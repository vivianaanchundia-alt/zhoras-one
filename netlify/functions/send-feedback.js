// ════════════════════════════════════════════════════════════════
// ZHORAS ONE — send-feedback.js
// Guarda el feedback del botón del header (Bloque 8.4.5) y notifica
// a info@zhorasone.com. La notificación NO pasa por _lib/emails.js:
// esa idempotencia es para correos únicos-por-siempre a un cliente
// (bienvenida, cancelación...); un usuario puede mandar feedback
// varias veces y Viviana debe enterarse todas las veces.
// ════════════════════════════════════════════════════════════════

const { verificarClerkJWT } = require('./_lib/clerk-jwt');
const { cabecerasCORS } = require('./_lib/cors');

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

exports.handler = async (event) => {
  const headers = cabecerasCORS(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const claims = await verificarClerkJWT(event);
  if (!claims) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'No autenticado' }) };
  }

  try {
    const { mensaje, modulo, anchoPantalla, userAgent, url } = JSON.parse(event.body || '{}');
    if (!mensaje || typeof mensaje !== 'string' || !mensaje.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mensaje vacío' }) };
    }

    const SB_URL     = process.env.SUPABASE_URL;
    const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
    if (!SB_URL || !SB_SERVICE) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuración incompleta' }) };
    }

    const mensajeLimpio = mensaje.trim().slice(0, 2000);
    const moduloLimpio  = typeof modulo === 'string' ? modulo.slice(0, 50) : null;

    // 1. Guardar en la tabla feedback (Bloque 0)
    const insRes = await fetch(`${SB_URL}/rest/v1/feedback`, {
      method: 'POST',
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresa_id:     claims.sub,
        clerk_user_id:  claims.sub,
        mensaje:        mensajeLimpio,
        modulo:         moduloLimpio,
        ancho_pantalla: Number.isFinite(anchoPantalla) ? anchoPantalla : null,
        user_agent:     typeof userAgent === 'string' ? userAgent.slice(0, 300) : null,
        url:            typeof url === 'string' ? url.slice(0, 300) : null,
      }),
    });
    if (!insRes.ok) {
      const err = await insRes.text();
      console.error('[send-feedback] Error Supabase:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'No se pudo guardar el feedback' }) };
    }

    // 2. Notificar por correo — nunca bloquea la respuesta.
    if (process.env.RESEND_API_KEY) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Zhoras One <notificaciones@zhorasone.com>',
          to: 'info@zhorasone.com',
          subject: '💬 Nuevo feedback en Zhoras One',
          html: `<p><strong>Módulo:</strong> ${esc(moduloLimpio || '—')}</p>`
              + `<p><strong>De:</strong> ${esc(claims.email || '—')} (${esc(claims.sub)})</p>`
              + `<p><strong>Pantalla:</strong> ${esc(anchoPantalla || '—')}px · ${esc(url || '—')}</p>`
              + `<p><strong>Mensaje:</strong></p><p>${esc(mensajeLimpio).replace(/\n/g, '<br>')}</p>`,
        }),
      }).catch(() => {});
    }

    // 3. Evento de producto (Bloque 8.2)
    fetch(`${SB_URL}/rest/v1/eventos`, {
      method: 'POST',
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa_id: claims.sub, clerk_user_id: claims.sub, evento: 'feedback_enviado', metadata: { modulo: moduloLimpio } }),
    }).catch(() => {});

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error('[send-feedback] Excepción:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno' }) };
  }
};

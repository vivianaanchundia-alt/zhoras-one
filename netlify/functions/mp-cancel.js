// ════════════════════════════════════════════════════════════════
// ZHORAS ONE — mp-cancel.js
// Netlify Function: cancela la suscripción activa del usuario logueado.
// La identidad SIEMPRE sale del JWT de Clerk verificado — el body NO
// lleva empresa_id (mismo patrón que mp-create.js, Bloque 0.5.3).
//
// Variables de entorno requeridas en Netlify:
//   MP_ACCESS_TOKEN       — token de producción de Mercado Pago
//   SUPABASE_URL          — URL del proyecto Supabase
//   SUPABASE_SERVICE_ROLE — service_role key (NUNCA en el frontend)
// ════════════════════════════════════════════════════════════════

const { verificarClerkJWT } = require('./_lib/clerk-jwt');
const { cabecerasCORS } = require('./_lib/cors');
const { enviarCorreo } = require('./_lib/emails');

exports.handler = async (event) => {
  const headers = cabecerasCORS(event);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  // ── AUTENTICACIÓN: la identidad viene del token, NUNCA del body ──
  const claims = await verificarClerkJWT(event);
  if (!claims) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'No autenticado' }) };
  }
  const empresaId = claims.sub;

  try {
    const { motivo } = JSON.parse(event.body || '{}');

    const MP_TOKEN   = process.env.MP_ACCESS_TOKEN;
    const SB_URL     = process.env.SUPABASE_URL;
    const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
    if (!MP_TOKEN || !SB_URL || !SB_SERVICE) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuración del servidor incompleta' }) };
    }

    // 1. Buscar la suscripción de ESTA empresa (nunca la del body)
    const suscRes = await fetch(
      `${SB_URL}/rest/v1/suscripciones?empresa_id=eq.${encodeURIComponent(empresaId)}&select=mp_preapproval_id,estado,current_period_end`,
      { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
    );
    const suscData = await suscRes.json();
    const susc = Array.isArray(suscData) ? suscData[0] : null;

    if (!susc || !susc.mp_preapproval_id) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No se encontró una suscripción activa para cancelar' }) };
    }
    if (susc.estado === 'cancelada') {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, yaEstaba: true }) };
    }

    // 2. Cancelar en Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${susc.mp_preapproval_id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${MP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (!mpRes.ok) {
      const mpErr = await mpRes.json().catch(() => ({}));
      console.error('[mp-cancel] Error MP:', mpErr);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'No se pudo cancelar en Mercado Pago' }) };
    }

    // 3. Actualizar Supabase. El webhook de MP (§3.1) también va a
    //    llegar y confirmar el mismo cambio — está bien que ambos
    //    caminos escriban lo mismo, es idempotente.
    const updRes = await fetch(
      `${SB_URL}/rest/v1/suscripciones?empresa_id=eq.${encodeURIComponent(empresaId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SB_SERVICE,
          Authorization: `Bearer ${SB_SERVICE}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          estado: 'cancelada',
          cancelada_en: new Date().toISOString(),
          motivo_cancelacion: (typeof motivo === 'string' ? motivo.slice(0, 500) : null),
          updated_at: new Date().toISOString(),
        }),
      }
    );
    if (!updRes.ok) {
      const err = await updRes.text();
      console.error('[mp-cancel] Error Supabase:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Se canceló en Mercado Pago pero no se pudo actualizar el estado. Se sincronizará solo en unos minutos.' }) };
    }

    // 4. Evento de producto (Bloque 8) — no crítico, nunca bloquea la respuesta.
    fetch(`${SB_URL}/rest/v1/eventos`, {
      method: 'POST',
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa_id: empresaId, evento: 'suscripcion_cancelada', metadata: { motivo: motivo || null } }),
    }).catch(() => {});

    // 5. Correo de confirmación (Bloque 7). claims.email ya viene
    //    verificado del JWT — no hace falta otra consulta. Nunca
    //    bloquea la respuesta: la cancelación ya se hizo, un fallo de
    //    correo no debe reportarse como error al usuario.
    if (claims.email) {
      const configRes = await fetch(
        `${SB_URL}/rest/v1/config?empresa_id=eq.${encodeURIComponent(empresaId)}&select=data&limit=1`,
        { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
      ).then(r => r.json()).catch(() => []);
      const idioma = configRes?.[0]?.data?.language === 'en' ? 'en' : 'es';
      const fechaAcceso = susc.current_period_end
        ? new Date(susc.current_period_end).toLocaleDateString(idioma === 'es' ? 'es-CL' : 'en-US', { day: 'numeric', month: 'long' })
        : null;
      enviarCorreo('suscripcion_cancelada', {
        empresaId, destinatario: claims.email, lang: idioma, fecha: fechaAcceso,
      }).catch(() => {});
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

  } catch (e) {
    console.error('[mp-cancel] Excepción:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno' }) };
  }
};

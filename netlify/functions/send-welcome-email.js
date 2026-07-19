// ════════════════════════════════════════════════════════════════
// ZHORAS ONE — send-welcome-email.js
// Dispara el correo de bienvenida (primer login). Llamado desde
// auth.js justo después de crear la empresa/trial — es la única forma
// de mandar un correo desde el navegador: la identidad SIEMPRE sale
// del JWT de Clerk verificado, nunca del body (mismo patrón que
// mp-create.js / mp-cancel.js, Bloque 0.5.3).
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

  const claims = await verificarClerkJWT(event);
  if (!claims) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'No autenticado' }) };
  }
  if (!claims.email) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, motivo: 'sin_email' }) };
  }

  try {
    const { nombre, lang } = JSON.parse(event.body || '{}');
    const r = await enviarCorreo('bienvenida', {
      empresaId:   claims.sub,
      destinatario: claims.email,
      nombre:      typeof nombre === 'string' ? nombre.slice(0, 100) : '',
      lang:        lang === 'en' ? 'en' : 'es',
    });
    return { statusCode: 200, headers, body: JSON.stringify(r) };
  } catch (e) {
    console.error('[send-welcome-email] Excepción:', e);
    // No bloquear el login por un fallo de correo.
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false }) };
  }
};

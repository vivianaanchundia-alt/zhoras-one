// ════════════════════════════════════════════════════════════════
// ZHORAS ONE — _lib/emails.js
// Envío de correos transaccionales vía Resend, con idempotencia
// contra la tabla emails_enviados (Bloque 0). Zoho Mail sigue siendo
// el correo humano de Viviana — esto es solo para automáticos.
//
// Helper interno (no es una Netlify Function pública) — lo consumen
// send-welcome-email.js, cron-trial.js, mp-webhook.js y mp-cancel.js.
//
// Variable de entorno requerida: RESEND_API_KEY.
// ════════════════════════════════════════════════════════════════

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM  = 'Zhoras One <notificaciones@zhorasone.com>';
const SITIO = process.env.URL_SITIO || 'https://zhorasone.com';

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Plantilla base compartida — HTML de tabla con estilos inline (los
// clientes de correo, sobre todo Gmail app, no soportan CSS externo
// ni la mayoría del CSS moderno).
function _wrapper(lang, tituloHtml, cuerpoHtml, ctaHref, ctaLabel) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:480px;width:100%;">
        <tr><td style="background:#0f172a;padding:24px 32px;">
          <span style="color:#ffffff;font-size:18px;font-weight:800;font-family:Arial,Helvetica,sans-serif;">Zhoras One</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;">${tituloHtml}</h1>
          <div style="font-size:14px;color:#374151;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">${cuerpoHtml}</div>
          ${ctaHref ? `<div style="margin-top:24px;"><a href="${ctaHref}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${ctaLabel}</a></div>` : ''}
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f9fafb;font-size:11px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;">
          Zhoras One · zhorasone.com<br/>
          ${lang === 'es' ? 'Si tienes preguntas, escríbenos a' : 'Questions? Email us at'} info@zhorasone.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── LAS 7 PLANTILLAS (§7.2) ───────────────────────────────────────
const TEMPLATES = {
  bienvenida: {
    es: { subject: '¡Bienvenido a Zhoras One! 🎉', build: d => _wrapper('es',
      `¡Bienvenido${d.nombre ? ', ' + esc(d.nombre) : ''}!`,
      `<p>Tienes 14 días de acceso completo al plan Empresa — todos los módulos, multi-sucursal, roles y auditoría.</p><p>El primer paso: sube tu archivo de ventas y en 2 minutos vas a ver tu negocio con claridad.</p>`,
      SITIO + '/dashboard.html', 'Subir mis datos') },
    en: { subject: 'Welcome to Zhoras One! 🎉', build: d => _wrapper('en',
      `Welcome${d.nombre ? ', ' + esc(d.nombre) : ''}!`,
      `<p>You have 14 days of full access to the Empresa plan — every module, multi-branch, roles and audit trail.</p><p>First step: upload your sales file and in 2 minutes you'll see your business clearly.</p>`,
      SITIO + '/dashboard.html', 'Upload my data') },
  },
  sin_datos_dia2: {
    es: { subject: 'Aún no has subido tus datos', build: d => _wrapper('es',
      'Te faltan 2 minutos para ver tu negocio claro',
      `<p>Hola${d.nombre ? ' ' + esc(d.nombre) : ''}, notamos que todavía no has subido ningún archivo a Zhoras One.</p><p>Sube tu Excel de ventas y automáticamente vas a ver KPIs, alertas y proyecciones — sin configurar nada.</p>`,
      SITIO + '/dashboard.html', 'Subir mi Excel') },
    en: { subject: "You haven't uploaded your data yet", build: d => _wrapper('en',
      "You're 2 minutes away from seeing your business clearly",
      `<p>Hi${d.nombre ? ' ' + esc(d.nombre) : ''}, we noticed you haven't uploaded any file to Zhoras One yet.</p><p>Upload your sales Excel and instantly see KPIs, alerts and projections — no setup needed.</p>`,
      SITIO + '/dashboard.html', 'Upload my Excel') },
  },
  trial_dia11: {
    es: { subject: 'Tu prueba termina en 3 días', build: d => _wrapper('es',
      'Quedan 3 días de tu prueba gratis',
      `<p>El ${esc(d.fecha)} termina tu acceso gratuito al plan Empresa. Elige un plan para no perder el acceso.</p>${d.recomendacion ? `<p><strong>Según tu uso, te recomendamos el plan ${esc(d.recomendacion)}.</strong></p>` : ''}<p>Tus datos se conservan 90 días pase lo que pase.</p>`,
      SITIO + '/dashboard.html', 'Elegir mi plan') },
    en: { subject: 'Your trial ends in 3 days', build: d => _wrapper('en',
      '3 days left in your free trial',
      `<p>On ${esc(d.fecha)} your free access to the Empresa plan ends. Choose a plan to keep your access.</p>${d.recomendacion ? `<p><strong>Based on your usage, we recommend the ${esc(d.recomendacion)} plan.</strong></p>` : ''}<p>Your data is kept for 90 days no matter what.</p>`,
      SITIO + '/dashboard.html', 'Choose my plan') },
  },
  trial_dia14: {
    es: { subject: 'Hoy es tu último día de prueba', build: d => _wrapper('es',
      'Hoy termina tu prueba gratis',
      `<p>Mañana tu cuenta pasa a modo solo lectura hasta que elijas un plan. Vas a seguir viendo tus datos, pero no vas a poder subir ni exportar.</p><p>Elige tu plan ahora y sigue sin interrupciones.</p>`,
      SITIO + '/dashboard.html', 'Elegir mi plan') },
    en: { subject: 'Today is the last day of your trial', build: d => _wrapper('en',
      'Your free trial ends today',
      `<p>Tomorrow your account switches to read-only mode until you choose a plan. You'll still see your data, but won't be able to upload or export.</p><p>Choose your plan now and keep going without interruption.</p>`,
      SITIO + '/dashboard.html', 'Choose my plan') },
  },
  suscripcion_activada: {
    es: { subject: '✅ Tu suscripción está activa', build: d => _wrapper('es',
      '¡Suscripción confirmada!',
      `<p>Tu plan ${esc(d.plan)} (${d.periodo === 'anual' ? 'anual' : 'mensual'}) ya está activo. Gracias por confiar en Zhoras One.</p><p>Puedes gestionar tu suscripción cuando quieras desde Configuración.</p>`,
      SITIO + '/dashboard.html', 'Ir a mi panel') },
    en: { subject: '✅ Your subscription is active', build: d => _wrapper('en',
      'Subscription confirmed!',
      `<p>Your ${esc(d.plan)} plan (${d.periodo === 'anual' ? 'annual' : 'monthly'}) is now active. Thanks for trusting Zhoras One.</p><p>You can manage your subscription anytime from Settings.</p>`,
      SITIO + '/dashboard.html', 'Go to my panel') },
  },
  pago_rechazado: {
    es: { subject: '⚠️ No se pudo procesar tu pago', build: d => _wrapper('es',
      'Hubo un problema con tu pago',
      `<p>Mercado Pago no pudo procesar el cobro de tu plan. Revisa que tu tarjeta tenga fondos o esté vigente, y vuelve a intentarlo desde Configuración.</p>`,
      SITIO + '/dashboard.html', 'Revisar mi suscripción') },
    en: { subject: '⚠️ We could not process your payment', build: d => _wrapper('en',
      'There was a problem with your payment',
      `<p>Mercado Pago couldn't process your plan's charge. Check that your card has funds and is valid, then try again from Settings.</p>`,
      SITIO + '/dashboard.html', 'Check my subscription') },
  },
  suscripcion_cancelada: {
    es: { subject: 'Tu suscripción fue cancelada', build: d => _wrapper('es',
      'Confirmamos tu cancelación',
      `<p>Tu suscripción quedó cancelada. Mantienes acceso hasta el ${esc(d.fecha || 'fin de tu período actual')}.</p><p>Tus datos se conservan 90 días — puedes reactivar cuando quieras.</p>`,
      SITIO + '/dashboard.html', 'Reactivar mi cuenta') },
    en: { subject: 'Your subscription was cancelled', build: d => _wrapper('en',
      'Cancellation confirmed',
      `<p>Your subscription has been cancelled. You keep access until ${esc(d.fecha || 'the end of your current period')}.</p><p>Your data is kept for 90 days — you can reactivate anytime.</p>`,
      SITIO + '/dashboard.html', 'Reactivate my account') },
  },
};

/**
 * Envía un correo transaccional, con idempotencia contra emails_enviados.
 * @param {string} tipo - una clave de TEMPLATES
 * @param {object} datos - { empresaId, destinatario, lang, ...variables }
 * NOTA — límite conocido: emails_enviados tiene unique(empresa_id, tipo),
 * pensado para los 4 correos de trial (uno por empresa en su vida). Para
 * los 3 recurrentes (activada/rechazado/cancelada) esto significa que
 * una empresa que reactiva después de cancelar NO recibirá un segundo
 * correo del mismo tipo — se acepta como límite conocido de este
 * lanzamiento, documentado aquí a propósito.
 * Nunca lanza — un fallo de correo no debe romper el flujo que lo dispara.
 */
async function enviarCorreo(tipo, datos) {
  const tpl = TEMPLATES[tipo];
  if (!tpl) { console.warn('[emails] Tipo desconocido:', tipo); return { ok: false }; }
  if (!RESEND_API_KEY) { console.warn('[emails] RESEND_API_KEY no configurada — correo no enviado'); return { ok: false }; }
  if (!datos || !datos.destinatario) { console.warn('[emails] Sin destinatario para', tipo); return { ok: false }; }

  const SB_URL     = process.env.SUPABASE_URL;
  const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

  try {
    // Idempotencia: si ya se envió este tipo a esta empresa, no repetir.
    if (SB_URL && SB_SERVICE && datos.empresaId) {
      const yaRes = await fetch(
        `${SB_URL}/rest/v1/emails_enviados?empresa_id=eq.${encodeURIComponent(datos.empresaId)}&tipo=eq.${encodeURIComponent(tipo)}&select=id`,
        { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
      );
      const ya = await yaRes.json().catch(() => null);
      if (Array.isArray(ya) && ya.length > 0) {
        return { ok: true, yaEnviado: true };
      }
    }

    const lang = datos.lang === 'en' ? 'en' : 'es';
    const t = tpl[lang];
    const html = t.build(datos);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: datos.destinatario, subject: t.subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[emails] Resend error:', err);
      return { ok: false };
    }

    if (SB_URL && SB_SERVICE && datos.empresaId) {
      await fetch(`${SB_URL}/rest/v1/emails_enviados`, {
        method: 'POST',
        headers: {
          apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`,
          'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates',
        },
        body: JSON.stringify({ empresa_id: datos.empresaId, destinatario: datos.destinatario, tipo }),
      }).catch(() => {});
    }

    return { ok: true };
  } catch (e) {
    console.error('[emails] Excepción enviando', tipo, ':', e.message);
    return { ok: false };
  }
}

module.exports = { enviarCorreo };

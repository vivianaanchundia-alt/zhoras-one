// ════════════════════════════════════════════════════════════════
// ZHORAS ONE — cron-trial.js
// Netlify Scheduled Function (diaria, ver [functions] en netlify.toml)
// Revisa las suscripciones en trial y dispara los recordatorios:
//   - sin_datos_dia2   (~12 días restantes, sin archivos subidos)
//   - trial_dia11      (3 días restantes)
//   - trial_dia14      (0 días restantes — último día)
//
// La idempotencia real la da _lib/emails.js (tabla emails_enviados):
// si el cron corre dos veces el mismo día, o dos días seguidos después
// de ya haber enviado, no duplica.
//
// Variables de entorno requeridas: SUPABASE_URL, SUPABASE_SERVICE_ROLE,
// RESEND_API_KEY (la usa _lib/emails.js).
// ════════════════════════════════════════════════════════════════

const { enviarCorreo } = require('./_lib/emails');

exports.handler = async () => {
  const SB_URL     = process.env.SUPABASE_URL;
  const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
  if (!SB_URL || !SB_SERVICE) {
    console.error('[cron-trial] Config incompleta');
    return { statusCode: 500, body: 'Config incompleta' };
  }
  const sbHeaders = { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` };

  try {
    const suscRes = await fetch(
      `${SB_URL}/rest/v1/suscripciones?estado=eq.trial&select=empresa_id,trial_ends_at`,
      { headers: sbHeaders }
    );
    const suscripciones = await suscRes.json();
    if (!Array.isArray(suscripciones)) {
      console.warn('[cron-trial] Respuesta inesperada de suscripciones');
      return { statusCode: 200, body: 'Sin suscripciones' };
    }

    let enviados = 0;

    for (const s of suscripciones) {
      if (!s.trial_ends_at) continue;
      const diasRestantes = Math.ceil((new Date(s.trial_ends_at) - Date.now()) / 86400000);

      // Determinar el tipo de correo ANTES de consultar más datos —
      // evita 3 fetch por cada empresa que no está en ninguna ventana.
      let tipo = null;
      if (diasRestantes === 3) tipo = 'trial_dia11';
      else if (diasRestantes <= 0) tipo = 'trial_dia14';
      // "día 2" se evalúa después de saber si ya subió archivos (abajo).

      const esVentanaDia2 = diasRestantes >= 11 && diasRestantes <= 12;
      if (!tipo && !esVentanaDia2) continue;

      const [usuarioRes, configRes, archivosRes] = await Promise.all([
        fetch(`${SB_URL}/rest/v1/usuarios_empresa?clerk_user_id=eq.${encodeURIComponent(s.empresa_id)}&select=email,nombre&limit=1`, { headers: sbHeaders }).then(r => r.json()).catch(() => []),
        fetch(`${SB_URL}/rest/v1/config?empresa_id=eq.${encodeURIComponent(s.empresa_id)}&select=data&limit=1`, { headers: sbHeaders }).then(r => r.json()).catch(() => []),
        esVentanaDia2
          ? fetch(`${SB_URL}/rest/v1/archivos?empresa_id=eq.${encodeURIComponent(s.empresa_id)}&select=id&limit=1`, { headers: sbHeaders }).then(r => r.json()).catch(() => [])
          : Promise.resolve(null),
      ]);

      if (esVentanaDia2 && !tipo) {
        const tieneArchivos = Array.isArray(archivosRes) && archivosRes.length > 0;
        if (!tieneArchivos) tipo = 'sin_datos_dia2';
      }
      if (!tipo) continue;

      const destinatario = usuarioRes?.[0]?.email;
      if (!destinatario) continue;

      const nombre = usuarioRes?.[0]?.nombre || '';
      const lang   = configRes?.[0]?.data?.language === 'en' ? 'en' : 'es';
      const fecha  = new Date(s.trial_ends_at).toLocaleDateString(lang === 'es' ? 'es-CL' : 'en-US', { day: 'numeric', month: 'long' });

      const r = await enviarCorreo(tipo, { nombre, fecha, lang, empresaId: s.empresa_id, destinatario });
      if (r.ok && !r.yaEnviado) enviados++;
    }

    console.log(`[cron-trial] ${suscripciones.length} suscripciones revisadas, ${enviados} correos enviados`);
    return { statusCode: 200, body: `OK — ${enviados} enviados` };
  } catch (e) {
    console.error('[cron-trial] Excepción:', e);
    return { statusCode: 500, body: 'Error' };
  }
};

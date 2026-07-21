// ════════════════════════════════════════════════════════════════
// ZHORAS ONE — mp-webhook.js
// Netlify Function: recibe las notificaciones de Mercado Pago cuando
// una suscripción cambia de estado, y actualiza la tabla suscripciones.
//
// Escribe en Supabase con service_role (salta RLS porque MP no es
// un usuario Clerk). La firma es OBLIGATORIA — sin excepciones — y
// el estado que se persiste sale siempre de una consulta a MP, nunca
// del body del webhook (que cualquiera puede intentar falsificar).
//
// Variables de entorno requeridas en Netlify:
//   MP_ACCESS_TOKEN       — para consultar el detalle del pago en MP
//   MP_WEBHOOK_SECRET     — secreto de firma del webhook (de MP)
//   SUPABASE_URL          — URL del proyecto Supabase
//   SUPABASE_SERVICE_ROLE — service_role key
// ════════════════════════════════════════════════════════════════

const crypto = require('crypto');
const { enviarCorreo } = require('./_lib/emails');

// Límites de usuarios por plan (deben coincidir con plans.js y con
// la landing — "hasta 10 usuarios" en Empresa, ver Bloque 3.7/4.3).
const MAX_USUARIOS = { emprendedor: 2, negocio: 5, empresa: 10 };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  try {
    const MP_TOKEN   = process.env.MP_ACCESS_TOKEN;
    const SECRET     = process.env.MP_WEBHOOK_SECRET;
    const SB_URL     = process.env.SUPABASE_URL;
    const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

    if (!MP_TOKEN || !SB_URL || !SB_SERVICE) {
      console.error('[mp-webhook] Config incompleta');
      return { statusCode: 500, body: 'Config incompleta' };
    }

    // ── 1. VERIFICAR FIRMA (obligatoria, sin excepciones) ────────
    if (!SECRET) {
      console.error('[mp-webhook] MP_WEBHOOK_SECRET ausente — rechazando');
      return { statusCode: 500, body: 'Config incompleta' };
    }

    const sig   = event.headers['x-signature']  || event.headers['X-Signature']  || '';
    const reqId = event.headers['x-request-id'] || event.headers['X-Request-Id'] || '';
    const parts = Object.fromEntries(
      sig.split(',').map(p => p.split('=').map(s => s.trim())).filter(p => p.length === 2)
    );
    const ts = parts.ts;
    const v1 = parts.v1;

    // ZO-007: parsear ANTES de validar la firma podía convertir un body
    // malformado en un 500 (fallo de infra) en vez de un 401 (petición
    // inválida) — sin riesgo de seguridad (la firma nunca se salta),
    // pero MP reintentaría un body basura como si fuera error nuestro.
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      console.warn('[mp-webhook] Body malformado — rechazando');
      return { statusCode: 401, body: 'Body inválido' };
    }
    const tipo   = body.type || body.topic;
    const dataId = (body.data && body.data.id) ? String(body.data.id) : '';

    // Rechazar si falta cualquier componente de la firma — antes esto
    // se ignoraba en silencio y el webhook seguía procesándose igual.
    if (!ts || !v1 || !dataId) {
      console.warn('[mp-webhook] Firma ausente o incompleta — rechazando');
      await _logSeguridad(SB_URL, SB_SERVICE, { tipo: tipo || null, recurso_id: dataId || null });
      return { statusCode: 401, body: 'Firma requerida' };
    }

    // Ventana de 5 minutos: corta los replays de firmas viejas.
    const edadSeg = Math.abs(Date.now() / 1000 - Number(ts));
    if (!Number.isFinite(edadSeg) || edadSeg > 300) {
      console.warn('[mp-webhook] ts fuera de rango:', ts);
      await _logSeguridad(SB_URL, SB_SERVICE, { tipo: tipo || null, recurso_id: dataId });
      return { statusCode: 401, body: 'Timestamp fuera de rango' };
    }

    const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', SECRET).update(manifest).digest('hex');

    // Comparación constant-time (evita timing attacks).
    const bufA = Buffer.from(hmac, 'utf8');
    const bufB = Buffer.from(v1, 'utf8');
    const firmaOK = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);

    if (!firmaOK) {
      console.warn('[mp-webhook] Firma inválida — rechazando');
      await _logSeguridad(SB_URL, SB_SERVICE, { tipo: tipo || null, recurso_id: dataId });
      return { statusCode: 401, body: 'Firma inválida' };
    }

    // ── 2. LEER LA NOTIFICACIÓN ─────────────────────────────────
    // Solo nos interesan suscripciones (preapproval) y pagos.
    if (tipo !== 'subscription_preapproval' && tipo !== 'preapproval' && tipo !== 'payment') {
      return { statusCode: 200, body: 'Ignorado (tipo no relevante)' };
    }

    const recursoId = dataId;

    // ── 2.5 IDEMPOTENCIA: cada webhook se procesa UNA sola vez ───
    // Sin esto, un webhook legítimo reenviado extiende el período
    // actual otros 30/365 días indefinidamente.
    const idempotencyKey = `${tipo}:${recursoId}`;
    const yaProcesados = await fetch(
      `${SB_URL}/rest/v1/webhooks_procesados?id=eq.${encodeURIComponent(idempotencyKey)}&select=id`,
      { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
    ).then(r => r.json()).catch(() => null);
    if (Array.isArray(yaProcesados) && yaProcesados.length > 0) {
      console.log('[mp-webhook] Duplicado ignorado:', idempotencyKey);
      return { statusCode: 200, body: 'Ya procesado' };
    }

    // ── 3. CONSULTAR EL DETALLE EN MERCADO PAGO ─────────────────
    // El estado que se persiste sale SIEMPRE de aquí, nunca del body
    // del webhook — regla que ya cumplía el código anterior y que no
    // se debe romper al ampliar los estados (§3.0.2).
    let detalle, externalRef, estadoMP;
    let mpPreapprovalId = null;

    if (tipo === 'payment') {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${recursoId}`, {
        headers: { Authorization: `Bearer ${MP_TOKEN}` },
      });
      detalle = await r.json();
      externalRef = detalle.external_reference;
      estadoMP = detalle.status; // approved, rejected, in_process, etc.
    } else {
      const r = await fetch(`https://api.mercadopago.com/preapproval/${recursoId}`, {
        headers: { Authorization: `Bearer ${MP_TOKEN}` },
      });
      detalle = await r.json();
      externalRef = detalle.external_reference;
      estadoMP = detalle.status; // authorized, paused, cancelled
      mpPreapprovalId = recursoId;
    }

    if (!externalRef || !externalRef.includes('::')) {
      return { statusCode: 200, body: 'Sin external_reference válido' };
    }

    // external_reference = "empresa_id::plan_id" (formato legacy) o
    // "empresa_id::plan_id::periodo" (formato actual).
    const refParts  = externalRef.split('::');
    const empresaId = refParts[0];
    const planId    = refParts[1];
    const periodo   = refParts[2] === 'anual' ? 'anual' : 'mensual';

    // ── 4. MAPEAR ESTADO DE MP → ESTADO INTERNO ──────────────────
    let nuevoEstado;
    let canceladaEn = null;
    if (estadoMP === 'authorized' || estadoMP === 'approved') {
      nuevoEstado = 'activa';
    } else if (estadoMP === 'paused') {
      nuevoEstado = 'pausada';
    } else if (estadoMP === 'cancelled') {
      nuevoEstado = 'cancelada';
      canceladaEn = new Date().toISOString();
    } else {
      // rejected, in_process, pending, etc.
      nuevoEstado = 'pago_fallido';
    }

    const maxUsuarios = MAX_USUARIOS[planId] || 1;
    const diasPeriodo = periodo === 'anual' ? 365 : 30;

    // ── 5. ACTUALIZAR SUPABASE (upsert, salta RLS con service_role) ─
    // Al cancelar, el acceso NO se corta de inmediato: el usuario pagó
    // hasta cierta fecha y tiene derecho a usarlo — por eso
    // current_period_end solo se recalcula cuando el estado es 'activa'.
    const upsertBody = {
      empresa_id: empresaId,
      estado: nuevoEstado,
      plan: (nuevoEstado === 'activa' || nuevoEstado === 'pausada' || nuevoEstado === 'cancelada') ? planId : 'trial',
      billing_period: periodo,
      mp_payment_id: String(recursoId),
      max_usuarios: (nuevoEstado === 'activa') ? maxUsuarios : 1,
      updated_at: new Date().toISOString(),
    };
    if (mpPreapprovalId) upsertBody.mp_preapproval_id = mpPreapprovalId;
    if (nuevoEstado === 'activa') {
      upsertBody.current_period_end = new Date(Date.now() + diasPeriodo * 24 * 60 * 60 * 1000).toISOString();
    }
    if (canceladaEn) upsertBody.cancelada_en = canceladaEn;

    const sbRes = await fetch(`${SB_URL}/rest/v1/suscripciones`, {
      method: 'POST',
      headers: {
        apikey: SB_SERVICE,
        Authorization: `Bearer ${SB_SERVICE}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates', // upsert por PK (empresa_id)
      },
      body: JSON.stringify(upsertBody),
    });

    if (!sbRes.ok) {
      const err = await sbRes.text();
      console.error('[mp-webhook] Error Supabase:', err);
      return { statusCode: 500, body: 'Error al actualizar suscripción' };
    }

    // ── 6. REGISTRAR IDEMPOTENCIA — DESPUÉS del upsert exitoso ───
    // Si esto falla, lo peor que pasa es reprocesar un webhook
    // (molesto, inocuo). Al revés perdería la activación de un pago real.
    await fetch(`${SB_URL}/rest/v1/webhooks_procesados`, {
      method: 'POST',
      headers: {
        apikey: SB_SERVICE,
        Authorization: `Bearer ${SB_SERVICE}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify({ id: idempotencyKey, empresa_id: empresaId, tipo, estado_mp: estadoMP }),
    }).catch(() => {});

    // ── 7. EVENTO DE PRODUCTO ─────────────────────────────────────
    if (nuevoEstado === 'activa') {
      await fetch(`${SB_URL}/rest/v1/eventos`, {
        method: 'POST',
        headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaId, evento: 'suscripcion_activa', metadata: { plan: planId, periodo } }),
      }).catch(() => {});
    }

    // ── 8. CORREO TRANSACCIONAL (Bloque 7) ────────────────────────
    // Nunca bloquea la respuesta del webhook — un fallo de correo no
    // debe hacer que MP reintente un webhook que sí se procesó bien.
    if (nuevoEstado === 'activa' || nuevoEstado === 'pago_fallido') {
      try {
        const usuarioRes = await fetch(
          `${SB_URL}/rest/v1/usuarios_empresa?clerk_user_id=eq.${encodeURIComponent(empresaId)}&select=email,nombre&limit=1`,
          { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
        ).then(r => r.json()).catch(() => []);
        const configRes = await fetch(
          `${SB_URL}/rest/v1/config?empresa_id=eq.${encodeURIComponent(empresaId)}&select=data&limit=1`,
          { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
        ).then(r => r.json()).catch(() => []);
        const destinatario = usuarioRes?.[0]?.email;
        if (destinatario) {
          const lang = configRes?.[0]?.data?.language === 'en' ? 'en' : 'es';
          const tipoCorreo = nuevoEstado === 'activa' ? 'suscripcion_activada' : 'pago_rechazado';
          await enviarCorreo(tipoCorreo, { empresaId, destinatario, lang, plan: planId, periodo });
        }
      } catch (e) {
        console.warn('[mp-webhook] No se pudo enviar el correo transaccional:', e.message);
      }
    }

    console.log(`[mp-webhook] Suscripción ${empresaId} → ${nuevoEstado} (${planId})`);
    return { statusCode: 200, body: 'OK' };

  } catch (e) {
    console.error('[mp-webhook] Excepción:', e);
    // 500, no 200 (CWE-754 / ZO-003): un 200 le dice a MP "ya procesado,
    // no reintentes" — si el fallo es nuestro (Supabase caído, etc.) la
    // activación de un pago real se pierde en silencio, sin reintento.
    // Los casos que sí son "nada que hacer" (evento irrelevante, sin
    // external_reference, ya procesado por idempotencia) devuelven 200
    // explícito arriba, antes de este catch — este solo cubre fallos
    // de infraestructura, donde el reintento automático de MP es la
    // red de seguridad correcta.
    return { statusCode: 500, body: 'Error interno' };
  }
};

// ── EVENTO DE SEGURIDAD: firma inválida ──────────────────────────
// Deja rastro en `eventos` (antes solo quedaba en console.warn, invisible
// fuera de los logs de Netlify). Nunca debe bloquear la respuesta del
// webhook ni filtrar la firma/token recibidos — solo identificadores.
async function _logSeguridad(SB_URL, SB_SERVICE, metadata) {
  try {
    await fetch(`${SB_URL}/rest/v1/eventos`, {
      method: 'POST',
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ evento: 'seguridad_firma_invalida', metadata }),
    });
  } catch (e) { /* nunca bloquear la respuesta del webhook por un fallo de log */ }
}

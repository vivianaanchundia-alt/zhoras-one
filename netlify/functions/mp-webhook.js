// ════════════════════════════════════════════════════════════════
// ZHORAS ONE — mp-webhook.js
// Netlify Function: recibe las notificaciones de Mercado Pago cuando
// un pago se aprueba/rechaza, y actualiza la tabla suscripciones.
//
// Escribe en Supabase con service_role (salta RLS porque MP no es
// un usuario Clerk). Verifica la firma para seguridad.
//
// Variables de entorno requeridas en Netlify:
//   MP_ACCESS_TOKEN       — para consultar el detalle del pago en MP
//   MP_WEBHOOK_SECRET     — secreto de firma del webhook (de MP)
//   SUPABASE_URL          — URL del proyecto Supabase
//   SUPABASE_SERVICE_ROLE — service_role key
// ════════════════════════════════════════════════════════════════

const crypto = require('crypto');

// Límites de usuarios por plan (deben coincidir con precios_planes)
const MAX_USUARIOS = { emprendedor: 2, negocio: 5, empresa: 999 };

exports.handler = async (event) => {
  // MP envía POST; responder rápido para no reintentar
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

    // ── 1. VERIFICAR FIRMA (seguridad) ──────────────────────────
    // MP envía x-signature: "ts=...,v1=hash". Validamos que es real.
    if (SECRET) {
      const sig = event.headers['x-signature'] || event.headers['X-Signature'] || '';
      const reqId = event.headers['x-request-id'] || event.headers['X-Request-Id'] || '';
      const parts = Object.fromEntries(sig.split(',').map(p => p.split('=').map(s => s.trim())));
      const ts = parts.ts;
      const v1 = parts.v1;

      const body = JSON.parse(event.body || '{}');
      const dataId = (body.data && body.data.id) ? body.data.id : '';

      if (ts && v1 && dataId) {
        const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`;
        const hmac = crypto.createHmac('sha256', SECRET).update(manifest).digest('hex');
        if (hmac !== v1) {
          console.warn('[mp-webhook] Firma inválida — ignorando');
          return { statusCode: 401, body: 'Firma inválida' };
        }
      }
    }

    // ── 2. LEER LA NOTIFICACIÓN ─────────────────────────────────
    const body = JSON.parse(event.body || '{}');
    const tipo = body.type || body.topic;

    // Solo nos interesan suscripciones (preapproval) y pagos
    if (tipo !== 'subscription_preapproval' && tipo !== 'preapproval' && tipo !== 'payment') {
      return { statusCode: 200, body: 'Ignorado (tipo no relevante)' };
    }

    const recursoId = body.data && body.data.id;
    if (!recursoId) return { statusCode: 200, body: 'Sin id' };

    // ── 3. CONSULTAR EL DETALLE EN MERCADO PAGO ─────────────────
    let detalle, externalRef, estadoMP;

    if (tipo === 'payment') {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${recursoId}`, {
        headers: { Authorization: `Bearer ${MP_TOKEN}` },
      });
      detalle = await r.json();
      externalRef = detalle.external_reference;
      estadoMP = detalle.status; // approved, rejected, etc.
    } else {
      const r = await fetch(`https://api.mercadopago.com/preapproval/${recursoId}`, {
        headers: { Authorization: `Bearer ${MP_TOKEN}` },
      });
      detalle = await r.json();
      externalRef = detalle.external_reference;
      estadoMP = detalle.status; // authorized, paused, cancelled
    }

    if (!externalRef || !externalRef.includes('::')) {
      return { statusCode: 200, body: 'Sin external_reference válido' };
    }

    // external_reference = "empresa_id::plan_id" (mensual, formato previo)
    // o "empresa_id::plan_id::periodo" (mensual|anual, formato actual).
    // Se mantiene compatibilidad con suscripciones ya creadas antes de
    // este cambio, que no tienen el tercer segmento.
    const refParts = externalRef.split('::');
    const empresaId = refParts[0];
    const planId    = refParts[1];
    const periodo    = refParts[2] === 'anual' ? 'anual' : 'mensual';

    // ── 4. DETERMINAR NUEVO ESTADO ──────────────────────────────
    const aprobado = (estadoMP === 'approved' || estadoMP === 'authorized');
    const nuevoEstado = aprobado ? 'activa' : 'vencida';
    const maxUsuarios = MAX_USUARIOS[planId] || 1;

    // Fin del período actual: +1 mes o +1 año desde ahora, según el
    // periodo contratado (antes: siempre +30 días, ignoraba anual).
    const diasPeriodo = periodo === 'anual' ? 365 : 30;
    const periodEnd = aprobado
      ? new Date(Date.now() + diasPeriodo * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // ── 5. ACTUALIZAR SUPABASE (upsert, salta RLS con service_role) ─
    const upsertBody = {
      empresa_id: empresaId,
      estado: nuevoEstado,
      plan: aprobado ? planId : 'trial',
      billing_period: periodo,
      mp_payment_id: String(recursoId),
      max_usuarios: aprobado ? maxUsuarios : 1,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    };

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

    console.log(`[mp-webhook] Suscripción ${empresaId} → ${nuevoEstado} (${planId})`);
    return { statusCode: 200, body: 'OK' };

  } catch (e) {
    console.error('[mp-webhook] Excepción:', e);
    // Responder 200 igual para que MP no reintente en loop por un error nuestro
    return { statusCode: 200, body: 'Error procesado' };
  }
};

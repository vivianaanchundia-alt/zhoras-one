// ════════════════════════════════════════════════════════════════
// ZHORAS ONE — mp-create.js
// Netlify Function: crea un link de suscripción en Mercado Pago.
// El frontend llama a esta función cuando el usuario elige un plan.
// Lee el precio real desde Supabase (tabla precios_planes).
//
// Variables de entorno requeridas en Netlify:
//   MP_ACCESS_TOKEN       — token de producción de Mercado Pago (APP_USR-...)
//   SUPABASE_URL          — URL del proyecto Supabase
//   SUPABASE_SERVICE_ROLE — service_role key (NUNCA en el frontend)
//   URL_SITIO             — https://zhoras.com (para el retorno tras pagar)
// ════════════════════════════════════════════════════════════════

exports.handler = async (event) => {
  // CORS + método
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const { plan_id, empresa_id, email, billing_period } = JSON.parse(event.body || '{}');
    const period = billing_period === 'anual' ? 'anual' : 'mensual'; // default seguro: mensual

    // Validación de entrada
    if (!plan_id || !empresa_id || !email) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan datos (plan_id, empresa_id, email)' }) };
    }
    if (!['emprendedor', 'negocio', 'empresa'].includes(plan_id)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Plan inválido' }) };
    }

    const MP_TOKEN   = process.env.MP_ACCESS_TOKEN;
    const SB_URL     = process.env.SUPABASE_URL;
    const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
    const SITIO      = process.env.URL_SITIO || 'https://zhoras.com';

    if (!MP_TOKEN || !SB_URL || !SB_SERVICE) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuración del servidor incompleta' }) };
    }

    // 1. Leer el precio real desde Supabase (fuente única de verdad)
    const precioRes = await fetch(
      `${SB_URL}/rest/v1/precios_planes?plan_id=eq.${plan_id}&activo=eq.true&select=precio_clp,precio_clp_anual,nombre`,
      { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
    );
    const precios = await precioRes.json();
    if (!Array.isArray(precios) || precios.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Plan no encontrado en precios' }) };
    }
    // Precio anual con fallback a 10x el mensual (2 meses gratis) por si la
    // columna aún no fue migrada en Supabase.
    const precioMensual = precios[0].precio_clp;
    const precioAnual   = precios[0].precio_clp_anual || Math.round(precioMensual * 10);
    const precio        = period === 'anual' ? precioAnual : precioMensual;
    const nombrePlan    = precios[0].nombre;

    // 2. Crear la suscripción (preapproval) en Mercado Pago
    // reason = nombre visible; auto_recurring = cobro automático según periodo.
    // Anual = suscripción recurrente que se renueva cada 12 meses (no es
    // pago único): sigue generando caja el año siguiente.
    const mpBody = {
      reason: `Zhoras One — Plan ${nombrePlan} (${period === 'anual' ? 'Anual' : 'Mensual'})`,
      auto_recurring: {
        frequency: period === 'anual' ? 12 : 1,
        frequency_type: 'months',
        transaction_amount: precio,
        currency_id: 'CLP',
      },
      payer_email: email,
      back_url: `${SITIO}/dashboard.html?suscripcion=ok`,
      status: 'pending',
      // external_reference vincula el pago con la empresa y el periodo en el webhook
      external_reference: `${empresa_id}::${plan_id}::${period}`,
    };

    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mpBody),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error('[mp-create] Error MP:', mpData);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'No se pudo crear la suscripción', detalle: mpData.message || '' }) };
    }

    // 3. Devolver el link de pago al frontend
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        init_point: mpData.init_point,     // URL a la que redirigir al usuario
        preapproval_id: mpData.id,
      }),
    };

  } catch (e) {
    console.error('[mp-create] Excepción:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno', detalle: e.message }) };
  }
};

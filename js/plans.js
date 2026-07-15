// ════════════════════════════════════════════════════════════════
// ZHORAS ONE — plans.js
// Fuente única de permisos por plan de suscripción.
// Toda la lógica de qué puede ver cada plan vive aquí.
// auth.js y dashboard.html leen de este objeto.
// ════════════════════════════════════════════════════════════════

const plans = (() => {

  // ── DEFINICIÓN DE PLANES ────────────────────────────────────
  // PERMISOS (módulos, roles) = lógica fija, viven aquí.
  // PRECIOS = cambian con el dólar, se cargan de Supabase (tabla
  // precios_planes) vía storage.preload(). Aquí quedan como fallback.
  const _preciosCache = {}; // plan_id → { precio_clp, precio_usd, max_usuarios }

  // Precios de respaldo (si Supabase no responde). Se sobreescriben
  // con los valores reales de la tabla precios_planes al cargar.
  const PRECIOS_FALLBACK = {
    emprendedor: { precio_clp: 16900, precio_usd: 17.99, precio_clp_anual: 169000, precio_usd_anual: 179.90, max_usuarios: 2 },
    negocio:     { precio_clp: 28900, precio_usd: 29.99, precio_clp_anual: 289000, precio_usd_anual: 299.90, max_usuarios: 5 },
    empresa:     { precio_clp: 56900, precio_usd: 59.99, precio_clp_anual: 569000, precio_usd_anual: 599.90, max_usuarios: 999 },
  };

  const PLANES = {
    trial: {
      nombre:      'Trial',
      precio:      0,
      maxUsuarios: 1,
      modulos:     'all',       // trial muestra TODO para enamorar
      export:      true,
      roles:       false,
      auditoria:   false,
      multiSucursal: false,
    },
    emprendedor: {
      nombre:      'Emprendedor',
      precio:      17.99,
      maxUsuarios: 2,
      // Excluye: finance, collections (los módulos gancho de upgrade)
      modulos:     ['home','summary','sales','clients','support',
                    'inventory','marketing','margin','team','cx',
                    'projections','suppliers','goals'],
      export:      false,       // export PDF solo desde Negocio
      roles:       false,
      auditoria:   false,
      multiSucursal: false,
      bloqueados:  ['finance','collections'], // se muestran con 🔒
      upgrade_msg_es: 'Finanzas y Cobranzas están incluidos en el plan Negocio',
      upgrade_msg_en: 'Finance and Collections are included in the Negocio plan',
    },
    negocio: {
      nombre:      'Negocio',
      precio:      29.99,
      maxUsuarios: 5,
      modulos:     'all',
      export:      true,
      roles:       true,        // Dueño/Asistente/Jefe de Área
      auditoria:   true,
      multiSucursal: false,
      bloqueados:  [],
    },
    empresa: {
      nombre:      'Empresa',
      precio:      59.99,
      maxUsuarios: Infinity,
      modulos:     'all',
      export:      true,
      roles:       true,
      auditoria:   true,
      multiSucursal: true,
      bloqueados:  [],
    },
  };

  // Lista completa de módulos del sistema
  const ALL_MODULES = [
    'home','summary','sales','clients','support','inventory',
    'marketing','finance','team','cx','projections','collections',
    'suppliers','margin','goals',
  ];

  // ── LEER PLAN ACTIVO ────────────────────────────────────────
  // Lee de localStorage (espejo de Supabase cargado en preload).
  // Si no hay plan → trial (nunca bloquea en prueba gratuita).
  function getPlanActivo() {
    try {
      const raw = localStorage.getItem('clarokpis_plan');
      const data = raw ? JSON.parse(raw) : null;
      if (!data) return 'trial';
      // Si el trial venció → degradar a emprendedor (sin pago activo)
      if (data.estado === 'trial' && data.trial_ends_at) {
        const ends = new Date(data.trial_ends_at);
        if (ends < new Date()) return 'vencido';
      }
      return data.plan || 'trial';
    } catch { return 'trial'; }
  }

  // ── API ──────────────────────────────────────────────────────

  // ── PRECIOS (desde Supabase con fallback) ───────────────────
  // storage.preload() llama a setPrecios() con los datos de la tabla.
  function setPrecios(rows) {
    if (!Array.isArray(rows)) return;
    rows.forEach(r => {
      _preciosCache[r.plan_id] = {
        precio_clp:        r.precio_clp,
        precio_usd:        r.precio_usd,
        precio_clp_anual:  r.precio_clp_anual,
        precio_usd_anual:  r.precio_usd_anual,
        max_usuarios:      r.max_usuarios,
      };
    });
  }

  function getPrecio(planId) {
    const p = _preciosCache[planId] || PRECIOS_FALLBACK[planId];
    return p ? p.precio_clp : 0;
  }

  function getPrecioUSD(planId) {
    const p = _preciosCache[planId] || PRECIOS_FALLBACK[planId];
    return p ? p.precio_usd : 0;
  }

  // ── PRECIO ANUAL (2 meses gratis) ────────────────────────────
  // Fallback: si Supabase aún no tiene la columna migrada, calcula
  // 10x el mensual (mismo criterio que mp-create.js en el backend).
  function getPrecioAnual(planId) {
    const p = _preciosCache[planId] || PRECIOS_FALLBACK[planId];
    if (p?.precio_clp_anual) return p.precio_clp_anual;
    return Math.round(getPrecio(planId) * 10);
  }

  function getPrecioAnualUSD(planId) {
    const p = _preciosCache[planId] || PRECIOS_FALLBACK[planId];
    if (p?.precio_usd_anual) return p.precio_usd_anual;
    return Math.round(getPrecioUSD(planId) * 10 * 100) / 100;
  }

  // % de ahorro del anual vs. pagar 12 meses al precio mensual.
  function getAhorroAnualPct(planId) {
    const mensualX12 = getPrecioUSD(planId) * 12;
    const anual       = getPrecioAnualUSD(planId);
    if (!mensualX12) return 0;
    return Math.round((1 - anual / mensualX12) * 100);
  }

  // Periodo de facturación de la suscripción activa ('mensual'|'anual').
  // Espejo local de Supabase, seteado por setPlanLocal() en storage.js.
  function getBillingPeriodActivo() {
    try {
      const raw = localStorage.getItem('clarokpis_plan');
      const data = raw ? JSON.parse(raw) : null;
      return data?.billing_period === 'anual' ? 'anual' : 'mensual';
    } catch { return 'mensual'; }
  }

  function getMaxUsuarios(planId) {
    const p = _preciosCache[planId] || PRECIOS_FALLBACK[planId];
    if (p) return p.max_usuarios;
    return getPlan(planId).maxUsuarios;
  }

  function getPlan(planId) {
    return PLANES[planId] || PLANES.trial;
  }

  // Módulos que el plan PUEDE ver (array de ids)
  function getModulosPermitidos(planId) {
    const p = getPlan(planId);
    if (p.modulos === 'all') return [...ALL_MODULES];
    return p.modulos;
  }

  // Módulos que el plan tiene BLOQUEADOS (para mostrar 🔒)
  function getModulosBloqueados(planId) {
    const p = getPlan(planId);
    return p.bloqueados || [];
  }

  // ¿Este plan puede exportar PDF?
  function canExport(planId) { return getPlan(planId).export; }

  // ¿Este plan tiene roles de usuario?
  function hasRoles(planId) { return getPlan(planId).roles; }

  // ¿Este plan tiene auditoría?
  function hasAuditoria(planId) { return getPlan(planId).auditoria; }

  // Mensaje de upgrade para módulo bloqueado
  function getUpgradeMsg(planId, lang) {
    const p = getPlan(planId);
    return lang === 'en' ? (p.upgrade_msg_en || 'Upgrade your plan to access this module')
                         : (p.upgrade_msg_es || 'Mejora tu plan para acceder a este módulo');
  }

  // Guardar plan en localStorage (llamado desde preload de storage.js)
  function setPlanLocal(data) {
    localStorage.setItem('clarokpis_plan', JSON.stringify(data));
  }

  return {
    PLANES,
    ALL_MODULES,
    getPlanActivo,
    getPlan,
    getModulosPermitidos,
    getModulosBloqueados,
    canExport,
    hasRoles,
    hasAuditoria,
    getUpgradeMsg,
    setPlanLocal,
    setPrecios,
    getPrecio,
    getPrecioUSD,
    getPrecioAnual,
    getPrecioAnualUSD,
    getAhorroAnualPct,
    getBillingPeriodActivo,
    getMaxUsuarios,
  };

})();

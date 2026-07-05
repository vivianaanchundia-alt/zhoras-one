// ════════════════════════════════════════════════════════════════
// ZHORAS ONE — plans.js
// Fuente única de permisos por plan de suscripción.
// Toda la lógica de qué puede ver cada plan vive aquí.
// auth.js y dashboard.html leen de este objeto.
// ════════════════════════════════════════════════════════════════

const plans = (() => {

  // ── DEFINICIÓN DE PLANES ────────────────────────────────────
  // Módulos bloqueados por plan (los que NO incluye).
  // 'all' = todos los módulos disponibles.
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
  };

})();

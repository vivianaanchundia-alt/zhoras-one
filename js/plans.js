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
    // max_usuarios pasa de 999 a 10: la landing promete "hasta 10
    // usuarios" (Bloque 4.3), no ilimitados — coordinar con la columna
    // real en Supabase (precios_planes.max_usuarios), que también debe
    // decir 10 para 'empresa'.
    empresa:     { precio_clp: 56900, precio_usd: 59.99, precio_clp_anual: 569000, precio_usd_anual: 599.90, max_usuarios: 10 },
  };

  // D6 — el trial otorga TODAS las capacidades del plan Empresa, con
  // una única salvedad deliberada (informesEmail: false — es la única
  // función visible pero no entregada durante el trial). Antes el
  // trial tenía multiSucursal:false y roles:false, lo que le ocultaba
  // a un cliente de 2-4 sucursales (el target del producto) la función
  // que más necesitaba probar.
  //
  // D5 — exportación disponible en TODOS los planes, diferenciada por
  // marca de agua. Antes trial.export=true pero emprendedor.export=
  // false: un usuario exportaba 14 días gratis y al suscribirse a
  // Emprendedor PERDÍA la función — cancelación garantizada.
  const PLANES = {
    trial: {
      nombre:         'Prueba',
      precio:         0,
      maxUsuarios:    3,          // invitar contadora + jefe de local
      modulos:        'all',
      export:         true,
      exportMarcaAgua: true,
      roles:          true,
      auditoria:      true,
      multiSucursal:  true,
      historicoMeses: null,       // ilimitado
      informesEmail:  false,      // única función visible pero no entregada
      _equivalente:   'empresa',
    },
    emprendedor: {
      nombre:      'Emprendedor',
      precio:      17.99,
      maxUsuarios: 2,
      // Excluye: finance, collections (los módulos gancho de upgrade)
      modulos:     ['home','summary','sales','clients','support',
                    'inventory','marketing','margin','team','cx',
                    'projections','suppliers','goals'],
      export:         true,       // antes false — ver D5 arriba
      exportMarcaAgua: true,
      roles:          false,
      auditoria:      false,
      multiSucursal:  false,
      historicoMeses: 12,
      informesEmail:  false,
      bloqueados:  ['finance','collections'], // se muestran con 🔒
      upgrade_msg_es: 'Finanzas y Cobranzas están incluidos en el plan Negocio',
      upgrade_msg_en: 'Finance and Collections are included in the Negocio plan',
    },
    negocio: {
      nombre:      'Negocio',
      precio:      29.99,
      maxUsuarios: 5,
      modulos:     'all',
      export:         true,
      exportMarcaAgua: false,
      roles:          true,        // Dueño/Asistente/Jefe de Área
      auditoria:      true,
      multiSucursal:  false,
      historicoMeses: 24,
      informesEmail:  'mensual',
      bloqueados:  [],
    },
    empresa: {
      nombre:      'Empresa',
      precio:      59.99,
      maxUsuarios: 10,            // antes Infinity — landing dice "hasta 10"
      modulos:     'all',
      export:         true,
      exportMarcaAgua: false,
      roles:          true,
      auditoria:      true,
      multiSucursal:  true,
      historicoMeses: null,       // ilimitado
      informesEmail:  'semanal',
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
      // Si el trial venció → 'vencido' (bloquea escritura, Bloque 3.6).
      // trial_ends_at viene de Supabase, calculado por el servidor
      // (Bloque 2/5) — nunca se calcula en el navegador.
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
    // 'vencido' no es una clave de PLANES: cae al fallback trial, que
    // como equivale a Empresa (D6) sigue mostrando TODOS los módulos —
    // exactamente lo que pide el gate de solo-lectura (Bloque 3.6): el
    // usuario ve su layout completo, pero subir/exportar/configurar se
    // bloquean con un chequeo explícito de getPlanActivo()==='vencido'
    // en cada acción de escritura, no aquí (canExport/hasRoles no deben
    // devolver true para un plan vencido).
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

  // ── D5: marca de agua en exportación ─────────────────────────
  function tieneMarcaAgua(planId) { return !!getPlan(planId).exportMarcaAgua; }

  // ── Límite de histórico (filtro de fecha, no borra datos) ────
  function getHistoricoMeses(planId) {
    const v = getPlan(planId).historicoMeses;
    return (v === null || v === undefined) ? null : v;
  }

  // ── Informes automáticos por correo (Bloque 7) ───────────────
  function getInformesEmail(planId) { return getPlan(planId).informesEmail || false; }

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

  // Datos crudos de la suscripción (espejo de la fila de Supabase que
  // guardó setPlanLocal en preload) — usado por el panel de suscripción
  // (Bloque 3.3) para mostrar próximo cobro / días de trial restantes.
  function getSuscripcionRaw() {
    try {
      const raw = localStorage.getItem('clarokpis_plan');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  // Días restantes de trial (0 si ya venció, null si no aplica).
  function getDiasTrialRestantes() {
    const s = getSuscripcionRaw();
    if (s.estado !== 'trial' || !s.trial_ends_at) return null;
    const ms = new Date(s.trial_ends_at) - new Date();
    return Math.max(0, Math.ceil(ms / 86400000));
  }

  // ── D7: RECOMENDADOR DE PLAN SEGÚN USO REAL ──────────────────
  // Cantidad de usuarios activos del equipo. El multiusuario real
  // (invitaciones) queda fuera de este lanzamiento (§12) — mientras no
  // exista esa UI, siempre hay 1 usuario (el owner) y esta señal nunca
  // dispara. Se deja resuelta para cuando el Bloque de invitaciones
  // exista: solo hay que llamar a setEquipoCount(n) con el valor real.
  let _equipoCount = 1;
  function setEquipoCount(n) { _equipoCount = Number(n) || 1; }

  function _sucursalesDetectadas() {
    if (typeof storage === 'undefined' || !storage.getData) return new Set();
    const campos = ['sales','clients','finance','inventory'];
    const set = new Set();
    campos.forEach(m => (storage.getData(m) || []).forEach(r => { if (r.Sucursal) set.add(r.Sucursal); }));
    return set;
  }

  function _usaFinanzasOCobranzas() {
    if (typeof storage === 'undefined' || !storage.getData) return false;
    return (storage.getData('finance') || []).length > 0 || (storage.getData('collections') || []).length > 0;
  }

  // Devuelve { plan, razones: [{es,en}] }. Se toma el plan más ALTO
  // entre todas las señales detectadas.
  function recomendarPlan() {
    const razones = [];
    let nivel = 1; // 1=emprendedor, 2=negocio, 3=empresa

    const sucursales = _sucursalesDetectadas();
    if (sucursales.size > 1) {
      nivel = 3;
      razones.push({
        es: `Detectamos ${sucursales.size} sucursales en tus datos`,
        en: `We detected ${sucursales.size} branches in your data`,
      });
    }

    if (_equipoCount > 5) {
      nivel = 3;
      razones.push({ es: `Tu equipo tiene ${_equipoCount} usuarios`, en: `Your team has ${_equipoCount} users` });
    } else if (_equipoCount >= 3 && nivel < 2) {
      nivel = 2;
      razones.push({ es: `Tu equipo tiene ${_equipoCount} usuarios`, en: `Your team has ${_equipoCount} users` });
    }

    if (_usaFinanzasOCobranzas() && nivel < 2) {
      nivel = 2;
      razones.push({ es: 'Usas Finanzas y/o Cobranzas', en: 'You use Finance and/or Collections' });
    }

    const planId = nivel === 3 ? 'empresa' : nivel === 2 ? 'negocio' : 'emprendedor';
    if (!razones.length) {
      razones.push({ es: 'Tu uso actual cabe en el plan Emprendedor', en: 'Your current usage fits the Emprendedor plan' });
    }
    return { plan: planId, razones };
  }

  // Avisos de degradación: qué pierde el usuario si elige un plan MENOR
  // al recomendado. Se muestran ANTES del checkout — nunca después de
  // pagar. Los datos fuera de límite no se borran, solo dejan de verse.
  function getAvisosDegradacion(planElegidoId, recomendacion) {
    const jerarquia = { emprendedor: 1, negocio: 2, empresa: 3 };
    if ((jerarquia[planElegidoId] || 1) >= (jerarquia[recomendacion?.plan] || 1)) return [];

    const elegido = getPlan(planElegidoId);
    const avisos = [];

    const sucursales = _sucursalesDetectadas();
    if (sucursales.size > 1 && !elegido.multiSucursal) {
      avisos.push({
        es: `Tus datos incluyen ${sucursales.size} sucursales. Este plan analiza solo una.`,
        en: `Your data includes ${sucursales.size} branches. This plan analyzes only one.`,
      });
    }

    const bloqueados = elegido.bloqueados || [];
    if (bloqueados.includes('finance') || bloqueados.includes('collections')) {
      avisos.push({
        es: 'Perderás acceso a Finanzas y Cobranzas.',
        en: "You'll lose access to Finance and Collections.",
      });
    }

    if (_equipoCount > elegido.maxUsuarios) {
      const extra = _equipoCount - elegido.maxUsuarios;
      avisos.push({
        es: `${extra} usuario${extra > 1 ? 's' : ''} de tu equipo perderá${extra > 1 ? 'n' : ''} acceso.`,
        en: `${extra} team member${extra > 1 ? 's' : ''} will lose access.`,
      });
    }

    if (elegido.historicoMeses) {
      avisos.push({
        es: `Tu histórico se limitará a los últimos ${elegido.historicoMeses} meses.`,
        en: `Your history will be limited to the last ${elegido.historicoMeses} months.`,
      });
    }

    return avisos;
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
    tieneMarcaAgua,
    getHistoricoMeses,
    getInformesEmail,
    getUpgradeMsg,
    setPlanLocal,
    getSuscripcionRaw,
    getDiasTrialRestantes,
    setPrecios,
    getPrecio,
    getPrecioUSD,
    getPrecioAnual,
    getPrecioAnualUSD,
    getAhorroAnualPct,
    getBillingPeriodActivo,
    getMaxUsuarios,
    recomendarPlan,
    getAvisosDegradacion,
    setEquipoCount,
  };

})();

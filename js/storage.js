// ════════════════════════════════════════════════════════════════
// ZHORAS ONE — storage.js v2.0 (Supabase backend)
// Capa unificada de datos: Supabase (nube) con caché-first síncrono.
// API pública 100% síncrona e IDÉNTICA a v1 — los módulos NO cambian.
// Patrón: preload() carga todo a memoria (async, 1 vez); las lecturas
// son síncronas desde caché; las escrituras sincronizan en segundo plano.
// ════════════════════════════════════════════════════════════════

const storage = (() => {

  // ── CONFIGURACIÓN SUPABASE ──────────────────────────────────
  // Estas dos constantes se inyectan en producción (ver más abajo
  // _initSupabase). En local/demo sin credenciales, cae a localStorage.
  const SUPABASE_URL  = window.__SUPABASE_URL__  || '';
  const SUPABASE_ANON  = window.__SUPABASE_ANON__ || '';
  let   _sb            = null;   // cliente Supabase (o null → modo local)
  let   _empresaId     = null;   // id del usuario logueado (Clerk sub)
  let   _sbReady       = false;  // Supabase conectado y datos precargados

  // ── CONSTANTES ──────────────────────────────────────────────
  const WORKSPACE_ID = 'default';           // eslint-disable-line no-unused-vars
  const LS_PREFIX  = 'clarokpis_';          // preservado (no romper datos locales)
  const IDB_NAME   = 'clarokpis_data';
  const IDB_VER    = 3;
  const MODULES    = ['sales','clients','support','inventory',
                      'marketing','finance','team','cx','suppliers','collections'];

  // ── ESTADO INTERNO ──────────────────────────────────────────
  let _db          = null;        // instancia IndexedDB (fallback local)
  let _ready       = false;
  let _initPromise = null;

  // Cache de KPIs: module+filtros → { result, ts }
  const _cache = new Map();
  const CACHE_TTL = 30000; // 30 segundos

  // ── CLIENTE SUPABASE (carga diferida del SDK) ───────────────
  async function _initSupabase() {
    if (!SUPABASE_URL || !SUPABASE_ANON) return false; // sin credenciales → modo local
    try {
      // Cargar SDK de Supabase desde CDN si no está presente
      if (!window.supabase) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      // Obtener el token JWT de Clerk para autenticar con Supabase (RLS)
      let clerkToken = null;
      try {
        if (window.Clerk && window.Clerk.session) {
          clerkToken = await window.Clerk.session.getToken({ template: 'supabase' });
        }
      } catch (e) { /* sin sesión Clerk → demo/local */ }

      _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
        global: clerkToken ? { headers: { Authorization: `Bearer ${clerkToken}` } } : {},
        auth: { persistSession: false },
      });

      // empresa_id = el 'sub' del usuario Clerk (aislamiento RLS)
      _empresaId = (window.Clerk && window.Clerk.user) ? window.Clerk.user.id : null;
      return !!_empresaId;
    } catch (e) {
      console.warn('[storage] Supabase init falló, usando modo local:', e);
      _sb = null;
      return false;
    }
  }

  // ── INICIALIZACIÓN IDB (fallback local / demo) ──────────────
  function init() {
    if (_initPromise) return _initPromise;
    _initPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('[storage] IndexedDB no disponible — usando fallback localStorage');
        _ready = false;
        resolve(false);
        return;
      }
      const req = indexedDB.open(IDB_NAME, IDB_VER);

      req.onupgradeneeded = e => {
        const db = e.target.result;
        MODULES.forEach(mod => {
          if (!db.objectStoreNames.contains(mod)) {
            const store = db.createObjectStore(mod, { keyPath: '_id', autoIncrement: true });
            store.createIndex('Fecha',      'Fecha',      { unique: false });
            store.createIndex('fileId',     'fileId',     { unique: false });
            store.createIndex('Vendedor',   'Vendedor',   { unique: false });
            store.createIndex('Sucursal',   'Sucursal',   { unique: false });
            store.createIndex('Canal_Venta','Canal_Venta',{ unique: false });
            store.createIndex('Cliente_ID', 'Cliente_ID', { unique: false });
          }
        });
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
      };

      req.onsuccess = e => {
        _db    = e.target.result;
        _ready = true;

        // Migrar datos existentes en localStorage → IDB (primera vez)
        _migrateFromLS().then(() => resolve(true));
      };

      req.onerror = () => {
        console.error('[storage] Error abriendo IndexedDB:', req.error);
        _ready = false;
        resolve(false); // degradar a localStorage, no rechazar
      };
    });
    return _initPromise;
  }

  // ── MIGRACIÓN localStorage → IndexedDB (una sola vez) ───────
  async function _migrateFromLS() {
    const migrated = ls.get('idb_migrated');
    if (migrated) return;

    for (const mod of MODULES) {
      const rows = ls.get('data_' + mod);
      if (rows && Array.isArray(rows) && rows.length > 0) {
        try {
          await _idbAddRows(mod, rows);
          ls.del('data_' + mod); // limpiar LS después de migrar
        } catch(e) {
          console.warn('[storage] Error migrando', mod, e);
        }
      }
    }
    ls.set('idb_migrated', true);
  }

  // ── CAPA localStorage (config, metas, alertas, archivos) ────
  const ls = {
    set: (k, v)  => { try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch(e) { console.warn('[ls.set]', k, e); } },
    get: (k)     => { try { const v = localStorage.getItem(LS_PREFIX + k); return v ? JSON.parse(v) : null; } catch { return null; } },
    del: (k)     => localStorage.removeItem(LS_PREFIX + k),
    keys: ()     => Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX)).map(k => k.slice(LS_PREFIX.length)),
    bytes: ()    => { try { return new Blob(Object.values(localStorage)).size; } catch { return 0; } }
  };

  // ── CAPA IndexedDB — operaciones internas ───────────────────
  async function _idbAddRows(module, rows) {
    if (!_db) return 0;
    return new Promise((resolve, reject) => {
      const tx    = _db.transaction(module, 'readwrite');
      const store = tx.objectStore(module);
      let count   = 0;
      rows.forEach(r => {
        const req = store.add(r);
        req.onsuccess = () => count++;
      });
      tx.oncomplete = () => resolve(count);
      tx.onerror    = () => reject(tx.error);
    });
  }

  async function _idbGetRows(module, filters = {}) {
    if (!_db) return ls.get('data_' + module) || [];
    return new Promise((resolve, reject) => {
      const tx    = _db.transaction(module, 'readonly');
      const store = tx.objectStore(module);
      const rows  = [];
      const req   = store.openCursor();
      req.onsuccess = e => {
        const c = e.target.result;
        if (!c) { resolve(rows); return; }
        if (_passesFilters(c.value, filters)) rows.push(c.value);
        c.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function _idbDeleteByFileId(module, fileId) {
    if (!_db) return;
    return new Promise((resolve, reject) => {
      const tx    = _db.transaction(module, 'readwrite');
      const store = tx.objectStore(module);
      const index = store.index('fileId');
      const req   = index.openCursor(IDBKeyRange.only(fileId));
      req.onsuccess = e => {
        const c = e.target.result;
        if (!c) { resolve(); return; }
        c.delete(); c.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function _idbCount(module) {
    if (!_db) return (ls.get('data_' + module) || []).length;
    return new Promise(resolve => {
      const tx  = _db.transaction(module, 'readonly');
      const req = tx.objectStore(module).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => resolve(0);
    });
  }

  async function _idbClear(module) {
    if (!_db) { ls.del('data_' + module); return; }
    return new Promise((resolve, reject) => {
      const tx  = _db.transaction(module, 'readwrite');
      tx.objectStore(module).clear();
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  }

  // ── FILTROS ─────────────────────────────────────────────────
  function _passesFilters(row, filters) {
    if (!filters || !Object.keys(filters).length) return true;

    // Filtro de período
    if (filters.dateFrom || filters.dateTo) {
      const d = parseDate(row.Fecha);
      if (!d) return false;
      if (filters.dateFrom && d < new Date(filters.dateFrom)) return false;
      if (filters.dateTo   && d > new Date(filters.dateTo))   return false;
    }

    // Filtros de dimensiones (acepta claves antiguas geo/channel/seller/product y nuevas sucursal/canal/vendedor/producto)
    // pick(): toma el primer valor que no sea 'all' ni vacío ('all' es truthy, no sirve ||)
    const pick = (a, b) => {
      if (a && a !== 'all') return a;
      if (b && b !== 'all') return b;
      return 'all';
    };
    const suc = pick(filters.sucursal, filters.geo);
    const can = pick(filters.canal,    filters.channel);
    const ven = pick(filters.vendedor, filters.seller);
    const pro = pick(filters.producto, filters.product);
    if (suc && suc !== 'all') {
      if (row.Sucursal !== suc) return false;
    }
    if (can && can !== 'all') {
      const rv = (row.Canal_Venta||'').toLowerCase();
      const fv = can.toLowerCase();
      if (fv === 'presential' || fv === 'presencial') { if (!['presencial','presential'].includes(rv)) return false; }
      else if (fv === 'virtual' || fv === 'online')   { if (!['virtual','online'].includes(rv)) return false; }
      else if (rv !== fv) return false;
    }
    if (ven && ven !== 'all' && row.Vendedor !== ven) return false;
    if (pro && pro !== 'all' && row.Producto !== pro) return false;
    if (filters.categoria && filters.categoria !== 'all' && row.Categoría !== filters.categoria) return false;

    return true;
  }

  // ── API PÚBLICA SINCRÓNICA (compatibilidad con código existente) ──
  // getData() devuelve datos del cache en memoria si ya fueron cargados,
  // sino retorna array vacío y dispara la carga async en background.

  const _memCache = {}; // module → rows[] (fuente síncrona de verdad)

  function getData(module) {
    // Siempre síncrono: lee de la caché en memoria.
    // La caché se llena en preload() desde Supabase (o desde IDB/LS en local).
    if (_memCache[module]) return _memCache[module];
    // Fallback local si preload aún no corrió (demo / sin Supabase)
    if (!_sb) {
      _idbGetRows(module).then(rows => {
        _memCache[module] = rows;
        document.dispatchEvent(new CustomEvent('clarokpis:dataUpdated', { detail: { module } }));
      }).catch(() => {
        _memCache[module] = ls.get('data_' + module) || [];
      });
      return ls.get('data_' + module) || [];
    }
    // Con Supabase, si no está en caché aún, devolver vacío (preload lo llenará)
    return [];
  }

  function applyFilters(rows, moduleIdOrFilters) {
    // Acepta: applyFilters(rows) → usa filtro global
    //         applyFilters(rows, 'sales') → usa filtro del módulo 'sales'
    //         applyFilters(rows, { dateFrom, ... }) → usa objeto filtro explícito (legacy)
    let filters;
    if (!moduleIdOrFilters) {
      filters = getActiveFilters();
    } else if (typeof moduleIdOrFilters === 'string') {
      filters = getActiveFilters(moduleIdOrFilters);
    } else {
      // objeto filters explícito (usado por app.js y summary)
      filters = moduleIdOrFilters;
      // Si tiene period pero no dateFrom, resolver las fechas
      if (filters.period && filters.period !== 'custom' && !filters.dateFrom) {
        const resolved = getActiveFilters();
        // construir filtro temporal con el period dado
        const tmp = { ...DEFAULT_FILTERS, ...filters };
        filters = _resolvePeriod(tmp);
      }
    }
    const hasActiveFilter = filters && (
      filters.dateFrom || filters.dateTo ||
      (filters.sucursal  && filters.sucursal  !== 'all') ||
      (filters.vendedor  && filters.vendedor  !== 'all') ||
      (filters.canal     && filters.canal     !== 'all') ||
      (filters.geo       && filters.geo       !== 'all') ||
      (filters.channel   && filters.channel   !== 'all') ||
      (filters.seller    && filters.seller    !== 'all') ||
      (filters.producto  && filters.producto  !== 'all') ||
      (filters.product   && filters.product   !== 'all') ||
      (filters.categoria && filters.categoria !== 'all')
    );
    if (!hasActiveFilter) return rows;
    return rows.filter(r => _passesFilters(r, filters));
  }

  // ── GUARDAR DATOS (async, llamado desde excel.js) ────────────
  async function addData(module, rows, fileId) {
    if (!Array.isArray(rows) || !rows.length) return 0;

    const stamped = rows.map(r => ({ ...r, fileId, _ts: Date.now() }));

    // 1. Actualizar caché en memoria AL INSTANTE (UI responde ya)
    _memCache[module] = [...(_memCache[module] || []), ...stamped];
    invalidateCache(module);

    // 2. Persistir
    if (_sb && _empresaId) {
      // Supabase: insertar filas en datos_modulo
      try {
        const payload = stamped.map(r => ({
          empresa_id: _empresaId,
          modulo:     module,
          file_id:    fileId,
          fila:       r,
        }));
        const { error } = await _sb.from('datos_modulo').insert(payload);
        if (error) throw error;
      } catch (e) {
        console.warn('[storage] Supabase addData falló:', module, e.message);
      }
    } else if (_ready && _db) {
      try { await _idbAddRows(module, stamped); }
      catch(e) {
        const existing = ls.get('data_' + module) || [];
        ls.set('data_' + module, [...existing, ...stamped]);
      }
    } else {
      const existing = ls.get('data_' + module) || [];
      ls.set('data_' + module, [...existing, ...stamped]);
    }

    return stamped.length;
  }

  async function removeFile(fileId) {
    // 1. Limpiar caché en memoria al instante
    for (const mod of MODULES) {
      if (_memCache[mod]) _memCache[mod] = _memCache[mod].filter(r => r.fileId !== fileId);
    }

    // 2. Persistir borrado
    if (_sb && _empresaId) {
      try {
        const { error } = await _sb.from('datos_modulo')
          .delete().eq('empresa_id', _empresaId).eq('file_id', fileId);
        if (error) throw error;
        await _sb.from('archivos').delete().eq('empresa_id', _empresaId).eq('id', fileId);
      } catch (e) {
        console.warn('[storage] Supabase removeFile falló:', e.message);
      }
    } else {
      for (const mod of MODULES) {
        if (_ready && _db) await _idbDeleteByFileId(mod, fileId);
        else {
          const rows = ls.get('data_' + mod) || [];
          ls.set('data_' + mod, rows.filter(r => r.fileId !== fileId));
        }
      }
    }

    // 3. Metadata de archivos (siempre en LS para acceso síncrono; espejo en Supabase)
    const files = ls.get('files') || [];
    ls.set('files', files.filter(f => f.id !== fileId));

    invalidateCache();
  }

  async function clearAllData() {
    for (const mod of MODULES) delete _memCache[mod];

    if (_sb && _empresaId) {
      try {
        await _sb.from('datos_modulo').delete().eq('empresa_id', _empresaId);
        await _sb.from('archivos').delete().eq('empresa_id', _empresaId);
        await _sb.from('alertas').delete().eq('empresa_id', _empresaId);
      } catch (e) {
        console.warn('[storage] Supabase clearAll falló:', e.message);
      }
    } else {
      for (const mod of MODULES) {
        if (_ready && _db) await _idbClear(mod);
        else ls.del('data_' + mod);
      }
    }
    ls.del('files');
    ls.del('alerts');
    invalidateCache();
  }

  // ── ARCHIVOS ─────────────────────────────────────────────────
  function addFile(meta) {
    const files = ls.get('files') || [];
    const file  = {
      id:          'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name:        meta.name        || 'archivo.xlsx',
      module:      meta.module      || 'sales',
      rows:        meta.rows        || 0,
      size:        meta.size        || 0,
      dateRange:   meta.dateRange   || null,
      uploadedAt:  new Date().toISOString(),
    };
    files.push(file);
    ls.set('files', files);
    // Sincronizar metadata a Supabase (fondo)
    if (_sb && _empresaId) {
      _sb.from('archivos').insert({
        id: file.id, empresa_id: _empresaId, modulo: file.module,
        nombre: file.name, filas: file.rows,
        subido_por: (window.Clerk && window.Clerk.user) ? window.Clerk.user.id : null,
      }).then(({ error }) => { if (error) console.warn('[storage] addFile sync:', error.message); });
    }
    return file;
  }

  function getFiles()            { return ls.get('files') || []; }
  function hasData()             { return getFiles().length > 0 || MODULES.some(m => (getData(m) || []).length > 0); }

  // ── METAS ────────────────────────────────────────────────────
  const DEFAULT_GOALS = {
    // Ventas
    sales_monthly:       0,
    avg_ticket:          0,
    growth_rate:         10,
    conversion_rate:     20,
    // Clientes
    retention_rate:      80,
    churn_rate:          8,
    ltv_cac_ratio:       3,
    repurchase_rate:     50,   // % mínimo de clientes que deben volver a comprar
    max_cac:             0,    // CAC máximo aceptable en $ (0 = sin meta definida)
    // CX
    nps:                 50,
    csat:                80,
    resolution_rate:     90,
    response_time_hrs:   4,
    // Finanzas
    gross_margin:        40,
    cash_days:           30,
    target_dpo:          30,   // días máximos para pagar a proveedores
    // Inventario
    inventory_days:      30,
    // Equipo
    team_goal_achievement: 90,
    absenteeism:         5,
    // Marketing
    roi_marketing:       300,
    // Descuento (invertido: menos es mejor)
    max_discount:        10,
  };

  // ── SINCRONIZACIÓN KV A SUPABASE (config, metas) ────────────
  // Escribe en la caché local (síncrono) y espeja a Supabase en fondo.
  function _syncKV(tabla, data) {
    if (_sb && _empresaId) {
      _sb.from(tabla).upsert({ empresa_id: _empresaId, data, updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.warn(`[storage] sync ${tabla}:`, error.message); });
    }
  }

  function getGoals()            { return { ...DEFAULT_GOALS, ...(ls.get('goals') || {}) }; }
  function setGoal(key, val)     { const g = getGoals(); g[key] = parseFloat(val) || 0; ls.set('goals', g); _syncKV('metas', g); invalidateCache(); }
  function setGoals(obj)         { const g = { ...getGoals(), ...obj }; ls.set('goals', g); _syncKV('metas', g); invalidateCache(); }

  // Metas por vendedor y sucursal
  function getGoalsByVendedor()  { return ls.get('goals_vendedor') || {}; }
  function getGoalsBySucursal()  { return ls.get('goals_sucursal') || {}; }
  function setGoalVendedor(name, key, val) {
    const g = getGoalsByVendedor();
    if (!g[name]) g[name] = {};
    g[name][key] = parseFloat(val) || 0;
    ls.set('goals_vendedor', g);
    invalidateCache();
  }
  function setGoalSucursal(name, key, val) {
    const g = getGoalsBySucursal();
    if (!g[name]) g[name] = {};
    g[name][key] = parseFloat(val) || 0;
    ls.set('goals_sucursal', g);
    invalidateCache();
  }

  // Umbrales de semáforo configurables
  function getSemaforoUmbrales() {
    return ls.get('semaforo_umbrales') || { amarillo: 80, rojo: 60 };
  }
  function setSemaforoUmbrales(amarillo, rojo) {
    ls.set('semaforo_umbrales', { amarillo: +amarillo, rojo: +rojo });
    invalidateCache();
  }

  // ── CONFIGURACIÓN ────────────────────────────────────────────
  const DEFAULT_CONFIG = {
    businessType:         'products',
    currency:             'CLP',
    currencySymbol:       '$',
    currencyLabel:        'CLP',
    companyName:          '',
    companyLogo:          '',
    workingDaysThisMonth: 22,
    workingDaysElapsed:   new Date().getDate(),
    language:             'es',
    rfmPenaltyEnabled:    true,   // penalizar segmento RFM por deuda vencida
    // Sistema de impuestos: array de impuestos configurables por país
    taxes: [
      { name: 'IVA', rate: 19 }  // Por defecto Chile
    ],
  };

  function getConfig()           { return { ...DEFAULT_CONFIG, ...(ls.get('config') || {}) }; }
  function setConfig(obj)        { const c = { ...getConfig(), ...obj }; ls.set('config', c); _syncKV('config', c); }

  // ── FILTROS GLOBALES ─────────────────────────────────────────
  // Convierte un Date a 'YYYY-MM-DD' usando la hora LOCAL del navegador.
  // Evita el desfase de un día que produce .toISOString() en zonas UTC+1/+2 (España)
  // y garantiza que los períodos de calendario coincidan con lo que el usuario ve.
  function _localDate(d) {
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const DEFAULT_FILTERS = {
    period:    'prevmonth', // today | week | month | quarter | year | all | custom
                            // 'prevmonth' como defecto: siempre hay datos del mes cerrado
    dateFrom:  null,
    dateTo:    null,
    compareMode: 'none',  // none | previous | lastyear
    sucursal:  'all',
    vendedor:  'all',
    canal:     'all',
    producto:  'all',
    categoria: 'all',
  };

  // Per-module filters: cada módulo tiene su propio filtro bajo 'filters_MODULE'
  // getFilters() sin argumento → filtro global (retrocompatible)
  // getFilters('sales') → filtro del módulo sales
  function getFilters(moduleId) {
    const key = moduleId ? 'filters_' + moduleId : 'filters';
    return { ...DEFAULT_FILTERS, ...(ls.get(key) || {}) };
  }
  function setFilters(obj, moduleId) {
    const key = moduleId ? 'filters_' + moduleId : 'filters';
    ls.set(key, { ...getFilters(moduleId), ...obj });
    document.dispatchEvent(new CustomEvent('clarokpis:filtersChanged', { detail: { moduleId } }));
  }
  function resetFilters(moduleId) {
    const key = moduleId ? 'filters_' + moduleId : 'filters';
    ls.set(key, { ...DEFAULT_FILTERS });
    document.dispatchEvent(new CustomEvent('clarokpis:filtersChanged', { detail: { moduleId } }));
  }

  // Resuelve un objeto de filtros convirtiendo 'period' en dateFrom/dateTo concretos.
  // IMPORTANTE: usa _localDate() en lugar de .toISOString() para que los límites de
  // período sean correctos en todos los timezones (LATAM UTC-3/-4/-5 y España UTC+1/+2).
  // .toISOString() devuelve la fecha en UTC, lo que desplaza el día en zonas UTC+.
  function _resolvePeriod(f) {
    const now = new Date();
    let dateFrom = f.dateFrom, dateTo = f.dateTo;
    if (f.period !== 'custom') {
      dateTo = _localDate(now);
      switch (f.period) {
        case 'today':    dateFrom = dateTo; break;
        case 'week':
        case 'last7': {  const d = new Date(now); d.setDate(now.getDate()-6);  dateFrom = _localDate(d); break; }
        case 'last30': { const d = new Date(now); d.setDate(now.getDate()-29); dateFrom = _localDate(d); break; }
        case 'last90': { const d = new Date(now); d.setDate(now.getDate()-89); dateFrom = _localDate(d); break; }
        case 'month':    dateFrom = _localDate(new Date(now.getFullYear(), now.getMonth(), 1)); break;
        case 'prevmonth': {
          dateFrom = _localDate(new Date(now.getFullYear(), now.getMonth()-1, 1));
          dateTo   = _localDate(new Date(now.getFullYear(), now.getMonth(), 0));
          break;
        }
        case 'quarter': {
          const q = Math.floor(now.getMonth()/3);
          dateFrom = _localDate(new Date(now.getFullYear(), q*3, 1));
          break;
        }
        case 'year':     dateFrom = _localDate(new Date(now.getFullYear(), 0, 1)); break;
        case 'lastyear': {
          dateFrom = _localDate(new Date(now.getFullYear()-1, 0, 1));
          dateTo   = _localDate(new Date(now.getFullYear()-1, 11, 31));
          break;
        }
        case 'all': default: dateFrom = null; dateTo = null;
      }
    }
    return { ...f, dateFrom, dateTo };
  }

  function getActiveFilters(moduleId) {
    return _resolvePeriod(getFilters(moduleId));
  }

  // Calcular rango del período anterior (para deltas)
  function getPreviousPeriodRange(filters) {
    const f = filters || getActiveFilters();
    if (!f.dateFrom || !f.dateTo) return null;

    const from = new Date(f.dateFrom);
    const to   = new Date(f.dateTo);
    const days = Math.round((to - from) / 86400000) + 1;

    const prevTo   = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - days + 1);

    return {
      dateFrom: prevFrom.toISOString().split('T')[0],
      dateTo:   prevTo.toISOString().split('T')[0],
    };
  }

  // ── ALERTAS ──────────────────────────────────────────────────
  // Helper que retorna el mensaje en el idioma activo
  // Usar SIEMPRE en lugar de alert.message directo
  function getAlertMessage(alert) {
    // Arquitectura messageKey+params: traduce siempre en tiempo de render
    if (alert.messageKey && typeof i18n !== 'undefined') {
      return i18n.t(alert.messageKey, alert.params || {});
    }
    // Fallback: message+messageEN (alertas viejas o demo sin messageKey)
    const lang = (typeof i18n !== 'undefined' && i18n.getLang)
      ? i18n.getLang()
      : (localStorage.getItem('clarokpis_lang') || 'es');
    if (lang === 'en' && alert.messageEN) return alert.messageEN;
    return alert.message || '';
  }

  function addAlert(alert) {
    const alerts = ls.get('alerts') || [];
    const existsIdx = alerts.findIndex(a =>
      !a.resolved &&
      a.module  === alert.module &&
      a.kpi     === alert.kpi   &&
      a.type    === alert.type
    );
    if (existsIdx >= 0) {
      // Si la nueva alerta usa messageKey, siempre actualizar
      // (upgrade de alertas viejas sin messageKey + datos frescos)
      if (alert.messageKey) {
        alerts[existsIdx].messageKey = alert.messageKey;
        alerts[existsIdx].params     = alert.params || {};
        alerts[existsIdx].message    = alert.message || alerts[existsIdx].message || '';
        alerts[existsIdx].messageEN  = alert.messageEN || alerts[existsIdx].messageEN || null;
        ls.set('alerts', alerts);
      }
      return; // no duplicar
    }

    alerts.push({
      id:         'a_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type:       alert.type      || 'warning',
      module:     alert.module    || 'general',
      kpi:        alert.kpi       || '',
      message:    alert.message   || '',
      messageEN:  alert.messageEN || null,
      value:      alert.value     ?? null,
      goal:       alert.goal      ?? null,
      resolved:   false,
      resolvedBy: null,
      resolvedAt: null,
      actionNote: null,
      createdAt:  new Date().toISOString(),
    });
    ls.set('alerts', alerts);
  }

  function getAlerts()           { return ls.get('alerts') || []; }
  function getActiveAlerts()     { return getAlerts().filter(a => !a.resolved); }

  function resolveAlert(id, resolvedBy, resolvedAt, note) {
    const alerts = getAlerts().map(a => {
      if (a.id !== id) return a;
      return { ...a, resolved: true, resolvedBy, resolvedAt, actionNote: note || null };
    });
    ls.set('alerts', alerts);
  }

  function pruneResolvedAlerts() {
    const cutoff = Date.now() - 90 * 24 * 3600 * 1000; // 90 días
    const alerts = getAlerts().filter(a =>
      !a.resolved || new Date(a.resolvedAt).getTime() > cutoff
    );
    ls.set('alerts', alerts);
  }

  // ── SEMÁFORO ─────────────────────────────────────────────────
  function getStatus(value, goal, inverted = false) {
    if (value === null || value === undefined || !goal) return 'na';
    const { amarillo, rojo } = getSemaforoUmbrales();
    const pct = inverted
      ? (goal / value) * 100    // invertido: menos es mejor (ej: churn, descuento)
      : (value / goal) * 100;
    if (pct >= 100)     return 'green';
    if (pct >= amarillo) return 'yellow';
    if (pct >= rojo)     return 'red';
    return 'red';
  }

  // ── CACHE DE KPIs ────────────────────────────────────────────
  function getCached(module, filters) {
    const key = module + ':' + JSON.stringify(filters || {});
    const c   = _cache.get(key);
    if (c && Date.now() - c.ts < CACHE_TTL) return c.result;
    return null;
  }

  function setCache(module, filters, result) {
    const key = module + ':' + JSON.stringify(filters || {});
    _cache.set(key, { result, ts: Date.now() });
  }

  function invalidateCache(module) {
    if (module) {
      for (const k of _cache.keys()) {
        if (k.startsWith(module + ':')) _cache.delete(k);
      }
      // _memCache[module] se preserva — datos raw válidos
    } else {
      _cache.clear();
      // _memCache se preserva — solo borramos KPIs calculados
    }
  }

  // ── ESTADÍSTICAS ─────────────────────────────────────────────
  async function getDataStats() {
    const stats = { total: 0, byModule: {} };
    for (const mod of MODULES) {
      const count = _ready ? await _idbCount(mod) : (ls.get('data_' + mod) || []).length;
      stats.byModule[mod] = count;
      stats.total += count;
    }
    return stats;
  }

  // Versión síncrona para render rápido
  function getDataStatsSync() {
    const stats = { total: 0, byModule: {} };
    MODULES.forEach(mod => {
      const rows = _memCache[mod] || ls.get('data_' + mod) || [];
      stats.byModule[mod] = rows.length;
      stats.total += rows.length;
    });
    return stats;
  }

  function getStorageInfo() {
    const files   = getFiles();
    const records = Object.values(getDataStatsSync().byModule).reduce((a, b) => a + b, 0);
    const usedKB  = Math.round(ls.bytes() / 1024);
    return {
      files:      files.length,
      records,
      usedKB,
      lastBackup: ls.get('last_backup'),
    };
  }

  // ── BACKUP ───────────────────────────────────────────────────
  function downloadBackup() {
    const backup = {
      version:   '3.0',
      exportedAt: new Date().toISOString(),
      config:    getConfig(),
      goals:     getGoals(),
      goalsVendedor: getGoalsByVendedor(),
      goalsSucursal: getGoalsBySucursal(),
      alerts:    getAlerts(),
      files:     getFiles(),
      filters:   getFilters(),
      data:      {},
    };

    MODULES.forEach(mod => {
      backup.data[mod] = _memCache[mod] || ls.get('data_' + mod) || [];
    });

    ls.set('last_backup', new Date().toISOString());

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `clarokpis-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function restoreBackup(backup) {
    try {
      if (!backup?.version || !backup?.data) return { success: false, error: 'Archivo inválido' };

      ls.set('config',  backup.config  || {});
      ls.set('goals',   backup.goals   || {});
      ls.set('goals_vendedor', backup.goalsVendedor || {});
      ls.set('goals_sucursal', backup.goalsSucursal || {});
      ls.set('alerts',  backup.alerts  || []);
      ls.set('files',   backup.files   || []);
      ls.set('filters', backup.filters || {});

      MODULES.forEach(mod => {
        const rows = backup.data?.[mod] || [];
        if (_ready && _db) {
          _idbClear(mod).then(() => _idbAddRows(mod, rows));
        } else {
          ls.set('data_' + mod, rows);
        }
        _memCache[mod] = rows;
      });

      invalidateCache();
      ls.del('idb_migrated'); // forzar remigración
      return { success: true };
    } catch(e) {
      return { success: false, error: e.message };
    }
  }

  // ── UTILIDADES ───────────────────────────────────────────────
  function parseDate(val) {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val) ? null : val;

    const s = String(val).trim();

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);

    // DD/MM/YYYY o DD-MM-YYYY
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`);

    // MM/DD/YYYY
    const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mdy) return new Date(`${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`);

    // Número de serie Excel
    if (/^\d{5}$/.test(s)) {
      const d = new Date(Date.UTC(1899, 11, 30));
      d.setUTCDate(d.getUTCDate() + parseInt(s));
      return d;
    }

    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function formatDate(val, style = 'short') {
    const d = val instanceof Date ? val : parseDate(val);
    if (!d || isNaN(d)) return '—';
    const locale = getConfig().language === 'en' ? 'en-US' : 'es-CL';
    const opts = {
      short:  { day: '2-digit', month: '2-digit', year: 'numeric' },
      medium: { day: 'numeric', month: 'short',   year: 'numeric' },
      long:   { day: 'numeric', month: 'long',    year: 'numeric', weekday: 'long' },
    };
    return d.toLocaleDateString(locale, opts[style] || opts.short);
  }

  // ── RANGO DE FECHAS REALES DE LOS DATOS ─────────────────────
  // Devuelve {min, max, label} con las fechas reales de la columna Fecha.
  // Acepta un módulo o un array de módulos (para cruces como margen).
  // Compatible con Supabase: solo usa getData() que es la API pública.
  function getDataDateRange(modules) {
    const mods = Array.isArray(modules) ? modules : [modules];
    const dates = [];
    mods.forEach(mod => {
      const rows = getData(mod);
      rows.forEach(r => {
        const d = parseDate(r.Fecha);
        if (d && !isNaN(d)) dates.push(d);
      });
    });
    if (!dates.length) return null;
    dates.sort((a, b) => a - b);
    const min = dates[0];
    const max = dates[dates.length - 1];
    const lang = (typeof i18n !== 'undefined' && i18n.getLang) ? i18n.getLang() : (getConfig().language || 'es');
    const locale = lang === 'en' ? 'en-US' : 'es-CL';
    const fmt = d => d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const prefix = lang === 'en' ? 'Data: ' : 'Datos: ';
    const isSameMonth = min.getMonth() === max.getMonth() && min.getFullYear() === max.getFullYear();
    const label = (isSameMonth ? fmt(max) : `${fmt(min)} – ${fmt(max)}`);
    return { min, max, label, prefix };
  }

  // ── MÓDULOS DISPONIBLES (para permisos) ─────────────────────
  function getAvailableModules() {
    return MODULES;
  }

  // ── PRECARGA ASYNC (llamar al iniciar la app) ────────────────
  // Con Supabase: conecta, trae config/metas/archivos + los 10 módulos
  // a _memCache de una vez. Después, todas las lecturas son síncronas.
  async function preload() {
    // Intentar conectar Supabase
    const sbOk = await _initSupabase();

    if (sbOk && _sb && _empresaId) {
      // ── MODO NUBE ──────────────────────────────────────────
      try {
        // 1. Traer TODAS las filas de datos de la empresa en una query
        const { data: filas, error } = await _sb
          .from('datos_modulo')
          .select('modulo, file_id, fila')
          .eq('empresa_id', _empresaId);
        if (error) throw error;

        // Agrupar por módulo en _memCache
        MODULES.forEach(m => { _memCache[m] = []; });
        (filas || []).forEach(row => {
          const r = { ...row.fila, fileId: row.file_id };
          if (!_memCache[row.modulo]) _memCache[row.modulo] = [];
          _memCache[row.modulo].push(r);
        });

        // 2. Traer config, metas, archivos → espejo en localStorage (acceso síncrono)
        const [{ data: cfg }, { data: mts }, { data: arch }, { data: suscData }] = await Promise.all([
          _sb.from('config').select('data').eq('empresa_id', _empresaId).maybeSingle(),
          _sb.from('metas').select('data').eq('empresa_id', _empresaId).maybeSingle(),
          _sb.from('archivos').select('*').eq('empresa_id', _empresaId),
          _sb.from('suscripciones').select('*').eq('empresa_id', _empresaId).maybeSingle(),
        ]);
        if (cfg && cfg.data)   ls.set('config', cfg.data);
        if (mts && mts.data)   ls.set('goals', mts.data);
        if (arch) ls.set('files', arch.map(a => ({
          id: a.id, name: a.nombre, module: a.modulo, rows: a.filas, uploadedAt: a.uploaded_at,
        })));
        // Espejo del plan activo para que plans.js lo lea síncronamente
        if (suscData && typeof plans !== 'undefined') {
          plans.setPlanLocal({
            plan:          suscData.plan || 'trial',
            estado:        suscData.estado,
            trial_ends_at: suscData.trial_ends_at,
            period_end:    suscData.current_period_end,
          });
        } else if (typeof plans !== 'undefined') {
          // Sin registro en suscripciones = trial nuevo
          plans.setPlanLocal({ plan: 'trial', estado: 'trial', trial_ends_at: null });
        }

        _sbReady = true;
        _ready = true;
      } catch (e) {
        console.warn('[storage] preload Supabase falló, cae a local:', e.message);
        await _preloadLocal();
      }
    } else {
      // ── MODO LOCAL (demo / sin credenciales) ──────────────
      await _preloadLocal();
    }

    // Señal de que los datos están listos
    window._storageReady = true;
    document.dispatchEvent(new Event('clarokpis:storageReady'));
  }

  async function _preloadLocal() {
    await init();
    // Precargar TODOS los módulos a memoria desde IDB/LS
    await Promise.all(MODULES.map(async mod => {
      try { _memCache[mod] = await _idbGetRows(mod); }
      catch { _memCache[mod] = ls.get('data_' + mod) || []; }
    }));
  }

  // ── API PÚBLICA ──────────────────────────────────────────────
  return {
    // Inicialización
    init,
    preload,

    // Datos
    getData,
    addData,
    removeFile,
    clearAllData,
    applyFilters,

    // Archivos
    addFile,
    getFiles,
    hasData,

    // Metas
    getGoals,
    setGoal,
    setGoals,
    getGoalsByVendedor,
    getGoalsBySucursal,
    setGoalVendedor,
    setGoalSucursal,
    getSemaforoUmbrales,
    setSemaforoUmbrales,

    // Config
    getConfig,
    setConfig,

    // Filtros
    getFilters,
    setFilters,
    resetFilters,
    getActiveFilters,
    getPreviousPeriodRange,

    // Alertas
    addAlert,
    getAlertMessage,
    getAlerts,
    getActiveAlerts,
    resolveAlert,
    pruneResolvedAlerts,

    // Semáforo
    getStatus,

    // Cache KPI
    getCached,
    setCache,
    invalidateCache,

    // Stats
    getDataStats,
    getDataStatsSync,
    getStorageInfo,

    // Backup
    downloadBackup,
    restoreBackup,

    // Utilidades
    parseDate,
    formatDate,
    getDataDateRange,
    localDate: _localDate,   // convierte Date → 'YYYY-MM-DD' en hora local (usado por Flatpickr en utils/sales)
    getAvailableModules,

    // Acceso interno (para módulos que necesitan IDB directo)
    _idbGetRows,
    _idbAddRows,
    getUniqueValues: function(module, field) {
      const rows = storage.getData(module);
      return [...new Set(rows.map(r => r[field]).filter(Boolean))].sort();
    },

    filterInventory: function(rows, moduleId) {
      return storage.applyFilters(rows, moduleId || 'inventory');
    },

    // Ventas netas: descuenta TODOS los impuestos configurados
    // Uso: storage.getNetAmount(monto) → monto / (1 + totalTaxRate/100)
    getNetAmount: function(monto) {
      const taxes = (storage.getConfig().taxes || [{ name: 'IVA', rate: 19 }]);
      const totalTaxRate = taxes.reduce((sum, t) => sum + (t.rate || 0), 0) / 100;
      return monto / (1 + totalTaxRate);
    },

    // Helper para metas históricas: guarda snapshot de metas del mes cerrado
    // Llamar al cambiar metas de un período anterior
    saveGoalsSnapshot: function(yearMonth) {
      // yearMonth: 'YYYY-MM'
      const history = ls.get('goals_history') || {};
      history[yearMonth] = {
        ...storage.getGoals(),
        byVendedor: storage.getGoalsByVendedor(),
        bySucursal: storage.getGoalsBySucursal(),
        savedAt: new Date().toISOString(),
      };
      ls.set('goals_history', history);
    },
    getGoalsHistory: function() {
      return ls.get('goals_history') || {};
    },

    // ── WORKSPACE API — para uso interno de módulos ──────────────
    // Usar storage.lsSet / storage.lsGet en lugar de localStorage directo.
    // Cuando activemos multi-empresa, estos métodos ya incluirán el prefijo
    // de workspace automáticamente sin que los módulos deban cambiar nada.
    lsSet: (k, v) => ls.set(k, v),
    lsGet: (k)    => ls.get(k),
    lsDel: (k)    => ls.del(k),
    workspaceId:  () => WORKSPACE_ID,
  };
})();

// ── AUTO-INICIALIZAR al cargar la página ─────────────────────
// _storageReady: bandera global para que dashboard pueda chequear si ya está listo
window._storageReady = false;
document.addEventListener('DOMContentLoaded', () => {
  storage.preload().then(() => {
    window._storageReady = true;
    document.dispatchEvent(new CustomEvent('clarokpis:storageReady'));
  });
});

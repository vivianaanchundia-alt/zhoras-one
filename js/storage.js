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
  let   _expectCloud   = false;  // hay sesión Clerk → los datos vienen de nube.
                                 // Cierra la ventana de carrera en la que getData
                                 // leería datos demo residuales de localStorage
                                 // mientras preload() de nube aún no terminó.

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
      // Cargar SDK de Supabase desde CDN si no está presente.
      // Versión pinneada + SRI (Bloque 0.5.8): un CDN comprometido no
      // ejecuta código con la sesión activa, el navegador rechaza el script.
      if (!window.supabase) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.7/dist/umd/supabase.min.js';
          s.integrity = 'sha384-BmlQlKlDvXvKoxkn5OQuUo/aJQCTXeB+Kls6EccBmG4Kf8AXvp89RtO9MtPxP/r5';
          s.crossOrigin = 'anonymous';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      // API nativa de Supabase v2 para Third-Party Auth. Se invoca antes
      // de CADA request, así que el token (que expira a los 60s) nunca
      // queda desactualizado a mitad de sesión. Reemplaza el override
      // manual de global.fetch, que competía con el header Authorization
      // que el propio SDK intenta fijar.
      _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
        accessToken: async () => {
          try {
            if (window.Clerk && window.Clerk.session) {
              return await window.Clerk.session.getToken({ template: 'supabase' });
            }
          } catch (e) { /* sin sesión → anon */ }
          return null;
        },
        auth: { persistSession: false },
      });

      // empresa_id = el 'sub' del usuario Clerk (aislamiento RLS)
      _empresaId = (window.Clerk && window.Clerk.user) ? window.Clerk.user.id : null;
      return !!_empresaId;
    } catch (e) {
      console.warn('[storage] Supabase init falló, usando modo local:', e);
      if (window.Sentry) {
        Sentry.captureException(e, { tags: { modulo: 'storage', operacion: '_initSupabase' } });
      }
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

    // Si hay sesión Clerk (datos de nube) pero preload aún no terminó, NO caer
    // al fallback de localStorage: contendría datos demo residuales. Devolver
    // vacío; preload poblará _memCache y disparará el re-render.
    if (_expectCloud) return [];

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

  // ── SINCRONIZACIÓN (badge del header, ver Bloque 1.6) ────────
  function _emitSync(estado) {
    try { document.dispatchEvent(new CustomEvent('zhoras:syncState', { detail: { estado } })); }
    catch (e) { /* noop */ }
  }

  // ── ANALÍTICA DE PRODUCTO (Bloque 8.1) ────────────────────────
  // Nunca debe romper la aplicación — silencioso en demo/local (sin
  // sesión nube no hay _sb/_empresaId) y ante cualquier fallo de red.
  function trackEvento(evento, metadata = {}) {
    if (!_sb || !_empresaId) return;
    try {
      _sb.from('eventos').insert({
        empresa_id: _empresaId,
        clerk_user_id: (window.Clerk && window.Clerk.user) ? window.Clerk.user.id : null,
        evento, metadata,
      }).then(() => {}).catch(() => {});
    } catch (e) { /* nunca romper la app por un evento de analítica */ }
  }

  // ── INSERCIÓN POR LOTES (Supabase) con reintentos ────────────
  // Un archivo de miles de filas en un único insert() lo rechaza
  // PostgREST o hace timeout. Se usa desde addData() y restoreBackup().
  async function _insertLotes(tabla, payload, loteSize = 500) {
    const lotes = [];
    for (let i = 0; i < payload.length; i += loteSize) {
      lotes.push(payload.slice(i, i + loteSize));
    }

    let guardadas = 0;
    let error = null;

    for (const lote of lotes) {
      let intentos = 0;
      let ok = false;
      while (intentos < 3 && !ok) {
        const res = await _sb.from(tabla).insert(lote);
        if (!res.error) { ok = true; guardadas += lote.length; break; }
        intentos++;
        error = res.error;
        if (intentos < 3) await new Promise(r => setTimeout(r, 400 * intentos));
      }
      if (!ok) break; // no seguir si un lote falló definitivamente
    }

    return { guardadas, error };
  }

  // ── GUARDAR DATOS (async, llamado desde excel.js) ────────────
  // Persiste PRIMERO; _memCache solo se actualiza si la escritura tuvo
  // éxito. Antes se actualizaba la UI al instante y el error de red se
  // tragaba con un console.warn — el usuario veía "guardado" con datos
  // que nunca llegaron a existir. Devuelve un resultado explícito para
  // que excel.js pueda informar al usuario si algo falló.
  async function addData(module, rows, fileId) {
    if (!Array.isArray(rows) || !rows.length) {
      return { ok: true, guardadas: 0, total: 0 };
    }

    const stamped = rows.map(r => ({ ...r, fileId, _ts: Date.now() }));

    if (_sb && _empresaId) {
      _emitSync('guardando');
      const payload = stamped.map(r => ({
        empresa_id: _empresaId,
        modulo:     module,
        file_id:    fileId,
        fila:       r,
      }));
      const { guardadas, error } = await _insertLotes('datos_modulo', payload);
      if (guardadas < payload.length) {
        console.warn('[storage] Supabase addData falló:', module, error && error.message);
        _emitSync('error');
        if (window.Sentry) {
          Sentry.captureException(error || new Error('addData: lote incompleto'), {
            tags: { modulo: 'storage', operacion: 'addData' },
            extra: { modulo_datos: module, filas: rows.length, guardadas },
          });
        }
        return { ok: false, guardadas, total: stamped.length, error: (error && error.message) || 'Error al guardar' };
      }
      _memCache[module] = [...(_memCache[module] || []), ...stamped];
      invalidateCache(module);
      _emitSync('sincronizado');
      return { ok: true, guardadas, total: stamped.length };
    }

    if (_ready && _db) {
      try { await _idbAddRows(module, stamped); }
      catch(e) {
        const existing = ls.get('data_' + module) || [];
        ls.set('data_' + module, [...existing, ...stamped]);
      }
    } else {
      const existing = ls.get('data_' + module) || [];
      ls.set('data_' + module, [...existing, ...stamped]);
    }

    _memCache[module] = [...(_memCache[module] || []), ...stamped];
    invalidateCache(module);
    return { ok: true, guardadas: stamped.length, total: stamped.length };
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
    const files  = ls.get('files') || [];
    const target = files.find(f => f.id === fileId);
    ls.set('files', files.filter(f => f.id !== fileId));
    if (target) logHistory('deleted', target);

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
  // Async: espera la escritura en Supabase antes de confirmar. Antes
  // era fire-and-forget — un insert que fallaba dejaba metadata local
  // de un archivo que nunca existió en la nube. Si falla, no se deja
  // entrada en localStorage y se devuelve null (el llamador decide).
  async function addFile(meta) {
    // Autor: usa auth.getCurrentUser() si está disponible (nombre capturado en onboarding).
    let uploadedByName = meta.uploadedByName || null;
    if (!uploadedByName && typeof auth !== 'undefined' && auth.getCurrentUser) {
      try { uploadedByName = auth.getCurrentUser()?.name || null; } catch (e) { /* noop */ }
    }
    const file  = {
      id:            'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name:          meta.name        || 'archivo.xlsx',
      module:        meta.module      || 'sales',
      rows:          meta.rows        || 0,
      size:          meta.size        || 0,
      dateRange:     meta.dateRange   || null,
      uploadedAt:    new Date().toISOString(),
      uploadedByName: uploadedByName,
    };

    if (_sb && _empresaId) {
      const { error } = await _sb.from('archivos').insert({
        id: file.id, empresa_id: _empresaId, modulo: file.module,
        nombre: file.name, filas: file.rows,
        subido_por:        (window.Clerk && window.Clerk.user) ? window.Clerk.user.id : null,
        subido_por_nombre: uploadedByName,
        date_range:        file.dateRange,
      });
      if (error) {
        console.warn('[storage] addFile falló:', error.message);
        if (window.Sentry) {
          Sentry.captureException(error, {
            tags: { modulo: 'storage', operacion: 'addFile' },
            extra: { modulo_datos: file.module },
          });
        }
        return null;
      }
    }

    const files = ls.get('files') || [];
    files.push(file);
    ls.set('files', files);
    logHistory('uploaded', file);
    return file;
  }

  function getFiles()            { return ls.get('files') || []; }
  function hasData()             { return getFiles().length > 0 || MODULES.some(m => (getData(m) || []).length > 0); }

  // ── SOLAPAMIENTO DE FECHAS (previene duplicados silenciosos) ──
  // Devuelve archivos del mismo módulo cuyo dateRange se cruza con el nuevo.
  function getOverlappingFiles(module, dateRange) {
    if (!dateRange || !dateRange.from || !dateRange.to) return [];
    const from = new Date(dateRange.from).getTime();
    const to   = new Date(dateRange.to).getTime();
    if (isNaN(from) || isNaN(to)) return [];
    return getFiles().filter(f => {
      if (f.module !== module || !f.dateRange) return false;
      const fFrom = new Date(f.dateRange.from).getTime();
      const fTo   = new Date(f.dateRange.to).getTime();
      if (isNaN(fFrom) || isNaN(fTo)) return false;
      return fFrom <= to && fTo >= from; // se cruzan
    });
  }

  // ── HISTORIAL DE ACCIONES (subidas, borrados, reemplazos) ────
  function logHistory(action, file) {
    let who = 'Usuario';
    if (typeof auth !== 'undefined' && auth.getCurrentUser) {
      try { who = auth.getCurrentUser()?.name || who; } catch (e) { /* noop */ }
    }
    const entry = {
      ts:     new Date().toISOString(),
      action, // 'uploaded' | 'deleted' | 'replaced'
      file:   file?.name || '—',
      who,
    };
    const history = ls.get('history') || [];
    history.unshift(entry);
    ls.set('history', history.slice(0, 200)); // límite razonable
  }

  function getHistory() { return ls.get('history') || []; }

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
    const saved = ls.get(key);
    // Solo en demo y solo si el usuario aún no eligió período: mostrar todo el
    // año en curso (1-ene → hoy) en vez de 'prevmonth', porque los datos demo
    // llegan hasta mayo 2026 y 'prevmonth' saldría vacío. No afecta a cuentas
    // reales ni pisa la elección del usuario una vez que cambia el filtro.
    if (!saved && typeof auth !== 'undefined' && auth.isDemo && auth.isDemo()) {
      return { ...DEFAULT_FILTERS, period: 'year' };
    }
    return { ...DEFAULT_FILTERS, ...(saved || {}) };
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
  // Hash simple y determinista (no criptográfico): detecta corrupción o
  // edición casual del archivo, no resiste un ataque dirigido — no hace falta.
  function _simpleChecksum(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16);
  }

  function downloadBackup() {
    const data = {};
    MODULES.forEach(mod => {
      data[mod] = _memCache[mod] || ls.get('data_' + mod) || [];
    });

    const backup = {
      version:    '3.0',
      empresa_id: _empresaId,
      exportedAt: new Date().toISOString(),
      plan:       (typeof plans !== 'undefined' && plans.getPlanActivo) ? plans.getPlanActivo() : null,
      checksum:   _simpleChecksum(JSON.stringify(data)),
      config:     getConfig(),
      goals:      getGoals(),
      goalsVendedor: getGoalsByVendedor(),
      goalsSucursal: getGoalsBySucursal(),
      alerts:     getAlerts(),
      files:      getFiles(),
      filters:    getFilters(),
      data,
    };

    ls.set('last_backup', new Date().toISOString());

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `clarokpis-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Señal temprana de churn (D8): quien descarga su backup y no
    // vuelve está por irse — permite reaccionar antes de perderlo.
    trackEvento('backup_descargado');
  }

  // Restaura un backup. Valida propiedad (empresa_id) y checksum ANTES de
  // tocar nada; persiste en Supabase (si hay sesión nube) antes de
  // actualizar memCache/LS — igual patrón "persistir primero" que addData.
  // opts.forzar = true → ignora un checksum que no coincide (tras que el
  // usuario confirme explícitamente en la UI que quiere continuar igual).
  async function restoreBackup(backup, opts = {}) {
    try {
      if (!backup || !backup.version || !backup.data) {
        return { success: false, error: 'archivo_invalido' };
      }

      // 1. Propiedad: rechaza si es de OTRA empresa. Los backups viejos sin
      //    empresa_id (formato anterior a este cambio) se aceptan con
      //    advertencia — rechazarlos rompería backups ya existentes.
      const esLegacy = !backup.empresa_id;
      if (!esLegacy && _empresaId && backup.empresa_id !== _empresaId) {
        // Evento de seguridad (Bloque 8.5) — una ráfaga de estos es una
        // señal real de alguien probando backups ajenos, no ruido.
        trackEvento('seguridad_backup_rechazado', { empresa_id_backup: backup.empresa_id });
        return { success: false, error: 'empresa_ajena' };
      }

      // 2. Checksum: si no coincide, exige confirmación explícita (opts.forzar)
      //    antes de continuar — puede ser corrupción o edición manual del JSON.
      const checksumOk = !backup.checksum || backup.checksum === _simpleChecksum(JSON.stringify(backup.data));
      if (!checksumOk && !opts.forzar) {
        return { success: false, error: 'checksum_invalido', requiereConfirmacion: true };
      }

      // 3. Persistir en Supabase PRIMERO (si hay sesión nube). Reemplaza
      //    todos los datos_modulo de la empresa por los del backup, en
      //    lotes de 500 con reintentos (mismo helper que addData).
      if (_sb && _empresaId) {
        _emitSync('guardando');
        const { error: errDel } = await _sb.from('datos_modulo').delete().eq('empresa_id', _empresaId);
        if (errDel) {
          _emitSync('error');
          if (window.Sentry) {
            Sentry.captureException(errDel, { tags: { modulo: 'storage', operacion: 'restoreBackup_delete' } });
          }
          return { success: false, error: 'fallo_limpieza' }; // nada se modificó
        }

        const payload = [];
        MODULES.forEach(mod => {
          (backup.data[mod] || []).forEach(fila => {
            payload.push({ empresa_id: _empresaId, modulo: mod, file_id: fila.fileId || null, fila });
          });
        });

        if (payload.length) {
          const { guardadas, error } = await _insertLotes('datos_modulo', payload);
          if (guardadas < payload.length) {
            _emitSync('error');
            if (window.Sentry) {
              Sentry.captureException(error || new Error('restoreBackup: lote incompleto'), {
                tags: { modulo: 'storage', operacion: 'restoreBackup_insert' },
                extra: { guardadas, total: payload.length },
              });
            }
            // Los datos actuales ya se borraron y la restauración quedó a
            // medias — es el único caso donde no hay forma limpia de
            // revertir sin dejar al usuario sin nada; se avisa explícito.
            return { success: false, error: 'fallo_a_medias' };
          }
        }
        _emitSync('sincronizado');
      }

      // 4. Solo si la persistencia (si aplicaba) tuvo éxito, actualizar
      //    la caché local que leen todos los módulos síncronamente.
      ls.set('config',  backup.config  || {});
      ls.set('goals',   backup.goals   || {});
      ls.set('goals_vendedor', backup.goalsVendedor || {});
      ls.set('goals_sucursal', backup.goalsSucursal || {});
      ls.set('alerts',  backup.alerts  || []);
      ls.set('files',   backup.files   || []);
      ls.set('filters', backup.filters || {});

      for (const mod of MODULES) {
        const rows = backup.data[mod] || [];
        if (!_sb) {
          if (_ready && _db) { await _idbClear(mod); await _idbAddRows(mod, rows); }
          else ls.set('data_' + mod, rows);
        }
        _memCache[mod] = rows;
      }

      invalidateCache();
      ls.del('idb_migrated'); // forzar remigración local

      trackEvento('backup_restaurado');
      trackEvento('seguridad_backup_restaurado', { filas: Object.values(backup.data).reduce((s, r) => s + (Array.isArray(r) ? r.length : 0), 0) });

      return { success: true, legacy: esLegacy };
    } catch(e) {
      console.warn('[storage] restoreBackup falló:', e.message);
      if (window.Sentry) {
        Sentry.captureException(e, { tags: { modulo: 'storage', operacion: 'restoreBackup' } });
      }
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
  // Elimina datos demo residuales de localStorage/memoria. Se llama al
  // confirmar sesión real para que los datos demo (cargados al ver el demo)
  // no contaminen el panel del usuario autenticado.
  function _purgeDemoResidue() {
    MODULES.forEach(m => {
      ls.del('data_' + m);         // claves clarokpis_data_MODULE
      _memCache[m] = [];           // limpiar caché en memoria
    });
    ls.del('files');               // lista de archivos demo
    ls.del('goals');               // metas demo
    ls.del('config');              // config demo (nombre de empresa, moneda, etc.)
                                    // — antes se preservaba y "Comercial Los Andes"
                                    // podía asomar en una cuenta real recién entrada.
    invalidateCache();
  }

  async function preload() {
    // ── ESPERAR A CLERK ANTES DE DECIDIR NUBE-VS-LOCAL ──────────
    // Sin esto, _initSupabase() lee window.Clerk.user cuando aún es
    // undefined (sesión cargando) → _empresaId null → cae a modo
    // local/demo aunque el usuario SÍ tenga sesión. Esperamos a que
    // auth.initClerk() resuelva la sesión (User o null, nunca undefined).
    try {
      if (typeof auth !== 'undefined' && auth.initClerk) {
        await auth.initClerk();
      }
    } catch (e) { /* si auth/Clerk falla, seguimos a modo local */ }

    // Si hay sesión Clerk real, los datos vendrán de la nube. Marcamos la
    // intención AHORA (antes de que _sb esté listo) para que getData no lea
    // datos demo residuales de localStorage durante la ventana asíncrona.
    // Además purgamos cualquier dato demo que quedó de una visita previa al
    // demo, para que la sesión real nunca se contamine.
    const _hasClerk = (window.Clerk && window.Clerk.user);
    if (_hasClerk) {
      _expectCloud = true;
      _purgeDemoResidue();
    }

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
        const [{ data: cfg }, { data: mts }, { data: arch }, { data: suscData }, { data: preciosData }] = await Promise.all([
          _sb.from('config').select('data').eq('empresa_id', _empresaId).maybeSingle(),
          _sb.from('metas').select('data').eq('empresa_id', _empresaId).maybeSingle(),
          _sb.from('archivos').select('*').eq('empresa_id', _empresaId),
          _sb.from('suscripciones').select('*').eq('empresa_id', _empresaId).maybeSingle(),
          _sb.from('precios_planes').select('*').eq('activo', true),
        ]);
        if (cfg && cfg.data)   ls.set('config', cfg.data);
        if (mts && mts.data)   ls.set('goals', mts.data);
        if (arch) ls.set('files', arch.map(a => ({
          id: a.id, name: a.nombre, module: a.modulo, rows: a.filas, uploadedAt: a.uploaded_at,
        })));
        // Precios de planes desde Supabase → plans.js
        if (preciosData && typeof plans !== 'undefined' && plans.setPrecios) {
          plans.setPrecios(preciosData);
        }
        // Espejo del plan activo para que plans.js lo lea síncronamente
        if (suscData && typeof plans !== 'undefined') {
          plans.setPlanLocal({
            plan:           suscData.plan || 'trial',
            estado:         suscData.estado,
            billing_period: suscData.billing_period || 'mensual',
            trial_ends_at:  suscData.trial_ends_at,
            period_end:     suscData.current_period_end,
          });
        } else if (typeof plans !== 'undefined') {
          // Sin registro en suscripciones = trial nuevo
          plans.setPlanLocal({ plan: 'trial', estado: 'trial', billing_period: 'mensual', trial_ends_at: null });
        }

        _sbReady = true;
        _ready = true;
      } catch (e) {
        console.warn('[storage] preload Supabase falló, cae a local:', e.message);
        if (window.Sentry) {
          Sentry.captureException(e, { tags: { modulo: 'storage', operacion: 'preload' } });
        }
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
    purgeDemoData: _purgeDemoResidue,
    addData,
    removeFile,
    clearAllData,
    applyFilters,

    // Archivos
    addFile,
    getFiles,
    hasData,
    getOverlappingFiles,
    getHistory,

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

    // Analítica de producto
    trackEvento,

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

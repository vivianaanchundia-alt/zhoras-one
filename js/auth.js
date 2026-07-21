// ════════════════════════════════════════════════════════════════
// CLAROKPIS — auth.js v2.0
// Clerk para identidad (Google + email/pass)
// Roles de negocio en localStorage (Dueño / Asistente / Jefe de Área)
// ════════════════════════════════════════════════════════════════

const auth = (() => {

  // ── CONFIGURACIÓN CLERK ──────────────────────────────────────
  // La publishable key vive en data-clerk-publishable-key del <script> en HTML.
  // NO duplicar aquí — cuando cambies de pk_test a pk_live en producción,
  // solo cambias el atributo HTML (o variable de entorno Netlify), no el código.

  // ── CONSTANTES ───────────────────────────────────────────────
  const LS = {
    role:      'clarokpis_role',
    roleSetup: 'clarokpis_role_setup',
    lastLogin: 'clarokpis_last_login',
    demoUser:  'clarokpis_demo_user',
  };

  const ROLES = {
    OWNER:        'owner',
    ASSISTANT:    'assistant',
    AREA_MANAGER: 'area_manager',
    DEMO:         'demo',
  };

  // Permisos por rol — incluye módulos nuevos
  const PERMISSIONS = {
    owner: {
      modules: ['home','summary','sales','clients','support','inventory',
                'marketing','finance','team','cx','projections','suppliers'],
      canUploadExcel:      false,
      canExportPDF:        true,
      canConfigGoals:      true,
      canConfigPasswords:  true,
      canDeleteFiles:      true,
      canViewFinance:      true,
      canViewAllBranches:  true,
      canViewAllSellers:   true,
    },
    assistant: {
      modules: ['home','summary','sales','clients','support','inventory',
                'marketing','team','cx','projections','suppliers'],
      canUploadExcel:      true,
      canExportPDF:        false,
      canConfigGoals:      false,
      canConfigPasswords:  false,
      canDeleteFiles:      true,
      canViewFinance:      false,
      canViewAllBranches:  true,
      canViewAllSellers:   true,
    },
    area_manager: {
      modules: [], // se define al configurar el rol
      canUploadExcel:      true,
      canExportPDF:        false,
      canConfigGoals:      false,
      canConfigPasswords:  false,
      canDeleteFiles:      false,
      canViewFinance:      false,
      canViewAllBranches:  false,
      canViewAllSellers:   false,
    },
    demo: {
      modules: ['home','summary','sales','clients','support','inventory',
                'marketing','finance','team','cx','projections','suppliers'],
      canUploadExcel:      false,
      canExportPDF:        false,
      canConfigGoals:      false,
      canConfigPasswords:  false,
      canDeleteFiles:      false,
      canViewFinance:      true,
      canViewAllBranches:  true,
      canViewAllSellers:   true,
    },
  };

  // ── ESTADO INTERNO ───────────────────────────────────────────
  let _clerk      = null;   // instancia Clerk
  let _clerkReady = false;  // Clerk inicializado
  let _demoMode   = false;  // modo demo activo

  // ── INICIALIZACIÓN CLERK ─────────────────────────────────────
  /**
   * Espera a que el <script data-clerk-publishable-key> (carga "hotload")
   * inyecte window.Clerk. Antes, si `Clerk` no existía en el instante
   * exacto en que corría initClerk(), se abandonaba de inmediato —
   * causa raíz real del bug "panel real → salta a demo sin poder volver":
   * redirectToSignIn() caía a loginAsDemo() en silencio cuando Clerk
   * todavía no terminaba de cargar (conexión lenta, primer render, etc).
   */
  function _waitForClerkGlobal(timeoutMs = 6000, intervalMs = 100) {
    return new Promise(resolve => {
      if (typeof Clerk !== 'undefined') return resolve(true);
      const start = Date.now();
      const iv = setInterval(() => {
        if (typeof Clerk !== 'undefined') {
          clearInterval(iv);
          resolve(true);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(iv);
          resolve(false);
        }
      }, intervalMs);
    });
  }

  async function initClerk() {
    // Si ya está inicializado, no repetir
    if (_clerkReady) return _clerk;

    // Verificar si la librería Clerk está cargada; si aún no (hotload
    // en curso), esperar activamente antes de rendirse.
    if (typeof Clerk === 'undefined') {
      const appeared = await _waitForClerkGlobal();
      if (!appeared) {
        console.warn('[auth] Clerk no disponible tras esperar — modo fallback');
        _clerkReady = false;
        return null;
      }
    }

    try {
      _clerk = window.Clerk;
      await _clerk.load();

      // ── ESPERAR RESOLUCIÓN DE SESIÓN ───────────────────────────
      // Tras load(), Clerk puede tener user === undefined (sesión AÚN
      // cargando) en vez de null (sin sesión) o un User (con sesión).
      // Decidir demo-vs-real en este instante causaba el bug de
      // "panel real 1-2s → salta a demo". Esperamos a que user deje de
      // ser undefined (se resuelva a User o null) antes de continuar.
      if (_clerk.user === undefined) {
        await _waitForSession(_clerk);
      }

      _clerkReady = true;
      return _clerk;
    } catch(e) {
      console.warn('[auth] Error iniciando Clerk:', e.message);
      _clerkReady = false;
      return null;
    }
  }

  /**
   * Espera a que Clerk resuelva la sesión (user pasa de undefined a
   * User|null). Usa addListener (oficial) y un timeout de seguridad
   * para no bloquear el arranque si algo falla.
   */
  function _waitForSession(clerk, timeoutMs = 4000) {
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try { unsub && unsub(); } catch {}
        clearTimeout(timer);
        resolve();
      };

      // Si ya se resolvió entre el check y aquí, salir de inmediato.
      if (clerk.user !== undefined) return finish();

      // Listener oficial: se dispara cuando cambian client/session/user.
      let unsub = null;
      try {
        unsub = clerk.addListener(() => {
          if (clerk.user !== undefined) finish();
        });
      } catch { /* addListener no disponible → dependemos del timeout */ }

      // Red de seguridad: nunca bloquear más de timeoutMs.
      const timer = setTimeout(finish, timeoutMs);
    });
  }

  // ── MODO DEMO ────────────────────────────────────────────────
  function loginAsDemo() {
    _demoMode = true;
    localStorage.setItem(LS.demoUser, JSON.stringify({
      role:      ROLES.DEMO,
      loginTime: new Date().toISOString(),
      isDemo:    true,
      name:      'Demo',
      email:     'demo@zhorasone.com',
    }));
    document.dispatchEvent(new CustomEvent('clarokpis:login', { detail: { role: ROLES.DEMO } }));
    return { success: true };
  }

  function isDemo() {
    if (_demoMode) return true;
    try {
      const raw = localStorage.getItem(LS.demoUser);
      if (!raw) return false;
      return JSON.parse(raw)?.isDemo === true;
    } catch { return false; }
  }

  // ── SESIÓN CLERK ─────────────────────────────────────────────
  function getClerkUser() {
    if (!_clerkReady || !_clerk?.user) return null;
    return _clerk.user;
  }

  function isLoggedIn() {
    // Demo siempre está "logueado"
    if (isDemo()) return true;
    // Verificar sesión Clerk
    if (_clerkReady && _clerk?.user) return true;
    // Fallback: verificar localStorage (sesión previa)
    try {
      const raw = localStorage.getItem(LS.demoUser);
      return raw ? JSON.parse(raw)?.isDemo === true : false;
    } catch { return false; }
  }

  // ── ROLES DE NEGOCIO ─────────────────────────────────────────
  // Clerk (unsafeMetadata) es la fuente de verdad — sobrevive a cambio de
  // navegador, modo incógnito y limpieza de caché. localStorage es solo
  // caché de arranque para lecturas síncronas (esta función se llama
  // muchas veces por render, no puede depender de una promesa).
  function getCurrentRole() {
    if (isDemo()) return ROLES.DEMO;

    const clerkUser = getClerkUser();
    const metaRole  = clerkUser?.unsafeMetadata?.role;
    if (metaRole) {
      // Repoblar localStorage si está vacío o desactualizado, sin
      // mostrar el modal — evita "me pide el nombre cada vez" en un
      // navegador/dispositivo nuevo donde Clerk ya tiene el rol.
      let cached = {};
      try { cached = JSON.parse(localStorage.getItem(LS.role) || '{}') || {}; } catch (e) { cached = {}; }
      if (cached.role !== metaRole || cached.userId !== clerkUser.id) {
        localStorage.setItem(LS.role, JSON.stringify({
          role:   metaRole,
          name:   clerkUser.unsafeMetadata?.nombre || cached.name || clerkUser.firstName || null,
          setAt:  new Date().toISOString(),
          userId: clerkUser.id,
          email:  clerkUser.emailAddresses?.[0]?.emailAddress || '',
        }));
      }
      return metaRole;
    }

    // Sin metadata en Clerk (o Clerk aún no listo) → caché local
    try {
      const raw = localStorage.getItem(LS.role);
      return raw ? JSON.parse(raw)?.role || null : null;
    } catch { return null; }
  }

  // Evento de seguridad genérico (Bloque 8.5) — fetch directo con el
  // token de Clerk, mismo patrón que _ensureEmpresaAndTrial. auth.js no
  // depende de storage.js (corren en paralelo al arrancar la página).
  async function _logSeguridad(evento, metadata, clerkUser) {
    try {
      const SB_URL  = window.__SUPABASE_URL__  || '';
      const SB_ANON = window.__SUPABASE_ANON__ || '';
      if (!SB_URL || !SB_ANON || !clerkUser) return;
      const token = (_clerkReady && _clerk?.session)
        ? await _clerk.session.getToken({ template: 'supabase' })
        : null;
      if (!token) return;
      await fetch(`${SB_URL}/rest/v1/eventos`, {
        method: 'POST',
        headers: { apikey: SB_ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: clerkUser.id, clerk_user_id: clerkUser.id, evento, metadata }),
      });
    } catch (e) { /* nunca romper el flujo por un evento de seguridad */ }
  }

  async function setRole(role, userName = null) {
    if (!Object.values(ROLES).includes(role)) return;
    const clerkUser = getClerkUser();
    const rolAnterior = getCurrentRole();
    // Preserva el nombre ya guardado si no se pasa uno nuevo (ej. al
    // cambiar de rol después desde Configuración).
    let name = userName;
    if (!name) {
      try { name = JSON.parse(localStorage.getItem(LS.role) || '{}')?.name || null; } catch (e) { name = null; }
    }
    const finalName = name || clerkUser?.firstName || null;
    localStorage.setItem(LS.role, JSON.stringify({
      role,
      name:   finalName,
      setAt:  new Date().toISOString(),
      userId: clerkUser?.id || 'local',
      email:  clerkUser?.emailAddresses?.[0]?.emailAddress || '',
    }));

    // Clerk como fuente de verdad — ver comentario de getCurrentRole().
    if (clerkUser) {
      try {
        await clerkUser.update({
          unsafeMetadata: { ...clerkUser.unsafeMetadata, role, nombre: finalName, onboarded: true },
        });
      } catch (e) {
        console.warn('[auth] No se pudo guardar el rol en Clerk:', e.message);
      }
    }

    // Evento de seguridad: solo en un cambio real, no en la asignación
    // inicial del primer login (ahí no hay "rol anterior" que cambiar).
    if (rolAnterior && rolAnterior !== role) {
      _logSeguridad('seguridad_rol_cambiado', { rol_anterior: rolAnterior, rol_nuevo: role }, clerkUser);
    }

    document.dispatchEvent(new CustomEvent('clarokpis:roleChanged', { detail: { role } }));
  }

  // Iniciales a partir del nombre guardado (para mostrar "subido por").
  function getUserInitials() {
    const user = getCurrentUser();
    const name = user?.name;
    if (!name) return '??';
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '??';
    return parts.length === 1
      ? parts[0].slice(0, 2).toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function isRoleConfigured() {
    if (isDemo()) return true;
    return getCurrentRole() !== null;
  }

  // ── PERMISOS ─────────────────────────────────────────────────
  function can(permission) {
    const role = getCurrentRole();
    if (!role) return false;
    return PERMISSIONS[role]?.[permission] === true;
  }

  function canViewModule(moduleId) {
    const role = getCurrentRole();
    if (!role) return false;
    return PERMISSIONS[role]?.modules?.includes(moduleId) ?? false;
  }

  function getAvailableModules() {
    const role = getCurrentRole();
    if (!role) return [];

    // Módulos permitidos por rol (lógica existente)
    const byRole = [...(PERMISSIONS[role]?.modules || [])];

    // Segunda capa: filtrar por plan de suscripción
    if (typeof plans !== 'undefined') {
      const planId    = plans.getPlanActivo();
      const permitidos = plans.getModulosPermitidos(planId);
      return byRole.filter(m => permitidos.includes(m));
    }

    return byRole;
  }

  // Nueva función: módulos bloqueados por plan (para mostrar 🔒 en sidebar)
  function getLockedModules() {
    if (typeof plans === 'undefined') return [];
    const planId = plans.getPlanActivo();
    return plans.getModulosBloqueados(planId);
  }

  function getCurrentPermissions() {
    const role = getCurrentRole();
    if (!role) return null;
    return { ...PERMISSIONS[role] };
  }

  // ── USUARIO ACTUAL (compatibilidad con código existente) ─────
  function getCurrentUser() {
    if (isDemo()) {
      try {
        const raw = localStorage.getItem(LS.demoUser);
        return raw ? JSON.parse(raw) : { role: 'demo', isDemo: true };
      } catch { return { role: 'demo', isDemo: true }; }
    }

    const clerkUser = getClerkUser();
    const role      = getCurrentRole(); // ya sincroniza LS desde Clerk si aplica
    let savedName   = clerkUser?.unsafeMetadata?.nombre || null;
    if (!savedName) {
      try { savedName = JSON.parse(localStorage.getItem(LS.role) || '{}')?.name || null; } catch (e) { savedName = null; }
    }

    if (!clerkUser && !role) return null;

    return {
      role:      role || 'owner',
      isDemo:    false,
      loginTime: localStorage.getItem(LS.lastLogin) || new Date().toISOString(),
      name:      savedName || clerkUser?.firstName || clerkUser?.emailAddresses?.[0]?.emailAddress || 'Usuario',
      email:     clerkUser?.emailAddresses?.[0]?.emailAddress || '',
      imageUrl:  clerkUser?.imageUrl || null,
    };
  }

  // ── FLUJO DE LOGIN ───────────────────────────────────────────

  /**
   * Redirige a Clerk SignIn (Google + email/pass)
   * Clerk redirige de vuelta a dashboard.html tras login exitoso
   */
  async function redirectToSignIn() {
    const c = await initClerk();
    if (!c) {
      // Antes: caía a modo demo en silencio (causa raíz del bug "panel
      // real → salta a demo sin poder volver"). Ahora se informa el
      // error real para que el usuario reintente en vez de terminar
      // atrapado en una sesión demo que no pidió.
      console.warn('[auth] Clerk no disponible tras esperar');
      const isES = (typeof i18n === 'undefined') || i18n.getLang() !== 'en';
      alert(isES
        ? 'No se pudo conectar el inicio de sesión. Revisa tu conexión y vuelve a intentar.'
        : 'Could not connect to sign-in. Check your connection and try again.');
      return;
    }
    await c.redirectToSignIn({ redirectUrl: window.location.origin + '/dashboard.html' });
  }

  /**
   * Verificar sesión al cargar dashboard.html
   * Si no hay sesión → redirigir a index.html
   * Si hay sesión pero no tiene rol → redirigir a selector de rol
   */
  async function requireAuth() {
    const c = await initClerk();

    // PRIORIDAD: si hay sesión Clerk real, es usuario real (NO demo).
    // Limpia cualquier flag demo residual de pruebas anteriores.
    if (c && c.user) {
      if (_demoMode || localStorage.getItem(LS.demoUser)) {
        localStorage.removeItem(LS.demoUser);
        _demoMode = false;
        // Purgar datos demo residuales de localStorage para que no contaminen
        // el panel real (los datos demo se guardan al ver el demo).
        if (typeof storage !== 'undefined' && storage.purgeDemoData) {
          try { storage.purgeDemoData(); } catch (e) { /* no bloquear login */ }
        }
      }
      // Hay sesión Clerk → guardar último login
      localStorage.setItem(LS.lastLogin, new Date().toISOString());

      // Verificar si tiene rol asignado
      if (!isRoleConfigured()) {
        _showRoleSelectorModal();
        return false;
      }

      // Login de retorno con rol ya configurado: por si la empresa/trial
      // no se llegó a crear en un login anterior (cuenta antigua, fallo
      // de red, etc.). _ensureEmpresaAndTrial es idempotente — no crea
      // una segunda empresa si ya existe. No se espera (no debe bloquear
      // el render); para el primer login real, la creación ocurre en
      // _selectRole() con el nombre de empresa que el usuario escribió.
      _ensureEmpresaAndTrial(c.user);

      return true;
    }

    // No hay sesión Clerk. ¿Es demo intencional?
    if (isDemo()) return true;

    // Ni Clerk ni demo → volver al login
    window.location.href = 'index.html';
    return false;
  }

  /**
   * Verificar en index.html si ya hay sesión → ir directo al dashboard
   */
  async function redirectIfLoggedIn() {
    // Prioridad: sesión Clerk real primero
    const c = await initClerk();
    if (c?.user) {
      // Usuario real → limpiar flag demo residual y entrar a su panel
      localStorage.removeItem(LS.demoUser);
      _demoMode = false;
      window.location.href = 'dashboard.html';
      return true;
    }

    // Solo si NO hay sesión real, respetar demo intencional
    if (isDemo()) {
      window.location.href = 'dashboard.html';
      return true;
    }
    return false;
  }

  // ── LOGOUT ───────────────────────────────────────────────────
  async function logout() {
    // Limpiar demo
    localStorage.removeItem(LS.demoUser);
    _demoMode = false;

    // Limpiar rol — fix de seguridad, no cosmético: en un equipo
    // compartido, sin esto el usuario B heredaba el rol del usuario A
    // que cerró sesión antes que él.
    localStorage.removeItem(LS.role);

    // Purgar residuos de datos demo (antes solo se purgaba al confirmar
    // sesión Clerk real en requireAuth(); si el usuario salía del demo
    // sin volver a entrar de inmediato, los datos demo quedaban en LS
    // y el próximo login real podía mostrarlos brevemente).
    if (typeof storage !== 'undefined' && storage.purgeDemoData) {
      try { storage.purgeDemoData(); } catch (e) { /* no bloquear logout */ }
    }

    // Logout Clerk si está disponible
    if (_clerkReady && _clerk?.user) {
      try { await _clerk.signOut(); } catch(e) { console.warn('[auth] Error en signOut:', e); }
    }

    document.dispatchEvent(new CustomEvent('clarokpis:logout'));
    window.location.href = 'index.html';
  }

  // ── EMPRESA + SUSCRIPCIÓN TRIAL (creación única, primer login) ─
  // D1: empresa_id pasa a ser un UUID propio (tabla `empresas`),
  // desacoplado del usuario. Alcance de este lanzamiento: se crea la
  // estructura y se usa (1 usuario = 1 empresa auto-creada); el
  // multiusuario real (invitaciones) queda para después.
  //
  // Llama directo al REST de Supabase con el anon key + el JWT de Clerk
  // (no a través de storage.js: auth.js corre EN PARALELO a
  // storage.preload(), no puede depender de su cliente interno, que
  // además no está expuesto en la API pública).
  //
  // Idempotente: si el usuario ya tiene una fila usuarios_empresa
  // activa, no crea nada. Nunca lanza — un fallo aquí no debe romper
  // el login.
  // Devuelve trial_ends_at (string ISO) cuando crea la fila por primera
  // vez, o null si ya existía / no aplica / falló. Lo usa _selectRole()
  // para mostrar la bienvenida con la fecha real (Bloque 5.2) — onboarding.html
  // no puede mostrarla porque corre ANTES de Clerk/Supabase (es autónomo
  // a propósito, ver comentario en su <head>).
  async function _ensureEmpresaAndTrial(clerkUser, nombreEmpresa = '') {
    if (!clerkUser) return null;
    const SB_URL  = window.__SUPABASE_URL__  || '';
    const SB_ANON = window.__SUPABASE_ANON__ || '';
    if (!SB_URL || !SB_ANON) return null; // sin credenciales de nube → nada que hacer

    try {
      const token = (_clerkReady && _clerk?.session)
        ? await _clerk.session.getToken({ template: 'supabase' })
        : null;
      if (!token) return null;

      const headers = {
        apikey: SB_ANON,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const yaTiene = await fetch(
        `${SB_URL}/rest/v1/usuarios_empresa?clerk_user_id=eq.${clerkUser.id}&estado=eq.activo&select=empresa_id`,
        { headers }
      ).then(r => r.json()).catch(() => null);
      if (Array.isArray(yaTiene) && yaTiene.length > 0) return null;

      // 1. Crear la empresa
      const nombre = nombreEmpresa?.trim() || (clerkUser.firstName ? `Empresa de ${clerkUser.firstName}` : 'Mi empresa');
      const empRes = await fetch(`${SB_URL}/rest/v1/empresas`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ nombre, creada_por: clerkUser.id }),
      });
      const empData = await empRes.json();
      if (!empRes.ok || !Array.isArray(empData) || !empData[0]?.id) {
        throw new Error('No se pudo crear la empresa: ' + JSON.stringify(empData));
      }
      const empresaId = empData[0].id;

      // 2. usuarios_empresa — quien crea la empresa es el owner
      // No lanza (no debe bloquear el trial si falla), pero el fallo
      // debe quedar visible: antes se tragaba en silencio y rompía el
      // candado de idempotencia de arriba (yaTiene), que depende de
      // esta fila para no reintentar crear otra empresa en cada login.
      const ueRes = await fetch(`${SB_URL}/rest/v1/usuarios_empresa`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          empresa_id:    empresaId,
          clerk_user_id: clerkUser.id,
          rol:           'owner',
          nombre:        clerkUser.firstName || null,
          email:         clerkUser.emailAddresses?.[0]?.emailAddress || null,
        }),
      });
      if (!ueRes.ok) {
        const ueErr = await ueRes.json().catch(() => null);
        console.warn('[auth] usuarios_empresa no se pudo crear (no bloquea el trial):', JSON.stringify(ueErr));
        if (window.Sentry) {
          Sentry.captureMessage('[auth] fallo en usuarios_empresa', {
            extra: { empresaId, clerkUserId: clerkUser.id, error: ueErr },
          });
        }
      }

      // 3. Suscripción trial. empresa_id usa el Clerk user ID (no el UUID
      //    nuevo de arriba) — las tablas existentes (datos_modulo,
      //    archivos, config, metas, suscripciones) NO se migran en este
      //    lanzamiento; siguen usando el user ID como hoy (ver nota en
      //    la migración del Bloque 0). trial_ends_at NUNCA se envía
      //    desde aquí — lo calcula el DEFAULT de la columna en Postgres
      //    (now() + 14 días), así ningún cliente puede alargarse el
      //    trial cambiando la fecha de su equipo.
      const yaSusc = await fetch(
        `${SB_URL}/rest/v1/suscripciones?empresa_id=eq.${clerkUser.id}&select=empresa_id`,
        { headers }
      ).then(r => r.json()).catch(() => null);

      let trialEndsAt = null;
      if (!Array.isArray(yaSusc) || yaSusc.length === 0) {
        // Prefer: return=representation → devuelve la fila creada, con
        // trial_ends_at ya resuelto por el DEFAULT de Postgres. Es la
        // única forma honesta de mostrar la fecha real en la bienvenida.
        const suscRes = await fetch(`${SB_URL}/rest/v1/suscripciones`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({ empresa_id: clerkUser.id, estado: 'trial', plan: 'trial', billing_period: 'mensual' }),
        });
        const suscData = await suscRes.json().catch(() => null);
        trialEndsAt = (Array.isArray(suscData) && suscData[0]?.trial_ends_at) || null;
      }

      // 4. Guardar empresa_id en Clerk — sobrevive a cambio de
      //    navegador/dispositivo, igual que el rol.
      try {
        await clerkUser.update({ unsafeMetadata: { ...clerkUser.unsafeMetadata, empresa_id: empresaId } });
      } catch (e) { /* no crítico: se reintenta en el próximo login */ }

      // Evento de embudo (Bloque 8.2) — primer login real. auth.js no
      // depende de storage.js (corren en paralelo), así que usa el
      // mismo fetch directo que el resto de esta función.
      fetch(`${SB_URL}/rest/v1/eventos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ empresa_id: clerkUser.id, clerk_user_id: clerkUser.id, evento: 'registro' }),
      }).catch(() => {});

      return trialEndsAt;

    } catch (e) {
      console.warn('[auth] No se pudo crear empresa/trial inicial:', e.message);
      if (window.Sentry) {
        Sentry.captureException(e, { tags: { modulo: 'auth', operacion: '_ensureEmpresaAndTrial' } });
      }
      return null;
    }
  }

  // ── MODAL SELECTOR DE ROL (primera vez post-login) ───────────
  function _showRoleSelectorModal() {
    // Eliminar si ya existe
    document.getElementById('roleSelectModal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'roleSelectModal';
    overlay.style.cssText = [
      'position:fixed;inset:0;background:rgba(10,15,30,.95);',
      'z-index:99999;display:flex;align-items:center;justify-content:center;',
      'padding:20px;font-family:Plus Jakarta Sans,system-ui,sans-serif;'
    ].join('');

    const clerkUser = getClerkUser();
    const name      = clerkUser?.firstName || 'Usuario';

    overlay.innerHTML = `
      <div style="background:#111827;border:1px solid #1e2d40;border-radius:20px;
                  width:100%;max-width:460px;padding:32px;text-align:center;">
        <div style="font-size:2rem;margin-bottom:12px;">👋</div>
        <h2 style="font-size:1.3rem;font-weight:800;color:#f0f4ff;margin-bottom:6px;">
          Bienvenido, ${name}
        </h2>
        <p style="font-size:.875rem;color:#8899aa;margin-bottom:20px;">
          ${i18n.t('clerkRoleSelect')}
        </p>

        <div style="text-align:left;margin-bottom:14px;">
          <label style="display:block;font-size:.78rem;font-weight:700;color:#8899aa;margin-bottom:6px;">
            ${i18n.t('clerkNamePrompt')}
          </label>
          <input id="clerkNameInput" type="text" placeholder="${i18n.t('clerkNamePlaceholder')}"
            value="${clerkUser?.firstName ? (clerkUser.firstName + (clerkUser.lastName ? ' ' + clerkUser.lastName : '')) : ''}"
            style="width:100%;padding:11px 14px;border-radius:10px;background:#1a2234;
                   border:1px solid #1e2d40;color:#f0f4ff;font-size:.88rem;box-sizing:border-box;" />
          <div style="font-size:.72rem;color:#4a5568;margin-top:5px;">${i18n.t('clerkNameHelp')}</div>
        </div>

        <div style="text-align:left;margin-bottom:20px;">
          <label style="display:block;font-size:.78rem;font-weight:700;color:#8899aa;margin-bottom:6px;">
            ${i18n.t('clerkCompanyPrompt')}
          </label>
          <input id="clerkCompanyInput" type="text" placeholder="${i18n.t('clerkCompanyPlaceholder')}"
            style="width:100%;padding:11px 14px;border-radius:10px;background:#1a2234;
                   border:1px solid #1e2d40;color:#f0f4ff;font-size:.88rem;box-sizing:border-box;" />
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
          ${[
            { role:'owner',        icon:'👑', labelKey:'clerkOwnerModalLabel',       descKey:'clerkOwnerModalDesc' },
            { role:'assistant',    icon:'🛠️', labelKey:'clerkAssistantModalLabel',   descKey:'clerkAssistantModalDesc' },
            { role:'area_manager', icon:'📊', labelKey:'clerkAreaManagerModalLabel', descKey:'clerkAreaManagerModalDesc' },
          ].map(r => `
            <button onclick="auth._selectRole('${r.role}')"
              style="display:flex;align-items:center;gap:14px;padding:14px 16px;
                     background:#1a2234;border:1px solid #1e2d40;border-radius:12px;
                     cursor:pointer;text-align:left;transition:border-color .15s;width:100%;"
              onmouseover="this.style.borderColor='#3b82f6'"
              onmouseout="this.style.borderColor='#1e2d40'">
              <span style="font-size:1.4rem;flex-shrink:0;">${r.icon}</span>
              <div>
                <div style="font-size:.9rem;font-weight:700;color:#f0f4ff;">${i18n.t(r.labelKey)}</div>
                <div style="font-size:.78rem;color:#8899aa;margin-top:2px;">${i18n.t(r.descKey)}</div>
              </div>
            </button>
          `).join('')}
        </div>

        <p style="font-size:.75rem;color:#4a5568;">
          ${i18n.t('clerkRoleDesc')}
        </p>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  // Llamado desde el botón del modal
  async function _selectRole(role) {
    const nameInput    = document.getElementById('clerkNameInput');
    const companyInput = document.getElementById('clerkCompanyInput');
    const typedName    = nameInput ? nameInput.value.trim() : '';
    if (!typedName) {
      nameInput?.focus();
      nameInput && (nameInput.style.borderColor = '#ef4444');
      showToast && showToast('⚠️ ' + i18n.t('clerkNameRequired'), 'yellow');
      return;
    }
    await setRole(role, typedName);
    // Primer login real: crea la empresa con el nombre que escribió el
    // usuario. requireAuth() ya no dispara esta creación mientras el
    // modal está abierto (ver comentario ahí) — pasa una sola vez, aquí.
    const trialEndsAt = await _ensureEmpresaAndTrial(getClerkUser(), companyInput ? companyInput.value.trim() : '');
    document.getElementById('roleSelectModal')?.remove();

    // Correo de bienvenida (Bloque 7) — fire-and-forget, nunca bloquea
    // el login. Solo en la creación real (trialEndsAt truthy), no en
    // logins de retorno.
    if (trialEndsAt) {
      _sendWelcomeEmail(typedName);
    }

    // Bienvenida en pantalla (Bloque 5.2) con la fecha REAL de fin de
    // trial, antes de recargar. Si trialEndsAt viene null (cuenta ya
    // existía, fallo de red, etc.) se salta directo al dashboard sin
    // bloquear el login.
    if (trialEndsAt) {
      _showWelcomeTrialModal(trialEndsAt);
    } else {
      window.location.reload();
    }
  }

  // Correo de bienvenida (Bloque 7) — endpoint propio porque el
  // navegador no puede llamar a _lib/emails.js directo (es server-side).
  // Nunca bloquea el login: cualquier fallo queda en consola.
  async function _sendWelcomeEmail(nombre) {
    try {
      const token = (_clerkReady && _clerk?.session)
        ? await _clerk.session.getToken({ template: 'supabase' })
        : null;
      if (!token) return;
      await fetch('/.netlify/functions/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nombre, lang: (typeof i18n !== 'undefined') ? i18n.getLang() : 'es' }),
      });
    } catch (e) { /* no crítico */ }
  }

  // Pantalla de bienvenida con la fecha exacta de fin de trial (Bloque
  // 5.2). Se muestra UNA vez, justo tras crear la empresa. El botón
  // "Empezar" recarga la página para aplicar permisos y entrar al panel.
  function _showWelcomeTrialModal(trialEndsAt) {
    document.getElementById('welcomeTrialModal')?.remove();
    const isES = i18n.getLang() !== 'en';
    const fecha = new Date(trialEndsAt).toLocaleDateString(isES ? 'es-CL' : 'en-US', { day: 'numeric', month: 'long' });

    const overlay = document.createElement('div');
    overlay.id = 'welcomeTrialModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,30,.95);z-index:99999;' +
      'display:flex;align-items:center;justify-content:center;padding:20px;font-family:Plus Jakarta Sans,system-ui,sans-serif;';
    overlay.innerHTML = `
      <div style="background:#111827;border:1px solid #1e2d40;border-radius:20px;width:100%;max-width:460px;padding:32px;text-align:center;">
        <div style="font-size:2rem;margin-bottom:12px;">🎉</div>
        <h2 style="font-size:1.2rem;font-weight:800;color:#f0f4ff;margin-bottom:14px;">
          ${i18n.t('welcomeTrialTitle')}
        </h2>
        <p style="font-size:.88rem;color:#c7d2e1;line-height:1.6;margin-bottom:10px;">
          ${i18n.t('welcomeTrialBody')}
        </p>
        <div style="font-size:.95rem;font-weight:700;color:#3b82f6;background:rgba(59,130,246,.1);border-radius:10px;padding:10px 14px;margin-bottom:14px;">
          📅 ${i18n.t('welcomeTrialDate').replace('{date}', fecha)}
        </div>
        <p style="font-size:.78rem;color:#8899aa;margin-bottom:22px;line-height:1.5;">
          ${i18n.t('welcomeTrialCharge').replace('{date}', fecha)}
        </p>
        <button id="welcomeTrialStart" class="btn btn-primary" style="width:100%;">
          ${i18n.t('welcomeTrialStartBtn')}
        </button>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('welcomeTrialStart').onclick = () => window.location.reload();
  }

  // ── COMPATIBILIDAD (funciones que usa el dashboard actual) ───
  // login() via contraseña legacy eliminado — autenticación solo via Clerk.
  // Cualquier llamada a auth.login() que quede en el código debe migrar
  // a auth.redirectToSignIn() (usuarios reales) o auth.loginAsDemo() (demo).
  function login(role) {
    if (role === ROLES.DEMO) return loginAsDemo();
    // Redirigir a Clerk en vez de aceptar contraseña local
    redirectToSignIn();
    return { success: false, error: 'use_clerk' };
  }

  function changePassword() {
    // Clerk gestiona el cambio de contraseña — abre el portal de perfil nativo
    if (_clerkReady && _clerk?.user) {
      _clerk.openUserProfile();
    } else {
      // Si Clerk no está listo, redirigir al login para que reautentica
      redirectToSignIn();
    }
  }

  // setupPasswords e isSetupDone eliminados — pertenecían al sistema de
  // contraseñas locales legacy. Con Clerk, el setup de acceso lo gestiona
  // Clerk directamente. isRoleConfigured() reemplaza a isSetupDone().
  function getRoles() { return { ...ROLES }; }

  // ── INICIALIZACIÓN ───────────────────────────────────────────
  // Auto-iniciar Clerk en segundo plano (no bloquea render)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initClerk());
  } else {
    initClerk();
  }

  // ── API PÚBLICA ──────────────────────────────────────────────
  return {
    // Core
    initClerk,
    redirectToSignIn,
    requireAuth,
    redirectIfLoggedIn,
    logout,

    // Sesión
    isLoggedIn,
    isDemo,
    getCurrentUser,
    getCurrentRole,
    getCurrentPermissions,
    getClerkUser,

    // Roles
    setRole,
    isRoleConfigured,
    getRoles,
    getUserInitials,
    ROLES,

    // Permisos
    can,
    canViewModule,
    getAvailableModules,
    getLockedModules,

    // Compatibilidad con código existente
    login,
    loginAsDemo,
    changePassword,

    // Interno (acceso desde modal)
    _selectRole,
    _showRoleSelectorModal,
  };
})();

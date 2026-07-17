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
  function getCurrentRole() {
    if (isDemo()) return ROLES.DEMO;
    try {
      const raw = localStorage.getItem(LS.role);
      return raw ? JSON.parse(raw)?.role || null : null;
    } catch { return null; }
  }

  function setRole(role, userName = null) {
    if (!Object.values(ROLES).includes(role)) return;
    const clerkUser = getClerkUser();
    // Preserva el nombre ya guardado si no se pasa uno nuevo (ej. al
    // cambiar de rol después desde Configuración).
    let name = userName;
    if (!name) {
      try { name = JSON.parse(localStorage.getItem(LS.role) || '{}')?.name || null; } catch (e) { name = null; }
    }
    localStorage.setItem(LS.role, JSON.stringify({
      role,
      name:   name || clerkUser?.firstName || null,
      setAt:  new Date().toISOString(),
      userId: clerkUser?.id || 'local',
      email:  clerkUser?.emailAddresses?.[0]?.emailAddress || '',
    }));
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
    const role      = getCurrentRole();
    let savedName   = null;
    try { savedName = JSON.parse(localStorage.getItem(LS.role) || '{}')?.name || null; } catch (e) { savedName = null; }

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

        <div style="text-align:left;margin-bottom:20px;">
          <label style="display:block;font-size:.78rem;font-weight:700;color:#8899aa;margin-bottom:6px;">
            ${i18n.t('clerkNamePrompt')}
          </label>
          <input id="clerkNameInput" type="text" placeholder="${i18n.t('clerkNamePlaceholder')}"
            value="${clerkUser?.firstName ? (clerkUser.firstName + (clerkUser.lastName ? ' ' + clerkUser.lastName : '')) : ''}"
            style="width:100%;padding:11px 14px;border-radius:10px;background:#1a2234;
                   border:1px solid #1e2d40;color:#f0f4ff;font-size:.88rem;box-sizing:border-box;" />
          <div style="font-size:.72rem;color:#4a5568;margin-top:5px;">${i18n.t('clerkNameHelp')}</div>
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
  function _selectRole(role) {
    const nameInput = document.getElementById('clerkNameInput');
    const typedName = nameInput ? nameInput.value.trim() : '';
    if (!typedName) {
      nameInput?.focus();
      nameInput && (nameInput.style.borderColor = '#ef4444');
      showToast && showToast('⚠️ ' + i18n.t('clerkNameRequired'), 'yellow');
      return;
    }
    setRole(role, typedName);
    document.getElementById('roleSelectModal')?.remove();
    // Recargar para aplicar permisos
    window.location.reload();
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

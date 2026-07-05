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
  async function initClerk() {
    // Si ya está inicializado, no repetir
    if (_clerkReady) return _clerk;

    // Verificar si la librería Clerk está cargada
    if (typeof Clerk === 'undefined') {
      console.warn('[auth] Clerk no disponible — modo fallback');
      _clerkReady = false;
      return null;
    }

    try {
      _clerk = window.Clerk;
      await _clerk.load();
      _clerkReady = true;
      return _clerk;
    } catch(e) {
      console.warn('[auth] Error iniciando Clerk:', e.message);
      _clerkReady = false;
      return null;
    }
  }

  // ── MODO DEMO ────────────────────────────────────────────────
  function loginAsDemo() {
    _demoMode = true;
    localStorage.setItem(LS.demoUser, JSON.stringify({
      role:      ROLES.DEMO,
      loginTime: new Date().toISOString(),
      isDemo:    true,
      name:      'Demo',
      email:     'demo@zhoras.com',
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

  function setRole(role) {
    if (!Object.values(ROLES).includes(role)) return;
    const clerkUser = getClerkUser();
    localStorage.setItem(LS.role, JSON.stringify({
      role,
      setAt:  new Date().toISOString(),
      userId: clerkUser?.id || 'local',
      email:  clerkUser?.emailAddresses?.[0]?.emailAddress || '',
    }));
    document.dispatchEvent(new CustomEvent('clarokpis:roleChanged', { detail: { role } }));
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

    if (!clerkUser && !role) return null;

    return {
      role:      role || 'owner',
      isDemo:    false,
      loginTime: localStorage.getItem(LS.lastLogin) || new Date().toISOString(),
      name:      clerkUser?.firstName || clerkUser?.emailAddresses?.[0]?.emailAddress || 'Usuario',
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
      // Fallback si Clerk no carga: ir al dashboard en modo demo
      console.warn('[auth] Clerk no disponible — modo demo');
      loginAsDemo();
      window.location.href = 'dashboard.html';
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
    // Demo siempre pasa
    if (isDemo()) return true;

    const c = await initClerk();

    // Clerk no disponible → modo demo automático para no bloquear
    if (!c || !c.user) {
      const hasDemo = (() => {
        try { return JSON.parse(localStorage.getItem(LS.demoUser))?.isDemo; } catch { return false; }
      })();
      if (!hasDemo) {
        window.location.href = 'index.html';
        return false;
      }
      return true;
    }

    // Hay sesión Clerk → guardar último login
    localStorage.setItem(LS.lastLogin, new Date().toISOString());

    // Verificar si tiene rol asignado
    if (!isRoleConfigured()) {
      // Primera vez → mostrar modal de selección de rol
      _showRoleSelectorModal();
      return false;
    }

    return true;
  }

  /**
   * Verificar en index.html si ya hay sesión → ir directo al dashboard
   */
  async function redirectIfLoggedIn() {
    if (isDemo()) {
      window.location.href = 'dashboard.html';
      return true;
    }

    const c = await initClerk();
    if (c?.user) {
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
        <p style="font-size:.875rem;color:#8899aa;margin-bottom:28px;">
          ${i18n.t('clerkRoleSelect')}
        </p>

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
    setRole(role);
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

// ════════════════════════════════════════════════════════════════
// CLAROKPIS — app.js v2.0
// Estado global, routing, sidebar, módulos nuevos
// Compatible 100% con dashboard.html existente
// ════════════════════════════════════════════════════════════════

// ── DEFINICIÓN DE MÓDULOS ────────────────────────────────────────
// Incluye módulos existentes + nuevos aprobados
const MODULE_DEFS = [
  { id:'home',        icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`, i18nKey:'moduleHome',        roles:['owner','assistant','area_manager','demo'] },
  { id:'summary',     icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="8" x="2" y="2" rx="2"/><rect width="8" height="8" x="14" y="2" rx="2"/><rect width="8" height="8" x="2" y="14" rx="2"/><rect width="8" height="8" x="14" y="14" rx="2"/></svg>`, i18nKey:'moduleSummary',     roles:['owner','assistant','demo'] },
  { id:'sales',       icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`, i18nKey:'moduleSales',       roles:['owner','assistant','area_manager','demo'] },
  { id:'clients',     icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`, i18nKey:'moduleClients',     roles:['owner','assistant','area_manager','demo'] },
  { id:'support',     icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`, i18nKey:'moduleSupport',     roles:['owner','assistant','area_manager','demo'] },
  { id:'inventory',   icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`, i18nKey:'moduleInventory',   roles:['owner','assistant','area_manager','demo'] },
  { id:'marketing',   icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 19-9-9 19-2-8-8-2z"/></svg>`, i18nKey:'moduleMarketing',   roles:['owner','assistant','demo'] },
  { id:'finance',     icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`, i18nKey:'moduleFinance',     roles:['owner','demo'] },           // solo Dueño
  { id:'team',        icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>`, i18nKey:'moduleTeam',        roles:['owner','assistant','demo'] },
  { id:'cx',          icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>`, i18nKey:'moduleCX',          roles:['owner','assistant','area_manager','demo'] },
  { id:'projections', icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`, i18nKey:'moduleProjections', roles:['owner','assistant','demo'] },
  // Módulos nuevos aprobados
  { id:'suppliers',   icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>`, i18nKey:'moduleSuppliers',   roles:['owner','assistant','demo'] },
  { id:'margin',      icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>`, i18nKey:'moduleMargin',      roles:['owner','demo'] },           // solo Dueño
  { id:'goals',       icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`, i18nKey:'goalsTitle',        roles:['owner'] },                  // solo Dueño
  { id:'collections', icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/><line x1="6" x2="6.01" y1="15" y2="15"/><line x1="10" x2="12" y1="15" y2="15"/></svg>`, i18nKey:'moduleCollections',  roles:['owner','demo'], module:'collections' },
  { id:'settings',    icon:'⚙️', i18nKey:'settings',          roles:['owner','assistant','area_manager','demo'], hidden:true },
];

// ── ROUTING ──────────────────────────────────────────────────────
function navigateTo(moduleId, pushHistory = true) {
  // Validar que el módulo existe y el usuario tiene acceso
  const def = MODULE_DEFS.find(m => m.id === moduleId);
  if (!def) { navigateTo('home', false); return; }

  const role = auth.getCurrentRole();
  if (!def.roles.includes(role)) {
    showToast('🔒 ' + i18n.t('errorNoPermission'), 'yellow');
    return;
  }

  app.previousModule = app.currentModule;
  app.currentModule  = moduleId;

  // Actualizar hash sin recargar
  if (pushHistory) {
    history.pushState({ module: moduleId }, '', '#' + moduleId);
  }

  // Actualizar sidebar activo
  _updateSidebarActive(moduleId);

  // Actualizar breadcrumb
  _updateBreadcrumb(moduleId);

  // Cerrar sidebar en móvil
  if (window.innerWidth < 1024) closeSidebar();

  // Limpiar drilldown si es navegación a módulo raíz
  app.drilldown = [];
  app.client360Id = null;

  // Renderizar módulo con skeleton primero
  _renderWithSkeleton(moduleId);
}

// Navegar atrás (breadcrumb)
function navigateBack() {
  if (app.drilldown.length > 0) {
    app.drilldown.pop();
    renderCurrentModule();
  } else if (app.previousModule) {
    navigateTo(app.previousModule);
  } else {
    navigateTo('home');
  }
}

// Alias para compatibilidad con código existente
function renderCurrentModule() {
  _renderWithSkeleton(app.currentModule);
}

// ── RENDER CON SKELETON ──────────────────────────────────────────
function _renderWithSkeleton(moduleId) {
  const area = document.getElementById('contentArea');
  if (!area) return;

  // Mostrar skeleton inmediatamente
  area.innerHTML = _buildSkeleton();

  // Renderizar módulo en el siguiente tick (no bloquea UI)
  requestAnimationFrame(() => {
    try {
      _renderModule(moduleId, area);
    } catch(e) {
      console.error('[app] Error renderizando módulo', moduleId, e);
      area.innerHTML = _buildErrorCard(moduleId, e.message);
    }
  });
}

function _renderModule(moduleId, area) {
  const renderers = {
    home:        () => typeof renderHome        === 'function' ? renderHome(area)        : _placeholder(area, 'Home'),
    summary:     () => typeof renderSummary     === 'function' ? renderSummary(area)     : _placeholder(area, 'Resumen Ejecutivo'),
    sales:       () => typeof renderSales       === 'function' ? renderSales(area)       : _placeholder(area, 'Ventas'),
    clients:     () => typeof renderClients     === 'function' ? renderClients(area)     : _placeholder(area, 'Clientes'),
    support:     () => typeof renderSupport     === 'function' ? renderSupport(area)     : _placeholder(area, 'Atención al Cliente'),
    inventory:   () => typeof renderInventory   === 'function' ? renderInventory(area)   : _placeholder(area, 'Inventario'),
    marketing:   () => typeof renderMarketing   === 'function' ? renderMarketing(area)   : _placeholder(area, 'Marketing'),
    finance:     () => typeof renderFinance     === 'function' ? renderFinance(area)     : _placeholder(area, 'Finanzas'),
    team:        () => typeof renderTeam        === 'function' ? renderTeam(area)        : _placeholder(area, 'Equipo'),
    cx:          () => typeof renderCX          === 'function' ? renderCX(area)          : _placeholder(area, 'CX'),
    projections: () => typeof renderProjections === 'function' ? renderProjections(area) : _placeholder(area, 'Proyecciones'),
    suppliers:   () => typeof renderSuppliers   === 'function' ? renderSuppliers(area)   : _placeholder(area, 'Proveedores'),
    margin:      () => typeof renderMargin      === 'function' ? renderMargin(area)      : _placeholder(area, 'Precio y Margen'),
    goals:       () => typeof renderGoals       === 'function' ? renderGoals(area)       : _placeholder(area, 'Metas'),
    settings:    () => typeof renderSettings    === 'function' ? renderSettings(area)    : _placeholder(area, 'Configuración'),
    collections: () => typeof collectionsModule !== 'undefined' ? collectionsModule.render(area) : _placeholder(area, 'Cobranzas'),
  };

  const render = renderers[moduleId];
  if (render) render();
  else _placeholder(area, moduleId);
}

// ── SIDEBAR ──────────────────────────────────────────────────────
function buildSidebarNav() {
  const nav  = document.getElementById('sidebarNav');
  if (!nav) return;

  const role    = auth.getCurrentRole();
  const hasData = storage.hasData();
  const alerts  = storage.getActiveAlerts();

  const visible = MODULE_DEFS.filter(m =>
    !m.hidden &&
    m.roles.includes(role)
  );

  nav.innerHTML = visible.map(m => {
    const alertCount = alerts.filter(a => a.module === m.id).length;
    const badge = alertCount > 0
      ? `<span class="nav-badge">${alertCount}</span>`
      : '';
    const isActive = app.currentModule === m.id ? ' active' : '';
    const isLocked = !hasData && !['home','settings'].includes(m.id) && !auth.isDemo()
      ? ' nav-item-locked'
      : '';
    return `
      <div class="nav-item${isActive}${isLocked}" onclick="navigateTo('${m.id}')" data-module="${m.id}">
        <span class="nav-item-icon">${m.icon}</span>
        <span class="nav-item-label" data-i18n="${m.i18nKey}">${i18n.t(m.i18nKey)}</span>
        ${badge}
      </div>
    `;
  }).join('');

  // Mostrar/ocultar banner demo
  const demoBanner = document.querySelector('.demo-banner-strip');
  if (demoBanner) {
    demoBanner.style.display = auth.isDemo() ? 'flex' : 'none';
  }
}

function _updateSidebarActive(moduleId) {
  document.querySelectorAll('.nav-item[data-module]').forEach(el => {
    el.classList.toggle('active', el.dataset.module === moduleId);
  });
}

// ── BREADCRUMB ───────────────────────────────────────────────────
function _updateBreadcrumb(moduleId) {
  const bc = document.getElementById('headerBreadcrumb');
  if (!bc) return;

  const def   = MODULE_DEFS.find(m => m.id === moduleId);
  const label = def ? i18n.t(def.i18nKey) : moduleId;

  let html = `<div class="breadcrumb">`;

  if (moduleId !== 'home') {
    html += `<span class="breadcrumb-item" onclick="navigateTo('home')">${i18n.t('moduleHome')}</span>`;
    html += `<span class="breadcrumb-sep">›</span>`;
  }

  // Drilldown items
  app.drilldown.forEach((item, i) => {
    html += `<span class="breadcrumb-item" onclick="navigateToDrilldown(${i})">${item.label}</span>`;
    html += `<span class="breadcrumb-sep">›</span>`;
  });

  html += `<span class="breadcrumb-active">${label}</span>`;
  html += `</div>`;

  bc.innerHTML = html;
}

// Push drilldown (ej: Clientes → Ficha de Carlos Mendoza)
function pushDrilldown(label, moduleId, params) {
  app.drilldown.push({ label, moduleId, params });
  _updateBreadcrumb(app.currentModule);
}

function navigateToDrilldown(index) {
  app.drilldown = app.drilldown.slice(0, index);
  renderCurrentModule();
}

// ── FICHA CLIENTE 360° ───────────────────────────────────────────
function openClient360(clientId) {
  app.client360Id = clientId;
  pushDrilldown(i18n.t('client360Title'), 'clients', { clientId });

  const area = document.getElementById('contentArea');
  if (!area) return;

  area.innerHTML = _buildSkeleton();

  requestAnimationFrame(() => {
    try {
      if (typeof renderClient360 === 'function') {
        renderClient360(area, clientId);
      } else {
        _placeholder(area, 'Ficha Cliente 360° — ' + clientId);
      }
    } catch(e) {
      area.innerHTML = _buildErrorCard('client360', e.message);
    }
  });
}

// ── INFO DE USUARIO EN SIDEBAR ───────────────────────────────────
function updateUserInfo() {
  const user   = auth.getCurrentUser();
  const avatar = document.getElementById('sidebarAvatar');
  const name   = document.getElementById('sidebarRoleName');

  if (!user) return;

  const roleLabels = {
    owner:        i18n.t('roleOwner'),
    assistant:    i18n.t('roleAssistant'),
    area_manager: i18n.t('roleAreaManager'),
    demo:         i18n.t('roleDemo'),
  };

  if (avatar) {
    // Si Clerk tiene foto, usarla
    if (user.imageUrl) {
      avatar.innerHTML = `<img src="${user.imageUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="avatar">`;
    } else {
      const initial = (user.name || user.email || 'U')[0].toUpperCase();
      avatar.textContent = initial;
    }
  }

  if (name) {
    const displayName = user.name && user.name !== user.role
      ? user.name
      : roleLabels[user.role] || user.role;
    name.textContent = displayName;
  }
}

// ── SIDEBAR MÓVIL ────────────────────────────────────────────────
function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const isOpen   = sidebar?.classList.contains('sidebar-open');

  sidebar?.classList.toggle('sidebar-open', !isOpen);
  overlay?.classList.toggle('hidden', isOpen);
  document.body.style.overflow = isOpen ? '' : 'hidden';
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('sidebar-open');
  document.getElementById('sidebarOverlay')?.classList.add('hidden');
  document.body.style.overflow = '';
}

// ── MODALES ───────────────────────────────────────────────────────
function showModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    // Trap focus dentro del modal
    setTimeout(() => el.querySelector('input, button, textarea')?.focus(), 50);
  }
}

function hideModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function toggleHeaderMenu() {
  document.getElementById('headerMenu')?.classList.toggle('hidden');
}

// ── TOAST ─────────────────────────────────────────────────────────
function showToast(msg, type = 'green') {
  const colors = {
    green:  '#22c55e',
    yellow: '#f59e0b',
    red:    '#ef4444',
    blue:   '#3b82f6',
  };
  const color = colors[type] || colors.green;
  const toast = document.createElement('div');
  toast.style.cssText = [
    `background:rgba(15,23,42,.96);`,
    `border:1px solid ${color}44;`,
    `color:${color};`,
    `padding:10px 18px;border-radius:10px;`,
    `font-size:.85rem;font-weight:600;`,
    `box-shadow:0 4px 20px rgba(0,0,0,.4);`,
    `animation:fadeInUp .2s ease;`,
    `white-space:nowrap;pointer-events:auto;`,
    `font-family:Plus Jakarta Sans,system-ui,sans-serif;`,
  ].join('');
  toast.textContent = msg;

  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ── FORMATTERS (compatibilidad y uso global) ──────────────────────
function formatCurrency(n, sym) {
  const cfg = storage.getConfig();
  const s   = sym || cfg.currencySymbol || '$';
  if (n === null || n === undefined || isNaN(n)) return `${s}—`;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${s}${(abs/1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${s}${(abs/1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${s}${(abs/1e3).toFixed(0)}K`;
  return `${sign}${s}${Math.round(abs).toLocaleString('es-CL')}`;
}

function formatCurrencyFull(n, sym) {
  const cfg = storage.getConfig();
  const s   = sym || cfg.currencySymbol || '$';
  if (n === null || n === undefined || isNaN(n)) return `${s}—`;
  return `${s}${Math.round(n).toLocaleString('es-CL')}`;
}

function formatPct(n, decimals = 1) {
  if (n === null || n === undefined || isNaN(n)) return '—%';
  return `${n.toFixed(decimals)}%`;
}

function formatNum(n, decimals = 0) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n.toFixed(decimals)).toLocaleString('es-CL');
}

function getStatusColor(status) {
  return {
    green:  '#22c55e',
    yellow: '#f59e0b',
    red:    '#ef4444',
    na:     '#64748b',
  }[status] || '#64748b';
}

function getHealthColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

// ── DELTA — comparación automática en KPI cards ───────────────────
function calcDelta(currentVal, module, campo, currentFilters) {
  try {
    const prevRange = storage.getPreviousPeriodRange(currentFilters);
    if (!prevRange) return null;

    const allData  = storage.getData(module);
    const prevData = storage.applyFilters(allData, prevRange);
    const prevVal  = prevData.reduce((s, r) => s + (parseFloat(r[campo]) || 0), 0);

    if (!prevVal) return null;
    const pct = ((currentVal - prevVal) / prevVal) * 100;
    return i18n.formatDelta(pct, currentFilters?.compareMode);
  } catch { return null; }
}


// ── LOGO EMPRESA ──────────────────────────────────────────────────
function handleLogoUpload(input) {
  const file = input.files?.[0];
  if (!file) return;

  // Validar tipo
  const allowed = ['image/png','image/jpeg','image/webp','image/svg+xml'];
  if (!allowed.includes(file.type)) {
    showToast(i18n.t('logoInvalidType'), 'red'); input.value = ''; return;
  }
  // Validar tamaño (2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast(i18n.t('logoTooBig'), 'red'); input.value = ''; return;
  }

  showToast(i18n.t('logoUploading'), 'blue');

  // SVG: guardar directo como base64 (ya es pequeño)
  if (file.type === 'image/svg+xml') {
    const reader = new FileReader();
    reader.onload = e => {
      _saveLogo(e.target.result);
    };
    reader.readAsDataURL(file);
    return;
  }

  // PNG/JPG/WebP: resize a 240×80 con canvas
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX_W = 240, MAX_H = 80;
      // Calcular escala manteniendo aspect ratio
      const scale = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL('image/png', 0.92);
      _saveLogo(base64);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function _saveLogo(base64) {
  if (!auth.isDemo()) {
    storage.setConfig({ companyLogo: base64 });
    updateCompanyBranding();
    renderCurrentModule(); // Refrescar settings para mostrar el preview
    showToast(i18n.t('logoSuccess'), 'green');
  } else {
    showToast('🔒 ' + (i18n.getLang()==='es' ? 'No disponible en demo' : 'Not available in demo'), 'yellow');
  }
}

function removeLogo() {
  if (auth.isDemo()) { showToast('🔒 ' + (i18n.getLang()==='es' ? 'No disponible en demo' : 'Not available in demo'), 'yellow'); return; }
  storage.setConfig({ companyLogo: '' });
  updateCompanyBranding();
  renderCurrentModule();
  showToast(i18n.getLang()==='es' ? '🗑️ Logo eliminado' : '🗑️ Logo removed', 'yellow');
}

// ── BRANDING ──────────────────────────────────────────────────────
function updateCompanyBranding() {
  const cfg = storage.getConfig();
  // Nombre en sidebar
  const logoName = document.querySelector('.sidebar-logo-name');
  if (logoName) logoName.textContent = cfg.companyName || 'Zhoras One';
  if (cfg.companyName) document.title = cfg.companyName + ' — Zhoras One';
  // Logo en sidebar: imagen o icono por defecto
  const iconWrap = document.querySelector('.sidebar-logo-icon');
  if (iconWrap) {
    if (cfg.companyLogo) {
      iconWrap.innerHTML = `<img src="${cfg.companyLogo}" style="max-width:28px;max-height:28px;object-fit:contain;border-radius:4px;" alt="logo" />`;
      iconWrap.style.background = 'rgba(255,255,255,.06)';
      iconWrap.style.cursor = 'pointer';
      iconWrap.title = i18n.t('logoClickToChange');
      iconWrap.onclick = () => document.getElementById('logoFileInput')?.click();
    } else {
      iconWrap.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`;
      iconWrap.style.background = '';
      iconWrap.style.cursor = 'pointer';
      iconWrap.title = i18n.t('logoUploadBtn');
      iconWrap.onclick = () => document.getElementById('logoFileInput')?.click();
    }
  }
}

function updateCurrencyIndicator() {
  const cfg = storage.getConfig();
  const sym = cfg.currencySymbol || '$';
  const lbl = cfg.currencyLabel  || cfg.currency || 'CLP';

  let el = document.getElementById('currencyIndicator');
  if (!el) {
    el = document.createElement('span');
    el.id = 'currencyIndicator';
    el.style.cssText = [
      'display:inline-flex;align-items:center;gap:4px;',
      'padding:4px 10px;background:var(--color-card);',
      'border:1px solid var(--color-border);border-radius:6px;',
      'font-size:.75rem;font-weight:700;color:var(--color-text-muted);',
      'cursor:pointer;white-space:nowrap;margin-right:4px;',
    ].join('');
    el.onclick = () => navigateTo('settings');
    const ha = document.querySelector('.header-actions');
    if (ha) ha.insertBefore(el, ha.firstChild);
  }
  el.innerHTML = `💱 ${sym} ${lbl}`;
}

function applyCurrencyChange(currency, sym, label) {
  storage.setConfig({ currency, currencySymbol: sym, currencyLabel: label });
  updateCurrencyIndicator();
  renderCurrentModule();
  showToast(`💱 ${label} (${sym})`, 'green');
}

function applyCompanySettings() {
  if (auth.isDemo()) { showToast('🔒 No disponible en demo', 'yellow'); return; }
  const name = (document.getElementById('companyNameInput')?.value || '').trim();
  storage.setConfig({ companyName: name });
  updateCompanyBranding();
  showToast('✅ ' + i18n.t('configSaved'), 'green');
}

// ── DEMO ──────────────────────────────────────────────────────────
function reloadDemoData() {
  if (!auth.isDemo()) return;
  const msg = i18n.getLang() === 'es' ? i18n.t('confirmReloadDemo') : 'Reload demo data?';
  if (!confirm(msg)) return;
  storage.clearAllData();
  loadDemoData().then(() => {
    buildSidebarNav();
    renderCurrentModule();
    showToast('🔄 Demo recargado', 'green');
  });
}

// ── EXPORTAR PDF (existente, mejorado) ────────────────────────────
function exportPDF() {
  if (typeof html2pdf === 'undefined') {
    showToast('⏳ ' + i18n.t('loading'), 'blue');
    return;
  }
  const area = document.getElementById('contentArea');
  if (!area) { showToast('❌ Sin contenido', 'red'); return; }

  showToast('📄 Generando PDF…', 'blue');

  const cfg    = storage.getConfig();
  const isDemo = auth.isDemo();
  const filename = `clarokpis-${app.currentModule}-${new Date().toISOString().split('T')[0]}${isDemo ? '-DEMO' : ''}.pdf`;
  const lang   = i18n.getLang();
  const dateStr = new Date().toLocaleDateString(lang === 'es' ? 'es-CL' : 'en-US',
                    { day: 'numeric', month: 'long', year: 'numeric' });

  // ── 1. Insertar header PDF en el DOM real ────────────────────
  const header = document.createElement('div');
  header.id = 'pdf-export-header';
  header.style.cssText = [
    'display:flex', 'align-items:center', 'justify-content:space-between',
    'padding-bottom:12px', 'margin-bottom:16px',
    'border-bottom:2px solid #e2e8f0',
  ].join(';');
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      ${cfg.companyLogo
        ? `<img src="${cfg.companyLogo}" style="max-height:36px;max-width:120px;object-fit:contain;" />`
        : ''}
      <div>
        <div style="font-size:1.05rem;font-weight:700;color:#0f172a;">
          ${cfg.companyName || 'Zhoras One'}</div>
        <div style="font-size:.72rem;color:#64748b;">
          ${i18n.t('exportPDF')} · ${dateStr}</div>
      </div>
    </div>
    <div style="font-size:.78rem;color:#64748b;">
      ${cfg.currencyLabel || 'CLP'}${isDemo ? ' · DEMO' : ''}</div>
  `;
  area.insertBefore(header, area.firstChild);

  // Watermark DEMO sobre el contentArea real
  let wm = null;
  if (isDemo) {
    wm = document.createElement('div');
    wm.id = 'pdf-demo-watermark';
    wm.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%',
      'transform:translate(-50%,-50%) rotate(-35deg)',
      'font-size:80px', 'font-weight:900',
      'color:rgba(0,0,0,.04)', 'pointer-events:none',
      'z-index:9999', 'letter-spacing:10px',
    ].join(';');
    wm.textContent = 'DEMO';
    document.body.appendChild(wm);
  }

  // ── 2. Activar tema claro via clase CSS ──────────────────────
  document.body.classList.add('pdf-export-active');

  // ── 3. Capturar tras aplicar estilos ─────────────────────────
  requestAnimationFrame(() => {
    setTimeout(() => {
      html2pdf().set({
        margin:      [8, 8, 8, 8],
        filename,
        image:       { type: 'jpeg', quality: 0.97 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          removeContainer: true,
        },
        jsPDF:     { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(area)
      .save()
      .then(()  => showToast('✅ PDF exportado', 'green'))
      .catch(() => showToast('❌ ' + i18n.t('errorPDFExport'), 'red'))
      .finally(() => {
        // ── 4. Restaurar estado original ─────────────────────
        document.body.classList.remove('pdf-export-active');
        if (header.parentNode) header.parentNode.removeChild(header);
        if (wm && wm.parentNode) wm.parentNode.removeChild(wm);
      });
    }, 150); // espera que el browser aplique los estilos CSS
  });
}


async function exportWeeklyReport() {
  if (typeof html2pdf === 'undefined') {
    showToast('⏳ ' + i18n.t('loading'), 'blue');
    return;
  }
  showToast('📋 ' + i18n.t('weeklyReportGenerating'), 'blue');

  const cfg     = storage.getConfig();
  const alerts  = storage.getActiveAlerts().slice(0, 5);
  const goals   = storage.getGoals();
  const filters = storage.getActiveFilters();

  // Recopilar KPIs principales
  const salesData  = storage.applyFilters(storage.getData('sales'),  filters);
  const totalSales = salesData.reduce((s, r) => s + (r.Ventas_Monto || 0), 0);
  const goalSales  = goals.sales_monthly || 0;
  const pctGoal    = goalSales > 0 ? (totalSales / goalSales * 100).toFixed(0) : '—';

  // Calcular índice de salud (simplificado para el informe)
  const healthScore = typeof calculateHealthIndex === 'function'
    ? calculateHealthIndex()
    : 72;

  // Acciones prioritarias
  const actions = app.todayActions.length > 0
    ? app.todayActions
    : (typeof generarAgendaHoy === 'function' ? generarAgendaHoy() : []);

  const html = document.createElement('div');
  html.style.cssText = 'padding:32px;background:#ffffff;color:#1a1a2e;font-family:Plus Jakarta Sans,system-ui,sans-serif;max-width:900px;margin:0 auto;';
  html.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #e2e8f0;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${cfg.companyLogo ? `<img src="${cfg.companyLogo}" style="max-height:44px;max-width:140px;object-fit:contain;" />` : ''}
        <div>
          <div style="font-size:1.4rem;font-weight:800;color:#1a1a2e;">${cfg.companyName || 'Zhoras One'}</div>
          <div style="font-size:.85rem;color:#64748b;margin-top:4px;">${i18n.t('weeklyReportTitle')}</div>
        </div>
      </div>
      <div style="text-align:right;font-size:.78rem;color:#64748b;">
        <div>${i18n.t('weeklyReportPeriod')}: ${new Date().toLocaleDateString(i18n.getLang()==='es'?'es-CL':'en-US', { month:'long', year:'numeric' })}</div>
        <div style="margin-top:4px;">${i18n.t('weeklyReportGenBy')}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:28px;">
      <div style="background:#f8f9fa;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:.75rem;color:#64748b;margin-bottom:6px;">${i18n.t('homeHealthScore')}</div>
        <div style="font-size:2rem;font-weight:800;font-family:JetBrains Mono,monospace;color:${getHealthColor(healthScore)};">${healthScore}</div>
        <div style="font-size:.72rem;color:#64748b;">/ 100</div>
      </div>
      <div style="background:#f8f9fa;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:.75rem;color:#64748b;margin-bottom:6px;">${i18n.t('kpiTotalSales')}</div>
        <div style="font-size:1.6rem;font-weight:800;font-family:JetBrains Mono,monospace;color:#1a1a2e;">${formatCurrency(totalSales)}</div>
      </div>
      <div style="background:#f8f9fa;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:.75rem;color:#64748b;margin-bottom:6px;">${i18n.t('kpiGoalAchiev')}</div>
        <div style="font-size:1.6rem;font-weight:800;font-family:JetBrains Mono,monospace;color:${pctGoal >= 100 ? '#22c55e' : pctGoal >= 80 ? '#f59e0b' : '#ef4444'};">${pctGoal}%</div>
      </div>
    </div>

    ${alerts.length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:.9rem;font-weight:700;color:#1a1a2e;margin-bottom:12px;">🚨 ${i18n.t('weeklyReportAlerts')}</div>
      ${alerts.map(a => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#f8f9fa;border-left:3px solid ${a.type === 'critical' ? '#ef4444' : '#f59e0b'};border-radius:0 8px 8px 0;margin-bottom:6px;">
          <span>${a.type === 'critical' ? '🔴' : '🟡'}</span>
          <span style="font-size:.82rem;color:#1a1a2e;">${storage.getAlertMessage(a)}</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${actions.length > 0 ? `
    <div>
      <div style="font-size:.9rem;font-weight:700;color:#1a1a2e;margin-bottom:12px;">⚡ ${i18n.t('weeklyReportActions')}</div>
      ${actions.map((a, i) => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#f8f9fa;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;">
          <span style="font-size:.75rem;font-weight:800;color:#3b82f6;min-width:20px;">${i + 1}</span>
          <span style="font-size:.82rem;color:#1a1a2e;">${a.texto || a.text || a}</span>
        </div>
      `).join('')}
    </div>
    ` : ''}
  `;

  const filename = `clarokpis-informe-semanal-${new Date().toISOString().split('T')[0]}.pdf`;

  html2pdf().set({
    margin:      [15, 15, 15, 15],
    filename,
    image:       { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
    jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).from(html).save()
    .then(()  => showToast('✅ ' + i18n.t('weeklyReportTitle') + ' exportado', 'green'))
    .catch(() => showToast('❌ ' + i18n.t('errorPDFExport'), 'red'));
}

// ── RESOLUCIÓN DE ALERTAS ─────────────────────────────────────────
function resolveAlertUI(alertId) {
  if (auth.isDemo()) { showToast('🔒 ' + i18n.t('alertDemoBlocked'), 'yellow'); return; }
  const role = auth.getCurrentRole();
  if (role === 'owner') { showToast('🔒 ' + i18n.t('alertNoPermission'), 'yellow'); return; }

  document.getElementById('resolveAlertModal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'resolveAlertModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';

  const box = document.createElement('div');
  box.style.cssText = 'background:#111827;border:1px solid #1e2d40;border-radius:16px;width:100%;max-width:440px;padding:24px;';
  box.innerHTML = `
    <div style="font-size:.95rem;font-weight:700;color:#f0f4ff;margin-bottom:8px;">✅ ${i18n.t('alertResolve')}</div>
    <div style="font-size:.8rem;color:#8899aa;margin-bottom:12px;">${i18n.t('alertResolveNote')}</div>
    <textarea id="resolveNoteInput" placeholder="${i18n.t('alertResolveNote')}…"
      style="width:100%;height:80px;padding:10px;background:#0a0f1e;border:1px solid #1e2d40;border-radius:8px;color:#f0f4ff;font-size:.82rem;resize:vertical;font-family:inherit;box-sizing:border-box;"></textarea>
    <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
      <button onclick="document.getElementById('resolveAlertModal').remove()"
        style="padding:8px 16px;background:#1a2234;border:1px solid #1e2d40;border-radius:8px;color:#8899aa;cursor:pointer;font-size:.82rem;">
        ${i18n.t('cancel')}
      </button>
      <button data-alert-id="${alertId}" onclick="_confirmResolveAlert(this.dataset.alertId)"
        style="padding:8px 16px;background:#22c55e;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:.82rem;font-weight:600;">
        ✅ ${i18n.t('alertResolveSave')}
      </button>
    </div>
  `;

  overlay.appendChild(box);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  setTimeout(() => overlay.querySelector('textarea')?.focus(), 50);
}

function _confirmResolveAlert(alertId) {
  const note      = (document.getElementById('resolveNoteInput')?.value || '').trim();
  const user      = auth.getCurrentUser();
  const resolvedBy = user?.name || auth.getCurrentRole() || 'unknown';

  storage.resolveAlert(alertId, resolvedBy, new Date().toISOString(), note);
  document.getElementById('resolveAlertModal')?.remove();
  buildSidebarNav();
  renderCurrentModule();
  showToast(`✅ ${i18n.getLang() === 'es' ? 'Alerta resuelta' : 'Alert resolved'}`, 'green');
}

// ── MODO PRESENTACIÓN ─────────────────────────────────────────────
function togglePresentationMode() {
  app.presentationMode = !app.presentationMode;
  document.body.classList.toggle('presentation-mode', app.presentationMode);

  const btn = document.getElementById('btnPresentationMode');
  if (btn) btn.textContent = app.presentationMode ? '✕' : '🖥️';

  let exitBtn = document.getElementById('presentationExitBtn');
  if (app.presentationMode) {
    if (!exitBtn) {
      exitBtn = document.createElement('button');
      exitBtn.id = 'presentationExitBtn';
      exitBtn.textContent = i18n.t('presentationExit');
      exitBtn.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;background:rgba(10,15,30,.95);border:1px solid rgba(255,255,255,.2);color:#f0f4ff;padding:8px 16px;border-radius:8px;font-size:.82rem;font-weight:700;cursor:pointer;';
      exitBtn.onclick = () => togglePresentationMode();
      document.body.appendChild(exitBtn);
    }
    exitBtn.style.display = 'block';
    showToast(i18n.t('presentationMode'), 'blue');
  } else {
    if (exitBtn) exitBtn.style.display = 'none';
  }
}

// ── RESTAURAR BACKUP ──────────────────────────────────────────────
function triggerRestoreFile() {
  document.getElementById('restoreInput')?.click();
}

function handleRestoreFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const backup = JSON.parse(ev.target.result);
      const result = storage.restoreBackup(backup);
      if (result.success) {
        showToast('✅ Datos restaurados', 'green');
        buildSidebarNav();
        renderCurrentModule();
      } else {
        showToast('❌ ' + result.error, 'red');
      }
    } catch {
      showToast(i18n.t('errorInvalidJSON'), 'red');
    }
  };
  reader.readAsText(file);
}

// ── FILTROS GLOBALES ──────────────────────────────────────────────
function applyGlobalFilter(key, value) {
  storage.setFilters({ [key]: value });
  renderCurrentModule();
}

function resetAllFilters() {
  storage.setFilters({
    period: 'month', dateFrom: null, dateTo: null,
    compareMode: 'none', sucursal: 'all',
    vendedor: 'all', canal: 'all',
    producto: 'all', categoria: 'all',
  });
  renderCurrentModule();
  showToast('↺ Filtros reseteados', 'blue');
}

function toggleCustomDateRange(period) {
  const el = document.getElementById('customDateRange');
  if (el) el.style.display = period === 'custom' ? 'flex' : 'none';
}

// ── LISTENERS GLOBALES ────────────────────────────────────────────
function _bindGlobalListeners() {
  // Botón atrás del navegador
  window.addEventListener('popstate', e => {
    const module = e.state?.module || 'home';
    navigateTo(module, false);
  });

  // Cerrar menú header al hacer click fuera
  document.addEventListener('click', e => {
    const menu = document.getElementById('headerMenu');
    const btn  = document.getElementById('btnHeaderMenu');
    if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });

  // Atajos de teclado
  document.addEventListener('keydown', e => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'Escape') {
      if (app.presentationMode) { togglePresentationMode(); return; }
      document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden'));
      document.getElementById('resolveAlertModal')?.remove();
      document.getElementById('roleSelectModal')?.remove();
    }

    if (e.altKey) {
      switch(e.key.toLowerCase()) {
        case 'h': e.preventDefault(); navigateTo('home');         break;
        case 's': e.preventDefault(); navigateTo('sales');        break;
        case 'c': e.preventDefault(); navigateTo('clients');      break;
        case 'u': e.preventDefault(); showModal('uploadModal');   break;
        case 'p': e.preventDefault(); togglePresentationMode();   break;
        case 'r': e.preventDefault(); exportWeeklyReport();       break;
      }
    }
  });

  // Cambio de idioma → rebuilding
  document.addEventListener('clarokpis:langChange', () => {
    buildSidebarNav();
    _updateBreadcrumb(app.currentModule);
    // Regenerar alertas en el idioma correcto al cambiar idioma
    // Las alertas se guardan con message+messageEN, pero regenerar asegura coherencia
    // getAlertMessage() usa messageKey+params → traduce en tiempo real
    // No necesita recargar alertas al cambiar idioma
    renderCurrentModule();
  });

  // Filtros cambiados → re-render (listener en dashboard.html — no duplicar aquí)
}

// ── HELPERS INTERNOS ──────────────────────────────────────────────
function _buildSkeleton(moduleId) {
  // Skeleton por módulo: hero card más prominente en módulos analíticos
  const heroModules = ['sales','finance','clients','marketing','cx','team','inventory','suppliers','margin','collections'];
  const isHero = heroModules.includes(moduleId || app?.currentModule);
  return `
    <div style="padding:24px 28px;">
      <!-- Título skeleton -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <div class="skeleton" style="height:24px;width:24px;border-radius:6px;flex-shrink:0;"></div>
        <div class="skeleton skeleton-text" style="width:180px;height:22px;"></div>
      </div>
      <!-- KPI cards skeleton: primera card es hero si aplica -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:14px;margin-bottom:20px;">
        ${isHero ? `<div class="skeleton kpi-hero" style="height:130px;grid-column:span 2;min-width:0;"></div>` : ''}
        ${[1,2,3,4].map(() => `<div class="skeleton skeleton-card"></div>`).join('')}
      </div>
      <!-- Chart skeleton -->
      <div class="skeleton skeleton-chart"></div>
      <!-- Segunda fila opcional -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">
        <div class="skeleton" style="height:160px;border-radius:var(--radius-lg);"></div>
        <div class="skeleton" style="height:160px;border-radius:var(--radius-lg);"></div>
      </div>
    </div>
  `;
}
// Alias global para que dashboard.html lo pueda llamar antes de que app.js termine de ejecutarse
window._buildSkeleton = _buildSkeleton;

function _buildErrorCard(moduleId, msg) {
  return `
    <div style="padding:32px;max-width:480px;margin:40px auto;">
      <div style="background:#111827;border:1px solid #ef444444;border-radius:16px;padding:24px;text-align:center;">
        <div style="font-size:2rem;margin-bottom:12px;">⚠️</div>
        <div style="font-size:1rem;font-weight:700;color:#f0f4ff;margin-bottom:8px;">Error en módulo ${moduleId}</div>
        <div style="font-size:.82rem;color:#8899aa;margin-bottom:16px;">${msg || 'Error desconocido'}</div>
        <button onclick="renderCurrentModule()"
          style="padding:8px 20px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:.85rem;font-weight:600;">
          🔄 Reintentar
        </button>
      </div>
    </div>
  `;
}

function _placeholder(area, name) {
  area.innerHTML = `
    <div style="padding:32px;text-align:center;color:#8899aa;">
      <div style="font-size:2rem;margin-bottom:12px;">🚧</div>
      <div style="font-size:1rem;font-weight:600;color:#f0f4ff;">Módulo en construcción</div>
      <div style="font-size:.85rem;margin-top:8px;">${name}</div>
    </div>
  `;
}

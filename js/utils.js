// ════════════════════════════════════════════════════════════════
// CLAROKPIS — utils.js
// Extraído del inline del dashboard.html — líneas 1449-1675
// Formatters, toast, branding, exportPDF, presentación, restore
// ════════════════════════════════════════════════════════════════

// ── FORMATTERS ────────────────────────────────────────────────────
// ── SANITIZACIÓN XSS ─────────────────────────────────────────────
// Escapa caracteres peligrosos para prevenir XSS en innerHTML
// Usar siempre que un dato del usuario (Excel, input) va a HTML,
// como contenido de texto: <td>${sanitize(x)}</td>
function sanitize(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Para valores dentro de atributos HTML: <div title="${sanitizeAttr(x)}">
// Además de lo anterior, escapa backtick y signo igual. NO habilita
// handlers inline (onclick=...) — para eso no hay escape seguro, hay
// que eliminar el handler y usar data-* + listener delegado.
function sanitizeAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;');
}

// ── DEBOUNCE ──────────────────────────────────────────────────────
// Retrasa la ejecución de fn hasta que pasen `wait` ms sin llamadas
// Usar en inputs de texto para evitar recálculos en cada tecla
function debounce(fn, wait = 250) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}


function formatCurrency(n, sym) {
  sym = sym || storage.getConfig().currencySymbol || '$';
  if (n === null || n === undefined || isNaN(n)) return `${sym}—`;
  if (Math.abs(n) >= 1000000) return `${sym}${(n/1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000)    return `${sym}${(n/1000).toFixed(0)}K`;
  return `${sym}${Math.round(n).toLocaleString('es-CL')}`;
}

function formatCurrencyShort(n, sym) {
  sym = sym || storage.getConfig().currencySymbol || '$';
  if (Math.abs(n) >= 1000000) return `${sym}${(n/1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000)    return `${sym}${(n/1000).toFixed(0)}K`;
  return `${sym}${Math.round(n)}`;
}

function formatCurrencyFull(n, sym) {
  sym = sym || storage.getConfig().currencySymbol || '$';
  if (n === null || n === undefined || isNaN(n)) return `${sym}—`;
  return `${sym}${Math.round(n).toLocaleString('es-CL')}`;
}

function formatPct(n, dec) {
  if (n === null || n === undefined || isNaN(n)) return '—%';
  return `${Number(n).toFixed(dec !== undefined ? dec : 1)}%`;
}

function formatNum(n, dec) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n.toFixed(dec || 0)).toLocaleString('es-CL');
}

function getHealthColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function getStatusColor(status) {
  return { green:'#22c55e', yellow:'#f59e0b', red:'#ef4444', na:'#64748b' }[status] || '#64748b';
}

// ── TOAST ─────────────────────────────────────────────────────────
function showToast(msg, type = 'green') {
  const colors = {
    green:  { bg:'var(--color-green-bg)',  border:'var(--color-green-border)',  color:'var(--color-green)' },
    yellow: { bg:'var(--color-yellow-bg)', border:'var(--color-yellow-border)', color:'var(--color-yellow)' },
    red:    { bg:'var(--color-red-bg)',    border:'var(--color-red-border)',    color:'var(--color-red)' },
    blue:   { bg:'var(--color-blue-bg)',   border:'var(--color-blue-border)',   color:'var(--color-blue)' },
  };
  const c = colors[type] || colors.green;
  const toast = document.createElement('div');
  toast.style.cssText = `background:${c.bg};border:1px solid ${c.border};color:${c.color};padding:10px 18px;border-radius:10px;font-size:.85rem;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.3);animation:fadeInUp .25s ease;white-space:nowrap;pointer-events:auto;font-family:Plus Jakarta Sans,system-ui,sans-serif;`;
  toast.textContent = msg;
  const container = document.getElementById('toastContainer');
  if (container) container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── MODALES ───────────────────────────────────────────────────────
function showModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}
function hideModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}
function toggleHeaderMenu() {
  document.getElementById('headerMenu')?.classList.toggle('hidden');
}

// ── BRANDING ──────────────────────────────────────────────────────
function applyCurrencyChange(currency, sym, label) {
  storage.setConfig({ currency, currencySymbol: sym, currencyLabel: label });
  if (typeof updateCurrencyIndicator === 'function') updateCurrencyIndicator();
  renderCurrentModule();
  showToast('💱 ' + label + ' (' + sym + ')', 'green');
}

function updateCurrencyIndicator() {
  const cfg = storage.getConfig();
  const sym = cfg.currencySymbol || '$';
  const lbl = cfg.currencyLabel  || cfg.currency || 'CLP';
  let el = document.getElementById('currencyIndicator');
  if (!el) {
    el = document.createElement('span');
    el.id = 'currencyIndicator';
    el.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--color-bg-card-2);border:1px solid var(--color-border);border-radius:6px;font-size:.75rem;font-weight:700;color:var(--color-text-muted);cursor:pointer;white-space:nowrap;margin-right:4px;';
    el.onclick = () => navigateTo('settings');
    const ha = document.querySelector('.header-actions');
    if (ha) ha.insertBefore(el, ha.firstChild);
  }
  el.innerHTML = '💱 ' + sym + ' ' + lbl;
}

function updateCompanyBranding() {
  const cfg = storage.getConfig();
  const n = document.querySelector('.sidebar-logo-name');
  if (n && cfg.companyName) n.textContent = cfg.companyName;
  if (cfg.companyName) document.title = cfg.companyName + ' — ClaroKPIs';
}

function applyCompanySettings() {
  if (auth.isDemo()) { showToast('🔒 No disponible en demo', 'yellow'); return; }
  const name = (document.getElementById('companyNameInput')?.value || '').trim();
  storage.setConfig({ companyName: name });
  updateCompanyBranding();
  showToast('✅ Guardado', 'green');
}

function toggleCustomDateRange(period) {
  const el = document.getElementById('customDateRange');
  if (el) el.style.display = period === 'custom' ? 'flex' : 'none';
}

// ── EXPORT PDF ────────────────────────────────────────────────────
function exportPDF() {
  if (typeof html2pdf === 'undefined') { showToast('⏳ Cargando exportador...', 'blue'); return; }
  // Gate de plan vencido (Bloque 3.6): solo lectura hasta suscribir.
  if (!auth.isDemo() && typeof plans !== 'undefined' && plans.getPlanActivo() === 'vencido') {
    showToast('🔒 ' + i18n.t('gateVencidoAction'), 'yellow');
    if (typeof showPlanUpgradeModal === 'function') showPlanUpgradeModal();
    return;
  }
  const config = storage.getConfig();
  const isDemo = auth.isDemo();
  const area   = document.getElementById('contentArea');
  if (!area) { showToast('❌ No hay contenido', 'red'); return; }

  showToast('📄 Generando PDF...', 'blue');

  const clone = area.cloneNode(true);
  clone.style.cssText = 'padding:20px;background:#0f172a;color:#f1f5f9;font-family:system-ui,sans-serif;';

  // DEMO en modo demo; trial/Emprendedor (D5) llevan marca de agua de
  // versión de prueba — Negocio y Empresa exportan limpio.
  const planId    = (typeof plans !== 'undefined') ? plans.getPlanActivo() : null;
  const marcaAgua = !isDemo && typeof plans !== 'undefined' && plans.tieneMarcaAgua(planId);
  if (isDemo || marcaAgua) {
    const wm = document.createElement('div');
    wm.style.cssText = isDemo
      ? 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:72px;font-weight:900;color:rgba(255,255,255,.06);pointer-events:none;z-index:9999;letter-spacing:8px;'
      : 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:24px;font-weight:900;color:rgba(255,255,255,.08);pointer-events:none;z-index:9999;letter-spacing:1px;width:900px;text-align:center;white-space:nowrap;';
    wm.textContent = isDemo ? 'DEMO' : i18n.t('pdfWatermarkTrial');
    clone.style.position = 'relative';
    clone.appendChild(wm);
  }

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.15);margin-bottom:20px;';
  header.innerHTML = `
    <div>
      <div style="font-size:1.1rem;font-weight:700;color:#f1f5f9">${config.companyName||'ClaroKPIs'}</div>
      <div style="font-size:.75rem;color:#94a3b8">Exportado el ${new Date().toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'})}</div>
    </div>
    <div style="font-size:.8rem;color:#94a3b8">${config.currencyLabel||'CLP'}${isDemo?' · DEMO':''}</div>`;
  clone.insertBefore(header, clone.firstChild);

  const filename = `clarokpis-${app.currentModule||'dashboard'}-${new Date().toISOString().split('T')[0]}${isDemo?'-DEMO':''}.pdf`;

  html2pdf().set({
    margin:      [10,10,10,10],
    filename,
    image:       { type:'jpeg', quality:.95 },
    html2canvas: { scale:2, useCORS:true, backgroundColor:'#0f172a', logging:false },
    jsPDF:       { unit:'mm', format:'a4', orientation:'landscape' },
    pagebreak:   { mode:['avoid-all','css','legacy'] },
  }).from(clone).save()
    .then(()  => showToast('✅ PDF exportado', 'green'))
    .catch(() => showToast('❌ ' + (i18n.t('errorPDFExport')||'Error al exportar'), 'red'));
}

// ── MODO PRESENTACIÓN ─────────────────────────────────────────────
function togglePresentationMode() {
  if (!window.app) return;
  app.presentationMode = !app.presentationMode;
  document.body.classList.toggle('presentation-mode', app.presentationMode);
  const btn = document.getElementById('btnPresentationMode');
  if (btn) btn.textContent = app.presentationMode ? '✕' : '🖥️';

  let exitBtn = document.getElementById('presentationExitBtn');
  if (app.presentationMode) {
    if (!exitBtn) {
      exitBtn = document.createElement('button');
      exitBtn.id = 'presentationExitBtn';
      exitBtn.innerHTML = '✕ ' + (i18n.t('back') || 'Salir');
      exitBtn.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;background:rgba(15,23,42,.92);border:1px solid rgba(255,255,255,.2);color:#f1f5f9;padding:8px 16px;border-radius:8px;font-size:.82rem;font-weight:700;cursor:pointer;font-family:Plus Jakarta Sans,system-ui,sans-serif;';
      exitBtn.onclick = () => togglePresentationMode();
      document.body.appendChild(exitBtn);
    }
    exitBtn.style.display = 'block';
    showToast(i18n.t('presentationMode'), 'blue');
  } else {
    if (exitBtn) exitBtn.style.display = 'none';
  }
}

// ── RESTORE BACKUP ────────────────────────────────────────────────
function triggerRestoreFile() {
  document.getElementById('restoreInput')?.click();
}

function handleRestoreFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    let backup;
    try {
      backup = JSON.parse(ev.target.result);
    } catch {
      showToast(i18n.t('errorInvalidJSON'), 'red');
      return;
    }

    // Confirmación destructiva en dos pasos, mostrando cuántas filas
    // se van a reemplazar — restaurar sobreescribe todos los datos actuales.
    const totalFilas = Object.values(backup?.data || {})
      .reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
    if (!confirm(i18n.t('backupConfirmReplace').replace('{n}', totalFilas.toLocaleString()))) return;
    if (!confirm(i18n.t('backupConfirmReplace2'))) return;

    let result = await storage.restoreBackup(backup);
    if (!result.success && result.requiereConfirmacion) {
      // Checksum no coincide (posible corrupción o edición manual) —
      // pedir confirmación explícita antes de continuar.
      if (!confirm(i18n.t('backupChecksumWarning'))) return;
      result = await storage.restoreBackup(backup, { forzar: true });
    }

    if (result.success) {
      showToast('✅ ' + i18n.t(result.legacy ? 'backupRestoredLegacy' : 'backupRestoredOk'), result.legacy ? 'blue' : 'green');
      buildSidebarNav();
      renderCurrentModule();
    } else {
      const msg = result.error === 'empresa_ajena' ? i18n.t('backupErrorAjena') : i18n.t('backupErrorGeneric');
      showToast('❌ ' + msg, 'red');
    }
  };
  reader.readAsText(file);
}

// ── ATAJOS DE TECLADO ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (e.altKey) {
    switch(e.key.toLowerCase()) {
      case 'h': e.preventDefault(); navigateTo('home');         break;
      case 's': e.preventDefault(); navigateTo('sales');        break;
      case 'c': e.preventDefault(); navigateTo('clients');      break;
      case 'u': e.preventDefault(); showModal('uploadModal');   break;
      case 'p': e.preventDefault(); togglePresentationMode();   break;
      case 'r': e.preventDefault();
        if (typeof exportWeeklyReport === 'function') exportWeeklyReport();
        break;
    }
  }

  if (e.key === 'Escape') {
    if (window.app?.presentationMode) { togglePresentationMode(); return; }
    document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden'));
    document.getElementById('resolveAlertModal')?.remove();
  }
});

// ── BARRA DE FILTROS GLOBAL ────────────────────────────────────────
// Usada por todos los módulos excepto Ventas (que tiene la suya propia)
// moduleId: clave del módulo ('finance','clients','cx', etc.)
// Cada módulo guarda sus propios filtros bajo 'filters_MODULE' en localStorage
// Incluye calendario Flatpickr para rangos personalizados (IDs únicos por módulo)

/**
 * Normalizes channel display values for i18n.
 * 'Presencial' → 'In-store' in EN mode.
 * All other values pass through unchanged (user-entered data).
 */
function normalizeChannel(val) {
  if (!val) return val;
  if (typeof i18n === 'undefined') return val;
  if (i18n.getLang() === 'en' && val.toLowerCase() === 'presencial') {
    return 'In-store';
  }
  return val;
}

function renderGlobalFilters(moduleId, options = {}) {
  const filters     = storage.getFilters(moduleId);
  const showSeller  = options.showSeller  !== false;
  const showChannel = options.showChannel !== false;
  const showBranch  = options.showBranch  !== false;

  const dataModule = options.dataModule || moduleId;
  const branches = storage.getUniqueValues('sales', 'Sucursal');
  const sellers  = showSeller  ? storage.getUniqueValues('sales', 'Vendedor') : [];
  const channels = showChannel ? storage.getUniqueValues(dataModule, 'Canal_Venta')
                                  .concat(storage.getUniqueValues('sales', 'Canal_Venta'))
                                  .filter((v,i,a) => a.indexOf(v) === i).sort() : [];

  // IDs únicos por módulo para evitar colisiones entre módulos
  // IMPORTANTE: usar comillas simples para que sea válido dentro de atributos HTML con comillas dobles
  // JSON.stringify produce "clients" → el segundo " cierra el atributo HTML prematuramente
  // Con comillas simples: 'clients' → seguro dentro de onclick="...('clients')..."
  const mid       = `'${moduleId}'`;
  const calId     = `gf_cal_${moduleId}`;
  const rangeId   = `gf_range_${moduleId}`;
  const fromId    = `gf_from_${moduleId}`;
  const toId      = `gf_to_${moduleId}`;
  const selectId  = `gf_period_${moduleId}`;
  const isCustom  = filters.period === 'custom';

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-CL') : '';

  // Helper: label for partial year
  const _now          = new Date();
  const _curMonth     = _now.getMonth(); // 0=Jan, 11=Dec
  const _isPartialYr  = _curMonth < 11;  // not December = partial year
  const _monthNames   = i18n.getLang() === 'es'
    ? ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const _partialLabel = _isPartialYr
    ? (i18n.getLang()==='es' ? `Este año (Ene–${_monthNames[_curMonth]})` : `This year (Jan–${_monthNames[_curMonth]})`)
    : (i18n.t('periodYear') || 'Este año');

  const periods = [
    { v:'all',       label: i18n.t('periodAll')       || 'Todo el período' },
    { v:'today',     label: i18n.t('periodToday')     || 'Hoy' },
    { v:'week',      label: i18n.t('periodWeek')      || 'Esta semana' },
    { v:'last7',     label: i18n.t('periodLast7')     || 'Últimos 7 días' },
    { v:'last30',    label: i18n.t('periodLast30')    || 'Últimos 30 días' },
    { v:'month',     label: i18n.t('periodMonth')     || 'Este mes' },
    { v:'prevmonth', label: i18n.t('periodPrevMonth') || 'Mes anterior' },
    { v:'last90',    label: i18n.t('periodLast90')    || 'Últimos 90 días' },
    { v:'quarter',   label: i18n.t('periodQuarter')   || 'Este trimestre' },
    { v:'year',      label: _partialLabel },
    { v:'lastyear',  label: i18n.t('periodLastYear')  || 'Año anterior' },
    { v:'custom',    label: i18n.t('periodCustom')    || '📅 Personalizado' },
  ];

  // Inicializa Flatpickr después de que el HTML esté en el DOM
  setTimeout(() => _initGlobalCalendar(moduleId), 0);

  return `
    <div class="filters-bar" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 0 14px;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:16px;">
      <div class="filter-group">
        <span class="filter-label">📅 ${i18n.t('filterPeriod') || 'PERÍODO'}</span>
        <select id="${selectId}" class="filter-select"
          onchange="_onGlobalPeriodChange(${mid},this.value)">
          ${periods.map(p=>`<option value="${p.v}" ${filters.period===p.v?'selected':''}>${p.label}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" title="${i18n.t('periodCustom')||'Rango personalizado'}"
          onclick="_openGlobalCalendar(${mid})"
          style="padding:4px 8px;font-size:.8rem;">📆</button>
      </div>
      <div id="${rangeId}" class="filter-group"
        style="display:${isCustom?'flex':'none'};gap:4px;align-items:center;">
        <input type="text" id="${fromId}" class="filter-select"
          placeholder="${i18n.t('dateFrom')||'Desde'}"
          value="${isCustom ? fmtDate(filters.dateFrom) : ''}"
          onclick="_openGlobalCalendar(${mid})" readonly
          style="width:90px;cursor:pointer;" />
        <span style="color:var(--color-text-faint);font-size:.75rem;">→</span>
        <input type="text" id="${toId}" class="filter-select"
          placeholder="${i18n.t('dateTo')||'Hasta'}"
          value="${isCustom ? fmtDate(filters.dateTo) : ''}"
          onclick="_openGlobalCalendar(${mid})" readonly
          style="width:90px;cursor:pointer;" />
      </div>
      ${showBranch && branches.length > 1 ? `
      <div class="filter-group">
        <span class="filter-label">🏪 ${i18n.t('filterGeo') || 'SUCURSAL'}</span>
        <select class="filter-select"
          onchange="storage.setFilters({sucursal:this.value},${mid});renderCurrentModule()">
          <option value="all">${i18n.t('geoAll') || 'Todas las sucursales'}</option>
          ${branches.map(b=>`<option value="${sanitizeAttr(b)}" ${filters.sucursal===b?'selected':''}>${sanitize(b)}</option>`).join('')}
        </select>
      </div>` : ''}
      ${showSeller && sellers.length > 1 ? `
      <div class="filter-group">
        <span class="filter-label">👤 ${i18n.t('filterSeller') || 'VENDEDOR'}</span>
        <select class="filter-select"
          onchange="storage.setFilters({vendedor:this.value},${mid});renderCurrentModule()">
          <option value="all">${i18n.t('sellerAll') || 'Todos los vendedores'}</option>
          ${sellers.map(s=>`<option value="${sanitizeAttr(s)}" ${filters.vendedor===s?'selected':''}>${sanitize(s)}</option>`).join('')}
        </select>
      </div>` : ''}
      ${showChannel && channels.length > 1 ? `
      <div class="filter-group">
        <span class="filter-label">📡 ${i18n.t('filterChannel') || 'CANAL'}</span>
        <select class="filter-select"
          onchange="storage.setFilters({canal:this.value},${mid});renderCurrentModule()">
          <option value="all">${i18n.t('channelAll') || 'Todos los canales'}</option>
          ${channels.map(c=>`<option value="${sanitizeAttr(c)}" ${filters.canal===c?'selected':''}>${sanitize(c)}</option>`).join('')}
        </select>
      </div>` : ''}
      <button class="filters-reset" style="margin-left:auto"
        onclick="storage.resetFilters(${mid});renderCurrentModule()">
        ↺ ${i18n.t('resetFilters') || 'Limpiar filtros'}
      </button>
    </div>`;
}

// ── Helpers para el calendario global (fuera de renderGlobalFilters) ──
// Instancias Flatpickr por módulo para no recrearlas en cada render
const _gfFpInstances = {};

function _initGlobalCalendar(moduleId) {
  if (typeof flatpickr === 'undefined') return;
  const fromEl = document.getElementById(`gf_from_${moduleId}`);
  if (!fromEl) return;
  // Destruir instancia anterior si existe (nuevo render del módulo)
  if (_gfFpInstances[moduleId]) {
    try { _gfFpInstances[moduleId].destroy(); } catch(e) {}
    delete _gfFpInstances[moduleId];
  }
  const filters = storage.getFilters(moduleId);
  _gfFpInstances[moduleId] = flatpickr(`#gf_from_${moduleId}`, {
    mode: 'range',
    dateFormat: 'Y-m-d',
    locale: i18n.getLang() === 'es' ? 'es' : 'en',
    defaultDate: filters.dateFrom && filters.dateTo
      ? [filters.dateFrom.split('T')[0], filters.dateTo.split('T')[0]]
      : undefined,
    onClose(selectedDates) {
      if (selectedDates.length === 2) {
        // storage.localDate() usa componentes locales del Date para evitar desfase UTC en España (UTC+1/+2)
        const from = storage.localDate(selectedDates[0]);
        const to   = storage.localDate(selectedDates[1]);
        storage.setFilters({ period:'custom', dateFrom:from, dateTo:to }, moduleId);
        // Actualizar UI sin re-render completo
        const sel   = document.getElementById(`gf_period_${moduleId}`);
        const range = document.getElementById(`gf_range_${moduleId}`);
        const fromI = document.getElementById(`gf_from_${moduleId}`);
        const toI   = document.getElementById(`gf_to_${moduleId}`);
        if (sel)   sel.value = 'custom';
        if (range) range.style.display = 'flex';
        if (fromI) fromI.value = selectedDates[0].toLocaleDateString('es-CL');
        if (toI)   toI.value   = selectedDates[1].toLocaleDateString('es-CL');
        renderCurrentModule();
      }
    }
  });
}

function _openGlobalCalendar(moduleId) {
  if (_gfFpInstances[moduleId]) {
    _gfFpInstances[moduleId].open();
  } else {
    _initGlobalCalendar(moduleId);
    setTimeout(() => _gfFpInstances[moduleId]?.open(), 50);
  }
}

function _onGlobalPeriodChange(moduleId, value) {
  const rangeEl = document.getElementById(`gf_range_${moduleId}`);
  if (value === 'custom') {
    if (rangeEl) rangeEl.style.display = 'flex';
    _openGlobalCalendar(moduleId);
  } else {
    if (rangeEl) rangeEl.style.display = 'none';
    storage.setFilters({ period: value, dateFrom: null, dateTo: null }, moduleId);
    renderCurrentModule();
  }
}

// ── KPI HERO — tarjeta principal de módulo ────────────────────────
/**
 * Renderiza la KPI card hero: número grande + semáforo + delta vs período anterior.
 * Ocupa 2 columnas en el kpi-grid gracias a .kpi-hero.
 *
 * @param {object} opts
 *   value     {string}  — valor formateado ya (ej: '$12.4M')
 *   label     {string}  — etiqueta KPI (ej: 'Total Ventas')
 *   status    {string}  — 'green' | 'yellow' | 'red' | 'blue' | 'na'
 *   delta     {string|null} — string de delta ya formateado (ej: '+8.4%') o null
 *   deltaDir  {string|null} — 'up' | 'down' | 'flat' (para color del delta)
 *   sub       {string|null} — texto secundario bajo el valor
 *   pct       {number|null} — 0-100 para progress bar (opcional)
 *   onclick   {string|null} — expresión JS para drill-down (opcional)
 * @returns {string} HTML
 */
function kpiHero({ value, label, status = 'na', delta = null, deltaDir = null, sub = null, pct = null, onclick = null }) {
  const statusColors = {
    green:  { dot: 'var(--color-green)',  glow: 'rgba(34,197,94,.18)',   border: 'var(--color-green-border)'  },
    yellow: { dot: 'var(--color-yellow)', glow: 'rgba(245,158,11,.15)',  border: 'var(--color-yellow-border)' },
    red:    { dot: 'var(--color-red)',    glow: 'rgba(239,68,68,.15)',   border: 'var(--color-red-border)'    },
    blue:   { dot: 'var(--color-blue)',   glow: 'rgba(59,130,246,.15)',  border: 'var(--color-blue-border)'   },
    na:     { dot: 'var(--color-text-faint)', glow: 'transparent',       border: 'var(--color-border)'        },
  };
  const sc = statusColors[status] || statusColors.na;

  // Delta: color según dirección
  const deltaColorMap = { up: 'var(--color-green)', down: 'var(--color-red)', flat: 'var(--color-text-faint)' };
  const deltaColor = deltaDir ? (deltaColorMap[deltaDir] || 'var(--color-text-muted)') : 'var(--color-text-muted)';
  const deltaArrow = deltaDir === 'up' ? '↑' : deltaDir === 'down' ? '↓' : '→';

  // Progress bar
  const progressBar = (pct !== null && pct !== undefined)
    ? `<div style="margin-top:12px;">
        <div style="height:4px;background:var(--color-bg-hover);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${Math.min(Math.max(pct, 0), 100)}%;background:${sc.dot};border-radius:2px;transition:width .6s ease;"></div>
        </div>
        <div style="font-size:.68rem;color:var(--color-text-faint);margin-top:4px;">${pct.toFixed(1)}% de meta</div>
      </div>`
    : '';

  const clickStyle = onclick ? 'cursor:pointer;' : '';
  const clickAttr  = onclick ? `onclick="${onclick}"` : '';

  return `
    <div class="kpi-card kpi-hero ${status}" ${clickAttr}
      style="
        ${clickStyle}
        border-color:${sc.border};
        box-shadow:0 0 0 1px ${sc.border}, 0 8px 32px ${sc.glow};
        padding:20px 24px;
        position:relative;
        overflow:hidden;
      ">
      <!-- Glow radial de fondo sutil -->
      <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 20% 50%, ${sc.glow} 0%, transparent 70%);pointer-events:none;"></div>

      <!-- Header: label + semáforo -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;position:relative;">
        <span style="font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-muted);">${label}</span>
        <span style="
          width:10px;height:10px;border-radius:50%;
          background:${sc.dot};
          box-shadow:0 0 8px ${sc.dot};
          flex-shrink:0;
        "></span>
      </div>

      <!-- Valor principal -->
      <div style="
        font-size:2.4rem;
        font-weight:800;
        font-family:var(--font-mono);
        color:var(--color-text);
        line-height:1;
        letter-spacing:-.03em;
        margin-bottom:6px;
        position:relative;
      ">${value}</div>

      <!-- Delta vs período anterior -->
      ${delta ? `
        <div style="
          display:inline-flex;align-items:center;gap:4px;
          font-size:.78rem;font-weight:700;
          color:${deltaColor};
          background:${deltaColor}18;
          border:1px solid ${deltaColor}30;
          border-radius:var(--radius-full);
          padding:2px 8px;
          position:relative;
        ">
          <span style="font-size:.7rem;">${deltaArrow}</span>
          <span>${delta}</span>
          <span style="font-weight:400;color:var(--color-text-faint);font-size:.7rem;">vs anterior</span>
        </div>
      ` : ''}

      <!-- Subtexto -->
      ${sub ? `<div style="font-size:.75rem;color:var(--color-text-faint);margin-top:8px;position:relative;">${sub}</div>` : ''}

      <!-- Progress bar -->
      <div style="position:relative;">${progressBar}</div>
    </div>
  `;
}

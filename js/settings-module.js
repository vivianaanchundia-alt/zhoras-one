// ════════════════════════════════════════════════════════════════
// CLAROKPIS — settings-module.js
// Extraído del inline — líneas 1067-1182
// ════════════════════════════════════════════════════════════════

function renderSettings(container) {
  const config = storage.getConfig();
  const goals  = storage.getGoals();
  const info   = storage.getStorageInfo();
  const isDemo = auth.isDemo();

  container.innerHTML = `
    <div class="module-header">
      <div class="module-title-wrap">
        <h1 class="module-title">⚙️ ${i18n.t('configTitle')||'Configuración'}</h1>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;">

      <!-- Tipo de negocio y moneda -->
      <div class="card">
        <h4 style="margin-bottom:16px;">🏢 ${i18n.t('configBusiness')||'Negocio'}</h4>
        <div class="form-group">
          <label class="form-label">${i18n.t('configBusiness')}</label>
          <select class="select" onchange="storage.setConfig({businessType:this.value});showToast('✅ Guardado','green')">
            <option value="products" ${config.businessType==='products'?'selected':''}>📦 Productos físicos</option>
            <option value="services" ${config.businessType==='services'?'selected':''}>🛎️ Servicios</option>
            <option value="hybrid"   ${config.businessType==='hybrid'  ?'selected':''}>🔄 Productos + Servicios</option>
          </select>
        </div>

        <!-- Logo upload -->
        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">${i18n.t('configCompanyLogo')}</label>
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
            <!-- Preview / placeholder -->
            <div id="logoPreviewWrap" style="width:120px;height:40px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;cursor:pointer;" onclick="document.getElementById('logoFileInput').click()" title="${i18n.t('logoClickToChange')}">
              ${config.companyLogo
                ? `<img id="logoPreviewImg" src="${config.companyLogo}" style="max-width:116px;max-height:36px;object-fit:contain;" />`
                : `<span style="font-size:.68rem;color:var(--color-text-faint);">📷 logo</span>`}
            </div>
            <!-- Acciones -->
            <div style="display:flex;flex-direction:column;gap:6px;">
              <input type="file" id="logoFileInput" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="display:none" onchange="handleLogoUpload(this)" />
              <button class="btn btn-sm btn-secondary" onclick="document.getElementById('logoFileInput').click()">
                📷 ${i18n.t('logoUploadBtn')}
              </button>
              ${config.companyLogo ? `<button class="btn btn-sm btn-ghost" style="color:var(--color-red);font-size:.72rem;" onclick="removeLogo()">✕ ${i18n.t('logoDeleteBtn')}</button>` : ''}
            </div>
          </div>
          <div style="font-size:.68rem;color:var(--color-text-faint);margin-top:6px;">${i18n.t('logoUploadHint')}</div>
        </div>

        <div class="form-group" style="margin-top:12px;">
          <label class="form-label">${i18n.t('configCompanyName')||'Nombre de empresa'}</label>
          <div style="display:flex;gap:8px;">
            <input type="text" class="input" id="companyNameInput"
              value="${config.companyName||''}"
              placeholder="Mi Empresa SpA"
              style="flex:1;" />
            <button class="btn btn-sm btn-secondary" onclick="applyCompanySettings()">✓</button>
          </div>
        </div>

        <div class="form-group" style="margin-top:12px;">
          <label class="form-label">${i18n.t('configCurrency')||'Moneda'}</label>
          <select class="select" onchange="applyCurrencyChange(this.value,this.options[this.selectedIndex].dataset.sym,this.options[this.selectedIndex].dataset.label)">
            <optgroup label="${i18n.t('settingsLatam')}">
              ${[
                ['CLP','$',   'CLP','🇨🇱','Peso Chileno'],
                ['COP','$',   'COP','🇨🇴','Peso Colombiano'],
                ['MXN','$',   'MXN','🇲🇽','Peso Mexicano'],
                ['PEN','S/',  'PEN','🇵🇪','Sol Peruano'],
                ['ARS','$',   'ARS','🇦🇷','Peso Argentino'],
                ['CRC','₡',   'CRC','🇨🇷','Colón Costarricense'],
                ['BRL','R$',  'BRL','🇧🇷','Real Brasileño'],
                ['UYU','$',   'UYU','🇺🇾','Peso Uruguayo'],
              ].map(([v,s,l,f,n]) => `
                <option value="${v}" data-sym="${s}" data-label="${l}" ${config.currency===v?'selected':''}>
                  ${f} ${s} ${v} — ${n}
                </option>`).join('')}
            </optgroup>
            <optgroup label="🌍 Internacional">
              ${[
                ['AUD','A$',  'AUD','🇦🇺','Dólar Australiano'],
                ['CAD','C$',  'CAD','🇨🇦','Dólar Canadiense'],
                ['GBP','£',   'GBP','🇬🇧','Libra Esterlina'],
                ['USD','$',   'USD','🇺🇸','Dólar'],
                ['EUR','€',   'EUR','🇪🇺','Euro'],
              ].map(([v,s,l,f,n]) => `
                <option value="${v}" data-sym="${s}" data-label="${l}" ${config.currency===v?'selected':''}>
                  ${f} ${s} ${v} — ${n}
                </option>`).join('')}
            </optgroup>
          </select>
        </div>

        <div class="form-group" style="margin-top:12px;">
          <label class="form-label">${i18n.t('configLanguage')||'Idioma'}</label>
          <select class="select" onchange="i18n.setLang(this.value)">
            <option value="es" ${i18n.getLang()==='es'?'selected':''}>🇨🇱 Español</option>
            <option value="en" ${i18n.getLang()==='en'?'selected':''}>🇺🇸 English</option>
          </select>
        </div>

        <div class="form-group" style="margin-top:12px;">
          <label class="form-label">🧾 ${i18n.getLang()==='es'?'Impuestos':'Taxes'}</label>
          <p style="font-size:.75rem;color:var(--color-text-faint);margin-bottom:10px;">
            ${i18n.getLang()==='es'
              ? i18n.t('settingsTaxHint')
              : i18n.t('settingsTaxHint')}
          </p>
          <div id="taxesContainer" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
            <!-- Generado dinámicamente por renderTaxes() -->
          </div>
          <button class="btn btn-secondary btn-sm" onclick="settingsModule.addTaxField()">
            ➕ ${i18n.getLang()==='es'?'Agregar impuesto':'Add tax'}
          </button>
          <p style="font-size:.72rem;color:var(--color-text-faint);margin-top:8px;">
            ${i18n.getLang()==='es'
              ? i18n.t('settingsNetSalesHint')
              : 'Net sales are used to compute real margins, comparable across countries.'}
          </p>
        </div>
      </div>

      <!-- Metas principales (acceso rápido) -->
      <div class="card">
        <h4 style="margin-bottom:4px;">🎯 ${i18n.t('configGoals')||'Metas'}</h4>
        <p style="font-size:.75rem;color:var(--color-text-faint);margin-bottom:16px;">
          ${i18n.t('settingsGoalsLink')} <a href="#" onclick="navigateTo('goals');return false;" style="color:var(--color-blue)">🎯 Metas</a>
        </p>
        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label">${i18n.t('settingsVentasMen')} (${config.currencyLabel||'CLP'})</label>
          <input type="number" class="input" value="${goals.sales_monthly||0}" placeholder="0"
            onchange="storage.setGoal('sales_monthly',this.value)" />
        </div>
        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label">${i18n.t('settingsRetClientes')}</label>
          <input type="number" class="input" value="${goals.retention_rate||80}" placeholder="80"
            onchange="storage.setGoal('retention_rate',this.value)" />
        </div>
        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label">${i18n.t('settingsNPSMin')}</label>
          <input type="number" class="input" value="${goals.nps||50}" placeholder="50"
            onchange="storage.setGoal('nps',this.value)" />
        </div>
        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label">${i18n.t('settingsDiasHab')}</label>
          <input type="number" class="input" value="${config.workingDaysThisMonth||22}" min="1" max="31"
            onchange="storage.setConfig({workingDaysThisMonth:parseInt(this.value)||22})" />
        </div>
        <button class="btn btn-primary btn-sm" onclick="storage.invalidateCache();renderCurrentModule();showToast('✅ Metas guardadas','green')">
          ${i18n.getLang()==='es'?'✅ Guardar metas':'✅ Save goals'}
        </button>
      </div>

      <!-- Mi Plan y Facturación -->
      ${!isDemo ? `
      <div class="card">
        <h4 style="margin-bottom:16px;">${i18n.t('configPlanTitle')}</h4>
        ${(() => {
          const isES      = i18n.getLang() !== 'en';
          const planId    = plans.getPlanActivo();
          const planInfo  = plans.getPlan(planId);
          const priceUsd  = plans.getPrecioUSD(planId);
          const priceYrUsd = plans.getPrecioAnualUSD(planId);
          const period    = plans.getBillingPeriodActivo();
          const ahorroPct = plans.getAhorroAnualPct(planId);
          const susc      = plans.getSuscripcionRaw();
          const isTrial    = planId === 'trial';
          const isVencido  = planId === 'vencido';
          const isCancelada = susc.estado === 'cancelada';
          const isPausada   = susc.estado === 'pausada';
          const isAnual   = period === 'anual';
          const diasTrial = plans.getDiasTrialRestantes();
          const maxUsuarios = plans.getMaxUsuarios(planId);

          const planLabel = isTrial ? i18n.t('configPlanFree')
            : isVencido ? i18n.t('configPlanExpired')
            : (planInfo.nombre || planId);

          const estadoBadge = isTrial    ? `<span class="badge badge-blue">${isES?'Prueba':'Trial'}</span>`
            : isVencido  ? `<span class="badge badge-red">${isES?'Vencido':'Expired'}</span>`
            : isCancelada ? `<span class="badge badge-yellow">${isES?'Cancelada':'Cancelled'}</span>`
            : isPausada  ? `<span class="badge badge-yellow">${isES?'Pausada':'Paused'}</span>`
            : `<span class="badge badge-green">${isES?'Activa':'Active'}</span>`;

          let proximoCobroHtml = '';
          if (isTrial && diasTrial !== null) {
            proximoCobroHtml = `<div style="font-size:.74rem;color:var(--color-text-muted);margin-bottom:10px;">⏳ ${isES?`${diasTrial} día${diasTrial===1?'':'s'} restantes de prueba`:`${diasTrial} day${diasTrial===1?'':'s'} left in trial`}</div>`;
          } else if (susc.period_end && isCancelada) {
            proximoCobroHtml = `<div style="font-size:.74rem;color:var(--color-text-muted);margin-bottom:10px;">${isES?'Acceso hasta':'Access until'}: <strong style="color:var(--color-text);">${storage.formatDate(susc.period_end,'medium')}</strong></div>`;
          } else if (susc.period_end && !isTrial && !isVencido) {
            proximoCobroHtml = `<div style="font-size:.74rem;color:var(--color-text-muted);margin-bottom:10px;">📅 ${isES?'Próximo cobro':'Next payment'}: <strong style="color:var(--color-text);">${storage.formatDate(susc.period_end,'medium')}</strong></div>`;
          }

          return `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">
              <div>
                <div style="font-size:.72rem;color:var(--color-text-faint);text-transform:uppercase;letter-spacing:.03em;">${i18n.t('configPlanCurrent')}</div>
                <div style="font-size:1.05rem;font-weight:800;color:var(--color-text);margin-top:2px;">
                  ${sanitize(planLabel)}${!isTrial && !isVencido && priceUsd ? ` <span style="font-size:.78rem;font-weight:600;color:var(--color-text-muted);">· $${isAnual?priceYrUsd:priceUsd}/${isAnual?(isES?'año':'yr'):(isES?'mes':'mo')}</span>` : ''}
                </div>
              </div>
              ${estadoBadge}
            </div>
            ${proximoCobroHtml}
            <div style="font-size:.74rem;color:var(--color-text-muted);margin-bottom:14px;">
              👥 ${isES?'Usuarios disponibles':'Available users'}: <strong style="color:var(--color-text);">${maxUsuarios}</strong>
            </div>
            ${!isTrial && !isVencido && !isAnual && !isCancelada ? `
            <div style="font-size:.74rem;color:#4ade80;background:rgba(34,197,94,.1);border-radius:8px;padding:8px 10px;margin-bottom:14px;cursor:pointer;"
                 onclick="showPlanUpgradeModal()">
              ${i18n.t('configPlanSwitchToAnnual').replace('{pct}', ahorroPct)}
            </div>` : ''}
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
              <button class="btn btn-primary btn-sm" onclick="showPlanUpgradeModal()">
                💳 ${i18n.t('configPlanUpgrade')}
              </button>
              ${!isTrial && !isVencido && !isCancelada ? `
              <button class="btn btn-secondary btn-sm" onclick="_confirmCancelSubscription()">
                ${i18n.t('configPlanCancel')}
              </button>` : ''}
            </div>
            <div style="font-size:.72rem;color:var(--color-text-faint);line-height:1.6;">
              ℹ️ ${i18n.t('configPlanInvoiceNote')}
            </div>
          `;
        })()}
      </div>` : ''}

      <!-- Datos y backup -->
      <div class="card">
        <h4 style="margin-bottom:16px;">💾 ${i18n.getLang()==='es'?'💾 Datos y backup':'💾 Config & Backup'}</h4>
        <div style="font-size:.82rem;color:var(--color-text-faint);margin-bottom:16px;line-height:1.8;">
          <div>📁 Archivos: <strong style="color:var(--color-text)">${info.files}</strong></div>
          <div>📊 Registros: <strong style="color:var(--color-text)">${info.records.toLocaleString()}</strong></div>
          <div>💽 Espacio: <strong style="color:var(--color-text)">${info.usedKB} KB</strong></div>
          ${info.lastBackup ? `<div>🕐 ${i18n.t('settingsLastBackup')}: <strong style="color:var(--color-text)">${storage.formatDate(info.lastBackup,'medium')}</strong></div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="storage.downloadBackup();showToast('✅ Backup descargado','green')">
            ⬇️ ${i18n.t('settingsDescargarBk')}
          </button>
          <button class="btn btn-secondary btn-sm" onclick="triggerRestoreFile()">
            ⬆️ ${i18n.t('settingsRestaurarBk')}
          </button>
          <input type="file" id="restoreInput" accept=".json" style="display:none" onchange="handleRestoreFile(event)" />
          ${isDemo ? `
            <button class="btn btn-secondary btn-sm" onclick="reloadDemoData()">
              🔄 ${i18n.t('settingsRecargarDemo')}
            </button>` : `
            <button class="btn btn-danger btn-sm" onclick="_confirmClearAll()">
              🗑️ ${i18n.getLang()==='es'?'Eliminar todos los datos':'Delete all data'}
            </button>`}
        </div>
      </div>

      <!-- Reports -->
      <div class="card">
        <h4 style="margin-bottom:16px;">${'📄 '+(i18n.getLang()==='es'?'Informes':'Reports')}</h4>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="exportPDF()">
            📄 ${i18n.t('settingsExportarPDF')}
          </button>
          <button class="btn btn-secondary btn-sm" onclick="exportWeeklyReport&&exportWeeklyReport()">
            📋 ${i18n.t('settingsInformeSem')}
          </button>
          <button class="btn btn-secondary btn-sm" onclick="togglePresentationMode()">
            🖥️ ${i18n.t('settingsModoPres')}
          </button>
        </div>
      </div>


      <!-- Comportamiento del módulo de Clientes -->
      <div class="card">
        <h4 style="margin-bottom:16px;">👥 ${i18n.getLang()==='es'?'Comportamiento — Clientes':'Behavior — Clients'}</h4>

        <div class="form-group" style="margin-bottom:0;">
          <label style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;">
            <div style="position:relative;margin-top:2px;flex-shrink:0;">
              <input type="checkbox" id="rfmPenaltyToggle"
                ${config.rfmPenaltyEnabled !== false ? 'checked' : ''}
                onchange="storage.setConfig({rfmPenaltyEnabled:this.checked});storage.invalidateCache();renderCurrentModule();showToast('✅ '+(i18n.getLang()==='es'?'Guardado':'Saved'),'green');"
                style="width:18px;height:18px;accent-color:var(--color-blue);cursor:pointer;" />
            </div>
            <div>
              <div style="font-size:.85rem;font-weight:600;color:var(--color-text);margin-bottom:3px;">
                ${i18n.t('collRFMPenaltyToggle')}
              </div>
              <div style="font-size:.73rem;color:var(--color-text-faint);line-height:1.5;">
                ${i18n.t('collRFMPenaltyHint')}
              </div>
            </div>
          </label>
        </div>
      </div>

    </div><!-- /grid -->
  `;
  
  // Renderizar campos de impuestos después de insertar HTML
  setTimeout(() => settingsModule._renderTaxFields(), 0);
}

function _confirmClearAll() {
  const isEs = i18n.getLang() === 'es';
  const msg  = isEs
    ? i18n.t('settingsConfirmDelete')
    : i18n.t('settingsConfirmDelete');
  if (!confirm(msg)) return;
  storage.clearAllData().then(() => {
    buildSidebarNav();
    renderCurrentModule();
    showToast(i18n.getLang()==='es' ? '🗑️ Datos eliminados' : '🗑️ Data deleted', 'yellow');
  });
}

// ── CANCELAR SUSCRIPCIÓN (Bloque 3.5) ────────────────────────────
// Confirmación en dos pasos: el modal explícito + un confirm() nativo
// antes de ejecutar. No se cancela con un solo clic.
function _confirmCancelSubscription() {
  document.getElementById('cancelSubModal')?.remove();
  const isES = i18n.getLang() !== 'en';
  const susc = plans.getSuscripcionRaw();
  const fechaAcceso = susc.period_end
    ? storage.formatDate(susc.period_end, 'long')
    : (isES ? 'el fin del período actual' : 'the end of your current period');

  const overlay = document.createElement('div');
  overlay.id = 'cancelSubModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,30,.92);z-index:99999;' +
    'display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:var(--color-bg-card,#111827);border:1px solid var(--color-border,#1e2d40);
                border-radius:16px;width:100%;max-width:440px;padding:28px;">
      <div style="font-size:1.6rem;margin-bottom:10px;">⚠️</div>
      <h3 style="font-size:1.05rem;font-weight:800;color:var(--color-text,#f0f4ff);margin-bottom:14px;">
        ${i18n.t('cancelSubTitle')}
      </h3>
      <ul style="list-style:none;padding:0;margin:0 0 16px 0;font-size:.82rem;color:var(--color-text,#f0f4ff);line-height:1.9;">
        <li>📅 ${i18n.t('cancelSubAccessUntil').replace('{date}', fechaAcceso)}</li>
        <li>💾 ${i18n.t('cancelSubDataKept')}</li>
        <li>🔄 ${i18n.t('cancelSubReactivate')}</li>
      </ul>
      <label style="display:block;font-size:.78rem;font-weight:700;color:var(--color-text-muted,#8899aa);margin-bottom:6px;">
        ${i18n.t('cancelSubReasonLabel')}
      </label>
      <textarea id="cancelSubReason" rows="2"
        style="width:100%;padding:10px;border-radius:8px;background:var(--color-bg,#1a2234);
               border:1px solid var(--color-border,#1e2d40);color:var(--color-text,#f0f4ff);
               font-size:.82rem;box-sizing:border-box;margin-bottom:18px;resize:vertical;font-family:inherit;"
        placeholder="${i18n.t('cancelSubReasonPlaceholder')}"></textarea>
      <div style="display:flex;gap:8px;">
        <button id="cancelSubConfirm" class="btn btn-danger btn-sm" style="flex:1;">${i18n.t('cancelSubConfirmBtn')}</button>
        <button id="cancelSubBack" class="btn btn-secondary btn-sm">${i18n.t('cancelSubBackBtn')}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('cancelSubBack').onclick = () => overlay.remove();
  document.getElementById('cancelSubConfirm').onclick = () => {
    const motivo = document.getElementById('cancelSubReason')?.value.trim() || '';
    overlay.remove();
    // Segundo paso: confirmación nativa antes de ejecutar de verdad.
    if (!confirm(i18n.t('cancelSubFinalConfirm'))) return;
    _executeCancelSubscription(motivo);
  };
}

async function _executeCancelSubscription(motivo) {
  try {
    showToast(i18n.t('cancelSubProcessing'), 'blue');
    const token = await window.Clerk.session.getToken({ template: 'supabase' });
    if (!token) throw new Error('Sesión no disponible');

    const res = await fetch('/.netlify/functions/mp-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ motivo }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'error');

    showToast('✅ ' + i18n.t('cancelSubSuccess'), 'green');
    renderCurrentModule();
  } catch (e) {
    console.error('[settings] cancelar suscripción:', e);
    if (window.Sentry) {
      Sentry.captureException(e, { tags: { modulo: 'settings', operacion: 'cancelSubscription' } });
    }
    showToast('❌ ' + i18n.t('cancelSubError'), 'red');
  }
}

function renderComingSoon(container, title, icon) {
  container.innerHTML = `
    <div class="module-header">
      <div class="module-title-wrap">
        <h1 class="module-title">${icon} ${title}</h1>
        <p class="module-subtitle">Módulo disponible con tus datos</p>
      </div>
    </div>
    <div class="no-data-state">
      <div class="no-data-icon">${icon}</div>
      <h2 class="no-data-title">Módulo ${title}</h2>
      <p class="no-data-desc">Sube tus datos de <strong>${title.toLowerCase()}</strong> y este módulo se activará automáticamente.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:16px">
        <button class="btn btn-primary" onclick="showModal('uploadModal')">📂 Subir datos</button>
        <button class="btn btn-secondary" onclick="downloadTemplate && downloadTemplate('${title.toLowerCase()}')">📥 Descargar plantilla</button>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════════
// SETTINGS MODULE OBJECT — Manejo de formulario de impuestos
// ════════════════════════════════════════════════════════════════
const settingsModule = {
  // Presets de impuestos por país
  countryTaxes: {
    // América Latina
    'Chile':       [{ name: 'IVA',       rate: 19 }],
    'Colombia':    [{ name: 'IVA',       rate: 19 }],
    'México':      [{ name: 'IVA',       rate: 16 }],
    'Perú':        [{ name: 'IGV',       rate: 18 }],
    'Argentina':   [{ name: 'IVA',       rate: 21 }],
    'Ecuador':     [{ name: 'IVA',       rate: 12 }],
    'Costa Rica':  [{ name: 'IVA',       rate: 13 }],
    'Uruguay':     [{ name: 'IVA',       rate: 22 }],
    'Brasil':      [{ name: 'IVA',       rate: 17 }],  // ICMS equiv. aprox.
    'Panamá':      [{ name: 'ITBMS',     rate:  7 }],
    // Resto del mundo
    'Australia':   [{ name: 'GST',       rate: 10 }],
    'Canadá':      [{ name: 'GST',       rate:  5 }],
    'España':      [{ name: 'IVA',       rate: 21 }],
    'United Kingdom': [{ name: 'VAT',    rate: 20 }],
    'United States':  [{ name: 'Sales Tax', rate: 0 }],
    // Personalizado
    'Personalizado': [{ name: 'Impuesto', rate: 0 }],
  },

  setCountryTaxes(country) {
    const taxes = this.countryTaxes[country] || [{ name: 'IVA', rate: 19 }];
    storage.setConfig({ taxes });
    storage.invalidateCache();
    this._renderTaxFields();
    showToast(`✅ Impuestos de ${country} configurados`, 'green');
  },

  addTaxField() {
    const config = storage.getConfig();
    const taxes = config.taxes || [{ name: 'IVA', rate: 19 }];
    taxes.push({ name: 'Nuevo impuesto', rate: 0 });
    storage.setConfig({ taxes });
    this._renderTaxFields();
  },

  removeTaxField(index) {
    const config = storage.getConfig();
    const taxes = config.taxes || [{ name: 'IVA', rate: 19 }];
    if (taxes.length <= 1) {
      showToast('⚠️ Debes mantener al menos un impuesto', 'yellow');
      return;
    }
    taxes.splice(index, 1);
    storage.setConfig({ taxes });
    this._renderTaxFields();
  },

  updateTaxField(index, field, value) {
    const config = storage.getConfig();
    const taxes = config.taxes || [{ name: 'IVA', rate: 19 }];
    if (!taxes[index]) return;
    taxes[index][field] = field === 'rate' ? parseFloat(value) || 0 : String(value);
    storage.setConfig({ taxes });
    storage.invalidateCache();
  },

  _renderTaxFields() {
    const config = storage.getConfig();
    const taxes = config.taxes || [{ name: 'IVA', rate: 19 }];
    const container = document.getElementById('taxesContainer');
    if (!container) return;

    const totalRate = taxes.reduce((sum, t) => sum + (t.rate || 0), 0);

    container.innerHTML = `
      <div style="margin-bottom:12px;padding:8px;background:rgba(100,150,255,0.1);border-radius:4px;border-left:3px solid var(--color-blue);">
        <div style="font-size:.75rem;color:var(--color-text-faint);margin-bottom:4px;">${i18n.t('settingsPresets')}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${Object.keys(this.countryTaxes).map(country => `
            <button class="btn btn-ghost btn-sm" onclick="settingsModule.setCountryTaxes('${country}')" 
              style="font-size:.7rem;padding:4px 8px;">
              ${country==='Personalizado'&&i18n.getLang()==='en'?'Custom':country}
            </button>
          `).join('')}
        </div>
      </div>

      <div style="margin-bottom:8px;padding:8px;background:rgba(255,255,100,0.1);border-radius:4px;border-left:3px solid var(--color-yellow);">
        <strong style="font-size:.8rem;">${i18n.t('settingsTotal')} ${totalRate}%</strong>
      </div>

      ${taxes.map((tax, i) => `
        <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:8px;">
          <div style="flex:1;">
            <label class="form-label" style="font-size:.75rem;">${i18n.getLang()==='es'?'Nombre':'Name'}</label>
            <input type="text" class="input" value="${sanitizeAttr(tax.name) || 'Impuesto'}" placeholder="IVA, GST, VAT..."
              onchange="settingsModule.updateTaxField(${i}, 'name', this.value)" />
          </div>
          <div style="width:90px;">
            <label class="form-label" style="font-size:.75rem;">%</label>
            <input type="number" class="input" value="${tax.rate ?? 0}" min="0" max="100" step="0.01" placeholder="0.00"
              onchange="settingsModule.updateTaxField(${i}, 'rate', this.value)" />
          </div>
          <button class="btn btn-ghost btn-sm" onclick="settingsModule.removeTaxField(${i})" style="padding:6px 8px;">
            🗑️
          </button>
        </div>
      `).join('')}
    `;
  }
};

// Renderizar campos de impuestos al cargar settings
window.addEventListener('load', () => {
  const container = document.getElementById('taxesContainer');
  if (container) settingsModule._renderTaxFields();
});

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
            <input type="text" class="input" value="${tax.name || 'Impuesto'}" placeholder="IVA, GST, VAT..."
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

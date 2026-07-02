// ════════════════════════════════════════════════════════════════
// CLAROKPIS — goals-module.js
// Módulo configuración visual de metas
// Solo visible para rol Dueño
// ════════════════════════════════════════════════════════════════

const goalsModule = (() => {
  let activeTab = 'global';
  let pendingChanges = {};

  function render(container) {
    const goals    = storage.getGoals();
    const umbrales = storage.getSemaforoUmbrales();
    const config   = storage.getConfig();
    const sym      = config.currencySymbol || '$';

    const salesRows = storage.getData('sales');
    const sellers   = [...new Set(salesRows.map(r=>r.Vendedor).filter(Boolean))];
    const branches  = [...new Set(salesRows.map(r=>r.Sucursal).filter(Boolean))];
    const goalsByV  = storage.getGoalsByVendedor();
    const goalsByS  = storage.getGoalsBySucursal();

    container.innerHTML = `
      <div class="module-header">
        <div>
          <h1 class="module-title">🎯 ${i18n.t('goalsTitle')}</h1>
          <p class="module-subtitle">${i18n.t('goalsSubtitle')}</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-secondary btn-sm" onclick="goalsModule._resetGoals()">↺ ${i18n.t('goalsReset')}</button>
          <button class="btn btn-primary" onclick="goalsModule._saveAll()">✅ ${i18n.t('goalsSave')}</button>
        </div>
      </div>

      <div class="tabs" style="margin-bottom:var(--space-5)">
        ${['global','sellers','branches','thresholds'].map(t=>`
          <div class="tab-btn ${activeTab===t?'active':''}" onclick="goalsModule._setTab('${t}')">
            ${{
              global:      '🌐 ' + i18n.t('goalsTabGlobales'),
              sellers:     '👤 ' + i18n.t('goalsTabPorVend'),
              branches:    '🏪 ' + i18n.t('goalsTabPorSuc'),
              thresholds:  '🚦 ' + i18n.t('goalsThresholds'),
            }[t]}
          </div>`).join('')}
      </div>

      <div id="goalsTabContent"></div>
    `;

    _renderTab(goals, umbrales, sym, sellers, branches, goalsByV, goalsByS);
  }

  function _setTab(tab) {
    activeTab = tab;
    // Scope al contentArea para no afectar tabs de otros módulos
    const scope = document.getElementById('contentArea') || document;
    scope.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const idx = ['global','sellers','branches','thresholds'].indexOf(tab) + 1;
    const active = scope.querySelector(`.tab-btn:nth-child(${idx})`);
    if (active) active.classList.add('active');

    const goals    = storage.getGoals();
    const umbrales = storage.getSemaforoUmbrales();
    const config   = storage.getConfig();
    const salesRows = storage.getData('sales');
    _renderTab(
      goals, umbrales, config.currencySymbol||'$',
      [...new Set(salesRows.map(r=>r.Vendedor).filter(Boolean))],
      [...new Set(salesRows.map(r=>r.Sucursal).filter(Boolean))],
      storage.getGoalsByVendedor(),
      storage.getGoalsBySucursal()
    );
  }

  function _renderTab(goals, umbrales, sym, sellers, branches, goalsByV, goalsByS) {
    const el = document.getElementById('goalsTabContent');
    if (!el) return;

    if (activeTab === 'global') {
      const KPI_GROUPS = [
        { label: '💰 '+i18n.t('goalsSecVentas'), items: [
          { key:'sales_monthly',    label:i18n.t('kpiGoalSalesMonthly'),   hint:i18n.t('goalsMontoDollar')+',',      type:'currency', unit:sym },
          { key:'avg_ticket',       label:i18n.t('kpiGoalAvgTicket'),      hint:i18n.t('goalsTicketEsp'),            type:'currency', unit:sym },
          { key:'growth_rate',      label:i18n.t('goalsCrecMensual'),      hint:i18n.t('goalsPctVsMes'),             type:'pct', unit:'%' },
          { key:'conversion_rate',  label:i18n.t('kpiGoalConversion'),     hint:i18n.t('goalsLeadsTransac'),         type:'pct', unit:'%' },
        ]},
        { label: '👥 '+i18n.t('goalsSecClientes'), items: [
          { key:'retention_rate',   label:i18n.t('kpiGoalRetention'),      hint:i18n.t('goalsHintRetention'),        type:'pct', unit:'%' },
          { key:'churn_rate',       label:i18n.t('kpiGoalChurn'),          hint:i18n.t('goalsHintChurn'),            type:'pct', unit:'%', inverted:true },
          { key:'ltv_cac_ratio',    label:i18n.t('goalsLTVCACMin'),        hint:i18n.t('goalsHintLTVCAC'),           type:'num', unit:'x' },
          { key:'repurchase_rate',  label:i18n.t('goalsTasaRecompra'),     hint:i18n.t('goalsHintPctRecompra'),      type:'pct', unit:'%' },
          { key:'max_cac',          label:i18n.t('goalsCACMax'),           hint:i18n.t('goalsHintCACZero'),          type:'num', unit:'$' },
        ]},
        { label: '😊 CX', items: [
          { key:'nps',              label:i18n.t('kpiGoalNPS'),            hint:'-100 to +100',                       type:'num', unit:'' },
          { key:'csat',             label:i18n.t('kpiGoalCSAT'),           hint:'1 to 5 → as percentage',            type:'pct', unit:'%' },
          { key:'resolution_rate',  label:i18n.t('kpiGoalFCR'),           hint:i18n.getLang()==='es'?'% resuelto 1er contacto':'% resolved on first contact', type:'pct', unit:'%' },
          { key:'response_time_hrs',label:i18n.t('goalsTiempoRespuesta'), hint:i18n.t('goalsHintHoras'),             type:'num', unit:'h', inverted:true },
        ]},
        { label: '💵 '+i18n.t('goalsSecFinanzas'), items: [
          { key:'gross_margin',     label:i18n.t('kpiGoalGrossMargin'),    hint:i18n.t('goalsHintPctMin'),            type:'pct', unit:'%' },
          { key:'cash_days',        label:i18n.t('kpiGoalCashDays'),       hint:i18n.t('goalsHintDiasCaja'),          type:'num', unit:'d' },
          { key:'target_dpo',       label:i18n.t('goalsDPOMax'),           hint:i18n.t('goalsDPOMaxHint'),            type:'num', unit:'d' },
        ]},
        { label: '📦 '+i18n.t('goalsSecInventario'), items: [
          { key:'inventory_days',   label:i18n.t('kpiGoalStockDays'),      hint:i18n.t('goalsHintDiasMax'),           type:'num', unit:'d', inverted:true },
        ]},
        { label: '💹 '+(i18n.getLang()==='es'?'Precios':'Pricing'), items: [
          { key:'max_discount',     label:i18n.t('kpiGoalDiscount'),       hint:i18n.t('goalsHintPctMax'),            type:'pct', unit:'%', inverted:true },
        ]},
        { label: '📣 '+i18n.t('goalsSecMarketing'), items: [
          { key:'roi_marketing',    label:i18n.t('kpiGoalROI'),            hint:i18n.t('goalsHintPctMin'),            type:'pct', unit:'%' },
        ]},
        { label: '👨‍💼 '+i18n.t('goalsSecEquipo'), items: [
          { key:'team_goal_achievement', label:i18n.t('kpiGoalTeamAchiev'),hint:i18n.t('goalsHintEquipo'),           type:'pct', unit:'%' },
          { key:'absenteeism',      label:i18n.t('kpiGoalAbsenteeism'),    hint:i18n.t('goalsHintAbsent'),           type:'pct', unit:'%', inverted:true },
        ]},
      ];

      el.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--space-5)">
          ${KPI_GROUPS.map(group => `
            <div class="section-card">
              <div class="section-card-header">
                <div class="section-card-title">${group.label}</div>
              </div>
              <table class="goals-table">
                <thead>
                  <tr>
                    <th style="width:45%">${i18n.t("goalsColKPI")}</th>
                    <th style="width:20%">${i18n.t("goalsColMetaActual")}</th>
                    <th style="width:20%">${i18n.t("goalsColNuevaMeta")}</th>
                    <th style="width:15%">${i18n.t("goalsColUnidad")}</th>
                  </tr>
                </thead>
                <tbody>
                  ${group.items.map(item => `
                    <tr>
                      <td>
                        <div class="goals-kpi-label">${item.label}</div>
                        <div class="goals-kpi-hint">${item.hint}</div>
                      </td>
                      <td style="font-family:var(--font-mono);font-size:.85rem;color:var(--color-text-muted)">
                        ${_formatGoalValue(goals[item.key], item)}
                      </td>
                      <td>
                        <input class="goals-input" type="text" inputmode="decimal"
                          placeholder="${_formatGoalValue(goals[item.key], item)}"
                          value="${goals[item.key] ? _formatSmartInput(goals[item.key], item) : ''}"
                          data-goal-key="${item.key}"
                          data-goal-type="${item.type}"
                          data-goal-unit="${item.unit||''}"
                          onfocus="this.value=this.value?goalsModule._parseSmartInput(this.value)||'':this.value;this.select()"
                          onblur="if(this.value!==''){const n=goalsModule._parseSmartInput(this.value);this.value=n?goalsModule._formatSmartInput(n,{type:this.dataset.goalType,unit:this.dataset.goalUnit}):''}"
                          onchange="goalsModule._onGoalChange('${item.key}', this.value)" />
                      </td>
                      <td style="font-size:.78rem;color:var(--color-text-faint)">${item.unit}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}
        </div>
      `;
    }

    else if (activeTab === 'sellers') {
      if (!sellers.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-title">${i18n.t('goalsNoVend')}</div><div class="empty-state-desc">${i18n.t('goalsNoVendDesc')}</div></div>`;
        return;
      }
      el.innerHTML = `
        <div class="section-card">
          <div class="section-card-header">
            <div class="section-card-title">👤 ${i18n.t('goalsMetasIndVend')}</div>
            <div class="section-card-subtitle">${i18n.t('goalsMetasIndVendDesc')}</div>
          </div>
          <table class="goals-table">
            <thead><tr>
              <th>${i18n.t('goalsColVendedor')}</th>
              <th>${i18n.t('goalsColMetaGlobal')}</th>
              <th>${i18n.t('goalsColMetaIndiv')}</th>
            </tr></thead>
            <tbody>
              ${sellers.map(name => `
                <tr>
                  <td style="font-weight:600">${sanitize(name)}</td>
                  <td style="font-family:var(--font-mono);font-size:.82rem;color:var(--color-text-muted)">
                    ${formatCurrency(goals.sales_monthly||0)}
                  </td>
                  <td>
                    <input class="goals-input" type="text" inputmode="decimal"
                        placeholder="${formatCurrency(goalsByV[name]?.ventas_mensual || goals.sales_monthly||0)}"
                        value="${goalsByV[name]?.ventas_mensual ? formatCurrency(goalsByV[name].ventas_mensual) : ''}"
                        data-goal-type="currency" data-goal-unit="$"
                        onfocus="this.value=this.value?goalsModule._parseSmartInput(this.value)||'':this.value;this.select()"
                        onblur="if(this.value!==''){const n=goalsModule._parseSmartInput(this.value);this.value=n?formatCurrency(n):''}"
                        onchange="goalsModule._onSellerGoalChange('${name}', 'ventas_mensual', this.value)" />
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    else if (activeTab === 'branches') {
      if (!branches.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏪</div><div class="empty-state-title">${i18n.t('goalsNoSuc')}</div></div>`;
        return;
      }
      el.innerHTML = `
        <div class="section-card">
          <div class="section-card-header">
            <div class="section-card-title">🏪 ${i18n.t('goalsMetasSuc')}</div>
          </div>
          <table class="goals-table">
            <thead><tr>
              <th>${i18n.t('goalsColSucursal')}</th>
              <th>${i18n.t('goalsColMetaGlobal')}</th>
              <th>${i18n.t('goalsColMetaSuc')}</th>
            </tr></thead>
            <tbody>
              ${branches.map(name => `
                <tr>
                  <td style="font-weight:600">${sanitize(name)}</td>
                  <td style="font-family:var(--font-mono);font-size:.82rem;color:var(--color-text-muted)">
                    ${formatCurrency(goals.sales_monthly||0)}
                  </td>
                  <td>
                    <input class="goals-input" type="text" inputmode="decimal"
                        placeholder="${formatCurrency(goalsByS[name]?.ventas_mensual || goals.sales_monthly||0)}"
                        value="${goalsByS[name]?.ventas_mensual ? formatCurrency(goalsByS[name].ventas_mensual) : ''}"
                        data-goal-type="currency"
                        data-goal-unit="$"
                        onfocus="this.value=this.value?goalsModule._parseSmartInput(this.value)||'':this.value;this.select()"
                        onblur="if(this.value!==''){const n=goalsModule._parseSmartInput(this.value);this.value=n?formatCurrency(n):''}"
                        onchange="goalsModule._onBranchGoalChange('${name}', 'ventas_mensual', this.value)" />
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    else if (activeTab === 'thresholds') {
      el.innerHTML = `
        <div class="section-card" style="max-width:480px">
          <div class="section-card-header">
            <div class="section-card-title">🚦 ${i18n.t('goalsThresholds')}</div>
            <div class="section-card-subtitle">${i18n.t('goalsThresholdsHelp')}</div>
          </div>

          <div class="form-group">
            <label class="form-label">🟡 ${i18n.t('goalsAmariilo')}</label>
            <input class="form-input" type="number" id="inputAmarillo" min="50" max="99" step="1"
              value="${umbrales.amarillo}" />
            <div class="form-hint">${i18n.t('goalsHintPctMin')} ${i18n.getLang()==='es'?'para semáforo':'for'} 🟡</div>
          </div>

          <div class="form-group">
            <label class="form-label">🔴 ${i18n.t('goalsRojo')}</label>
            <input class="form-input" type="number" id="inputRojo" min="0" max="80" step="1"
              value="${umbrales.rojo}" />
            <div class="form-hint">${i18n.t('goalsHintPctMin')} ${i18n.getLang()==='es'?'para semáforo':'for'} 🔴</div>
          </div>

          <div style="background:var(--color-bg);border:0.5px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-5);margin-bottom:var(--space-5)">
            <div style="font-size:.75rem;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:var(--space-4)">${i18n.t('goalsPreviewSemaforo')}</div>
            <div style="display:flex;flex-direction:column;gap:var(--space-3)">
              <div style="display:flex;align-items:center;gap:10px">
                <span class="status-dot green"></span>
                <span style="font-size:.82rem;color:var(--color-text)">≥ ${umbrales.amarillo}% ${i18n.t('goalsVerdeLabel')}</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <span class="status-dot yellow"></span>
                <span style="font-size:.82rem;color:var(--color-text)">${umbrales.rojo}% – ${umbrales.amarillo-1}% ${i18n.t('goalsAmarilloLabel')}</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <span class="status-dot red"></span>
                <span style="font-size:.82rem;color:var(--color-text)">< ${umbrales.rojo}% ${i18n.t('goalsRojoLabel')}</span>
              </div>
            </div>
          </div>

          <button class="btn btn-primary" onclick="goalsModule._saveThresholds()">
            ✅ ${i18n.t('goalsSaveThresholds')}
          </button>
        </div>
      `;
    }
  }

  // ── HANDLERS ─────────────────────────────────────────────────
  function _onGoalChange(key, value) {
    pendingChanges[key] = _parseSmartInput(value);
  }

  function _onSellerGoalChange(name, key, value) {
    storage.setGoalVendedor(name, key, _parseSmartInput(value));
  }

  function _onBranchGoalChange(name, key, value) {
    storage.setGoalSucursal(name, key, _parseSmartInput(value));
  }

  function _saveAll() {
    if (Object.keys(pendingChanges).length) {
      storage.setGoals(pendingChanges);
      pendingChanges = {};
    }
    showToast('✅ ' + i18n.t('goalsSaved'), 'green');
    storage.invalidateCache();
  }

  function _saveThresholds() {
    const amarillo = parseInt(document.getElementById('inputAmarillo')?.value) || 80;
    const rojo     = parseInt(document.getElementById('inputRojo')?.value)     || 60;
    if (amarillo <= rojo) { showToast('⚠️ ' + i18n.t('goalsUmbralError'), 'yellow'); return; }
    storage.setSemaforoUmbrales(amarillo, rojo);
    showToast('✅ ' + i18n.t('goalsUmbralSaved'), 'green');
    storage.invalidateCache();
    _setTab('thresholds');
  }

  function _resetGoals() {
    if (!confirm(i18n.t('goalsConfirmReset'))) return;
    storage.lsDel('goals');
    storage.lsDel('goals_vendedor');
    storage.lsDel('goals_sucursal');
    pendingChanges = {};
    storage.invalidateCache();
    render(document.getElementById('contentArea'));
    showToast(i18n.t('goalsRestoredMsg'), 'blue');
  }

  // ── SMART INPUT HELPERS ──────────────────────────────────────
  function _parseSmartInput(val) {
    if (val === '' || val === null || val === undefined) return 0;
    let s = String(val).trim().replace(/^[^0-9.]+/, '');
    const mag = s.match(/^([\d.]+)\s*([MmKkBb])$/);
    if (mag) {
      const num = parseFloat(mag[1]);
      const mult = { m: 1e6, k: 1e3, b: 1e9 }[mag[2].toLowerCase()] || 1;
      return num * mult;
    }
    const clean = s.replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
  }

  function _formatSmartInput(val, item) {
    if (!val && val !== 0) return '';
    if (item.type === 'currency') return formatCurrency(val);
    if (item.type === 'pct')      return val % 1 === 0 ? val + '%' : val.toFixed(1) + '%';
    return val + (item.unit || '');
  }

  // ── HELPERS ──────────────────────────────────────────────────
  function _formatGoalValue(val, item) {
    if (!val && val !== 0) return '—';
    if (item.type === 'currency') return formatCurrency(val);
    if (item.type === 'pct')      return formatPct(val);
    return val + (item.unit || '');
  }

  return { render, _setTab, _onGoalChange, _onSellerGoalChange, _onBranchGoalChange, _saveAll, _saveThresholds, _resetGoals, _parseSmartInput, _formatSmartInput };
})();

function renderGoals(container) { goalsModule.render(container); }

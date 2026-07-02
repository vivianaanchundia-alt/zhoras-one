/**
 * ClaroKPIs — finance-module.js
 * Módulo Finanzas + Flujo de Caja. Solo visible para rol Dueño.
 */

const financeModule = (() => {
  let activeTab = 'cashflow';

  // Helper: devuelve etiqueta de impuestos totales (ej: "IVA 19%", "IVA 19% + Consumo 2%")
  function getTotalTaxLabel() {
    const taxes = storage.getConfig().taxes || [{ name: 'IVA', rate: 19 }];
    const totalRate = taxes.reduce((sum, t) => sum + (t.rate || 0), 0);
    if (taxes.length === 1) {
      return `${taxes[0].name} ${taxes[0].rate}%`;
    }
    const labels = taxes.map(t => `${t.name} ${t.rate}%`).join(' + ');
    return `${labels} = ${totalRate}%`;
  }

  function render(container) {
    // Solo dueño y demo pueden ver finanzas
    if (!auth.can('canViewFinance')) {
      container.innerHTML = `<div class="no-data-state">
        <div class="no-data-icon">🔒</div>
        <h2 class="no-data-title">${i18n.t('errorNoPermission')}</h2>
        <p class="no-data-desc">${i18n.getLang()==='es'?'El módulo de Finanzas es exclusivo del rol Dueño.':'The Finance module is restricted to Owner role.'}</p>
      </div>`;
      return;
    }

    const rows   = storage.applyFilters(storage.getData('finance'), 'finance');
    const goals  = storage.getGoals();
    const config = storage.getConfig();
    const sym    = config.currencySymbol || '$';
    const data   = calcFinanceKPIs(rows, goals);
    const hasData = rows.length > 0;

    container.innerHTML = `
      <div class="module-header">
        <div class="module-title-wrap">
          <h1 class="module-title">💵 ${i18n.t('financeTitle')}</h1>
          <p class="module-subtitle">${rows.length.toLocaleString()} ${i18n.t('registros')||'registros'}${(() => {
              const _dr = storage.getDataDateRange('finance');
              return _dr ? ' · ' + (i18n.getLang()==='es' ? 'Datos: ' : 'Data: ') + _dr.label : '';
            })()}${auth.isDemo() ? (i18n.getLang()==='es'?' · Modo Demo 👁️':' · Demo mode 👁️') : (i18n.getLang()==='es'?' · Solo visible para Dueño 🔒':' · Owner role only 🔒')}</p>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button>
      </div>

      ${renderGlobalFilters('finance', { showSeller: false, showChannel: false })}
      <div class="tabs" id="financeTabs">
        <div class="tab-item ${activeTab==='cashflow' ?'active':''}" onclick="financeModule.setTab('cashflow')">${i18n.t('finTabCashflow')}</div>
        <div class="tab-item ${activeTab==='margins'  ?'active':''}" onclick="financeModule.setTab('margins')">${i18n.getLang()==='es'?'📊 Márgenes':'📊 Margins'}</div>
        <div class="tab-item ${activeTab==='forecast' ?'active':''}" onclick="financeModule.setTab('forecast')">${i18n.getLang()==='es'?'📈 Proyección':'📈 Projection'}</div>
        <div class="tab-item ${activeTab==='dpo'      ?'active':''}" onclick="financeModule.setTab('dpo')">${i18n.t('finTabPayables')}</div>
        <div class="tab-item ${activeTab==='breakeven'?'active':''}" onclick="financeModule.setTab('breakeven')">${i18n.t('finTabBreakeven')}</div>
      </div>

      ${!hasData ? noData() : renderTab(data, goals, sym, rows)}
    `;

    if (hasData) setTimeout(() => renderCharts(data, sym), 50);
  }

  function renderTab(data, goals, sym, rows) {
    if (activeTab === 'cashflow')  return renderCashflow(data, goals, sym);
    if (activeTab === 'margins')   return renderMargins(data, goals, sym);
    if (activeTab === 'forecast')  return renderForecast(data, goals, sym);
    if (activeTab === 'dpo')       return renderDPO(data, goals, sym);
    if (activeTab === 'breakeven') return renderBreakeven(data, goals, sym);
    return '';
  }

  // ── FLUJO DE CAJA ─────────────────────────────────────────────
  function renderCashflow(data, goals, sym) {
    const cashStatus  = storage.getStatus(data.cashDays, goals.cash_days || 30);
    const balStatus   = data.cashBalance >= 0 ? 'green' : 'red';

    return `
      ${(storage.getData('collections')||[]).length > 0 ? `
        <div class="card" style="background:var(--color-blue-bg);border-color:var(--color-blue-border);margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <span style="font-size:.82rem;color:var(--color-blue);">💳 ${i18n.getLang()==='es'?'Tienes datos de cobranzas — ver el detalle de facturas vencidas':'You have collections data — view overdue invoice details'}</span>
          <button class="btn btn-sm btn-secondary" onclick="navigateTo('collections')" style="font-size:.75rem;">
            ${i18n.getLang()==='es'?'Ir a Cobranzas →':'Go to Collections →'}
          </button>
        </div>` : ''}
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(185px,1fr));margin-bottom:20px;">
        ${kpiCard('💵', i18n.t('finFlujoPeriodo'), fmt(data.netCashFlow, sym), data.netCashFlow>=0?'green':'red', i18n.t('finIngEgr'), null, null,true)}
        ${kpiCard('🏦', i18n.t('finSaldoAcum'),   fmt(data.cashBalance, sym), balStatus, i18n.t('finBalanceTotal'), null, null)}
        ${kpiCard('📅', i18n.t('finDiasCaja'),      data.cashDays !== null ? data.cashDays+' '+i18n.t('finCycleDays') : '—', cashStatus, `${i18n.t('metaLabel')}: ${goals.cash_days||30} ${i18n.t('finCycleDays')}`, data.cashDays, cashStatus)}
        ${kpiCard('📥', i18n.t('finIngresos'),          fmt(data.totalIncome, sym), 'green', i18n.t('finPeriodoActual'), null, null)}
        ${kpiCard('📤', i18n.t('finCostosGastos'),   fmt(data.totalCosts + data.totalExpenses, sym), 'red', `${i18n.t('finCostos')}: ${fmt(data.totalCosts,sym)} · ${i18n.t('finGastos')}: ${fmt(data.totalExpenses,sym)}`, null, null)}
        ${kpiCard('📋', i18n.t('finCxCobrar'),  fmt(data.receivables, sym), data.receivableDays>30?'yellow':'green', `${data.receivableDays||0} ${i18n.t('finDiasPromedio')}`, null, null)}
      </div>

      ${data.cashBalance < 0 || data.cashDays < 15 ? `
        <div class="alert alert-red" style="margin-bottom:16px;">
          <span class="alert-icon">🚨</span>
          <div class="alert-body">
            <div class="alert-title">${i18n.t('alertCashTitle')}</div>
            <div class="alert-message">${i18n.getLang()==='es' ? (data.cashBalance < 0 ? 'Saldo negativo — revisar flujo urgente.' : `Solo ${data.cashDays} ${i18n.t('finCycleDays')} de caja disponible — por debajo del mínimo recomendado.`) : (data.cashBalance < 0 ? 'Negative balance — review cash flow urgently.' : `Only ${data.cashDays} ${i18n.t('finCycleDays')} of cash available — below the recommended minimum.`)}</div>
          </div>
        </div>` : ''}

      <div class="chart-card">
        <div class="chart-card-header"><div class="chart-card-title">${i18n.t('finFlujoCajaMensual')}</div></div>
        <div class="chart-container" style="height:260px;"><canvas id="cashflowChart"></canvas></div>
      </div>
    `;
  }

  // ── MÁRGENES ──────────────────────────────────────────────────
  function renderMargins(data, goals, sym) {
    const gmStatus  = storage.getStatus(data.grossMargin,  goals.gross_margin || 40);
    const omStatus  = storage.getStatus(data.opMargin,     20);

    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(185px,1fr));margin-bottom:20px;">
        ${kpiCard('📊', i18n.t('kpiMargenBruto')||'Gross margin',   pct(data.grossMargin),  gmStatus, `${i18n.getLang()==='es'?'sobre ventas netas':'of net sales'} · Meta: ${goals.gross_margin||40}%`, data.grossMargin, gmStatus)}
        ${kpiCard('⚙️', i18n.t('kpiMargenOper')||'Operating margin',  pct(data.opMargin),     omStatus, (i18n.getLang()==='es'?'ingresos - todos los costos':'revenue minus all costs'), data.opMargin, omStatus)}
        ${kpiCard('💰', i18n.t('kpiIngresosBrutos')||'Gross revenue',     fmt(data.totalIncome, sym),  'blue', (i18n.getLang()==='es'?(i18n.getLang()==='es'?'con impuestos':'incl. taxes'):'incl. taxes'), null, null)}
        ${kpiCard('💵', i18n.t('kpiVentasNetas')||'Net sales',        fmt(data.netIncome, sym),    'blue', `${i18n.getLang()==='es'?'sin impuestos':'excl. taxes'} (${getTotalTaxLabel()})`, null, null)}
        ${kpiCard('🏷️', i18n.t('kpiCostoVentas')||'Cost of sales',    fmt(data.totalCosts, sym),   'yellow', 'COGS', null, null)}
        ${kpiCard('🏢', i18n.t('kpiGastosOp')||'Operating expenses',fmt(data.totalExpenses, sym),'yellow', (i18n.getLang()==='es'?'overhead':'overhead'), null, null)}
        ${kpiCard('✅', i18n.t('kpiResultadoNeto')||'Net result',      fmt(data.netResult, sym),    data.netResult>=0?'green':'red', (i18n.getLang()==='es'?'utilidad/pérdida':'profit/loss'), null, null)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;" class="charts-row">
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">📊 ${i18n.t('finComposicion')}</div></div>
          <div class="chart-container" style="height:240px;"><canvas id="marginCompositionChart"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">📈 ${i18n.t('finEvolucion')}</div></div>
          <div class="chart-container" style="height:240px;"><canvas id="marginTrendChart"></canvas></div>
        </div>
      </div>
    `;
  }

  // ── PROYECCIÓN ────────────────────────────────────────────────
  function renderForecast(data, goals, sym) {
    const monthlyAvgIncome = data.monthlyTrend.length
      ? data.monthlyTrend.reduce((s,m)=>s+m.income,0) / data.monthlyTrend.length : 0;
    const monthlyAvgCosts  = data.monthlyTrend.length
      ? data.monthlyTrend.reduce((s,m)=>s+m.costs+m.expenses,0) / data.monthlyTrend.length : 0;
    const monthlyNetAvg    = monthlyAvgIncome - monthlyAvgCosts;

    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px;">
        ${fcCard(i18n.getLang()==='es'?'30 días':'30 days', fmt(monthlyNetAvg,sym),    monthlyNetAvg>=0?'green':'red', i18n.t('finResultNeto'))}
        ${fcCard(i18n.getLang()==='es'?'60 días':'60 days', fmt(monthlyNetAvg*2,sym),  monthlyNetAvg>=0?'green':'red', i18n.t('finAcum2m'))}
        ${fcCard(i18n.getLang()==='es'?'90 días':'90 days', fmt(monthlyNetAvg*3,sym),  monthlyNetAvg>=0?'green':'red', i18n.t('finAcum3m'))}
      </div>

      <div class="chart-card" style="margin-bottom:16px;">
        <div class="chart-card-header"><div class="chart-card-title">${i18n.t('finProyIngCostos')}</div></div>
        <div class="chart-container" style="height:260px;"><canvas id="financeForecastChart"></canvas></div>
      </div>

      <div class="card" style="background:var(--color-blue-bg);border-color:var(--color-blue-border);">
        <div style="font-size:.82rem;color:var(--color-text-muted);line-height:1.8;">
          <strong style="color:var(--color-blue)">ℹ️ ${i18n.getLang()==='es'?'Metodología':'Methodology'}:</strong> ${i18n.getLang()==='es'?'Proyección basada en promedio de':'Projection based on average of'} ${data.monthlyTrend.length} ${i18n.getLang()==='es'?'meses con datos.':'months of data.'}
          ${i18n.getLang()==='es'?'Promedio mensual de ingresos':'Monthly avg. revenue'}: <strong>${fmt(monthlyAvgIncome,sym)}</strong> · ${i18n.getLang()==='es'?'Costos promedio':'Avg. costs'}: <strong>${fmt(monthlyAvgCosts,sym)}</strong>
        </div>
      </div>
    `;
  }

  function fcCard(label, value, status, sub) {
    const colors = { green:'rgba(34,197,94,.15)', red:'rgba(239,68,68,.15)', yellow:'rgba(234,179,8,.15)' };
    const textC  = { green:'var(--color-green)', red:'var(--color-red)', yellow:'var(--color-yellow)' };
    return `<div class="card" style="text-align:center;background:${colors[status]||colors.green};">
      <div style="font-size:.7rem;font-weight:700;color:${textC[status]};text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${label}</div>
      <div style="font-size:1.4rem;font-weight:800;font-family:var(--font-mono);color:var(--color-text);margin-bottom:3px">${value}</div>
      <div style="font-size:.72rem;color:var(--color-text-faint)">${sub}</div>
    </div>`;
  }

  // ── CUENTAS POR PAGAR / DPO ───────────────────────────────────
  function renderDPO(data, goals, sym) {
    // Banner link a cobranzas si hay datos
    const dpoStatus = data.dpo !== null
      ? (data.dpo <= (goals.target_dpo||30) ? 'green' : data.dpo <= (goals.target_dpo||30)*1.5 ? 'yellow' : 'red') : 'na';
    const dsoStatus = data.receivableDays !== null
      ? (data.receivableDays <= 15 ? 'green' : data.receivableDays <= 30 ? 'yellow' : 'red') : 'na';
    const cycleColor = data.cashCycle !== null
      ? (data.cashCycle <= 30 ? 'var(--color-green)' : data.cashCycle <= 60 ? 'var(--color-yellow)' : 'var(--color-red)') : 'var(--color-text-faint)';

    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(185px,1fr));margin-bottom:20px;">
        ${kpiCard('📋',i18n.t('finTabPayables').replace('📋 ','')||'Accounts Payable (AP)', fmt(data.payables, sym), data.payables>0?'yellow':'green', (i18n.getLang()==='es'?'saldo total por pagar':'total balance to pay'), null, null)}
        ${kpiCard('📅',i18n.t('finDPOLabel'), data.dpo !== null ? data.dpo+' '+i18n.t('finCycleDays') : '—', dpoStatus, `${i18n.t('metaLabel')}: ≤${goals.target_dpo||30} ${i18n.t('finCycleDays')}`, data.dpo, dpoStatus)}
        ${kpiCard('🧾',i18n.t('finDSOLabel'), data.receivableDays !== null ? data.receivableDays+' '+i18n.t('finCycleDays') : '—', dsoStatus, (i18n.getLang()==='es'?'tiempo promedio de cobro a clientes':'avg. collection time from clients'), data.receivableDays, dsoStatus)}
        ${kpiCard('🔄',(i18n.getLang()==='es'?'Ciclo de caja':'Cash cycle'), data.cashCycle !== null ? data.cashCycle+' '+i18n.t('finCycleDays') : '—', data.cashCycle!==null&&data.cashCycle<=30?'green':data.cashCycle!==null&&data.cashCycle<=60?'yellow':'red', (i18n.getLang()==='es'?'DSO − DPO (menor = mejor)':'DSO − DPO (lower = better)'), null, null)}
      </div>

      <!-- Explicación visual del ciclo de caja -->
      <div class="chart-card" style="margin-bottom:16px;">
        <div class="chart-card-header"><div class="chart-card-title">🔄 ${i18n.t('finCicloConv')}</div></div>
        <div style="padding:20px 24px;">
          <div style="display:flex;align-items:center;gap:0;margin-bottom:20px;flex-wrap:wrap;">
            ${_cycleBar(i18n.getLang()==='es'?'Compras a proveedor':'Purchases from supplier', data.dpo||0, 'var(--color-yellow)', i18n.getLang()==='es'?'Pagas en '+(data.dpo||'?')+' días':'Pay in '+(data.dpo||'?')+' days')}
            <div style="font-size:1.2rem;color:var(--color-text-faint);padding:0 4px;">→</div>
            ${_cycleBar(i18n.getLang()==='es'?'Cobro a clientes':'Collections from clients', data.receivableDays||0, 'var(--color-blue)', i18n.getLang()==='es'?'Cobras en '+(data.receivableDays||'?')+' días':'Collect in '+(data.receivableDays||'?')+' days')}
            <div style="font-size:1.2rem;color:var(--color-text-faint);padding:0 4px;">=</div>
            <div style="text-align:center;padding:12px 20px;border-radius:10px;background:${cycleColor}22;border:1px solid ${cycleColor}44;min-width:120px;">
              <div style="font-size:1.6rem;font-weight:800;font-family:var(--font-mono);color:${cycleColor};">${data.cashCycle ?? '—'}</div>
              <div style="font-size:.7rem;font-weight:700;color:var(--color-text-muted);margin-top:2px;">${(i18n.getLang()==='es'?'DÍAS DE CICLO':'CYCLE DAYS')}</div>
            </div>
          </div>
          <div style="background:var(--color-bg);border-radius:8px;padding:12px 16px;font-size:.8rem;color:var(--color-text-muted);line-height:1.7;">
            ${data.cashCycle !== null && data.cashCycle > 0
              ? (i18n.getLang()==='es'
                  ? `⚠️ La empresa financia <strong style="color:var(--color-yellow)">${data.cashCycle} ${i18n.t('finCycleDays')}</strong> ${i18n.t('finInsightCashDays')} — cada día equivale a aprox. <strong>${fmt((data.totalCosts+data.totalExpenses)/180, sym)}</strong> inmovilizado.`
                  : `⚠️ The company finances <strong style="color:var(--color-yellow)">${data.cashCycle} ${i18n.t('finCycleDays')}</strong> of operations on its own capital — each day equals approx. <strong>${fmt((data.totalCosts+data.totalExpenses)/180, sym)}</strong> tied up.`)
              : data.cashCycle !== null && data.cashCycle <= 0
                ? `✅ ${i18n.t('finNegCycle')}`
                : (i18n.getLang()==='es'?'Sin datos suficientes para calcular el ciclo.':'Not enough data to calculate the cycle.')}
          </div>
        </div>
      </div>

      <!-- Tabla mensual de CXP vs CXC -->
      <div class="chart-card">
        <div class="chart-card-header"><div class="chart-card-title">📊 ${i18n.t('finCuentasChart')}</div></div>
        <div class="chart-container" style="height:240px;"><canvas id="dpoChart"></canvas></div>
      </div>
    `;
  }

  function _cycleBar(label, days, color, sub) {
    return `<div style="text-align:center;padding:12px 20px;border-radius:10px;background:${color}18;border:1px solid ${color}33;min-width:110px;">
      <div style="font-size:1.4rem;font-weight:800;font-family:var(--font-mono);color:${color};">${days}</div>
      <div style="font-size:.68rem;font-weight:700;color:var(--color-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.04em;">${label}</div>
      <div style="font-size:.65rem;color:var(--color-text-faint);margin-top:1px;">${sub}</div>
    </div>`;
  }

  // ── PUNTO DE EQUILIBRIO (BREAK-EVEN) ─────────────────────────
  function renderBreakeven(data, goals, sym) {
    const be = data.breakeven;
    const beStatus = be !== null
      ? (data.totalIncome >= be ? 'green' : data.totalIncome >= be * 0.85 ? 'yellow' : 'red') : 'na';
    const coverage = be > 0 && data.totalIncome > 0
      ? Math.round((data.totalIncome / be) * 100) : null;
    const marginSafety = be > 0 && data.totalIncome > 0
      ? Math.round(((data.totalIncome - be) / data.totalIncome) * 100) : null;

    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(185px,1fr));margin-bottom:20px;">
        ${kpiCard('⚖️',(i18n.getLang()==='es'?'Punto de equilibrio':'Break-even point'), fmt(be, sym), beStatus, (i18n.getLang()==='es'?'ingresos mínimos para cubrir costos':'minimum revenue to cover costs'), null, null)}
        ${kpiCard('📊',i18n.getLang()==='es'?'Cobertura actual':'Coverage ratio', coverage !== null ? coverage+'%' : '—', beStatus, i18n.getLang()==='es'?'Ventas actuales vs. equilibrio':'Actual sales vs. break-even', coverage, beStatus)}
        ${kpiCard('🛡️',i18n.getLang()==='es'?'Margen de seguridad':'Safety margin', marginSafety !== null ? marginSafety+'%' : '—', marginSafety!==null&&marginSafety>=20?'green':marginSafety!==null&&marginSafety>=10?'yellow':'red', i18n.getLang()==='es'?'cuánto pueden caer las ventas':'how much sales can drop', null, null)}
        ${kpiCard('🏢',i18n.getLang()==='es'?'Costos fijos estimados':'Estimated fixed costs', fmt(data.totalExpenses, sym), 'yellow', i18n.getLang()==='es'?'gastos operacionales del período':'operating expenses for period', null, null)}
        ${kpiCard('🏷️',i18n.getLang()==='es'?'Costos variables':'Variable costs', fmt(data.totalCosts, sym), 'yellow', 'COGS', null, null)}
        ${kpiCard('💰',i18n.getLang()==='es'?'Margen contribución':'Contribution margin', pct(data.contributionMargin), data.contributionMargin!==null&&data.contributionMargin>=40?'green':data.contributionMargin!==null&&data.contributionMargin>=25?'yellow':'red', i18n.getLang()==='es'?'(Ingresos − CV) / Ingresos':'(Revenue − VC) / Revenue', null, null)}
      </div>

      <!-- Visualización del break-even -->
      <div class="chart-card" style="margin-bottom:16px;">
        <div class="chart-card-header"><div class="chart-card-title">⚖️ ${i18n.getLang()==='es'?'Análisis de punto de equilibrio':'Break-even analysis'}</div></div>
        <div class="chart-container" style="height:280px;"><canvas id="breakevenChart"></canvas></div>
      </div>

      <!-- Insight card -->
      <div class="card" style="background:${beStatus==='green'?'rgba(34,197,94,.07)':beStatus==='yellow'?'rgba(245,158,11,.07)':'rgba(239,68,68,.07)'};border-color:${beStatus==='green'?'rgba(34,197,94,.2)':beStatus==='yellow'?'rgba(245,158,11,.2)':'rgba(239,68,68,.2)'};">
        <div style="font-size:.85rem;color:var(--color-text);line-height:1.8;">
          ${be !== null && data.totalIncome > 0 ? `
            ${data.totalIncome >= be
              ? (i18n.getLang()==='es'?`✅ <strong>Por encima del equilibrio.</strong> Las ventas actuales (${fmt(data.totalIncome,sym)}) superan el punto de equilibrio en <strong>${fmt(data.totalIncome-be,sym)}</strong> (${marginSafety}% de margen de seguridad).`:`✅ <strong>Above break-even.</strong> Current sales (${fmt(data.totalIncome,sym)}) exceed break-even by <strong>${fmt(data.totalIncome-be,sym)}</strong> (${marginSafety}% safety margin).`)
              : (i18n.getLang()==='es'?`⚠️ <strong>Por debajo del equilibrio.</strong> Faltan <strong style="color:var(--color-red)">${fmt(be-data.totalIncome,sym)}</strong> en ventas para cubrir todos los costos. Se necesita aumentar ventas un <strong>${Math.round((be/data.totalIncome-1)*100)}%</strong>.`:`⚠️ <strong>Below break-even.</strong> <strong style="color:var(--color-red)">${fmt(be-data.totalIncome,sym)}</strong> more in sales needed to cover all costs. Sales need to increase by <strong>${Math.round((be/data.totalIncome-1)*100)}%</strong>.`)}
            <br>El margen de contribución de <strong>${pct(data.contributionMargin)}</strong> significa que por cada peso de venta, quedan <strong>${pct(data.contributionMargin)}</strong> para cubrir costos fijos.
          ` : 'Sin datos suficientes para calcular el punto de equilibrio.'}
        </div>
      </div>
    `;
  }

  // ── CÁLCULO KPIs ──────────────────────────────────────────────
  function calcFinanceKPIs(rows, goals) {
    if (!rows.length) return emptyFinanceKPIs();

    const income   = rows.filter(r => isIncome(r)).reduce((s,r)=>s+(parseFloat(r.Monto)||parseFloat(r.Ingresos)||0),0);
    const costs    = rows.filter(r => isCost(r)).reduce((s,r)=>s+(parseFloat(r.Monto)||parseFloat(r.Costos)||0),0);
    const expenses = rows.filter(r => isExpense(r)).reduce((s,r)=>s+(parseFloat(r.Monto)||parseFloat(r.Gastos_Operacionales)||0),0);

    // Si hay columnas directas
    const directIncome   = rows.reduce((s,r)=>s+(parseFloat(r.Ingresos)||0),0);
    const directCosts    = rows.reduce((s,r)=>s+(parseFloat(r.Costos)||0),0);
    const directExpenses = rows.reduce((s,r)=>s+(parseFloat(r.Gastos_Operacionales)||0),0);
    const directReceiv   = rows.reduce((s,r)=>s+(parseFloat(r.Cuentas_Por_Cobrar)||0),0);

    const totalIncome   = directIncome   || income;
    const totalCosts    = directCosts    || costs;
    const totalExpenses = directExpenses || expenses;
    const receivables   = directReceiv;

    // Ventas netas: ingresos descontando el IVA/impuesto configurado
    const netIncome    = storage.getNetAmount(totalIncome);
    const grossProfit  = totalIncome - totalCosts;
    const netResult    = totalIncome - totalCosts - totalExpenses;
    // Margen bruto real: sobre ventas netas (comparable entre países con distinto IVA)
    const grossMargin  = netIncome > 0 ? ((netIncome - totalCosts) / netIncome) * 100 : null;
    const opMargin     = totalIncome > 0 ? (netResult   / totalIncome) * 100 : null;

    const netCashFlow  = totalIncome - totalCosts - totalExpenses;
    const cashBalance  = netCashFlow;
    const dailyExpend  = (totalCosts + totalExpenses) / 30;
    const cashDays     = dailyExpend > 0 ? Math.round(cashBalance / dailyExpend) : null;
    const receivableDays = totalIncome > 0 && receivables > 0
      ? Math.round((receivables / totalIncome) * 30) : null;

    const directPayables = rows.reduce((s,r)=>s+(parseFloat(r.Cuentas_Por_Pagar)||0),0);
    const payables = directPayables;

    // DPO: (CXP / Costos) × días del período
    const periodDays = data => 30 * rows.length; // ~30 días por registro mensual
    const dpo = payables > 0 && totalCosts > 0
      ? Math.round((payables / totalCosts) * 30) : null;

    // Ciclo de caja = DSO - DPO
    const cashCycle = receivableDays !== null && dpo !== null
      ? receivableDays - dpo : null;

    // Break-even: Costos fijos / Margen de contribución %
    const contributionMargin = totalIncome > 0
      ? ((totalIncome - totalCosts) / totalIncome) * 100 : null;
    const breakeven = contributionMargin > 0
      ? totalExpenses / (contributionMargin / 100) : null;

    const monthlyTrend = calcMonthly(rows);

    return {
      totalIncome, netIncome, totalCosts, totalExpenses, receivables, payables,
      grossProfit, netResult, grossMargin, opMargin,
      netCashFlow, cashBalance, cashDays, receivableDays,
      dpo, cashCycle, contributionMargin, breakeven,
      monthlyTrend,
    };
  }

  function isIncome(r)   { const t=(r.Tipo_Movimiento||r.Tipo||'').toLowerCase(); return ['ingreso','income','venta','cobro','entrada'].some(k=>t.includes(k)); }
  function isCost(r)     { const t=(r.Tipo_Movimiento||r.Tipo||'').toLowerCase(); return ['costo','cost','cogs','compra'].some(k=>t.includes(k)); }
  function isExpense(r)  { const t=(r.Tipo_Movimiento||r.Tipo||'').toLowerCase(); return ['gasto','expense',(i18n.getLang()==='es'?'overhead':'overhead'),'opex','salario','arriendo','servicio'].some(k=>t.includes(k)); }

  function calcMonthly(rows) {
    const months = {};
    rows.forEach(r => {
      const d = storage.parseDate(r.Fecha);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!months[key]) months[key] = { key, income:0, costs:0, expenses:0, receivables:0, payables:0 };
      months[key].income     += parseFloat(r.Ingresos)||0;
      months[key].costs      += parseFloat(r.Costos)||0;
      months[key].expenses   += parseFloat(r.Gastos_Operacionales)||0;
      months[key].receivables+= parseFloat(r.Cuentas_Por_Cobrar)||0;
      months[key].payables   += parseFloat(r.Cuentas_Por_Pagar)||0;
      if (isIncome(r))  months[key].income   += parseFloat(r.Monto)||0;
      if (isCost(r))    months[key].costs    += parseFloat(r.Monto)||0;
      if (isExpense(r)) months[key].expenses += parseFloat(r.Monto)||0;
    });
    return Object.values(months).sort((a,b)=>a.key.localeCompare(b.key)).slice(-6);
  }

  function emptyFinanceKPIs() {
    return { totalIncome:0,totalCosts:0,totalExpenses:0,receivables:0,payables:0,
      grossProfit:0,netResult:0,grossMargin:null,opMargin:null,
      netCashFlow:0,cashBalance:0,cashDays:null,receivableDays:null,
      dpo:null,cashCycle:null,contributionMargin:null,breakeven:null,monthlyTrend:[] };
  }

  // ── CHARTS ───────────────────────────────────────────────────
  function renderCharts(data, sym) {
    const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const labels = data.monthlyTrend.map(m=>names[parseInt(m.key.split('-')[1])-1]);
    const BASE = { responsive:true,maintainAspectRatio:false,animation:{duration:500},
      plugins:{legend:{labels:{color:'#94a3b8',font:{size:11},boxWidth:10,padding:12}},
        tooltip:{backgroundColor:'#1e293b',borderColor:'#334155',borderWidth:1,titleColor:'#94a3b8',bodyColor:'#f1f5f9',padding:8,cornerRadius:6}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11}},border:{display:false}},
              y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11},callback:v=>sym+(v>=1000000?(v/1000000).toFixed(1)+'M':v>=1000?(v/1000).toFixed(0)+'K':v)},border:{display:false}}}};

    if (activeTab === 'cashflow' && data.monthlyTrend.length) {
      mkChart('cashflowChart',{type:'bar',data:{labels,datasets:[
        {label:i18n.t('finIngresos'),data:data.monthlyTrend.map(m=>m.income),backgroundColor:'rgba(34,197,94,.7)',borderColor:'#22c55e',borderWidth:1.5,borderRadius:5},
        {label:'Costos+Gastos',data:data.monthlyTrend.map(m=>m.costs+m.expenses),backgroundColor:'rgba(239,68,68,.7)',borderColor:'#ef4444',borderWidth:1.5,borderRadius:5},
      ]},options:{...BASE}});
    }

    if (activeTab === 'margins') {
      mkChart('marginCompositionChart',{type:'doughnut',data:{
        labels:[i18n.t('kpiCostoVentas')||'Cost of sales',i18n.t('kpiGastosOp')||'Operating expenses',i18n.t('kpiResultadoNeto')||'Net result'],
        datasets:[{data:[Math.max(data.totalCosts,0),Math.max(data.totalExpenses,0),Math.max(data.netResult,0)],
          backgroundColor:['rgba(234,179,8,.7)','rgba(249,115,22,.7)','rgba(34,197,94,.7)'],
          borderColor:['#eab308','#f97316','#22c55e'],borderWidth:1.5,hoverOffset:5}]},
        options:{...BASE,cutout:'60%',scales:{x:{display:false},y:{display:false}}}});

      if (data.monthlyTrend.length) {
        mkChart('marginTrendChart',{type:'line',data:{labels,datasets:[
          {label:'Margen bruto %',data:data.monthlyTrend.map(m=>{
            const i=m.income; const c=m.costs; return i>0?((i-c)/i*100).toFixed(1):0;}),
            borderColor:'#22c55e',backgroundColor:'rgba(34,197,94,.06)',borderWidth:2,pointRadius:3,tension:.4,fill:true},
          {label:'Margen neto %',data:data.monthlyTrend.map(m=>{
            const i=m.income; const n=i-m.costs-m.expenses; return i>0?(n/i*100).toFixed(1):0;}),
            borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.06)',borderWidth:2,pointRadius:3,tension:.4,fill:true},
        ]},options:{...BASE,scales:{...BASE.scales,y:{...BASE.scales.y,ticks:{...BASE.scales.y.ticks,callback:v=>v+'%'}}}}});
      }
    }

    if (activeTab === 'forecast' && data.monthlyTrend.length) {
      const monthNames=['Ene','Feb','Mar','Abr','May','Jun'];
      const now = new Date();
      const futureLabels = Array.from({length:3},(_,i)=>{
        const d=new Date(now.getFullYear(),now.getMonth()+i+1,1);
        return monthNames[d.getMonth()];
      });
      const avgInc = data.monthlyTrend.reduce((s,m)=>s+m.income,0)/data.monthlyTrend.length;
      const avgCst = data.monthlyTrend.reduce((s,m)=>s+m.costs+m.expenses,0)/data.monthlyTrend.length;
      const allLabels = [...labels, ...futureLabels];
      const incomeData = [...data.monthlyTrend.map(m=>m.income), avgInc, avgInc*1.02, avgInc*1.04];
      const costsData  = [...data.monthlyTrend.map(m=>m.costs+m.expenses), avgCst, avgCst*1.01, avgCst*1.01];
      mkChart('financeForecastChart',{type:'line',data:{labels:allLabels,datasets:[
        {label:i18n.t('finIngresos'),data:incomeData,borderColor:'#22c55e',backgroundColor:'rgba(34,197,94,.08)',borderWidth:2.5,pointRadius:4,tension:.4,fill:true,
          segment:{borderDash:ctx=>ctx.p0DataIndex>=data.monthlyTrend.length-1?[5,3]:undefined}},
        {label:'Costos+Gastos',data:costsData,borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,.06)',borderWidth:2,pointRadius:4,tension:.4,fill:true,
          segment:{borderDash:ctx=>ctx.p0DataIndex>=data.monthlyTrend.length-1?[5,3]:undefined}},
      ]},options:{...BASE}});
    }
  
    if (activeTab === 'dpo' && data.monthlyTrend.length) {
      mkChart('dpoChart',{type:'bar',data:{labels,datasets:[
        {label:i18n.t('finCxCobrar'),data:data.monthlyTrend.map(m=>m.receivables||0),backgroundColor:'rgba(59,130,246,.7)',borderColor:'#3b82f6',borderWidth:1.5,borderRadius:4},
        {label:'Cuentas x pagar', data:data.monthlyTrend.map(m=>m.payables||0),  backgroundColor:'rgba(245,158,11,.7)',borderColor:'#f59e0b',borderWidth:1.5,borderRadius:4},
      ]},options:{...BASE}});
    }

    if (activeTab === 'breakeven' && data.breakeven !== null) {
      // Simular curva de ingresos vs costos totales en escala 0-150% del nivel actual
      const steps = 8;
      const maxScale = 1.5;
      const scalePoints = Array.from({length:steps+1},(_,i)=>i/steps*maxScale);
      const beLabels  = scalePoints.map(s=>fmt(data.totalIncome*s,sym));
      const revenueL  = scalePoints.map(s=>data.totalIncome*s);
      const fixedL    = scalePoints.map(()=>data.totalExpenses);
      const totalCostL= scalePoints.map(s=>data.totalExpenses + data.totalCosts*s);
      mkChart('breakevenChart',{type:'line',data:{labels:beLabels,datasets:[
        {label:i18n.t('finIngresos'),       data:revenueL,   borderColor:'#22c55e',backgroundColor:'rgba(34,197,94,.08)',borderWidth:2.5,pointRadius:3,tension:.4,fill:false},
        {label:'Costos totales', data:totalCostL, borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,.06)',borderWidth:2.5,pointRadius:3,tension:.4,fill:false},
        {label:'Costos fijos',   data:fixedL,     borderColor:'rgba(245,158,11,.6)',backgroundColor:'transparent',borderWidth:1.5,pointRadius:0,borderDash:[5,3],fill:false},
      ]},options:{...BASE,plugins:{...BASE.plugins,
        annotation:{annotations:{bePoint:{type:'line',xMin:data.breakeven/data.totalIncome*steps,xMax:data.breakeven/data.totalIncome*steps,borderColor:'rgba(255,255,255,.3)',borderWidth:1.5,borderDash:[4,4]}}}
      }}});
    }
  }

  function mkChart(id, config) {
    const el = document.getElementById(id);
    if (!el) return;
    if (window._ckCharts && window._ckCharts[id]) window._ckCharts[id].destroy();
    if (!window._ckCharts) window._ckCharts = {};
    window._ckCharts[id] = new Chart(el, config);
  }

  function kpiCard(icon,label,value,status,sub,pct,pctStatus){
      return `<div class="kpi-card ${status}">
        <div class="kpi-card-header"><div class="kpi-card-icon">${icon}</div><div class="kpi-status-dot ${status}"></div></div>
        <div class="kpi-card-value">${value}</div><div class="kpi-card-label">${label}</div>
        ${sub?`<div style="font-size:.72rem;color:var(--color-text-faint);margin-top:3px">${sub}</div>`:''}
        ${pct!==null&&pct!==undefined?`<div class="kpi-card-progress" style="margin-top:8px"><div class="progress-bar-wrap"><div class="progress-bar-fill ${pctStatus||status}" style="width:${Math.min(pct,100)}%"></div></div></div>`:''}
      </div>`;
    }
    function pct(v){return v!==null&&v!==undefined?v.toFixed(1)+'%':'—';}
    function fmt(n,sym='$'){if(!n&&n!==0)return`${sym}—`;if(n>=1000000)return`${sym}${(n/1000000).toFixed(1)}M`;if(n>=1000)return`${sym}${(n/1000).toFixed(0)}K`;if(n<=-1000000)return`-${sym}${(Math.abs(n)/1000000).toFixed(1)}M`;return`${sym}${Math.round(n).toLocaleString()}`;}
    function noData(){return`<div class="no-data-state"><div class="no-data-icon">💵</div><h2 class="no-data-title">${i18n.t('errorNoData')}</h2><p class="no-data-desc">Sube un Excel de finanzas con columnas: Fecha, Tipo_Movimiento, Monto, Concepto — o columnas: Ingresos, Costos, Gastos_Operacionales</p><button class="btn btn-primary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button></div>`;}

    function setTab(tab){
      activeTab=tab;
      if(window._ckCharts){Object.values(window._ckCharts).forEach(c=>c&&c.destroy());window._ckCharts={};}
      render(document.getElementById('contentArea'));
    }

    return { render, setTab };
})();
window.financeModule = financeModule;

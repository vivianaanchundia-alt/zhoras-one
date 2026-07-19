/**
 * ClaroKPIs — sales-module.js  Bloque A
 * Módulo Ventas con:
 * - Selector de período con Flatpickr (calendario visual + rangos)
 * - Modo comparación de períodos (meses/trimestres/años a elegir)
 * - i18n completo en gráficos y filtros
 * - Drill-down real en tarjetas
 */

const salesModule = (() => {
  let activeTab   = 'summary';
  let activeChart = 'line';

  // ════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ════════════════════════════════════════════════════════
  function render(container) {
    const rawRows = storage.getData('sales');
    const rows    = storage.applyFilters(rawRows, 'sales');
    const config  = storage.getConfig();
    const sym     = config.currencySymbol || '$';
    const goals   = storage.getGoals();
    const filters = storage.getFilters('sales');
    const kpisData = kpis.calcSales(rows, goals);
    // Mapear propiedades al formato esperado por este módulo
    const kpisObj = {
      totalSales:      kpisData.totalMonto,
      totalGoal:       kpisData.totalMeta,
      goalAchievement: kpisData.goalAchievement,
      avgTicket:       kpisData.avgTicket,
      conversionRate:  kpisData.conversionRate,
      totalTransacciones: kpisData.totalTransacciones,
      totalUnits:      kpisData.totalUnidades,
      totalLeads:      kpisData.totalLeads,
      avgClosingDays:  kpisData.avgDiasCierre,
      ltvEstimado:     kpisData.ltv,
      crossSelling:    kpisData.crossSellRate,
      monthlyTrend:    kpisData.monthlyTrend,
      sellerRanking:   kpisData.sellerRanking,
      byChannel:       kpisData.byChannel,
      byBranch:        kpisData.byBranch,
      byProduct:       kpisData.byProduct,
      byCategory:      kpisData.byCategory,
      monthForecast:   kpisData.monthForecast,
    };
    const kpisMod = kpisObj;

    container.innerHTML = `
      <div class="module-header">
        <div class="module-title-wrap">
          <h1 class="module-title">💰 ${i18n.t('moduleSales')}</h1>
          <p class="module-subtitle">
            ${rows.length.toLocaleString()} ${i18n.t('records')}${(() => {
              const _dr = storage.getDataDateRange('sales');
              return _dr ? ' · ' + (i18n.getLang()==='es' ? 'Datos: ' : 'Data: ') + _dr.label : '';
            })()}
            <span class="currency-badge">💱 ${sym} ${config.currencyLabel||config.currency||'CLP'}</span>
          </p>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="showModal('uploadModal')">
          📂 ${i18n.t('uploadData')}
        </button>
      </div>

      ${renderFiltersBar(rawRows)}

      ${renderComparisonBar(filters)}

      <div class="tabs" id="salesTabs">
        <div class="tab-item ${activeTab==='summary'   ?'active':''}" onclick="salesModule.setTab('summary')">${i18n.t('tabSummary')}</div>
        <div class="tab-item ${activeTab==='sellers'   ?'active':''}" onclick="salesModule.setTab('sellers')">🏆 ${i18n.t('tabSellers')}</div>
        <div class="tab-item ${activeTab==='products'  ?'active':''}" onclick="salesModule.setTab('products')">📦 ${i18n.t('tabProducts')}</div>
        <div class="tab-item ${activeTab==='projection'?'active':''}" onclick="salesModule.setTab('projection')">📈 ${i18n.t('tabProjection')}</div>
      </div>

      ${!rawRows.length ? renderNoData() : (rows.length === 0 ? renderEmptyPeriod(filters) : renderTab(kpisMod, goals, sym, rows, rawRows))}
    `;

    // Drill-down de vendedor por listener delegado, no onclick inline con
    // dato interpolado (el nombre viene del Excel — ver fila con
    // class="row-seller" en renderSellers). Se registra UNA vez por
    // contenedor: innerHTML reemplaza los hijos en cada render, pero no
    // este listener adjunto al propio container.
    if (!container._salesClickBound) {
      container._salesClickBound = true;
      container.addEventListener('click', (e) => {
        const fila = e.target.closest('.row-seller');
        if (fila) drillDownSeller(fila.dataset.seller);
      });
    }

    if (rawRows.length) {
      setTimeout(() => {
        initPeriodPicker();
        initComparisonPicker();
        renderCharts(kpis, sym, rows, rawRows);
      }, 50);
    }
  }

  // ════════════════════════════════════════════════════════
  // BARRA DE FILTROS con calendario Flatpickr
  // ════════════════════════════════════════════════════════
  function renderFiltersBar(rawRows) {
    const filters  = storage.getFilters('sales');
    const branches = storage.getUniqueValues('sales','Sucursal');
    const channels = storage.getUniqueValues('sales','Canal_Venta');
    const sellers  = storage.getUniqueValues('sales','Vendedor');
    const products = storage.getUniqueValues('sales','Categoría');

    // Helper: etiqueta dinámica para año parcial
    const _now2         = new Date();
    const _curMonth2    = _now2.getMonth();
    const _isPartialYr2 = _curMonth2 < 11;
    const _mNames2      = i18n.getLang() === 'es'
      ? ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
      : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const _yrLabel2 = _isPartialYr2
      ? (i18n.getLang()==='es' ? `Este año (Ene–${_mNames2[_curMonth2]})` : `This year (Jan–${_mNames2[_curMonth2]})`)
      : (i18n.t('periodYear') || 'Este año');

    const periods = [
      { v:'all',       label: i18n.t('periodAll') },
      { v:'today',     label: i18n.t('periodToday') },
      { v:'week',      label: i18n.t('periodWeek') },
      { v:'last7',     label: i18n.t('periodLast7') },
      { v:'last30',    label: i18n.t('periodLast30') },
      { v:'last90',    label: i18n.t('periodLast90') },
      { v:'month',     label: i18n.t('periodMonth') },
      { v:'prevmonth', label: i18n.t('periodPrevMonth') },
      { v:'quarter',   label: i18n.t('periodQuarter') },
      { v:'year',      label: _yrLabel2 },
      { v:'lastyear',  label: i18n.t('periodLastYear') },
      { v:'custom',    label: '📅 ' + i18n.t('periodCustom') },
    ];

    const isCustom = filters.period === 'custom';

    return `
      <div class="filters-bar" id="salesFiltersBar">

        <!-- PERÍODO con calendario visual -->
        <div class="filter-group">
          <span class="filter-label">📅 ${i18n.t('filterPeriod')}</span>
          <div class="period-picker-wrap" style="position:relative;display:inline-flex;align-items:center;gap:4px;">
            <select class="filter-select" id="periodSelect"
              onchange="salesModule.setFilter('period', this.value)">
              ${periods.map(p=>`<option value="${p.v}" ${filters.period===p.v?'selected':''}>${p.label}</option>`).join('')}
            </select>
            <!-- Botón calendario para rango personalizado siempre visible -->
            <button class="btn btn-ghost btn-sm" id="calendarBtn" title="${i18n.t('periodCustom')}"
              onclick="salesModule.openCalendar()"
              style="padding:4px 7px;border-radius:6px;font-size:1rem;line-height:1;">
              🗓️
            </button>
          </div>
        </div>

        <!-- Rango fechas — visible cuando period=custom -->
        <div class="filter-group" id="customDateRange"
          style="display:${isCustom?'flex':'none'};gap:4px;align-items:center;">
          <input type="text" id="dateFromInput" class="filter-select"
            placeholder="${i18n.t('dateFrom')}"
            value="${filters.dateFrom ? filters.dateFrom.split('T')[0] : ''}"
            style="width:110px;cursor:pointer;"
            onclick="salesModule.openCalendar()" readonly />
          <span style="color:var(--color-text-faint);font-size:.85rem;">→</span>
          <input type="text" id="dateToInput" class="filter-select"
            placeholder="${i18n.t('dateTo')}"
            value="${filters.dateTo ? filters.dateTo.split('T')[0] : ''}"
            style="width:110px;cursor:pointer;"
            onclick="salesModule.openCalendar()" readonly />
        </div>

        <span class="filter-sep"></span>

        <!-- SUCURSAL -->
        <div class="filter-group">
          <span class="filter-label">🏪 ${i18n.t('filterGeo')}</span>
          <select class="filter-select" onchange="salesModule.setFilter('geo', this.value)">
            <option value="all">${i18n.t('geoAll')}</option>
            ${branches.map(b=>`<option value="${sanitizeAttr(b)}" ${filters.geo===b?'selected':''}>${sanitize(b)}</option>`).join('')}
          </select>
        </div>

        <!-- CANAL -->
        <div class="filter-group">
          <span class="filter-label">📡 ${i18n.t('filterChannel')}</span>
          <select class="filter-select" onchange="salesModule.setFilter('channel', this.value)">
            <option value="all">${i18n.t('channelAll')}</option>
            <option value="presential" ${filters.channel==='presential'?'selected':''}>${i18n.t('channelPresential')}</option>
            <option value="virtual"    ${filters.channel==='virtual'   ?'selected':''}>${i18n.t('channelVirtual')}</option>
            ${channels.filter(c=>!['presencial','virtual','online','teléfono','telefono'].includes(c.toLowerCase()))
              .map(c=>`<option value="${sanitizeAttr(c)}" ${filters.channel===c?'selected':''}>${sanitize(c)}</option>`).join('')}
          </select>
        </div>

        <!-- VENDEDOR -->
        <div class="filter-group hide-mobile">
          <span class="filter-label">👤 ${i18n.t('filterSeller')}</span>
          <select class="filter-select" onchange="salesModule.setFilter('seller', this.value)">
            <option value="all">${i18n.t('sellerAll')}</option>
            ${sellers.map(s=>`<option value="${sanitizeAttr(s)}" ${filters.seller===s?'selected':''}>${sanitize(s)}</option>`).join('')}
          </select>
        </div>

        <!-- CATEGORÍA -->
        <div class="filter-group hide-mobile">
          <span class="filter-label">🏷️ ${i18n.t('filterProduct')}</span>
          <select class="filter-select" onchange="salesModule.setFilter('categoria', this.value)">
            <option value="all">${i18n.t('productAll')}</option>
            ${products.map(p=>`<option value="${sanitizeAttr(p)}" ${filters.categoria===p?'selected':''}>${sanitize(p)}</option>`).join('')}
          </select>
        </div>

        <button class="filters-reset" onclick="salesModule.resetFilters()">
          ${i18n.t('resetFilters')}
        </button>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════
  // BARRA DE COMPARACIÓN DE PERÍODOS
  // ════════════════════════════════════════════════════════
  function renderComparisonBar(filters) {
    const mode = filters.compareMode || 'none';
    const selected = filters.compareWith || [];

    return `
      <div class="comparison-bar" id="comparisonBar"
        style="background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">

        <span style="font-size:.82rem;font-weight:600;color:var(--color-text-muted);">
          🔀 ${i18n.t('compareWith')}:
        </span>

        <!-- Tipo de comparación -->
        <div style="display:flex;gap:6px;">
          ${[
            {v:'none',     label: i18n.t('compareNone')},
            {v:'prev',     label: i18n.t('comparePrev')},
            {v:'lastyear', label: i18n.t('compareLastYear')},
            {v:'months',   label: i18n.t('compareMonths')},
            {v:'quarters', label: i18n.t('compareQuarters')},
            {v:'years',    label: i18n.t('compareYears')},
          ].map(opt=>`
            <button class="btn btn-xs ${mode===opt.v?'btn-primary':'btn-ghost'}"
              onclick="salesModule.setCompareMode('${opt.v}')"
              style="padding:3px 10px;font-size:.75rem;border-radius:5px;">
              ${opt.label}
            </button>`).join('')}
        </div>

        <!-- Selector de períodos múltiples (meses/trimestres/años) -->
        ${(mode==='months'||mode==='quarters'||mode==='years') ? `
          <div id="multiPeriodSelector" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <select class="filter-select" id="comparePeriodAdd"
              style="font-size:.78rem;padding:3px 8px;"
              onchange="salesModule.addComparePeriod(this.value);this.value=''">
              <option value="">+ ${i18n.t('compareAddPeriod')}</option>
              ${getComparePeriodOptions(mode)}
            </select>
            ${selected.map(p=>`
              <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--color-blue-bg);border:1px solid var(--color-blue-border);border-radius:5px;font-size:.75rem;color:var(--color-blue);">
                ${p}
                <button onclick="salesModule.removeComparePeriod('${p}')"
                  style="background:none;border:none;cursor:pointer;color:var(--color-blue);font-size:.9rem;padding:0;line-height:1;">×</button>
              </span>`).join('')}
            ${selected.length > 0 ? `
              <button class="btn btn-ghost btn-xs" onclick="salesModule.clearComparePeriods()"
                style="font-size:.75rem;padding:2px 8px;color:var(--color-red);">
                ${i18n.t('comparisonClear')}
              </button>` : ''}
          </div>` : ''}
      </div>
    `;
  }

  /** Genera opciones para el selector de períodos a comparar */
  function getComparePeriodOptions(mode) {
    const now    = new Date();
    const months = Array.from({length:12},(_,i)=>new Date(now.getFullYear(),now.getMonth()-11+i,1));
    const names  = [i18n.t('monthJan'),i18n.t('monthFeb'),i18n.t('monthMar'),i18n.t('monthApr'),
                    i18n.t('monthMay'),i18n.t('monthJun'),i18n.t('monthJul'),i18n.t('monthAug'),
                    i18n.t('monthSep'),i18n.t('monthOct'),i18n.t('monthNov'),i18n.t('monthDec')];

    if (mode === 'months') {
      return months.map(d=>
        `<option value="${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}">
          ${names[d.getMonth()]} ${d.getFullYear()}
        </option>`).join('');
    }
    if (mode === 'quarters') {
      const qs = [];
      for (let y = now.getFullYear()-1; y <= now.getFullYear(); y++) {
        for (let q = 1; q <= 4; q++) {
          const label = `Q${q} ${y}`;
          const val   = `Q${q}-${y}`;
          if (new Date(y, q*3-1, 1) <= now) qs.push(`<option value="${val}">${label}</option>`);
        }
      }
      return qs.join('');
    }
    if (mode === 'years') {
      return Array.from({length:5},(_,i)=>{
        const y=now.getFullYear()-4+i;
        return `<option value="${y}">${y}</option>`;
      }).join('');
    }
    return '';
  }

  // ════════════════════════════════════════════════════════
  // TABS
  // ════════════════════════════════════════════════════════
  function renderTab(kpisArg, goals, sym, rows, rawRows) {
    const filters = storage.getFilters('sales');
    if (activeTab === 'summary')    return renderSummary(kpisArg, goals, sym, rows, rawRows, filters);
    if (activeTab === 'sellers')    return renderSellers(rows, sym, goals);
    if (activeTab === 'products')   return renderProducts(rows, sym);
    if (activeTab === 'projection') return renderProjection(rows, sym, goals);
    return '';
  }

  // ── RESUMEN ──────────────────────────────────────────────
  function renderSummary(kpis, goals, sym, rows, rawRows, filters) {
    const goalSt = storage.getStatus(kpis.goalAchievement, 100);
    const tickSt = storage.getStatus(kpis.avgTicket, goals.avg_ticket);
    const convSt = storage.getStatus(kpis.conversionRate, goals.conversion_rate);

    // ── HERO KPI: Total Ventas ──────────────────────────────
    // Calcular delta vs período anterior
    let heroDelta = null, heroDeltaDir = null;
    try {
      const prevRange = storage.getPreviousPeriodRange(filters);
      if (prevRange) {
        const prevRows = storage.applyFilters(storage.getData('sales'), prevRange);
        const prevTotal = prevRows.reduce((s, r) => s + (r.Ventas_Monto || 0), 0);
        if (prevTotal > 0) {
          const pct = ((kpis.totalSales - prevTotal) / prevTotal) * 100;
          heroDelta = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
          heroDeltaDir = pct > 1 ? 'up' : pct < -1 ? 'down' : 'flat';
        }
      }
    } catch(e) { /* sin delta */ }

    const heroSub = goals.sales_monthly
      ? `Meta: ${fmt(goals.sales_monthly, sym)} · ${(kpis.goalAchievement || 0).toFixed(1)}% logrado`
      : `${(kpis.totalTransacciones || 0).toLocaleString()} ${i18n.t('records')}`;

    return `
      <!-- Hero KPI -->
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(185px,1fr));margin-bottom:20px;">
        ${kpiHero({
          value:    fmt(kpis.totalSales, sym),
          label:    i18n.t('kpiTotalSales'),
          status:   goalSt,
          delta:    heroDelta,
          deltaDir: heroDeltaDir,
          sub:      heroSub,
          pct:      kpis.goalAchievement || null,
          onclick:  `salesModule.drillDown('true')`,
        })}
        ${kpiCard('🎯', i18n.t('kpiGoalAchiev'),   `${(kpis.goalAchievement||0).toFixed(1)}%`, goalSt,
          `${i18n.t('chartGoal')}: ${fmt(kpis.totalGoal,sym)}`,
          kpis.goalAchievement, goalSt, 'goal')}
        ${kpiCard('🛒', i18n.t('kpiAvgTicket'),    fmt(kpis.avgTicket,sym), tickSt,
          `${kpis.totalTransacciones||0} ${i18n.t('records')}`,
          null, null, 'tickets')}
        ${kpiCard('📈', i18n.t('kpiConversion'),   `${(kpis.conversionRate||0).toFixed(1)}%`, convSt,
          `${kpis.totalLeads||0} ${i18n.t('kpiLeads')}`,
          kpis.conversionRate, convSt, 'conversion')}
        ${kpiCard('📦', i18n.t('kpiUnitsSold'),    (kpis.totalUnits||0).toLocaleString(), 'blue',
          i18n.t('kpiUnitsSold'), null, null, null)}
        ${kpiCard('⚡', i18n.getLang()==='es'?'Velocidad cierre':'Closing Speed', kpis.avgClosingDays ? kpis.avgClosingDays.toFixed(1)+(i18n.getLang()==='es'?' días':' days') : '—', 'blue',
          i18n.getLang()==='es'?'promedio cierre':'avg. closing', null, null, null)}
        ${kpiCard('💎', i18n.getLang()==='es'?'LTV Estimado':'Estimated LTV', fmt(kpis.ltvEstimado, sym), 'green',
          i18n.getLang()==='es'?'por cliente':'per client', null, null, null)}
        ${kpiCard('🔀', i18n.getLang()==='es'?'Cross-Selling':'Cross-Selling', kpis.crossSelling ? kpis.crossSelling.toFixed(1)+'%' : '—', 'blue',
          i18n.getLang()==='es'?'venta cruzada':'cross-selling', null, null, null)}
      </div>

      <!-- Sugerencias si hay KPIs en rojo -->
      ${renderSuggestions(kpis, goals)}

      <!-- Gráfico principal -->
      <div class="chart-card" style="margin-bottom:16px;">
        <div class="chart-card-header">
          <div class="chart-card-title">📊 ${i18n.t('kpiTotalSales')} — ${i18n.t('chartHistoric')}</div>
          <div style="display:flex;gap:6px;">
            ${['line','bar','area'].map(t=>`
              <button class="btn btn-xs ${activeChart===t?'btn-primary':'btn-ghost'}"
                onclick="salesModule.setChart('${t}')"
                style="padding:3px 9px;font-size:.75rem;">
                ${t==='line'?'📈':t==='bar'?'📊':'🌊'}
              </button>`).join('')}
            <button class="btn btn-xs btn-ghost" onclick="salesModule.setChart('branch')"
              style="padding:3px 9px;font-size:.75rem;">
              ${i18n.t('filterGeo')}
            </button>
            <button class="btn btn-xs btn-ghost" onclick="salesModule.setChart('channel')"
              style="padding:3px 9px;font-size:.75rem;">
              ${i18n.t('filterChannel')}
            </button>
          </div>
        </div>
        <div class="chart-container" style="height:260px;"><canvas id="salesMainChart"></canvas></div>
      </div>

      <!-- Comparación de períodos si está activa -->
      ${renderComparisonPanel(rows, sym)}
    `;
  }

  /** Panel de sugerencias cuando hay KPIs en rojo */
  function renderSuggestions(kpis, goals) {
    const suggestions = [];
    if (kpis.goalAchievement && kpis.goalAchievement < 80) {
      suggestions.push({
        icon:'📉', title: i18n.getLang()==='es' ? 'Ventas bajo el 80% de meta' : 'Sales below 80% of goal',
        items: i18n.getLang()==='es' ? [
          i18n.t('salesAccionFunnel'),
          i18n.t('salesAccionCoaching'),
          i18n.t('salesAccionReactivacion'),
        ] : [
          'Review the lead funnel — are there conversion bottlenecks?',
          'Identify underperforming sellers and provide targeted coaching',
          'Consider a reactivation campaign for inactive clients',
        ]
      });
    }
    if (kpis.conversionRate && kpis.conversionRate < goals.conversion_rate) {
      suggestions.push({
        icon:'🎯', title: i18n.getLang()==='es' ? i18n.t('salesConversionBaja') : 'Conversion below goal',
        items: i18n.getLang()==='es' ? [
          'Analizar qué etapa del proceso de venta pierde más leads',
          'Mejorar el seguimiento post-contacto (leads sin respuesta)',
          'Revisar la propuesta de valor frente a la competencia',
        ] : [
          'Analyze which sales stage loses the most leads',
          'Improve post-contact follow-up (unanswered leads)',
          'Review value proposition against competition',
        ]
      });
    }
    if (!suggestions.length) return '';

    return `
      <div class="card" style="background:var(--color-blue-bg);border-color:var(--color-blue-border);margin-bottom:16px;">
        <details>
          <summary style="cursor:pointer;font-size:.88rem;font-weight:700;color:var(--color-blue);list-style:none;display:flex;align-items:center;gap:8px;">
            <span>💡</span>
            <span>${i18n.t('homeSuggestions')} (${suggestions.length})</span>
            <span style="margin-left:auto;font-size:.75rem;color:var(--color-text-faint);">▼ ${i18n.getLang()==='es'?'ver recomendaciones':'see recommendations'}</span>
          </summary>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:12px;">
            ${suggestions.map(s=>`
              <div>
                <div style="font-size:.83rem;font-weight:700;color:var(--color-text);margin-bottom:6px;">${s.icon} ${s.title}</div>
                ${s.items.map(item=>`<div style="font-size:.78rem;color:var(--color-text-muted);padding:3px 0 3px 16px;border-left:2px solid var(--color-blue-border);">• ${item}</div>`).join('')}
              </div>`).join('')}
          </div>
        </details>
      </div>
    `;
  }

  /** Panel de comparación de períodos activos */
  function renderComparisonPanel(rows, sym) {
    const filters = storage.getFilters('sales');
    const mode    = filters.compareMode || 'none';
    const periods = filters.compareWith || [];
    if (mode === 'none' || !periods.length) return '';

    // Calcular métricas para cada período comparado
    const comparisons = periods.map(p => {
      const pRows = filterByPeriodLabel(rows, p, mode);
      const pSales = pRows.reduce((s,r)=>s+(parseFloat(r.Ventas_Monto)||0),0);
      const pGoal  = pRows.reduce((s,r)=>s+(parseFloat(r.Meta_Ventas)||0),0);
      const pGoalPct = pGoal>0?(pSales/pGoal*100):null;
      return { label:p, sales:pSales, goal:pGoal, goalPct:pGoalPct, rows:pRows.length };
    });

    const mainSales = rows.reduce((s,r)=>s+(parseFloat(r.Ventas_Monto)||0),0);

    return `
      <div class="chart-card" style="margin-bottom:16px;">
        <div class="chart-card-header">
          <div class="chart-card-title">🔀 ${i18n.t('comparisonTitle')}</div>
          <span class="badge badge-blue">${periods.length} ${i18n.getLang()==='es'?'períodos':'periods'}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;padding:8px 0;">
          <!-- Período actual -->
          <div style="text-align:center;padding:12px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);border-radius:8px;">
            <div style="font-size:.7rem;font-weight:700;color:var(--color-blue);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">
              ${i18n.t('chartActual')}
            </div>
            <div style="font-size:1.2rem;font-weight:800;font-family:var(--font-mono);color:var(--color-text);">${fmt(mainSales,sym)}</div>
          </div>
          <!-- Períodos comparados -->
          ${comparisons.map(c=>{
            const diff = mainSales > 0 ? ((mainSales-c.sales)/c.sales*100) : null;
            const diffColor = diff===null?'var(--color-text-faint)':diff>0?'var(--color-green)':'var(--color-red)';
            const diffIcon  = diff===null?'':diff>0?'▲':'▼';
            return `
              <div style="text-align:center;padding:12px;background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:8px;">
                <div style="font-size:.7rem;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">${c.label}</div>
                <div style="font-size:1.2rem;font-weight:800;font-family:var(--font-mono);color:var(--color-text);">${fmt(c.sales,sym)}</div>
                ${diff!==null?`<div style="font-size:.78rem;color:${diffColor};margin-top:4px;font-weight:600;">${diffIcon} ${Math.abs(diff).toFixed(1)}% ${diff>0?i18n.t('comparisonBetter'):i18n.t('comparisonWorse')}</div>`:''}
                <div style="font-size:.7rem;color:var(--color-text-faint);margin-top:2px;">${c.rows} ${i18n.t('records')}</div>
              </div>`;
          }).join('')}
        </div>
        <div class="chart-container" style="height:220px;margin-top:8px;"><canvas id="comparisonChart"></canvas></div>
      </div>
    `;
  }

  /** Filtra filas por label de período (ej: "2026-03", "Q1-2026", "2025") */
  function filterByPeriodLabel(rows, label, mode) {
    return rows.filter(r => {
      const d = storage.parseDate(r.Fecha);
      if (!d) return false;
      if (mode === 'months') {
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        return key === label;
      }
      if (mode === 'quarters') {
        const [qPart, year] = label.split('-');
        const q = parseInt(qPart.replace('Q',''));
        const startMonth = (q-1)*3;
        return d.getFullYear()===parseInt(year) && d.getMonth()>=startMonth && d.getMonth()<startMonth+3;
      }
      if (mode === 'years') {
        return d.getFullYear() === parseInt(label);
      }
      return false;
    });
  }

  // ── VENDEDORES ───────────────────────────────────────────
  function renderSellers(rows, sym, goals) {
    if (!rows.length) return `<div class="empty-state"><div class="empty-state-title">${i18n.t('errorNoData')}</div></div>`;

    const sellerMap = {};
    rows.forEach(r => {
      const n = r.Vendedor || 'Sin asignar';
      if (!sellerMap[n]) sellerMap[n] = { name:n, sales:0, goal:0, units:0, leads:0, tx:0 };
      sellerMap[n].sales += parseFloat(r.Ventas_Monto)||0;
      sellerMap[n].goal  += parseFloat(r.Meta_Ventas)||0;
      sellerMap[n].units += parseFloat(r.Ventas_Unidades)||0;
      sellerMap[n].leads += parseFloat(r.Leads)||0;
      sellerMap[n].tx    += 1;
    });
    const sellers = Object.values(sellerMap)
      .map(s=>({...s, pct: s.goal>0?(s.sales/s.goal*100):null}))
      .sort((a,b)=>b.sales-a.sales);

    return `
      <div class="chart-card" style="margin-bottom:16px;">
        <div class="chart-card-header"><div class="chart-card-title">🏆 ${i18n.t('tabSellers')}</div></div>
        <div class="chart-container" style="height:${Math.min(sellers.length*42+60,360)}px;">
          <canvas id="sellerChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-card-header"><div class="chart-card-title">📋 ${i18n.t('tabSellers')} — ${i18n.t('records')}</div></div>
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>${i18n.t('filterSeller')}</th>
                <th class="number">${i18n.t('kpiTotalSales')}</th>
                <th class="number">${i18n.t('kpiGoalAchiev')}</th>
                <th class="number">${i18n.t('kpiAvgTicket')}</th>
                <th class="number">${i18n.t('kpiLeads')}</th>
              </tr>
            </thead>
            <tbody>
              ${sellers.map(s=>{
                const st = s.pct!==null?(s.pct>=100?'green':s.pct>=80?'yellow':'red'):'blue';
                return `<tr class="row-seller" data-seller="${sanitizeAttr(s.name)}" style="cursor:pointer;">
                  <td style="font-weight:600;color:var(--color-text)">${sanitize(s.name)}</td>
                  <td class="number">${fmt(s.sales,sym)}</td>
                  <td class="number"><span class="badge badge-${st}">${s.pct!==null?s.pct.toFixed(1)+'%':'—'}</span></td>
                  <td class="number">${s.tx>0?fmt(s.sales/s.tx,sym):'—'}</td>
                  <td class="number">${s.leads}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── PRODUCTOS ────────────────────────────────────────────
  function renderProducts(rows, sym) {
    if (!rows.length) return `<div class="empty-state"><div class="empty-state-title">${i18n.t('errorNoData')}</div></div>`;

    const prodMap = {};
    rows.forEach(r => {
      const n = r.Producto || r.Categoría || i18n.t('sinCategoria')||'—';
      if (!prodMap[n]) prodMap[n] = { name:n, cat:r.Categoría||'—', sales:0, units:0 };
      prodMap[n].sales += parseFloat(r.Ventas_Monto)||0;
      prodMap[n].units += parseFloat(r.Ventas_Unidades)||0;
    });
    const prods = Object.values(prodMap).sort((a,b)=>b.sales-a.sales).slice(0,12);
    const total  = prods.reduce((s,p)=>s+p.sales,0);

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;" class="charts-row">
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">${'📦 '+(i18n.getLang()==='es'?'Top productos — ventas':'Top products — sales')}</div></div>
          <div class="chart-container" style="height:280px;"><canvas id="prodSalesChart"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">📊 ${i18n.t('filterProduct')}</div></div>
          <div class="chart-container" style="height:280px;"><canvas id="prodCatChart"></canvas></div>
        </div>
      </div>
      <div class="chart-card" style="margin-top:16px;">
        <div class="chart-card-header"><div class="chart-card-title">📋 ${i18n.t('tabProducts')} — ${i18n.getLang()==='es'?'detalle':'detail'}</div></div>
        <div class="table-wrapper">
          <table class="table">
            <thead><tr><th>${i18n.t('tabProducts')}</th><th>${i18n.t('filterProduct')}</th><th class="number">${i18n.t('kpiTotalSales')}</th><th class="number">%</th><th class="number">${i18n.t('kpiUnitsSold')}</th></tr></thead>
            <tbody>
              ${prods.map(p=>{
                const pct = total>0?(p.sales/total*100).toFixed(1)+'%':'—';
                return `<tr><td style="font-weight:600">${sanitize(p.name)}</td><td><span class="chip">${sanitize(p.cat)}</span></td><td class="number">${fmt(p.sales,sym)}</td><td class="number" style="color:var(--color-text-faint)">${pct}</td><td class="number">${p.units.toLocaleString()}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── PROYECCIÓN ────────────────────────────────────────────
  function renderProjection(rows, sym, goals) {
    const config = storage.getConfig();
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const dayOfMonth  = now.getDate();

    // Usar días laborables configurados o días naturales
    const workingDays = config.workingDaysThisMonth || daysInMonth;
    const workingDaysElapsed = config.workingDaysElapsed || dayOfMonth;

    // Tendencia histórica (últimos 6 meses) — calcular primero para usar como fallback
    const monthMap = {};
    rows.forEach(r => {
      const d = storage.parseDate(r.Fecha); if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      monthMap[key] = (monthMap[key]||0) + (parseFloat(r.Ventas_Monto)||0);
    });
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const trend = Object.entries(monthMap)
      .filter(([k]) => k !== curMonthKey)  // excluir mes actual para el promedio
      .sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
    const avgMonthly = trend.length ? trend.reduce((s,[,v])=>s+v,0)/trend.length : 0;

    const monthRows = rows.filter(r => {
      const d = storage.parseDate(r.Fecha);
      return d && d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
    });
    const salesSoFar = monthRows.reduce((s,r)=>s+(parseFloat(r.Ventas_Monto)||0),0);
    // Si no hay datos del mes actual, usar promedio histórico como proyección base
    const noCurrentData = salesSoFar === 0 && monthRows.length === 0;
    const projected = noCurrentData
      ? avgMonthly
      : (workingDaysElapsed > 0 ? (salesSoFar/workingDaysElapsed)*workingDays : 0);
    const goalMonthly = goals.sales_monthly || 0;
    const goalPct    = goalMonthly > 0 ? (projected/goalMonthly*100) : null;
    const projStatus = goalPct!==null?(goalPct>=100?'green':goalPct>=80?'yellow':'red'):'blue';
    const growth = trend.length>=2 ? (trend[trend.length-1][1]-trend[0][1])/trend[0][1]/trend.length : 0;

    return `
      <!-- Configuración días laborables -->
      <div class="card" style="background:var(--color-blue-bg);border-color:var(--color-blue-border);margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
          <div style="font-size:.85rem;font-weight:700;color:var(--color-blue)">⚙️ ${i18n.t('workingDays')}</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:.78rem;color:var(--color-text-muted)">${i18n.getLang()==='es'?'Días totales del mes':'Total days this month'}:</label>
            <input type="number" min="1" max="31" value="${workingDays}"
              style="width:60px;padding:4px 8px;border-radius:6px;border:1px solid var(--color-border);background:var(--color-bg-card);color:var(--color-text);font-size:.82rem;text-align:center;"
              onchange="salesModule.setWorkingDays(this.value,'total')" />
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:.78rem;color:var(--color-text-muted)">${i18n.getLang()==='es'?'Días transcurridos':'Days elapsed'}:</label>
            <input type="number" min="1" max="31" value="${workingDaysElapsed}"
              style="width:60px;padding:4px 8px;border-radius:6px;border:1px solid var(--color-border);background:var(--color-bg-card);color:var(--color-text);font-size:.82rem;text-align:center;"
              onchange="salesModule.setWorkingDays(this.value,'elapsed')" />
          </div>
          <div style="font-size:.72rem;color:var(--color-text-faint);max-width:280px;">${i18n.t('workingDaysHelp')}</div>
        </div>
      </div>

      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:20px;">
        ${kpiCard('💰', i18n.getLang()==='es'?'Ventas a hoy':'Sales to date', fmt(salesSoFar,sym), 'blue', `${workingDaysElapsed} ${i18n.getLang()==='es'?'días laborables transcurridos':'working days elapsed'}`, null, null, null)}
        ${kpiCard('📈', i18n.t('projectedSales'), fmt(projected,sym), projStatus, `${i18n.t('chartGoal')}: ${fmt(goalMonthly,sym)}`, goalPct, projStatus, null)}
        ${kpiCard('🎯', i18n.getLang()==='es'?'% de meta proyectado':'% of goal projected', goalPct!==null?goalPct.toFixed(1)+'%':'—', projStatus, `Meta: ${fmt(goalMonthly,sym)}`, goalPct, projStatus, null)}
        ${kpiCard('📅', i18n.getLang()==='es'?'Días restantes':'Days remaining', (workingDays-workingDaysElapsed).toString(), 'blue', i18n.getLang()==='es'?'para cerrar el mes':'to close the month', null, null, null)}
      </div>

      ${noCurrentData ? `<div class="card" style="background:var(--color-blue-bg);border-color:var(--color-blue-border);margin-bottom:16px;font-size:.8rem;color:var(--color-blue);">
        ℹ️ ${i18n.getLang()==='es'?'Sin transacciones registradas este mes — proyección basada en promedio histórico.':'No transactions recorded this month — projection based on historical average.'}
      </div>` : ''}
      <div class="chart-card">
        <div class="chart-card-header"><div class="chart-card-title">📈 ${i18n.t('chartProjection')} — ${i18n.getLang()==='es'?'histórico + proyección':'historical + projection'}</div></div>
        <div class="chart-container" style="height:260px;"><canvas id="projChart"></canvas></div>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════
  // GRÁFICOS — labels con i18n completo
  // ════════════════════════════════════════════════════════
  function renderCharts(kpis, sym, rows, rawRows) {
    const PALETTE = ['#3b82f6','#6366f1','#22c55e','#eab308','#ef4444','#a855f7','#f97316','#14b8a6'];
    const BASE = {
      responsive:true, maintainAspectRatio:false, animation:{duration:500},
      plugins:{
        legend:{labels:{color:'#94a3b8',font:{size:11},boxWidth:10,padding:12}},
        tooltip:{backgroundColor:'#1e293b',borderColor:'#334155',borderWidth:1,
          titleColor:'#94a3b8',bodyColor:'#f1f5f9',padding:8,cornerRadius:6}
      },
      scales:{
        x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11}},border:{display:false}},
        y:{grid:{color:'rgba(255,255,255,.04)'},border:{display:false},
          ticks:{color:'#64748b',font:{size:11},
            callback: v => sym+(v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':v)}}
      }
    };

    if (activeTab === 'summary') {
      // Tendencia mensual
      const monthMap = {}, goalMap = {};
      const _goalSeen = new Set();
      rows.forEach(r=>{
        const d=storage.parseDate(r.Fecha); if(!d) return;
        const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        monthMap[k]=(monthMap[k]||0)+(parseFloat(r.Ventas_Monto)||0);
        // Dedup meta por vendedor+mes para evitar inflar la meta
        const gk=`${k}_${r.Vendedor||''}`;
        if(!_goalSeen.has(gk)){ _goalSeen.add(gk); goalMap[k]=(goalMap[k]||0)+(parseFloat(r.Meta_Ventas)||0); }
      });
      const sorted = Object.entries(monthMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-8);
      const labels = sorted.map(([k])=>{
        const [y,m]=k.split('-'); return `${i18n.monthName(parseInt(m)-1)} ${y}`;
      });
      const salesData = sorted.map(([,v])=>v);
      const goalData  = sorted.map(([k])=>goalMap[k]||0);

      mkChart('salesMainChart',{type: activeChart==='bar'?'bar':'line',data:{labels,datasets:[
        {label:i18n.t('chartSales'),data:salesData,borderColor:'#3b82f6',backgroundColor:activeChart==='bar'?'rgba(59,130,246,.7)':'rgba(59,130,246,.08)',borderWidth:2.5,pointRadius:4,tension:.4,fill:activeChart==='area',borderRadius:activeChart==='bar'?5:0},
        {label:i18n.t('chartGoal'),data:goalData,borderColor:'rgba(234,179,8,.6)',backgroundColor:'rgba(234,179,8,.04)',borderWidth:1.5,borderDash:[5,3],pointRadius:3,tension:.4,fill:false},
      ]},options:{...BASE}});

      // Comparación (si aplica)
      const filters = storage.getFilters('sales');
      if ((filters.compareMode||'none')!=='none' && (filters.compareWith||[]).length>0) {
        const mode = filters.compareMode;
        const periods = filters.compareWith;
        const mainSales = rows.reduce((s,r)=>s+(parseFloat(r.Ventas_Monto)||0),0);
        const allLabels = [i18n.t('chartActual'), ...periods];
        const allData   = [mainSales, ...periods.map(p=>filterByPeriodLabel(rows,p,mode).reduce((s,r)=>s+(parseFloat(r.Ventas_Monto)||0),0))];
        mkChart('comparisonChart',{type:'bar',data:{labels:allLabels,datasets:[
          {label:i18n.t('kpiTotalSales'),data:allData,backgroundColor:PALETTE.map(c=>c+'cc'),borderColor:PALETTE,borderWidth:1.5,borderRadius:6}
        ]},options:{...BASE,plugins:{...BASE.plugins,legend:{display:false}}}});
      }
    }

    if (activeTab === 'sellers') {
      const sellerMap = {};
      rows.forEach(r=>{const n=r.Vendedor||'?';if(!sellerMap[n])sellerMap[n]={sales:0,goal:0};sellerMap[n].sales+=(parseFloat(r.Ventas_Monto)||0);sellerMap[n].goal+=(parseFloat(r.Meta_Ventas)||0);});
      const sellers=Object.entries(sellerMap).map(([n,v])=>({name:n,...v,pct:v.goal>0?v.sales/v.goal*100:null})).sort((a,b)=>b.sales-a.sales);
      mkChart('sellerChart',{type:'bar',data:{labels:sellers.map(s=>s.name.split(' ')[0]),datasets:[
        {label:i18n.t('kpiTotalSales'),data:sellers.map(s=>s.sales),backgroundColor:sellers.map(s=>s.pct!==null?(s.pct>=100?'rgba(34,197,94,.7)':s.pct>=80?'rgba(234,179,8,.7)':'rgba(239,68,68,.7)'):'rgba(59,130,246,.7)'),borderColor:sellers.map(s=>s.pct!==null?(s.pct>=100?'#22c55e':s.pct>=80?'#eab308':'#ef4444'):'#3b82f6'),borderWidth:1.5,borderRadius:5},
      ]},options:{...BASE,indexAxis:'y',plugins:{...BASE.plugins,legend:{display:false}}}});
    }

    if (activeTab === 'products') {
      const prodMap={};
      rows.forEach(r=>{const n=r.Producto||r.Categoría||'?';if(!prodMap[n])prodMap[n]={sales:0,units:0,cat:r.Categoría||'—'};prodMap[n].sales+=(parseFloat(r.Ventas_Monto)||0);prodMap[n].units+=(parseFloat(r.Ventas_Unidades)||0);});
      const top8=Object.values(prodMap).sort((a,b)=>b.sales-a.sales).slice(0,8);
      mkChart('prodSalesChart',{type:'bar',data:{labels:top8.map(p=>p.name.length>14?p.name.slice(0,12)+'…':p.name),datasets:[
        {label:i18n.t('kpiTotalSales'),data:top8.map(p=>p.sales),backgroundColor:PALETTE.map(c=>c+'cc'),borderColor:PALETTE,borderWidth:1.5,borderRadius:5}
      ]},options:{...BASE,indexAxis:'y',plugins:{...BASE.plugins,legend:{display:false}}}});
      const catMap={};rows.forEach(r=>{const c=r.Categoría||'Otros';catMap[c]=(catMap[c]||0)+(parseFloat(r.Ventas_Monto)||0);});
      const cats=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
      mkChart('prodCatChart',{type:'doughnut',data:{labels:cats.map(([k])=>k),datasets:[{data:cats.map(([,v])=>v),backgroundColor:PALETTE.map(c=>c+'cc'),borderColor:PALETTE,borderWidth:1.5,hoverOffset:5}]},options:{...BASE,cutout:'65%',scales:{x:{display:false},y:{display:false}}}});
    }

    if (activeTab === 'projection') {
      const now=new Date();
      const monthMap={},goalMap={},_gs2=new Set();
      rows.forEach(r=>{const d=storage.parseDate(r.Fecha);if(!d) return;const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;monthMap[k]=(monthMap[k]||0)+(parseFloat(r.Ventas_Monto)||0);const gk2=`${k}_${r.Vendedor||''}`;if(!_gs2.has(gk2)){_gs2.add(gk2);goalMap[k]=(goalMap[k]||0)+(parseFloat(r.Meta_Ventas)||0);}});
      const hist=Object.entries(monthMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-5);
      const avgM=hist.length?hist.reduce((s,[,v])=>s+v,0)/hist.length:0;
      const futureLabels=[1,2,3].map(i=>{const d=new Date(now.getFullYear(),now.getMonth()+i,1);return`${i18n.monthName(d.getMonth())} ${d.getFullYear()}`;});
      const allLabels=[...hist.map(([k])=>{const[y,m]=k.split('-');return`${i18n.monthName(parseInt(m)-1)} ${y}`;}), ...futureLabels];
      const histData=[...hist.map(([,v])=>v),...[null,null,null]];
      const projData=[...hist.map((_,i)=>i===hist.length-1?hist[i][1]:null),avgM,avgM*1.02,avgM*1.04];
      mkChart('projChart',{type:'line',data:{labels:allLabels,datasets:[
        {label:i18n.t('chartHistoric'),data:histData,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.08)',borderWidth:2.5,pointRadius:5,tension:.4,fill:true},
        {label:i18n.t('chartProjection'),data:projData,borderColor:'rgba(99,102,241,.7)',backgroundColor:'rgba(99,102,241,.05)',borderWidth:2,borderDash:[6,3],pointRadius:5,tension:.4,fill:true},
      ]},options:{...BASE}});
    }
  }

  // ════════════════════════════════════════════════════════
  // FLATPICKR — calendario visual con rangos
  // ════════════════════════════════════════════════════════
  let _fpInstance = null;

  function initPeriodPicker() {
    if (typeof flatpickr === 'undefined') return;
    const fromEl = document.getElementById('dateFromInput');
    if (!fromEl || _fpInstance) return;
    const filters = storage.getFilters('sales');
    _fpInstance = flatpickr('#dateFromInput', {
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
          storage.setFilters({ period:'custom', dateFrom:from, dateTo:to }, 'sales');
          document.getElementById('periodSelect').value = 'custom';
          document.getElementById('customDateRange').style.display = 'flex';
          document.getElementById('dateFromInput').value = selectedDates[0].toLocaleDateString(i18n.getLang()==='es'?'es-CL':'en-US');
          document.getElementById('dateToInput').value   = selectedDates[1].toLocaleDateString(i18n.getLang()==='es'?'es-CL':'en-US');
          charts.destroyAll();
          render(document.getElementById('contentArea'));
        }
      }
    });
  }

  function openCalendar() {
    if (_fpInstance) {
      _fpInstance.open();
    } else {
      // Flatpickr no disponible — usar inputs nativos
      const fromEl = document.getElementById('dateFromInput');
      if (fromEl) fromEl.type = 'date';
    }
  }

  function initComparisonPicker() {
    // Nada que inicializar con el approach actual — los selects son dinámicos
  }

  // ════════════════════════════════════════════════════════
  // DRILL-DOWN REAL
  // ════════════════════════════════════════════════════════
  function drillDown(type) {
    const rows = storage.applyFilters(storage.getData('sales'), 'sales');
    const sym  = storage.getConfig().currencySymbol || '$';
    const area = document.getElementById('contentArea');
    if (!area) return;

    if (type === 'total') {
      // Detalle por día
      const dayMap = {};
      rows.forEach(r=>{const d=storage.parseDate(r.Fecha);if(!d) return;const k=d.toISOString().split('T')[0];dayMap[k]=(dayMap[k]||0)+(parseFloat(r.Ventas_Monto)||0);});
      const days=Object.entries(dayMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-30);
      _showDrillPanel(area,
        `💰 ${i18n.getLang()==='es'?'Ventas por día':'Sales by day'} — ${i18n.getLang()==='es'?'últimos 30 días':'last 30 days'}`,
        days.map(([k,v])=>({label:k.slice(5),value:fmt(v,sym),raw:v})),
        'salesDrillChart', days.map(([k])=>k.slice(5)), days.map(([,v])=>v), sym
      );
    } else if (type === 'tickets') {
      // Histograma de tickets
      const tickets = rows.map(r=>parseFloat(r.Ventas_Monto)||0).filter(v=>v>0);
      const max=Math.max(...tickets), min=Math.min(...tickets);
      const buckets=10, size=(max-min)/buckets||1;
      const hist=Array(buckets).fill(0);
      tickets.forEach(v=>{ const i=Math.min(Math.floor((v-min)/size),buckets-1); hist[i]++; });
      const labels=hist.map((_,i)=>fmt(min+i*size,sym)+' – '+fmt(min+(i+1)*size,sym));
      _showDrillPanel(area,
        `🛒 ${i18n.getLang()==='es'?'Distribución de tickets':'Ticket distribution'}`,
        hist.map((v,i)=>({label:labels[i],value:v+' tickets',raw:v})),
        'salesDrillChart', labels.map((_,i)=>fmt(min+i*size,sym)), hist, sym, false
      );
    } else if (type === 'conversion') {
      // Funnel
      const totalLeads = rows.reduce((s,r)=>s+(parseFloat(r.Leads)||0),0);
      const totalTx    = rows.length;
      const totalClients = new Set(rows.map(r=>r.Cliente_ID).filter(Boolean)).size;
      const steps = [
        {label:i18n.t('kpiLeads'), value:totalLeads},
        {label:i18n.getLang()==='es'?'Transacciones':'Transactions', value:totalTx},
        {label:i18n.getLang()==='es'?'Clientes únicos':'Unique clients', value:totalClients},
      ];
      _showDrillPanel(area,
        `📈 ${i18n.getLang()==='es'?'Funnel de conversión':'Conversion funnel'}`,
        steps.map(s=>({label:s.label,value:s.value.toLocaleString(),raw:s.value})),
        'salesDrillChart', steps.map(s=>s.label), steps.map(s=>s.value), sym
      );
    }
  }

  function _showDrillPanel(area, title, tableRows, chartId, labels, data, sym, isMoney=true) {
    const existing = document.getElementById('drillPanel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'drillPanel';
    panel.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';
    panel.innerHTML = `
      <div style="background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:12px;width:100%;max-width:700px;max-height:85vh;overflow-y:auto;padding:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="font-size:1rem;font-weight:700;color:var(--color-text)">${title}</div>
          <button onclick="document.getElementById('drillPanel').remove()" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:var(--color-text-muted);">✕</button>
        </div>
        <div style="height:220px;margin-bottom:16px;"><canvas id="${chartId}"></canvas></div>
        <table class="table">
          <thead><tr><th>${i18n.getLang()==='es'?'Período/Rango':'Period / Range'}</th><th class="number">${i18n.getLang()==='es'?'Valor':'Value'}</th></tr></thead>
          <tbody>${tableRows.map(r=>`<tr><td>${r.label}</td><td class="number">${r.value}</td></tr>`).join('')}</tbody>
        </table>
      </div>`;
    document.body.appendChild(panel);
    panel.addEventListener('click', e=>{ if(e.target===panel) panel.remove(); });

    setTimeout(()=>{
      const el=document.getElementById(chartId); if(!el) return;
      const BASE={responsive:true,maintainAspectRatio:false,animation:{duration:400},plugins:{legend:{display:false},tooltip:{backgroundColor:'#1e293b',bodyColor:'#f1f5f9',padding:8,cornerRadius:6}},scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:10}},border:{display:false}},y:{grid:{color:'rgba(255,255,255,.04)'},border:{display:false},ticks:{color:'#64748b',font:{size:10},callback:v=>isMoney?(sym+(v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':v)):v}}}};
      new Chart(el,{type:'bar',data:{labels,datasets:[{data,backgroundColor:'rgba(59,130,246,.7)',borderColor:'#3b82f6',borderWidth:1.5,borderRadius:4}]},options:{...BASE}});
    },50);
  }

  // ════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════
  function mkChart(id, config) {
    const el = document.getElementById(id); if (!el) return;
    if (window._ckCharts?.[id]) window._ckCharts[id].destroy();
    if (!window._ckCharts) window._ckCharts = {};
    window._ckCharts[id] = new Chart(el, config);
  }

  function kpiCard(icon, label, value, status, sub, pct, pctStatus, drillType) {
    const clickAttr = drillType ? `onclick="salesModule.drillDown('${drillType}')" style="cursor:pointer;"` : '';
    return `<div class="kpi-card ${status}" ${clickAttr}>
      <div class="kpi-card-header">
        <div class="kpi-card-icon">${icon}</div>
        <div class="kpi-status-dot ${status}"></div>
        ${drillType ? '<span style="font-size:.6rem;color:var(--color-text-faint);margin-left:auto">🔍</span>' : ''}
      </div>
      <div class="kpi-card-value">${value}</div>
      <div class="kpi-card-label">${label}</div>
      ${sub ? `<div style="font-size:.72rem;color:var(--color-text-faint);margin-top:3px">${sub}</div>` : ''}
      ${pct!==null&&pct!==undefined ? `<div class="kpi-card-progress" style="margin-top:8px"><div class="progress-bar-wrap"><div class="progress-bar-fill ${pctStatus||status}" style="width:${Math.min(pct,100)}%"></div></div></div>` : ''}
    </div>`;
  }

  function renderEmptyPeriod(filters) {
    const isEs   = i18n.getLang() === 'es';
    const period = filters.period || 'prevmonth';
    const futureP = ['month','today','week','last7'].includes(period);
    const hint = futureP
      ? (i18n.getLang()==='es' ? 'Los datos del período actual aún no están disponibles. Selecciona <strong>Mes anterior</strong> para ver los últimos datos.' : 'Data for the current period is not yet available. Select <strong>Previous month</strong> to see the latest data.')
      : (i18n.getLang()==='es' ? 'No hay datos para el período y filtros seleccionados. Intenta ampliar el rango o cambiar los filtros.' : 'No data for the selected period and filters. Try a wider range or different filters.');
    return `<div class="no-data-state">
      <div class="no-data-icon">${futureP ? '🗓️' : '🔍'}</div>
      <h2 class="no-data-title">${i18n.t('noDataPeriod')}</h2>
      <p class="no-data-desc">${hint}</p>
      ${futureP ? `<button class="btn btn-primary" onclick="storage.setFilters({period:'prevmonth'},'sales');renderCurrentModule()">
        📅 ${isEs ? 'Ver mes anterior' : 'View previous month'}
      </button>` : ''}
    </div>`;
  }

  function renderNoData() {
    return `<div class="no-data-state">
      <div class="no-data-icon">💰</div>
      <h2 class="no-data-title">${i18n.t('errorNoData')}</h2>
      <p class="no-data-desc">${i18n.getLang()==='es'?'Sube un Excel de ventas con columnas: Fecha, Ventas_Monto, Vendedor, Producto':'Upload a sales Excel with columns: Fecha, Ventas_Monto, Vendedor, Producto'}</p>
      <button class="btn btn-primary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button>
    </div>`;
  }

  function fmt(n, sym='$') {
    if (n===null||n===undefined||isNaN(n)) return `${sym}—`;
    if (Math.abs(n)>=1e6) return `${sym}${(n/1e6).toFixed(1)}M`;
    if (Math.abs(n)>=1e3) return `${sym}${(n/1e3).toFixed(0)}K`;
    return `${sym}${Math.round(n).toLocaleString('es-CL')}`;
  }

  // ════════════════════════════════════════════════════════
  // API PÚBLICA
  // ════════════════════════════════════════════════════════
  function setTab(tab) {
    activeTab = tab;
    _fpInstance = null;
    if (window._ckCharts) { Object.values(window._ckCharts).forEach(c=>c?.destroy()); window._ckCharts={}; }
    render(document.getElementById('contentArea'));
  }

  function setChart(type) {
    activeChart = type;
    render(document.getElementById('contentArea'));
  }

  function setFilter(key, value) {
    storage.setFilters({ [key]: value }, 'sales');
    if (key === 'period') {
      const cdr = document.getElementById('customDateRange');
      if (cdr) cdr.style.display = value === 'custom' ? 'flex' : 'none';
    }
    _fpInstance = null;
    if (window._ckCharts) { Object.values(window._ckCharts).forEach(c=>c?.destroy()); window._ckCharts={}; }
    render(document.getElementById('contentArea'));
  }

  function resetFilters() {
    storage.resetFilters('sales');
    _fpInstance = null;
    render(document.getElementById('contentArea'));
  }

  function setCompareMode(mode) {
    storage.setFilters({ compareMode: mode, compareWith: mode==='none'?[]:storage.getFilters('sales').compareWith||[] }, 'sales');
    render(document.getElementById('contentArea'));
  }

  function addComparePeriod(period) {
    if (!period) return;
    const filters = storage.getFilters('sales');
    const current = filters.compareWith || [];
    if (!current.includes(period) && current.length < 5) {
      storage.setFilters({ compareWith: [...current, period] }, 'sales');
      render(document.getElementById('contentArea'));
    }
  }

  function removeComparePeriod(period) {
    const filters = storage.getFilters('sales');
    storage.setFilters({ compareWith: (filters.compareWith||[]).filter(p=>p!==period) }, 'sales');
    render(document.getElementById('contentArea'));
  }

  function clearComparePeriods() {
    storage.setFilters({ compareWith: [] }, 'sales');
    render(document.getElementById('contentArea'));
  }

  function setWorkingDays(value, type) {
    const config = storage.getConfig();
    if (type === 'total')   storage.setConfig({ workingDaysThisMonth: parseInt(value)||22 });
    if (type === 'elapsed') storage.setConfig({ workingDaysElapsed:   parseInt(value)||1 });
    render(document.getElementById('contentArea'));
  }

  function drillDownSeller(sellerName) {
    storage.setFilters({ vendedor: sellerName }, 'sales');
    if (window._ckCharts) { Object.values(window._ckCharts).forEach(c=>c?.destroy()); window._ckCharts={}; }
    render(document.getElementById('contentArea'));
  }

  return {
    render, setTab, setChart, setFilter, resetFilters,
    setCompareMode, addComparePeriod, removeComparePeriod, clearComparePeriods,
    setWorkingDays, drillDown, drillDownSeller, openCalendar,
  };
})();

window.salesModule = salesModule;

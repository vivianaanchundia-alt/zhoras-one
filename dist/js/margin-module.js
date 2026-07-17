// ════════════════════════════════════════════════════════════════
// CLAROKPIS — margin-module.js
// Módulo Precio y Margen por producto/categoría
// Solo visible para rol Dueño
// ════════════════════════════════════════════════════════════════

const marginModule = (() => {
  let activeTab   = 'products';
  let sortField   = 'monto';
  let sortDir     = 'desc';

  function render(container) {
    const allSales  = storage.getData('sales');
    const salesRows = storage.applyFilters(allSales, 'margin');
    const invRows   = storage.getData('inventory');
    const goals     = storage.getGoals();
    const config    = storage.getConfig();
    const sym       = config.currencySymbol || '$';

    // Sin datos en absoluto → estado vacío completo
    if (!allSales.length) { container.innerHTML = _emptyState('nosales'); return; }

    const filterBar = renderGlobalFilters('margin', { showSeller: true, showChannel: true, showBranch: true });

    // Filtro deja sin datos → barra de filtros + mensaje (para poder limpiar)
    if (!salesRows.length) {
      container.innerHTML = `
        <div class="module-header">
          <div><h1 class="module-title">💹 ${i18n.t('marginTitle')}</h1></div>
        </div>
        ${filterBar}
        <div class="no-data-state">
          <div class="no-data-icon">💹</div>
          <h2 class="no-data-title">${i18n.getLang()==='es'?'Sin datos para este período':'No data for this period'}</h2>
          <p class="no-data-desc">${i18n.getLang()==='es'?'Ajusta o limpia los filtros para ver resultados.':'Adjust or clear filters to see results.'}</p>
        </div>`;
      return;
    }

    // Verificar si hay datos de descuento
    const hasDiscount = salesRows.some(r => parseFloat(r.PVP) > 0 && parseFloat(r.Precio_Facturado) > 0);
    const hasCost     = invRows.some(r => parseFloat(r.Costo_Unitario) > 0);

    const discData    = kpis.calcDiscount(salesRows);
    const products    = kpis.calcMarginByProduct(salesRows, invRows);
    const productRank = kpis.calcProductRanking(salesRows);
    const goalDisc    = goals.max_discount || 10;
    const goalMargin  = goals.gross_margin  || 40;

    container.innerHTML = `
      <div class="module-header">
        <div>
          <h1 class="module-title">💹 ${i18n.t('marginTitle')}</h1>
          <p class="module-subtitle">${salesRows.length.toLocaleString()} ${i18n.t('records')}${(() => {
              const _dr = storage.getDataDateRange(['sales','inventory']);
              return _dr ? ' · ' + (i18n.getLang()==='es' ? 'Datos: ' : 'Data: ') + _dr.label : '';
            })()}
            <span style="display:inline-flex;align-items:center;gap:4px;margin-left:8px;padding:2px 8px;border-radius:20px;font-size:.7rem;font-weight:700;background:var(--color-blue-bg);border:1px solid var(--color-blue-border);color:var(--color-blue);">
              ${hasCost ? i18n.t('marginSourceBoth') : i18n.t('marginSourceSales')}
            </span>
          </p>
        </div>
        <div class="module-actions">
          <button class="btn btn-sm btn-secondary" onclick="excelProcessor.downloadTemplate('sales')">
            📥 ${i18n.getLang()==='es'?'Plantilla ventas':'Sales template'}
          </button>
        </div>
      </div>

      ${!hasCost ? `
        <div class="card" style="background:var(--color-yellow-bg);border:1px solid var(--color-yellow-border);padding:12px 16px;display:flex;align-items:flex-start;gap:10px;margin-bottom:16px;">
          <span style="font-size:1.1rem;flex-shrink:0;">📦</span>
          <div>
            <strong style="color:var(--color-text);font-size:.85rem;">${i18n.t('marginNeedsInventory')}</strong>
            <div style="margin-top:4px;">
              <button class="btn btn-sm btn-secondary" onclick="excelProcessor.downloadTemplate('inventory')" style="font-size:.75rem;">
                📥 ${i18n.getLang()==='es'?'Plantilla inventario':'Inventory template'}
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      ${filterBar}

      <!-- KPIs principales -->
      <div class="kpi-grid kpi-grid-4" style="margin-bottom:var(--space-5)">
        ${_kpiCard(i18n.t('kpiAvgDiscount'),
          discData ? formatPct(discData.avg) : '—',
          discData ? storage.getStatus(goalDisc, discData.avg, true) : 'na', '🏷️',
          discData ? calcDelta(discData.avg,'sales','PVP', storage.getActiveFilters()) : null,true)}
        ${_kpiCard(i18n.t('marginDescMax'),
          discData ? formatPct(discData.max) : '—',
          discData ? (discData.max > goalDisc*1.5 ? 'red' : discData.max > goalDisc ? 'yellow' : 'green') : 'na', '📉', null)}
        ${_kpiCard(i18n.t('kpiAvgMargin'),
          products.length ? formatPct(products.filter(p=>p.grossMargin).reduce((s,p)=>s+p.grossMargin,0)/(products.filter(p=>p.grossMargin).length||1)) : '—',
          products.length ? storage.getStatus(products.filter(p=>p.grossMargin).reduce((s,p)=>s+p.grossMargin,0)/(products.filter(p=>p.grossMargin).length||1), goalMargin) : 'na', '📊', null)}
        ${_kpiCard(i18n.t('kpiBestMarginProduct'),
          products[0]?.name ? `${products[0].name.split(' ')[0]} (${formatPct(products[0].grossMargin||0)})` : '—',
          'green', '🥇', null)}
      </div>

      <!-- Alerta si descuento sobre meta -->
      ${discData && discData.avg > goalDisc ? `
        <div class="alert-banner yellow" style="margin-bottom:var(--space-5)">
          <span class="alert-banner-icon">🏷️</span>
          <div class="alert-banner-body">
            <div class="alert-banner-title">${i18n.t('alertDiscountHigh')}: ${formatPct(discData.avg)} (meta: ${goalDisc}%)</div>
            <div class="alert-banner-desc">${i18n.t('marginActionDiscount')}</div>
          </div>
        </div>` : ''}

      <!-- Tabs -->
      <div class="tabs" style="margin-bottom:var(--space-5)">
        ${['products','category','discount','channel'].map(t => `
          <div class="tab-btn ${activeTab===t?'active':''}" onclick="marginModule._setTab('${t}')">
            ${{products:('📦 '+i18n.t('marginTabPorProd')), category:('🗂️ '+i18n.t('marginTabPorCat')), discount:('🏷️ '+i18n.t('marginTabDescuentos')), channel:('📡 '+i18n.t('marginTabCanalSuc'))}[t]}
          </div>`).join('')}
      </div>

      <!-- Advertencias si faltan columnas -->
      ${!hasDiscount ? `<div class="alert-banner" style="margin-bottom:var(--space-4);border-color:var(--color-blue-border)">
        <span class="alert-banner-icon">ℹ️</span>
        <div class="alert-banner-body">
          <div class="alert-banner-title">${i18n.t('marginNoDiscountData')}</div>
        </div>
      </div>` : ''}
      ${!hasCost ? `<div class="alert-banner" style="margin-bottom:var(--space-4);border-color:var(--color-blue-border)">
        <span class="alert-banner-icon">ℹ️</span>
        <div class="alert-banner-body">
          <div class="alert-banner-title">${i18n.t('marginNoCostData')}</div>
        </div>
      </div>` : ''}

      <div id="marginTabContent"></div>
    `;

    _renderTab(products, productRank, discData, goalDisc, goalMargin, sym);

    // Alertas storage
    if (discData && discData.avg > goalDisc) {
      storage.addAlert({ type:'warning', module:'margin', kpi:'avg_discount',
        message: i18n.t('alertDiscountHigh'), value: discData.avg, goal: goalDisc });
    }
  }

  function _setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
      const map = { products:'producto', category:'categoría', discount:'descuento' };
      b.classList.toggle('active', b.textContent.toLowerCase().includes(map[tab]));
    });
    const salesRows = storage.applyFilters(storage.getData('sales'), 'margin');
    const invRows   = storage.getData('inventory');
    const goals     = storage.getGoals();
    const config    = storage.getConfig();
    _renderTab(
      kpis.calcMarginByProduct(salesRows, invRows),
      kpis.calcProductRanking(salesRows),
      kpis.calcDiscount(salesRows),
      goals.max_discount || 10,
      goals.gross_margin  || 40,
      config.currencySymbol || '$'
    );
  }

  function _renderTab(products, productRank, discData, goalDisc, goalMargin, sym) {
    const el = document.getElementById('marginTabContent');
    if (!el) return;

    if (activeTab === 'products') {
      el.innerHTML = `
        <div class="section-card">
          <div class="section-card-header">
            <div class="section-card-title">${'📦 '+i18n.t('marginPrecioProd')}</div>
            <div class="section-card-subtitle">${i18n.t('marginClickProd')}</div>
          </div>
          <!-- Header tabla -->
          <div class="margin-table-header">
            <div></div>
            <div>Producto</div>
            <div class="right">Ventas</div>
            <div class="right">Descuento %</div>
            <div class="right">${i18n.getLang()==="es"?"Margen %":"Margin %"}</div>
          </div>
          <div id="marginProductTable"></div>
        </div>

        <!-- Histograma (oculto hasta seleccionar producto) -->
        <div id="marginHistogramCard" class="section-card hidden" style="margin-top:var(--space-5)">
          <div class="section-card-header">
            <div class="section-card-title" id="marginHistogramTitle">${i18n.getLang()==='es'?'Distribución de descuentos':'Discount distribution'}</div>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('marginHistogramCard').classList.add('hidden')">✕</button>
          </div>
          <div class="chart-wrap" style="height:200px"><canvas id="chartDiscountHistogram"></canvas></div>
        </div>
      `;
      charts.renderMarginTable('marginProductTable', products, { gross_margin: goalMargin });
    }

    else if (activeTab === 'category') {
      // Agrupar por categoría
      const catMap = {};
      products.forEach(p => {
        const cat = p.categoria || 'Sin categoría';
        if (!catMap[cat]) catMap[cat] = { cat, monto:0, items:0, discounts:[], margins:[] };
        catMap[cat].monto   += p.monto;
        catMap[cat].items++;
        if (p.avgDiscount !== null) catMap[cat].discounts.push(p.avgDiscount);
        if (p.grossMargin  !== null) catMap[cat].margins.push(p.grossMargin);
      });
      const cats = Object.values(catMap).map(c => ({
        ...c,
        avgDiscount: c.discounts.length ? c.discounts.reduce((s,v)=>s+v,0)/c.discounts.length : null,
        avgMargin:   c.margins.length   ? c.margins.reduce((s,v)=>s+v,0)/c.margins.length     : null,
      })).sort((a,b) => b.monto - a.monto);

      el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5)">
          <div class="section-card">
            <div class="section-card-header"><div class="section-card-title">${'💰 '+(i18n.getLang()==='es'?'Ventas por categoría':'Sales by category')}</div></div>
            <div class="chart-wrap" style="height:260px"><canvas id="chartCatSales"></canvas></div>
          </div>
          <div class="section-card">
            <div class="section-card-header"><div class="section-card-title">${'📊 '+(i18n.getLang()==='es'?'Tabla de categorías':'Category table')}</div></div>
            <table class="data-table">
              <thead><tr>
                <th>${i18n.getLang()==='es'?'Categoría':'Category'}</th>
                <th class="right">${i18n.getLang()==="es"?"Ventas":"Sales"}</th>
                <th class="right">${i18n.getLang()==="es"?"Desc. prom.":"Avg. disc."}</th>
                <th class="right">${i18n.getLang()==="es"?"Margen prom.":"Avg. margin"}</th>
              </tr></thead>
              <tbody>
                ${cats.map(c => `<tr>
                  <td style="font-weight:600">${c.cat}</td>
                  <td class="right mono">${formatCurrency(c.monto)}</td>
                  <td class="right mono" style="color:${c.avgDiscount>goalDisc?'var(--color-red)':c.avgDiscount>goalDisc*.8?'var(--color-yellow)':'var(--color-green)'}">
                    ${c.avgDiscount!==null ? formatPct(c.avgDiscount) : '—'}
                  </td>
                  <td class="right mono" style="color:${c.avgMargin<25?'var(--color-red)':c.avgMargin<goalMargin?'var(--color-yellow)':'var(--color-green)'}">
                    ${c.avgMargin!==null ? formatPct(c.avgMargin) : '—'}
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      setTimeout(() => charts.salesDonut('chartCatSales', cats.map(c=>({label:c.cat,value:c.monto,pct:0}))), 50);
    }

    else if (activeTab === 'discount') {
      if (!discData) {
        el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏷️</div><div class="empty-state-title">${i18n.t('marginNoDiscountData')}</div></div>`;
        return;
      }
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5)">
          <div class="section-card">
            <div class="section-card-header"><div class="section-card-title">📊 Distribución de descuentos</div></div>
            <div class="chart-wrap" style="height:260px"><canvas id="chartMainHistogram"></canvas></div>
          </div>
          <div class="section-card">
            <div class="section-card-header"><div class="section-card-title">${'🔢 '+(i18n.getLang()==='es'?'Estadísticas de descuento':'Discount statistics')}</div></div>
            <div style="display:flex;flex-direction:column;gap:var(--space-3);padding:var(--space-2) 0">
              ${[
                [(i18n.getLang()==='es'?'Descuento promedio':'Avg. discount'), formatPct(discData.avg), discData.avg > goalDisc ? 'red' : 'green'],
                [(i18n.getLang()==='es'?'Descuento mediano':'Median discount'),  formatPct(discData.median), 'na'],
                [i18n.t('marginDescMax'),   formatPct(discData.max),    discData.max > goalDisc*1.5 ? 'red' : 'yellow'],
                [(i18n.getLang()==='es'?'Descuento mínimo':'Min. discount'),   formatPct(discData.min),    'green'],
                [(i18n.getLang()==='es'?'Transacciones con descuento':'Transactions with discount'), discData.count.toLocaleString(), 'na'],
                [(i18n.getLang()==='es'?'Meta descuento máximo':'Max. discount target'), formatPct(goalDisc), 'na'],
              ].map(([label, val, st]) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,.04)">
                  <span style="font-size:.82rem;color:var(--color-text-muted)">${label}</span>
                  <span style="font-size:.9rem;font-weight:700;font-family:var(--font-mono);color:${getStatusColor(st)}">${val}</span>
                </div>`).join('')}
            </div>
          </div>
        </div>

        <!-- Top 10 productos con mayor descuento -->
        <div class="section-card" style="margin-top:var(--space-5)">
          <div class="section-card-header">
            <div class="section-card-title">⚠️ Productos con mayor descuento promedio</div>
          </div>
          <table class="data-table">
            <thead><tr>
              <th>#</th><th>${i18n.getLang()==='es'?'Producto':'Product'}</th><th>${i18n.getLang()==='es'?'Categoría':'Category'}</th>
              <th class="right">${i18n.getLang()==="es"?"Desc. prom.":"Avg. disc."}</th><th class="right">${i18n.getLang()==="es"?"Desc. máx.":"Max. disc."}</th>
              <th class="right">${i18n.getLang()==="es"?"Ventas":"Sales"}</th>
            </tr></thead>
            <tbody>
              ${[...productRank].filter(p=>p.avgDiscount!==null).sort((a,b)=>b.avgDiscount-a.avgDiscount).slice(0,10).map((p,i)=>`
                <tr>
                  <td style="color:var(--color-text-faint)">${i+1}</td>
                  <td style="font-weight:600">${sanitize(p.name)}</td>
                  <td style="font-size:.8rem;color:var(--color-text-muted)">${p.categoria}</td>
                  <td class="right mono" style="color:${p.avgDiscount>goalDisc?'var(--color-red)':p.avgDiscount>goalDisc*.8?'var(--color-yellow)':'var(--color-green)'}">
                    ${formatPct(p.avgDiscount)}
                  </td>
                  <td class="right mono" style="color:var(--color-text-muted)">${formatPct(p.maxDiscount||0)}</td>
                  <td class="right mono">${formatCurrency(p.monto)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
      setTimeout(() => charts.discountHistogram('chartMainHistogram', discData.histogram), 50);
    }

    else if (activeTab === 'channel') {
      const salesRows = storage.applyFilters(storage.getData('sales'), 'margin');
      const invRows   = storage.getData('inventory');

      // Calcular margen por canal y sucursal
      const byChannel  = _calcMarginByGroup(salesRows, invRows, 'Canal_Venta');
      const bySucursal = _calcMarginByGroup(salesRows, invRows, 'Sucursal');

      el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;" class="charts-row">
          <div class="section-card">
            <div class="section-card-header"><div class="section-card-title">${'📡 '+(i18n.getLang()==='es'?'Margen bruto por canal de venta':'Gross margin by sales channel')}</div></div>
            <div class="chart-wrap" style="height:240px"><canvas id="channelMarginChart"></canvas></div>
          </div>
          <div class="section-card">
            <div class="section-card-header"><div class="section-card-title">${'🏢 '+(i18n.getLang()==='es'?'Margen bruto por sucursal':'Gross margin by branch')}</div></div>
            <div class="chart-wrap" style="height:240px"><canvas id="sucursalMarginChart"></canvas></div>
          </div>
        </div>

        <!-- Tabla canal -->
        <div class="section-card" style="margin-bottom:16px;">
          <div class="section-card-header"><div class="section-card-title">${'📡 '+(i18n.getLang()==='es'?'Detalle por canal':'Channel breakdown')}</div></div>
          <table class="data-table">
            <thead><tr>
              <th>${i18n.getLang()==='es'?'Canal':'Channel'}</th><th class="right">${i18n.getLang()==="es"?"Ventas":"Sales"}</th><th class="right">${i18n.getLang()==="es"?"Unidades":"Units"}</th>
              <th class="right">${i18n.getLang()==="es"?"Desc. prom.":"Avg. disc."}</th><th class="right">${i18n.getLang()==="es"?"Margen bruto":"Gross margin"}</th><th class="right">${i18n.getLang()==="es"?"% Margen":"% Margin"}</th>
            </tr></thead>
            <tbody>
              ${byChannel.map(g => `
                <tr>
                  <td style="font-weight:600">${normalizeChannel(g.group)}</td>
                  <td class="right mono">${formatCurrency(g.monto)}</td>
                  <td class="right mono">${g.units.toLocaleString()}</td>
                  <td class="right mono" style="color:${g.avgDiscount>10?'var(--color-yellow)':'var(--color-text-muted)'}">${g.avgDiscount!==null?formatPct(g.avgDiscount):'—'}</td>
                  <td class="right mono" style="color:var(--color-green)">${formatCurrency(g.grossProfit)}</td>
                  <td class="right mono" style="color:${g.grossMargin>=40?'var(--color-green)':g.grossMargin>=25?'var(--color-yellow)':'var(--color-red)'}">
                    <strong>${g.grossMargin!==null?formatPct(g.grossMargin):'—'}</strong>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <!-- Tabla sucursal -->
        <div class="section-card">
          <div class="section-card-header"><div class="section-card-title">${'🏢 '+(i18n.getLang()==='es'?'Detalle por sucursal':'Branch breakdown')}</div></div>
          <table class="data-table">
            <thead><tr>
              <th>${i18n.getLang()==="es"?"Sucursal":"Branch"}</th><th class="right">${i18n.getLang()==="es"?"Ventas":"Sales"}</th><th class="right">${i18n.getLang()==="es"?"Unidades":"Units"}</th>
              <th class="right">${i18n.getLang()==="es"?"Desc. prom.":"Avg. disc."}</th><th class="right">${i18n.getLang()==="es"?"Margen bruto":"Gross margin"}</th><th class="right">${i18n.getLang()==="es"?"% Margen":"% Margin"}</th>
            </tr></thead>
            <tbody>
              ${bySucursal.map(g => `
                <tr>
                  <td style="font-weight:600">${normalizeChannel(g.group)}</td>
                  <td class="right mono">${formatCurrency(g.monto)}</td>
                  <td class="right mono">${g.units.toLocaleString()}</td>
                  <td class="right mono" style="color:${g.avgDiscount>10?'var(--color-yellow)':'var(--color-text-muted)'}">${g.avgDiscount!==null?formatPct(g.avgDiscount):'—'}</td>
                  <td class="right mono" style="color:var(--color-green)">${formatCurrency(g.grossProfit)}</td>
                  <td class="right mono" style="color:${g.grossMargin>=40?'var(--color-green)':g.grossMargin>=25?'var(--color-yellow)':'var(--color-red)'}">
                    <strong>${g.grossMargin!==null?formatPct(g.grossMargin):'—'}</strong>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
      setTimeout(() => {
        _renderGroupChart('channelMarginChart',  byChannel,  sym);
        _renderGroupChart('sucursalMarginChart', bySucursal, sym);
      }, 50);
    }
  }

  function _calcMarginByGroup(salesRows, invRows, groupField) {
    const costMap = {};
    invRows.forEach(r => { if (r.Producto && r.Costo_Unitario) costMap[r.Producto] = parseFloat(r.Costo_Unitario)||0; });

    const groups = {};
    salesRows.forEach(r => {
      const key = r[groupField] || 'Sin dato';
      if (!groups[key]) groups[key] = { group:key, monto:0, units:0, cost:0, discountSum:0, discountCount:0 };
      const monto = parseFloat(r.Ventas_Monto)||0;
      const units = parseFloat(r.Ventas_Unidades)||0;
      const pvp   = parseFloat(r.PVP)||0;
      const prec  = parseFloat(r.Precio_Facturado)||0;
      const cost  = (costMap[r.Producto]||0) * units;
      groups[key].monto += monto;
      groups[key].units += units;
      groups[key].cost  += cost;
      if (pvp > 0 && prec > 0) {
        groups[key].discountSum   += ((pvp - prec) / pvp) * 100;
        groups[key].discountCount += 1;
      }
    });

    return Object.values(groups).map(g => {
      // Margen bruto real: sobre ventas netas (sin IVA) para comparabilidad entre países
      const netMonto     = storage.getNetAmount(g.monto);
      const grossProfit  = g.cost > 0 ? netMonto - g.cost : null;
      const grossMargin  = grossProfit !== null && netMonto > 0 ? (grossProfit / netMonto) * 100 : null;
      const avgDiscount  = g.discountCount > 0 ? g.discountSum / g.discountCount : null;
      return { ...g, netMonto, grossProfit, grossMargin, avgDiscount };
    }).sort((a, b) => b.monto - a.monto);
  }

  function _renderGroupChart(canvasId, groups, sym) {
    const el = document.getElementById(canvasId);
    if (!el) return;
    if (window._ckCharts?.[canvasId]) window._ckCharts[canvasId].destroy();
    if (!window._ckCharts) window._ckCharts = {};
    const labels  = groups.map(g => normalizeChannel(g.group));
    const margins = groups.map(g => g.grossMargin !== null ? parseFloat(g.grossMargin.toFixed(1)) : 0);
    const colors  = margins.map(m => m >= 40 ? 'rgba(34,197,94,.75)' : m >= 25 ? 'rgba(245,158,11,.75)' : 'rgba(239,68,68,.75)');
    window._ckCharts[canvasId] = new Chart(el, {
      type: 'bar',
      data: { labels, datasets: [{ label:'Margen bruto %', data:margins, backgroundColor:colors, borderRadius:5, borderWidth:0 }] },
      options: {
        responsive:true, maintainAspectRatio:false, animation:{duration:400},
        plugins:{ legend:{display:false}, tooltip:{backgroundColor:'#1e293b',borderColor:'#334155',borderWidth:1,titleColor:'#94a3b8',bodyColor:'#f1f5f9',callbacks:{label:ctx=>`Margen: ${ctx.raw}%`}} },
        scales:{
          x:{ grid:{display:false}, ticks:{color:'#64748b',font:{size:11}} },
          y:{ grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'#64748b',font:{size:11},callback:v=>v+'%'}, max:60 }
        }
      }
    });
  }

  // Click en producto → mostrar histograma
  function showProductHistogram(productName) {
    const salesRows = storage.applyFilters(storage.getData('sales'), 'margin');
    const rows = salesRows.filter(r => r.Producto === productName &&
      parseFloat(r.PVP) > 0 && parseFloat(r.Precio_Facturado) > 0);
    if (!rows.length) return;

    const discounts  = rows.map(r => ((parseFloat(r.PVP) - parseFloat(r.Precio_Facturado)) / parseFloat(r.PVP)) * 100);
    const histogram  = kpis.calcDiscount(rows)?.histogram;
    if (!histogram) return;

    const card  = document.getElementById('marginHistogramCard');
    const title = document.getElementById('marginHistogramTitle');
    if (card && title) {
      title.textContent = `Descuentos — ${productName}`;
      card.classList.remove('hidden');
      setTimeout(() => charts.discountHistogram('chartDiscountHistogram', histogram), 50);
    }
  }

  function _kpiCard(label, value, status, icon, delta) {
    const color = getStatusColor(status);
    const deltaHtml = delta ? `<div class="kpi-card-delta" style="color:${delta.color}">${delta.text}</div>` : '';
    return `
      <div class="kpi-card status-${status}">
        <div class="kpi-card-label"><span class="status-dot ${status}"></span>${label}</div>
        <div class="kpi-card-value" style="color:${color}">${value}</div>
        ${deltaHtml}
      </div>`;
  }

  function _emptyState(type = 'nosales') {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">💹</div>
        <div class="empty-state-title">${i18n.t('marginTitle')}</div>
        <div class="empty-state-desc">${i18n.getLang()==='es'?'Sube tu Excel de ventas con las columnas <strong>PVP</strong> y <strong>Precio_Facturado</strong> para ver márgenes y descuentos.':'Upload your Sales Excel with the <strong>PVP</strong> and <strong>Precio_Facturado</strong> columns to see margins and discounts.'}</div>
        <div class="empty-state-action" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn-primary" onclick="showModal('uploadModal')">📂 ${i18n.getLang()==='es'?'Subir datos':'Upload data'}</button>
          <button class="btn btn-secondary" onclick="excelProcessor.downloadTemplate('sales')">📥 ${i18n.getLang()==='es'?'Plantilla ventas':'Sales template'}</button>
        </div>
      </div>`;
  }

  return { render, _setTab, showProductHistogram };
})();

function renderMargin(container) { marginModule.render(container); }

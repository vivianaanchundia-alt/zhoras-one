// ════════════════════════════════════════════════════════════════
// CLAROKPIS — suppliers-module.js
// Módulo Proveedores y Compras
// ════════════════════════════════════════════════════════════════

const suppliersModule = (() => {
  let activeTab = 'summary';

  function render(container) {
    const allRows = storage.getData('suppliers');
    const rows   = storage.applyFilters(allRows, 'suppliers');
    const goals  = storage.getGoals();
    const config = storage.getConfig();
    const sym    = config.currencySymbol || '$';
    const data   = kpis.calcSuppliers(rows, goals);

    // Sin datos en absoluto (no subidos) → estado vacío completo
    if (!allRows.length) {
      container.innerHTML = _emptyState();
      return;
    }

    const header = `
      <div class="module-header">
        <div>
          <h1 class="module-title">🏭 ${i18n.t('suppliersTitle')}</h1>
          <p class="module-subtitle">${rows.length.toLocaleString()} ${i18n.t('records')}${(() => {
              const _dr = storage.getDataDateRange('suppliers');
              return _dr ? ' · ' + (i18n.getLang()==='es' ? 'Datos: ' : 'Data: ') + _dr.label : '';
            })()}</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-sm btn-secondary" onclick="excelProcessor.downloadTemplate('suppliers')">
            📥 ${i18n.t('templateDownload')}
          </button>
          <button class="btn btn-sm btn-secondary" onclick="showModal('uploadModal')">
            📂 ${i18n.t('uploadData')}
          </button>
        </div>
      </div>
      ${renderGlobalFilters('suppliers', { showSeller: false, showChannel: false, showBranch: false })}
    `;

    // Filtro deja sin datos → mostrar barra de filtros + mensaje (para poder limpiar)
    if (!rows.length) {
      container.innerHTML = header + `
        <div class="no-data-state">
          <div class="no-data-icon">🏭</div>
          <h2 class="no-data-title">${i18n.getLang()==='es'?'Sin datos para este período':'No data for this period'}</h2>
          <p class="no-data-desc">${i18n.getLang()==='es'?'Ajusta o limpia los filtros para ver resultados.':'Adjust or clear filters to see results.'}</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      ${header}

      <!-- KPIs principales -->
      <div class="kpi-grid kpi-grid-4" style="margin-bottom:var(--space-5)">
        ${_kpiCard(i18n.t('supplierTotalSpend'),    formatCurrency(data.totalSpend),     data.totalSpend>0?'green':'na',  '🏭',true)}
        ${_kpiCard(i18n.t('supplierOnTimeDelivery'), data.globalOTD!==null?formatPct(data.globalOTD):'—', data.globalOTD>=90?'green':data.globalOTD>=75?'yellow':'red', '📦')}
        ${_kpiCard(i18n.t('suppOrdenesPend'),             data.pending.length,                data.pending.length>0?'yellow':'green', '⏳')}
        ${_kpiCard(i18n.t('suppOrdenesVenc'),               data.overdue.length,                data.overdue.length>0?'red':'green',    '🚨')}
      </div>

      <!-- Alertas de riesgo -->
      ${_renderAlerts(data)}

      <!-- Tabs -->
      <div class="tabs" style="margin-bottom:var(--space-5)">
        ${['summary','orders','ranking'].map(t => `
          <div class="tab-btn ${activeTab===t?'active':''}" onclick="suppliersModule._setTab('${t}')">
            ${{summary:i18n.t('suppTabResumen'), orders:i18n.t('suppTabOrdenes'), ranking:i18n.t('suppTabRanking')}[t]}
          </div>`).join('')}
      </div>

      <!-- Contenido del tab -->
      <div id="suppliersTabContent"></div>
    `;

    _renderTab(data, sym);

    // Alertas al storage
    if (data.overdue.length > 0) {
      storage.addAlert({ type:'warning', module:'suppliers', kpi:'overdue_orders',
        message: i18n.t('alertSupplierOverdue'), value: data.overdue.length });
    }
    const highRisk = data.supplierList.filter(s => s.risk === 'high');
    if (highRisk.length > 0) {
      storage.addAlert({ type:'warning', module:'suppliers', kpi:'concentration',
        message: i18n.t('alertSupplierConc') + ': ' + highRisk[0].name, value: highRisk[0].concPct });
    }
  }

  function _setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.textContent.toLowerCase().includes({summary:'resum',orders:'orden',ranking:'ranking'}[tab]));
    });
    const rows  = storage.applyFilters(storage.getData('suppliers'), 'suppliers');
    const data  = kpis.calcSuppliers(rows, storage.getGoals());
    const sym   = storage.getConfig().currencySymbol || '$';
    _renderTab(data, sym);
  }

  function _renderTab(data, sym) {
    const el = document.getElementById('suppliersTabContent');
    if (!el) return;

    if (activeTab === 'summary') {
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5)">
          <div class="section-card">
            <div class="section-card-header">
              <div class="section-card-title">${'💰 '+i18n.t('suppGastoPorProv')}</div>
            </div>
            <div class="chart-wrap" style="height:280px"><canvas id="chartSupplierSpend"></canvas></div>
          </div>
          <div class="section-card">
            <div class="section-card-header">
              <div class="section-card-title">${'⏱️ '+i18n.t('suppLeadTimeDias')}</div>
            </div>
            <div class="chart-wrap" style="height:280px"><canvas id="chartSupplierLT"></canvas></div>
          </div>
        </div>
        <div class="section-card" style="margin-top:var(--space-5)">
          <div class="section-card-header">
            <div class="section-card-title">${'📦 '+i18n.t('suppGastoPorCat')}</div>
          </div>
          <div class="chart-wrap" style="height:220px"><canvas id="chartSupplierCat"></canvas></div>
        </div>
      `;
      setTimeout(() => {
        charts.supplierSpendBar('chartSupplierSpend', data.supplierList);
        charts.supplierLeadTimeBar('chartSupplierLT', data.supplierList);
        charts.salesDonut('chartSupplierCat', data.byCategory);
      }, 50);
    }

    else if (activeTab === 'orders') {
      const allRows = storage.applyFilters(storage.getData('suppliers'), 'suppliers');
      el.innerHTML = `
        <div class="section-card">
          <div class="section-card-header">
            <div class="section-card-title">${'📋 '+(i18n.getLang()==='es'?'Órdenes de compra':'Purchase orders')}</div>
            <div style="display:flex;gap:8px">
              ${data.overdue.length > 0 ? `<span class="badge badge-red">⚠️ ${data.overdue.length} ${i18n.getLang()==='es'?'vencidas':'overdue'}</span>` : ''}
              ${data.pending.length > 0 ? `<span class="badge badge-yellow">⏳ ${data.pending.length} ${i18n.getLang()==='es'?'pendientes':'pending'}</span>` : ''}
            </div>
          </div>
          <div class="table-scroll-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${i18n.t('supplierOrderID')}</th>
                  <th>${i18n.t('supplierName')}</th>
                  <th>${i18n.t('supplierOrderDate')}</th>
                  <th>${i18n.t('supplierExpectedDate')}</th>
                  <th>${i18n.t('supplierRealDate')}</th>
                  <th class="right">${i18n.t('supplierLeadTimeDays')}</th>
                  <th class="right">${i18n.t('supplierTotalSpend')}</th>
                  <th class="center">Estado</th>
                </tr>
              </thead>
              <tbody>
                ${allRows.slice(0,50).map(r => {
                  const isOverdue = !r.Fecha_Entrega_Real && r.Fecha_Entrega_Esperada &&
                    new Date(r.Fecha_Entrega_Esperada) < new Date();
                  const isOnTime  = r.Fecha_Entrega_Real && r.Fecha_Entrega_Esperada &&
                    new Date(r.Fecha_Entrega_Real) <= new Date(r.Fecha_Entrega_Esperada);
                  const status    = !r.Fecha_Entrega_Real
                    ? (isOverdue ? '<span class="badge badge-red">Vencida</span>' : '<span class="badge badge-yellow">Pendiente</span>')
                    : (isOnTime  ? '<span class="badge badge-green">A tiempo</span>' : '<span class="badge badge-red">Con retraso</span>');
                  return `<tr>
                    <td class="mono" style="font-size:.78rem">${r.OC_ID||'—'}</td>
                    <td style="font-weight:600">${sanitize(r.Proveedor_Nombre)||'—'}</td>
                    <td>${storage.formatDate(r.Fecha)}</td>
                    <td>${storage.formatDate(r.Fecha_Entrega_Esperada)||'—'}</td>
                    <td>${storage.formatDate(r.Fecha_Entrega_Real)||'—'}</td>
                    <td class="right mono">${r.Lead_Time_Días||'—'}</td>
                    <td class="right mono">${formatCurrency(r.Costo_Total)}</td>
                    <td class="center">${status}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    else if (activeTab === 'ranking') {
      el.innerHTML = `
        <div class="section-card">
          <div class="section-card-header">
            <div class="section-card-title">${'🏆 '+(i18n.getLang()==='es'?'Ranking de proveedores':'Supplier ranking')}</div>
          </div>
          <div class="table-scroll-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>${i18n.t('supplierName')}</th>
                  <th>${i18n.t('supplierCountry')}</th>
                  <th class="right">${i18n.t('supplierTotalSpend')}</th>
                  <th class="right">${i18n.t('supplierConcentration')}</th>
                  <th class="right">${i18n.t('supplierLeadTime')}</th>
                  <th class="right">${i18n.t('supplierOnTimeDelivery')}</th>
                  <th class="center">${i18n.t('supplierRisk')}</th>
                </tr>
              </thead>
              <tbody>
                ${data.supplierList.map((s,i) => `
                  <tr>
                    <td style="color:var(--color-text-faint);font-size:.8rem">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
                    <td style="font-weight:600">${sanitize(s.name)}</td>
                    <td style="font-size:.8rem;color:var(--color-text-muted)">${s.pais||'—'}</td>
                    <td class="right mono">${formatCurrency(s.spend)}</td>
                    <td class="right">
                      <div class="table-bar-wrap">
                        <div class="table-bar"><div class="table-bar-fill supplier-risk-fill ${s.risk}" style="width:${s.concPct}%"></div></div>
                        <span style="font-size:.78rem;font-family:var(--font-mono);min-width:36px">${s.concPct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td class="right mono">${s.avgLT ? s.avgLT.toFixed(0)+' d' : '—'}</td>
                    <td class="right mono">${s.otd !== null ? formatPct(s.otd) : '—'}</td>
                    <td class="center">
                      <span class="badge ${s.risk==='high'?'badge-red':s.risk==='medium'?'badge-yellow':'badge-green'}">
                        ${{high:'⚠️ Alto',medium:'⚡ Medio',low:'✅ Bajo'}[s.risk]}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }

  function _renderAlerts(data) {
    const alerts = [];
    data.supplierList.filter(s => s.risk === 'high').forEach(s => {
      alerts.push({ type:'red', icon:'⚠️', title: `Dependencia alta: ${sanitize(s.name)}`,
        desc: `${s.concPct.toFixed(1)}% del gasto total — ${i18n.t('supplierActionConc')}` });
    });
    if (data.overdue.length > 0) {
      alerts.push({ type:'red', icon:'🚨', title: `${data.overdue.length} ${i18n.getLang()==='es'?'orden(es) de compra vencidas':'overdue purchase order(s)'}`,
        desc: i18n.t('supplierActionOverdue') });
    }
    if (!alerts.length) return '';
    return `<div style="margin-bottom:var(--space-5)">${alerts.map(a => `
      <div class="alert-banner ${a.type}" onclick="suppliersModule._setTab('orders')">
        <span class="alert-banner-icon">${a.icon}</span>
        <div class="alert-banner-body">
          <div class="alert-banner-title">${a.title}</div>
          <div class="alert-banner-desc">${a.desc}</div>
        </div>
        <span style="color:var(--color-text-faint);font-size:.8rem">Ver →</span>
      </div>`).join('')}</div>`;
  }

  function _kpiCard(label, value, status, icon) {
    const colors = { green:getStatusColor('green'), yellow:getStatusColor('yellow'), red:getStatusColor('red'), na:'#4a5568' };
    const color  = colors[status] || colors.na;
    return `
      <div class="kpi-card status-${status}">
        <div class="kpi-card-label"><span class="status-dot ${status}"></span>${label}</div>
        <div class="kpi-card-value" style="color:${color}">${value}</div>
      </div>`;
  }

  function _emptyState() {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">🏭</div>
        <div class="empty-state-title">${i18n.t('suppliersTitle')}</div>
        <div class="empty-state-desc">Sube tu Excel de proveedores para ver órdenes de compra, lead times y concentración.</div>
        <div class="empty-state-action" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn-primary" onclick="showModal('uploadModal')">📂 Subir datos</button>
          <button class="btn btn-secondary" onclick="excelProcessor.downloadTemplate('suppliers')">📥 Descargar plantilla</button>
        </div>
      </div>`;
  }

  return { render, _setTab };
})();

function renderSuppliers(container) { suppliersModule.render(container); }

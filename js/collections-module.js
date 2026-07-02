// ════════════════════════════════════════════════════════════════
// CLAROKPIS — collections-module.js
// Módulo Cobranzas y Cuentas por Cobrar
// Solo visible para rol Dueño (ownerOnly)
// ════════════════════════════════════════════════════════════════

const collectionsModule = (() => {
  let _activeTab = 'resumen';

  function render(container) {
    const rows   = storage.getData('collections');
    const config = storage.getConfig();
    const sym    = config.currencySymbol || '$';
    const hasData = rows && rows.length > 0;

    container.innerHTML = `
      <div class="module-header">
        <div class="module-title-wrap">
          <h1 class="module-title">💳 ${i18n.t('collTitle')}</h1>
          <p class="module-subtitle">${hasData ? rows.length.toLocaleString()+' '+i18n.t('collTotalFacturas')+((() => {
              const _dr = storage.getDataDateRange('collections');
              if (_dr) return ' · ' + (i18n.getLang()==='es' ? 'Datos: ' : 'Data: ') + _dr.label;
              // Fallback: Fecha_Vencimiento si no hay columna Fecha
              const _fv = rows.map(r => storage.parseDate(r.Fecha_Vencimiento)).filter(d => d && !isNaN(d));
              if (!_fv.length) return '';
              _fv.sort((a,b) => a-b);
              const _fmt = d => d.toLocaleDateString(i18n.getLang()==='es'?'es-CL':'en-US',{day:'numeric',month:'short',year:'numeric'});
              return ' · ' + (i18n.getLang()==='es' ? 'Vence: ' : 'Due: ') + _fmt(_fv[0]) + ' – ' + _fmt(_fv[_fv.length-1]);
            })()) : i18n.t('collSubtitle')}</p>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button>
      </div>

      ${hasData ? `
        <div class="tabs" id="collTabs">
          ${['resumen','aging','cartera','evolucion'].map((t,i) => `
            <div class="tab-item ${_activeTab===t?'active':''}" onclick="collectionsModule.setTab('${t}')">
              ${[i18n.t('collTabResumen'),i18n.t('collTabAging'),i18n.t('collTabCartera'),i18n.t('collTabEvolucion')][i]}
            </div>`).join('')}
        </div>
        ${_renderTab(rows, sym)}
      ` : _renderNoData()}
    `;

    if (hasData) {
      setTimeout(() => _renderCharts(rows, sym), 50);
    } else {
      // Si IDB está cargando, re-renderizar cuando lleguen los datos
      const _onDataReady = (e) => {
        if (e.detail?.module === 'collections') {
          document.removeEventListener('clarokpis:dataUpdated', _onDataReady);
          if (app && app.currentModule === 'collections') {
            collectionsModule.render(container);
          }
        }
      };
      document.addEventListener('clarokpis:dataUpdated', _onDataReady);
    }
  }

  function _renderTab(rows, sym) {
    if (_activeTab === 'resumen')   return _renderResumen(rows, sym);
    if (_activeTab === 'aging')     return _renderAging(rows, sym);
    if (_activeTab === 'cartera')   return _renderCartera(rows, sym);
    if (_activeTab === 'evolucion') return _renderEvolucion(rows, sym);
    return '';
  }

  // ── KPI CALC ─────────────────────────────────────────────────
  function _calcKPIs(rows) {
    const activas   = rows.filter(r => r.Estado !== 'Pagada');
    const totalCxC  = activas.reduce((s,r) => s+(parseFloat(r.Monto_Pendiente)||0), 0);
    const alDia     = activas.filter(r => r.Dias_Vencida === 0 || !r.Dias_Vencida).reduce((s,r) => s+(parseFloat(r.Monto_Pendiente)||0), 0);
    const vencida   = activas.filter(r => (parseFloat(r.Dias_Vencida)||0) > 0).reduce((s,r) => s+(parseFloat(r.Monto_Pendiente)||0), 0);
    const critica   = activas.filter(r => r.Tramo === '+90').reduce((s,r) => s+(parseFloat(r.Monto_Pendiente)||0), 0);
    const riesgo60  = activas.filter(r => (parseFloat(r.Dias_Vencida)||0) > 60).reduce((s,r) => s+(parseFloat(r.Monto_Pendiente)||0), 0);
    const pctRiesgo = totalCxC > 0 ? (riesgo60/totalCxC*100) : 0;
    const pctVencida = totalCxC > 0 ? (vencida/totalCxC*100) : 0;

    // DSO aproximado: CxC / (ventas últimos 90d / 90)
    const ventas90 = storage.getData('sales')
      .filter(r => { const d = storage.parseDate(r.Fecha); if(!d) return false;
        const ago90 = new Date(); ago90.setDate(ago90.getDate()-90);
        return d >= ago90; })
      .reduce((s,r) => s+(parseFloat(r.Ventas_Monto)||0), 0);
    const dso = ventas90 > 0 ? Math.round((totalCxC / ventas90) * 90) : null;

    // Concentración top 3
    const byClient = {};
    activas.forEach(r => { byClient[r.Cliente_ID] = (byClient[r.Cliente_ID]||0) + (parseFloat(r.Monto_Pendiente)||0); });
    const sorted = Object.values(byClient).sort((a,b)=>b-a);
    const top3   = sorted.slice(0,3).reduce((s,v)=>s+v,0);
    const conc   = totalCxC > 0 ? (top3/totalCxC*100) : 0;

    // Aging por tramo
    const aging = {'0-30':0,'31-60':0,'61-90':0,'+90':0};
    activas.forEach(r => { const t = r.Tramo||'0-30'; if (aging[t]!==undefined) aging[t] += parseFloat(r.Monto_Pendiente)||0; });

    return { totalCxC, alDia, vencida, critica, riesgo60, pctRiesgo, pctVencida, dso, conc, aging, activas };
  }

  // ── RESUMEN ──────────────────────────────────────────────────
  function _renderResumen(rows, sym) {
    const k = _calcKPIs(rows);
    const dsoStatus = k.dso === null ? 'blue' : k.dso <= 30 ? 'green' : k.dso <= 45 ? 'yellow' : 'red';
    const riesgoStatus = k.pctRiesgo < 15 ? 'green' : k.pctRiesgo < 30 ? 'yellow' : 'red';
    const concStatus = k.conc < 40 ? 'green' : k.conc < 60 ? 'yellow' : 'red';

    // Insight principal
    const insight = k.pctVencida < 20
      ? `<div class="card" style="background:var(--color-green-bg);border-color:var(--color-green-border);">✅ ${i18n.t('collInsightSano')}</div>`
      : `<div class="card" style="background:var(--color-red-bg);border-color:var(--color-red-border);">⚠️ ${i18n.t('collInsightRiesgo').replace('{pct}', k.pctVencida.toFixed(1))}</div>`;

    return `
      ${insight}
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(185px,1fr));margin:16px 0;">
        ${_kpi('💳', i18n.t('collTotalCxC'),     _fmt(k.totalCxC,sym), 'blue',   k.activas.length+' '+i18n.t('collTotalFacturas'), null, null, true)}
        ${_kpi('🟢', i18n.t('collCxCAlDia'),     _fmt(k.alDia,sym),   'green',  (k.totalCxC>0?(k.alDia/k.totalCxC*100).toFixed(1):0)+'%', null, null)}
        ${_kpi('🔴', i18n.t('collCxCVencida'),   _fmt(k.vencida,sym), k.pctVencida>20?'red':'yellow', k.pctVencida.toFixed(1)+'% del total', null, null)}
        ${_kpi('📅', i18n.t('collDSO'),          k.dso !== null ? k.dso+'d' : '—', dsoStatus, i18n.getLang()==='es'?'meta: ≤30 días':'target: ≤30 days', null, null)}
        ${_kpi('⚠️', i18n.t('collPctRiesgo'),    k.pctRiesgo.toFixed(1)+'%', riesgoStatus, i18n.getLang()==='es'?'deuda >60 días':'debt >60 days', null, null)}
        ${_kpi('🏦', i18n.t('collConcentracion'), k.conc.toFixed(1)+'%', concStatus, i18n.getLang()==='es'?'top 3 clientes':'top 3 clients', null, null)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;" class="charts-row">
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">⏱️ ${i18n.t('collTabAging')}</div></div>
          <div class="chart-container" style="height:220px;"><canvas id="agingDonut"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">📊 ${i18n.getLang()==='es'?'Distribución por tramo':'Distribution by aging band'}</div></div>
          <div style="padding:8px 0;">
            ${[
              {t:'0-30', k:'0-30',  color:'green'},
              {t:'31-60',k:'31-60', color:'yellow'},
              {t:'61-90',k:'61-90', color:'orange'},
              {t:'+90',  k:'+90',   color:'red'},
            ].map(tr => {
              const monto = k.aging[tr.k] || 0;
              const pct = k.totalCxC > 0 ? monto/k.totalCxC*100 : 0;
              const label = {
                '0-30': i18n.t('collTramo0'), '31-60': i18n.t('collTramo31'),
                '61-90': i18n.t('collTramo61'), '+90': i18n.t('collTramo90')
              }[tr.k];
              return `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                  <div style="width:90px;font-size:.75rem;color:var(--color-text-muted);flex-shrink:0;">${label}</div>
                  <div style="flex:1;background:var(--color-bg);border-radius:4px;height:18px;overflow:hidden;">
                    <div style="width:${pct.toFixed(1)}%;height:100%;background:var(--color-${tr.color === 'orange' ? 'red' : tr.color});opacity:.7;border-radius:4px;transition:width .4s;"></div>
                  </div>
                  <div style="width:80px;text-align:right;font-size:.75rem;font-family:var(--font-mono);color:var(--color-text);">${_fmtShort(monto,sym)}</div>
                  <div style="width:40px;text-align:right;font-size:.7rem;color:var(--color-text-faint);">${pct.toFixed(0)}%</div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>
      <div style="font-size:.7rem;color:var(--color-text-faint);margin-top:8px;">ℹ️ ${i18n.t('collMetodologia')}</div>
    `;
  }

  // ── AGING DETAIL ─────────────────────────────────────────────
  function _renderAging(rows, sym) {
    const activas = rows.filter(r => r.Estado !== 'Pagada');
    const tramos = ['0-30','31-60','61-90','+90'];
    const labels  = [i18n.t('collTramo0'),i18n.t('collTramo31'),i18n.t('collTramo61'),i18n.t('collTramo90')];
    const colors  = ['green','yellow','red','red'];

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px;">
        ${tramos.map((t,i) => {
          const group = activas.filter(r => r.Tramo === t);
          const monto = group.reduce((s,r)=>s+(parseFloat(r.Monto_Pendiente)||0),0);
          return _kpi(['🟢','🟡','🔴','💀'][i], labels[i], _fmt(monto,sym), colors[i], group.length+' '+(i18n.getLang()==='es'?'facturas':'invoices'), null, null);
        }).join('')}
      </div>

      ${tramos.map((t,i) => {
        const group = activas.filter(r => r.Tramo === t);
        if (!group.length) return '';
        return `
          <div class="chart-card" style="margin-bottom:16px;">
            <div class="chart-card-header">
              <div class="chart-card-title">${['🟢','🟡','🔴','💀'][i]} ${labels[i]}</div>
              <span class="badge badge-${colors[i]}">${_fmt(group.reduce((s,r)=>s+(parseFloat(r.Monto_Pendiente)||0),0),sym)}</span>
            </div>
            <div class="table-wrapper">
              <table class="table">
                <thead><tr>
                  <th>${i18n.t('collColFactura')}</th>
                  <th>${i18n.t('collColCliente')}</th>
                  <th>${i18n.t('collColVencimiento')}</th>
                  <th class="number">${i18n.t('collColMontoPendiente')}</th>
                  <th class="number">${i18n.t('collColDias')}</th>
                </tr></thead>
                <tbody>
                  ${group.sort((a,b)=>(parseFloat(b.Dias_Vencida)||0)-(parseFloat(a.Dias_Vencida)||0)).map(r => `
                    <tr>
                      <td style="font-size:.78rem;font-family:var(--font-mono);color:var(--color-text-muted)">${r.Factura_ID}</td>
                      <td style="font-weight:600;color:var(--color-text)">${sanitize(r.Nombre_Cliente||r.Cliente_ID)}</td>
                      <td style="font-size:.78rem;color:var(--color-text-muted)">${storage.formatDate(r.Fecha_Vencimiento,'medium')}</td>
                      <td class="number" style="font-weight:700;color:var(--color-${colors[i]})">${_fmt(parseFloat(r.Monto_Pendiente)||0,sym)}</td>
                      <td class="number">${parseFloat(r.Dias_Vencida)||0 > 0 ? `<span class="badge badge-${colors[i]}">${Math.round(parseFloat(r.Dias_Vencida))}d</span>` : '—'}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>`;
      }).join('')}
    `;
  }

  // ── CARTERA POR CLIENTE ───────────────────────────────────────
  function _renderCartera(rows, sym) {
    const activas  = rows.filter(r => r.Estado !== 'Pagada');
    const byClient = {};
    activas.forEach(r => {
      const id = r.Cliente_ID;
      if (!byClient[id]) byClient[id] = { id, nombre:r.Nombre_Cliente||id, monto:0, maxDias:0, facturas:0, tramo:r.Tramo };
      byClient[id].monto   += parseFloat(r.Monto_Pendiente)||0;
      byClient[id].maxDias  = Math.max(byClient[id].maxDias, parseFloat(r.Dias_Vencida)||0);
      byClient[id].facturas++;
      // peor tramo
      const order = {'0-30':0,'31-60':1,'61-90':2,'+90':3};
      if ((order[r.Tramo]||0) > (order[byClient[id].tramo]||0)) byClient[id].tramo = r.Tramo;
    });

    const sorted = Object.values(byClient).sort((a,b)=>b.monto-a.monto);
    const totalCxC = sorted.reduce((s,c)=>s+c.monto,0);
    const tramoColor = {'0-30':'green','31-60':'yellow','61-90':'red','+90':'red'};

    return `
      <div class="chart-card">
        <div class="chart-card-header"><div class="chart-card-title">👤 ${i18n.t('collTabCartera')}</div></div>
        <div class="table-wrapper">
          <table class="table">
            <thead><tr>
              <th>${i18n.t('collColCliente')}</th>
              <th class="number">${i18n.t('collColMontoPendiente')}</th>
              <th class="number">% total</th>
              <th>${i18n.getLang()==='es'?'Facturas':'Invoices'}</th>
              <th>${i18n.getLang()==='es'?'Peor tramo':'Worst band'}</th>
              <th>${i18n.getLang()==='es'?'Días max':'Max days'}</th>
              <th></th>
            </tr></thead>
            <tbody>
              ${sorted.map(c => {
                const pct = totalCxC > 0 ? c.monto/totalCxC*100 : 0;
                const color = tramoColor[c.tramo] || 'blue';
                return `<tr>
                  <td style="font-weight:600;color:var(--color-text)">${sanitize(c.nombre)}</td>
                  <td class="number" style="font-weight:700;font-family:var(--font-mono)">${_fmt(c.monto,sym)}</td>
                  <td class="number">
                    <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">
                      <div class="progress-bar-wrap" style="width:50px;"><div class="progress-bar-fill ${color}" style="width:${pct.toFixed(0)}%;"></div></div>
                      <span style="font-size:.73rem;color:var(--color-text-faint)">${pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style="font-size:.78rem;color:var(--color-text-muted)">${c.facturas}</td>
                  <td><span class="badge badge-${color}">${{'0-30':i18n.t('collTramo0'),'31-60':i18n.t('collTramo31'),'61-90':i18n.t('collTramo61'),'+90':i18n.t('collTramo90')}[c.tramo]||c.tramo}</span></td>
                  <td class="number" style="color:var(--color-${color});font-weight:600">${c.maxDias > 0 ? Math.round(c.maxDias)+'d' : '—'}</td>
                  <td><button class="btn btn-ghost btn-sm" style="font-size:.72rem;padding:2px 8px;" onclick="navigateTo('clients')">${i18n.t('collVerCliente')}</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── EVOLUCIÓN ────────────────────────────────────────────────
  function _renderEvolucion(rows, sym) {
    return `
      <div class="chart-card">
        <div class="chart-card-header"><div class="chart-card-title">📈 ${i18n.getLang()==='es'?'CxC vs Ingresos — últimos 6 meses':'A/R vs Revenue — last 6 months'}</div></div>
        <div class="chart-container" style="height:280px;"><canvas id="collTrendChart"></canvas></div>
      </div>
      <div style="font-size:.7rem;color:var(--color-text-faint);margin-top:8px;">ℹ️ ${i18n.t('collMetodologia')}</div>
    `;
  }

  // ── NO DATA ──────────────────────────────────────────────────
  function _renderNoData() {
    return `
      <div class="no-data-state">
        <div class="no-data-icon">💳</div>
        <h2 class="no-data-title">${i18n.t('collNoData')}</h2>
        <p class="no-data-desc">${i18n.t('collNoDataDesc')}</p>
        <button class="btn btn-primary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button>
      </div>
    `;
  }

  // ── CHARTS ───────────────────────────────────────────────────
  function _renderCharts(rows, sym) {
    const k = _calcKPIs(rows);
    const COLORS = ['#22c55e','#eab308','#f97316','#ef4444'];

    if (_activeTab === 'resumen') {
      _mkChart('agingDonut', {
        type: 'doughnut',
        data: {
          labels: [i18n.t('collTramo0'),i18n.t('collTramo31'),i18n.t('collTramo61'),i18n.t('collTramo90')],
          datasets: [{ data: [k.aging['0-30'],k.aging['31-60'],k.aging['61-90'],k.aging['+90']],
            backgroundColor: COLORS.map(c=>c+'cc'), borderColor: COLORS, borderWidth:1.5, hoverOffset:5 }]
        },
        options: { responsive:true, maintainAspectRatio:false, cutout:'65%',
          plugins:{ legend:{ labels:{color:'#94a3b8',font:{size:11},boxWidth:10,padding:12}}},
          scales:{x:{display:false},y:{display:false}} }
      });
    }

    if (_activeTab === 'evolucion') {
      // Usar datos de finanzas para la tendencia
      const finRows = storage.getData('finance');
      const sorted = finRows.sort((a,b)=>a.Fecha.localeCompare(b.Fecha)).slice(-6);
      if (sorted.length) {
        const BASE = { responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ labels:{color:'#94a3b8',font:{size:11},boxWidth:10,padding:12}},
            tooltip:{backgroundColor:'#1e293b',borderColor:'#334155',borderWidth:1,titleColor:'#94a3b8',bodyColor:'#f1f5f9',padding:8,cornerRadius:6}},
          scales:{ x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11}},border:{display:false}},
                   y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11},callback:(v)=>_fmtShort(v,sym)},border:{display:false}} } };
        _mkChart('collTrendChart', {
          type: 'line',
          data: {
            labels: sorted.map(r => r.Periodo || r.Fecha.slice(0,7)),
            datasets: [
              { label: i18n.t('collTotalCxC'), data: sorted.map(r=>parseFloat(r.Cuentas_Por_Cobrar)||0),
                borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,.08)', borderWidth:2.5, pointRadius:4, pointHoverRadius:6, tension:.4, fill:true },
              { label: i18n.getLang()==='es'?'Ingresos':'Revenue', data: sorted.map(r=>parseFloat(r.Ingresos)||0),
                borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,.05)', borderWidth:2, pointRadius:4, pointHoverRadius:6, tension:.4, fill:false },
            ]
          },
          options: { ...BASE }
        });
      }
    }
  }

  function _mkChart(id, config) {
    const el = document.getElementById(id); if (!el) return;
    if (window._ckCharts && window._ckCharts[id]) window._ckCharts[id].destroy();
    if (!window._ckCharts) window._ckCharts = {};
    window._ckCharts[id] = new Chart(el, config);
  }

  // ── HELPERS ──────────────────────────────────────────────────
  function _kpi(icon, label, value, status, sub, pct, pctStatus, hero) {
    const heroClass = hero ? ' kpi-hero' : '';
    const ghost     = hero ? ` data-ghost="${String(value).replace(/[^0-9.,KMB%x]/g,'').slice(0,5)}"` : '';
    return `<div class="kpi-card ${status}${heroClass}"${ghost}>
      <div class="kpi-card-header"><div class="kpi-card-icon">${icon}</div><div class="kpi-status-dot ${status}"></div></div>
      <div class="kpi-card-value">${value}</div>
      <div class="kpi-card-label">${label}</div>
      ${sub?`<div style="font-size:.72rem;color:var(--color-text-faint);margin-top:3px">${sub}</div>`:''}
      ${pct!==null&&pct!==undefined?`<div class="kpi-card-progress" style="margin-top:8px"><div class="progress-bar-wrap"><div class="progress-bar-fill ${pctStatus||status}" style="width:${Math.min(pct,100)}%"></div></div></div>`:''}
    </div>`;
  }

  function _fmt(n, sym='$') {
    if (!n && n !== 0) return `${sym}—`;
    if (n >= 1e9) return `${sym}${(n/1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${sym}${(n/1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${sym}${(n/1e3).toFixed(0)}K`;
    return `${sym}${Math.round(n).toLocaleString()}`;
  }

  function _fmtShort(n, sym='$') { return _fmt(n, sym); }

  function setTab(tab) {
    _activeTab = tab;
    if (window._ckCharts) { Object.values(window._ckCharts).forEach(c=>c&&c.destroy()); window._ckCharts={}; }
    render(document.getElementById('contentArea'));
  }

  // ── EXPORT API ───────────────────────────────────────────────
  // Helper público para clients-module: obtener deuda vencida por cliente
  function getOverdueByClient() {
    const rows = storage.getData('collections') || [];
    const result = {};
    rows.filter(r => (parseFloat(r.Dias_Vencida)||0) > 60)
        .forEach(r => {
          const id = r.Cliente_ID;
          if (!result[id]) result[id] = { monto:0, maxDias:0 };
          result[id].monto   += parseFloat(r.Monto_Pendiente)||0;
          result[id].maxDias  = Math.max(result[id].maxDias, parseFloat(r.Dias_Vencida)||0);
        });
    return result;
  }

  return { render, setTab, getOverdueByClient };
})();

window.collectionsModule = collectionsModule;

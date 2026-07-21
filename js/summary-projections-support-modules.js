/**
 * Zhoras One — summary-projections-support-modules.js
 * Fase 5: Resumen Ejecutivo, Proyecciones y Atención al Cliente.
 */

// ════════════════════════════════════════════════════════════════
// MÓDULO RESUMEN EJECUTIVO
// ════════════════════════════════════════════════════════════════
const summaryModule = (() => {

  function render(container) {
    const config   = storage.getConfig();
    const sym      = config.currencySymbol || '$';
    const goals    = storage.getGoals();
    // Resumen Ejecutivo tiene su propio filtro de período independiente ('summary')
    const salesData    = storage.applyFilters(storage.getData('sales'),     'summary');
    const clientData   = storage.applyFilters(storage.getData('clients'),   'summary');
    const inventData   = storage.applyFilters(storage.getData('inventory'), 'summary');
    // Finanzas: si el filtro deja sin datos, usar todos para que Resultado Neto siempre aparezca
    const financeData  = (() => {
      const filtered = storage.applyFilters(storage.getData('finance'), 'summary');
      return filtered.length > 0 ? filtered : storage.getData('finance');
    })();
    const alerts       = storage.getActiveAlerts();
    const files        = storage.getFiles();
    const hasAnyData   = storage.hasData();

    // Calcular todos los KPIs resumidos
    const summary = buildSummary(salesData, clientData, inventData, financeData, goals, sym);

    container.innerHTML = `
      <div class="module-header">
        <div class="module-title-wrap">
          <h1 class="module-title">📋 ${i18n.t('summaryTitle')}</h1>
          <p class="module-subtitle">${i18n.t('summaryGenerated')} ${(() => { const _dr = storage.getDataDateRange('sales'); return _dr ? _dr.label : new Date().toLocaleDateString(i18n.getLang()==='es'?'es-CL':'en-US',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); })()}</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-sm btn-secondary" onclick="window.print()">🖨️ Imprimir</button>
          <button class="btn btn-sm btn-primary"   onclick="exportPDF()">📄 Exportar PDF</button>
        </div>
      </div>

      ${renderGlobalFilters('summary', { showSeller: true, showChannel: true, showBranch: true })}

      ${!hasAnyData ? renderNoDataSummary() : renderFullSummary(summary, alerts, goals, sym, files)}
    `;
  }

  function renderNoDataSummary() {
    return `
      <div class="no-data-state">
        <div class="no-data-icon">📋</div>
        <h2 class="no-data-title">${i18n.getLang()==='es'?'Sin datos para resumir':'No data to summarize'}</h2>
        <p class="no-data-desc">${i18n.getLang()==='es'?'Sube al menos un archivo Excel para generar el resumen ejecutivo automático.':'Upload at least one Excel file to generate the automatic executive summary.'}</p>
        <button class="btn btn-primary" onclick="showModal('uploadModal')">📂 Subir datos</button>
      </div>`;
  }

  function renderFullSummary(s, alerts, goals, sym, files) {
    const dateRange = files.length ? getDateRange(files) : (i18n.getLang()==='es'?'Sin datos de período':'No data for period');
    return `
      <!-- ENCABEZADO EJECUTIVO -->
      <div class="card" style="background:linear-gradient(135deg,rgba(59,130,246,.1),rgba(99,102,241,.08));border-color:rgba(59,130,246,.25);margin-bottom:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--color-text);margin-bottom:4px;">${i18n.getLang()==='es'?'Resumen Ejecutivo':'Executive Summary'} — Zhoras One</div>
            <div style="font-size:.82rem;color:var(--color-text-muted);">${i18n.getLang()==='es'?'Período analizado':'Analyzed period'}: <strong>${dateRange}</strong></div>
          </div>
          <div style="display:flex;gap:12px;align-items:center;">
            <div style="text-align:center;">
              <div style="font-size:2rem;font-weight:800;font-family:var(--font-mono);color:${getHealthColor(s.healthScore)}">${s.healthScore}</div>
              <div style="font-size:.68rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em;">${i18n.getLang()==='es'?'Salud del negocio':'Business health'}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3 BLOQUES: BIEN / ATENCIÓN / URGENTE -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:20px;">

        <!-- Va bien -->
        <div class="card" style="border-color:var(--color-green-border);background:var(--color-green-bg);">
          <div style="font-size:.9rem;font-weight:700;color:var(--color-green);margin-bottom:14px;">✅ ${i18n.t('summaryGoingWell')}</div>
          ${s.goingWell.length
            ? s.goingWell.map(item=>`
              <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
                <span style="color:var(--color-green);flex-shrink:0">▲</span>
                <div>
                  <div style="font-size:.83rem;font-weight:600;color:var(--color-text)">${item.title}</div>
                  <div style="font-size:.75rem;color:var(--color-text-muted)">${item.detail}</div>
                </div>
              </div>`).join('')
            : `<div style="font-size:.82rem;color:var(--color-text-muted)">${i18n.getLang()==='es'?'Sube más datos para identificar puntos fuertes.':'Upload more data to identify strengths.'}</div>`}
        </div>

        <!-- Necesita atención -->
        <div class="card" style="border-color:var(--color-yellow-border);background:var(--color-yellow-bg);">
          <div style="font-size:.9rem;font-weight:700;color:var(--color-yellow);margin-bottom:14px;">⚠️ ${i18n.t('summaryNeedsAttention')}</div>
          ${s.needsAttention.length
            ? s.needsAttention.map(item=>`
              <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
                <span style="color:var(--color-yellow);flex-shrink:0">●</span>
                <div>
                  <div style="font-size:.83rem;font-weight:600;color:var(--color-text)">${item.title}</div>
                  <div style="font-size:.75rem;color:var(--color-text-muted)">${item.detail}</div>
                </div>
              </div>`).join('')
            : `<div style="font-size:.82rem;color:var(--color-text-muted)">${i18n.getLang()==='es'?'Sin alertas en esta categoría.':'No alerts in this category.'}</div>`}
        </div>

        <!-- Acción urgente -->
        <div class="card" style="border-color:var(--color-red-border);background:var(--color-red-bg);">
          <div style="font-size:.9rem;font-weight:700;color:var(--color-red);margin-bottom:14px;">🚨 ${i18n.t('summaryUrgentAction')}</div>
          ${s.urgent.length
            ? s.urgent.map(item=>`
              <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
                <span style="color:var(--color-red);flex-shrink:0">!</span>
                <div>
                  <div style="font-size:.83rem;font-weight:600;color:var(--color-text)">${item.title}</div>
                  <div style="font-size:.75rem;color:var(--color-text-muted)">${item.detail}</div>
                </div>
              </div>`).join('')
            : `<div style="font-size:.82rem;color:var(--color-text-muted)">${i18n.getLang()==='es'?'Sin acciones urgentes. 🎉':'No urgent actions. 🎉'}</div>`}
        </div>
      </div>

      <!-- KPIs SNAPSHOT -->
      <div style="font-size:.85rem;font-weight:700;color:var(--color-text);margin-bottom:12px;">${i18n.getLang()==='es'?'📊 Snapshot de KPIs principales':'📊 Key KPI Snapshot'}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;">
        ${s.kpiSnapshot.map(k => `
          <div class="card card-sm" style="text-align:center;border-color:${getBorderColor(k.status)};">
            <div style="font-size:.7rem;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">${k.label}</div>
            <div style="font-size:1.3rem;font-weight:800;font-family:var(--font-mono);color:${getStatusColor(k.status)}">${k.value}</div>
            ${k.vs ? `<div style="font-size:.68rem;color:var(--color-text-muted);margin-top:3px">${k.vs}</div>` : ''}
            <div class="dot ${k.status}" style="margin:6px auto 0;"></div>
          </div>`).join('')}
      </div>

      <!-- ALERTAS ACTIVAS -->
      ${alerts.length > 0 ? `
        <div style="font-size:.85rem;font-weight:700;color:var(--color-text);margin-bottom:12px;">${i18n.getLang()==='es'?'🚨 Alertas activas (':'🚨 Active alerts ('}<${alerts.length})</div>
        ${alerts.slice(0,8).map(a => `
          <div class="alert-item ${a.type==='critical'?'critical':''}" style="margin-bottom:8px;">
            <span class="alert-icon">${a.type==='critical'?'🔴':'🟡'}</span>
            <div class="alert-body">
              <div class="alert-msg">${storage.getAlertMessage(a)}</div>
              <div class="alert-meta">${i18n.t('module'+a.module.charAt(0).toUpperCase()+a.module.slice(1))||a.module} · ${storage.formatDate(a.createdAt,'medium')}</div>
            </div>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="resolveAlertUI('${a.id}')">✓</button>
          </div>`).join('')}
      ` : ''}

      <!-- PROYECCIÓN DEL MES -->
      <div class="card" style="margin-top:8px;">
        <div style="font-size:.85rem;font-weight:700;color:var(--color-text);margin-bottom:14px;">📈 ${i18n.t('summaryMonthProjection')}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
          ${s.monthProjection.map(p => `
            <div style="text-align:center;padding:10px;background:var(--color-bg);border-radius:8px;">
              <div style="font-size:.7rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${p.label}</div>
              <div style="font-size:1.1rem;font-weight:800;font-family:var(--font-mono);color:${getStatusColor(p.status)}">${p.value}</div>
            </div>`).join('')}
        </div>
      </div>
    `;
  }

  // ── LÓGICA DEL RESUMEN ────────────────────────────────────────
  function buildSummary(salesData, clientData, inventData, financeData, goals, sym) {
    const goingWell = [], needsAttention = [], urgent = [];

    // Ventas
    const totalSales = salesData.reduce((s,r)=>s+(parseFloat(r.Ventas_Monto)||0),0);
    const totalMeta  = salesData.reduce((s,r)=>s+(parseFloat(r.Meta_Ventas)||0),0) || goals.sales_monthly;
    const goalPct    = totalMeta > 0 ? (totalSales/totalMeta)*100 : null;

    if (goalPct !== null) {
      if (goalPct >= 100) goingWell.push({ title:'Ventas sobre meta', detail:`${goalPct.toFixed(0)}% — ${fmt(totalSales,sym)} de ${fmt(totalMeta,sym)}` });
      else if (goalPct >= 80) needsAttention.push({ title:(i18n.getLang()==='es'?'Ventas cerca de meta':'Sales near target'), detail:`${goalPct.toFixed(0)}% — Faltan ${fmt(totalMeta-totalSales,sym)}` });
      else urgent.push({ title:i18n.t('summaryVentasBajoMeta'), detail:`${i18n.getLang()==='es'?'Solo':'Only'} ${goalPct.toFixed(0)}% — ${i18n.t('summaryRevisarVentas')}` });
    }

    // Clientes
    const totalClients = clientData.length;
    const atRisk = clientData.filter(r=>(parseFloat(r.Días_Sin_Compra)||0)>=60&&(parseFloat(r.Días_Sin_Compra)||0)<=180).length;
    if (atRisk > 0 && totalClients > 0) {
      const pct = (atRisk/totalClients*100).toFixed(0);
      if (pct > 20) urgent.push({ title:`${atRisk} ${i18n.t('summaryClientesRiesgo')}`, detail:`${pct}% ${i18n.t('summaryBaseInactiva')}` });
      else needsAttention.push({ title:`${atRisk} ${i18n.t('summaryClientesRiesgo')}`, detail:`${pct}% de la base sin actividad reciente` });
    }
    const npsRows = clientData.filter(r=>r.NPS!==''&&r.NPS!=null);
    if (npsRows.length) {
      const proms = npsRows.filter(r=>Number(r.NPS)>=9).length;
      const dets  = npsRows.filter(r=>Number(r.NPS)<=6).length;
      const nps   = ((proms-dets)/npsRows.length)*100;
      if (nps >= 50) goingWell.push({ title:'NPS excelente', detail:`Score: ${Math.round(nps)} — ${proms} promotores activos` });
      else if (nps < 0) urgent.push({ title:'NPS negativo', detail:`Score: ${Math.round(nps)} — ${i18n.t('sumNPSNeg')}` });
    }

    // Inventario
    const criticalInv = inventData.filter(r=>{
      const stock=(parseFloat(r.Stock_Inicial)||0); const sold=(parseFloat(r.Ventas_Unidades)||0);
      const daily=sold/30; return daily>0 && stock/daily < 7;
    });
    if (criticalInv.length > 0) urgent.push({ title:i18n.t('sumStockCritico').replace('{n}',criticalInv.length), detail:i18n.t('sumStockDias') });

    // Finanzas
    const totalIncome  = financeData.reduce((s,r)=>s+(parseFloat(r.Ingresos)||0),0);
    const totalCosts   = financeData.reduce((s,r)=>s+(parseFloat(r.Costos)||parseFloat(r.Gastos_Operacionales)||0),0);
    const netResult    = totalIncome - totalCosts;
    if (totalIncome > 0) {
      if (netResult > 0) goingWell.push({ title:i18n.t('summaryFinPos'), detail:`${i18n.t('utilidad')}: ${fmt(netResult,sym)} — ${i18n.t('margen')}: ${(netResult/totalIncome*100).toFixed(1)}%` });
      else if (netResult < 0) urgent.push({ title:'Resultado financiero negativo', detail:i18n.t('sumPerdida').replace('{amt}',fmt(Math.abs(netResult),sym)) });
    }

    // Si hay poco datos, agregar mensajes genéricos
    if (!goingWell.length && !needsAttention.length && !urgent.length) {
      needsAttention.push({ title:'Datos insuficientes', detail:i18n.t('sumSubirModulos') });
    }

    // Health score
    let healthScore = 50;
    if (goalPct !== null) healthScore = Math.round(goalPct * 0.4 + 50 * 0.6);
    healthScore = Math.max(0, Math.min(100, healthScore));

    // KPI Snapshot
    const kpiSnapshot = [
      { label:i18n.t('summarySecVentas')||'Sales', value: totalSales > 0 ? fmt(totalSales,sym) : '—', status: goalPct!==null?(goalPct>=100?'green':goalPct>=80?'yellow':'red'):'na', vs: goalPct!==null?`${goalPct.toFixed(0)}% meta`:null },
      { label:i18n.t('summaryClientesActivos'), value: totalClients > 0 ? totalClients.toLocaleString() : '—', status: 'blue', vs: atRisk > 0 ? `${atRisk} ${i18n.t('summaryEnRiesgo')}` : null },
      { label:i18n.t('summaryResultadoNeto'), value: totalIncome > 0 ? fmt(netResult,sym) : '—', status: netResult>0?'green':netResult<0?'red':'na', vs: totalIncome>0?`Margen: ${(netResult/totalIncome*100).toFixed(0)}%`:null },
      { label:i18n.t('summaryStockCritico'), value: criticalInv.length.toString(), status: criticalInv.length>0?'red':'green', vs: criticalInv.length>0?i18n.t('sumProductosDias'):null },
      { label:i18n.t('summaryAlertasActivas'), value: storage.getActiveAlerts().length.toString(), status: storage.getActiveAlerts().length>0?(storage.getActiveAlerts().some(a=>a.type==='critical')?'red':'yellow'):'green', vs: null },
    ];

    // Proyección del mes
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const dayOfMonth  = now.getDate();

    // Usar mes actual; si no hay ventas, usar último mes con datos
    let projYear = now.getFullYear(), projMonth = now.getMonth();
    let monthSales = salesData.filter(r=>{
      const d=storage.parseDate(r.Fecha);
      return d && d.getMonth()===projMonth && d.getFullYear()===projYear;
    }).reduce((s,r)=>s+(parseFloat(r.Ventas_Monto)||0),0);

    let projElapsed = dayOfMonth;
    let projDaysInMonth = daysInMonth;
    if (monthSales === 0 && salesData.length > 0) {
      const dates = salesData.map(r=>storage.parseDate(r.Fecha)).filter(Boolean).sort((a,b)=>b-a);
      if (dates.length) {
        const ld = dates[0];
        projYear = ld.getFullYear(); projMonth = ld.getMonth();
        projDaysInMonth = new Date(projYear, projMonth+1, 0).getDate();
        projElapsed = projDaysInMonth; // mes completo
        monthSales = salesData.filter(r=>{
          const d=storage.parseDate(r.Fecha);
          return d && d.getMonth()===projMonth && d.getFullYear()===projYear;
        }).reduce((s,r)=>s+(parseFloat(r.Ventas_Monto)||0),0);
      }
    }

    const config = storage.getConfig();
    const workTotal   = config.workingDaysThisMonth || projDaysInMonth;
    const workElapsed = (config.workingDaysElapsed > 0 ? config.workingDaysElapsed : null) || projElapsed;
    const projected = workElapsed > 0 ? (monthSales / workElapsed) * workTotal : 0;
    const monthProjection = [
      { label:i18n.t('summaryVentasHoy'), value: fmt(monthSales,sym), status: goalPct!==null?(goalPct>=80?'green':'yellow'):'blue' },
      { label:i18n.t('summaryProyFin'), value: projected>0?fmt(projected,sym):'—', status: goals.sales_monthly>0?(projected>=goals.sales_monthly?'green':'yellow'):'blue' },
      { label:(i18n.getLang()==='es'?'Días restantes':'Days remaining'), value: (daysInMonth-dayOfMonth).toString(), status:'blue' },
      { label:(i18n.getLang()==='es'?'% de meta':'% of target'), value: goals.sales_monthly>0?`${(projected/goals.sales_monthly*100).toFixed(0)}%`:'—', status: goals.sales_monthly>0?(projected>=goals.sales_monthly?'green':projected>=goals.sales_monthly*0.8?'yellow':'red'):'na' },
    ];

    return { goingWell, needsAttention, urgent, healthScore, kpiSnapshot, monthProjection };
  }

  function getDateRange(files) {
    const dates = files.flatMap(f => f.dateRange ? [f.dateRange.from, f.dateRange.to] : []).filter(Boolean);
    if (!dates.length) return i18n.t('currentPeriod');
    const sorted = dates.sort();
    return `${storage.formatDate(sorted[0],'medium')} — ${storage.formatDate(sorted[sorted.length-1],'medium')}`;
  }

  function getStatusColor(s){ return{green:'var(--color-green)',yellow:'var(--color-yellow)',red:'var(--color-red)',blue:'var(--color-blue)',na:'var(--color-text-faint)'}[s]||'var(--color-text-faint)'; }
  function getBorderColor(s){ return{green:'var(--color-green-border)',yellow:'var(--color-yellow-border)',red:'var(--color-red-border)',blue:'var(--color-blue-border)',na:'var(--color-border)'}[s]||'var(--color-border)'; }
  function getHealthColor(n){ return n>=80?'var(--color-green)':n>=60?'var(--color-yellow)':'var(--color-red)'; }
  function fmt(n,sym='$'){if(!n&&n!==0)return`${sym}—`;if(n>=1000000)return`${sym}${(n/1000000).toFixed(1)}M`;if(n>=1000)return`${sym}${(n/1000).toFixed(0)}K`;return`${sym}${Math.round(n).toLocaleString()}`;}

  return { render };
})();


// ════════════════════════════════════════════════════════════════
// MÓDULO PROYECCIONES
// ════════════════════════════════════════════════════════════════
const projectionsModule = (() => {

  function render(container) {
    const config  = storage.getConfig();
    const sym     = config.currencySymbol || '$';
    const goals   = storage.getGoals();
    const salesData   = storage.getData('sales');
    const clientData  = storage.getData('clients');
    const inventData  = storage.getData('inventory');
    const hasData     = storage.hasData();
    const data        = buildProjections(salesData, clientData, inventData, goals, sym);

    container.innerHTML = `
      <div class="module-header">
        <div class="module-title-wrap">
          <h1 class="module-title">📈 ${i18n.t('moduleProjections')}</h1>
          <p class="module-subtitle">${i18n.t('basadoTendencia')} · ${i18n.t('summaryConfianza')}: ${data.confidence}%</p>
        </div>
      </div>

      ${!hasData ? noData() : renderContent(data, goals, sym)}
    `;
    if (hasData) setTimeout(() => renderCharts(data, sym), 50);
  }

  function renderContent(data, goals, sym) {
    return `
      <!-- Cards de proyección -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
        ${projCard(('📅 30 '+i18n.t('projDias')), data.p30, goals.sales_monthly, sym, '#3b82f6', data.confidence)}
        ${projCard(('📆 60 '+i18n.t('projDias')), data.p60, goals.sales_monthly*2, sym, '#6366f1', Math.max(data.confidence-10,0))}
        ${projCard(('🗓️ 90 '+i18n.t('projDias')), data.p90, goals.sales_monthly*3, sym, '#a855f7', Math.max(data.confidence-20,0))}
      </div>

      <!-- Gráfico proyección de ventas -->
      <div class="chart-card" style="margin-bottom:16px;">
        <div class="chart-card-header">
          <div class="chart-card-title">${i18n.t('projHistFuturo')}</div>
          <span class="badge badge-blue">${i18n.t('summaryConfianza')}: ${data.confidence}%</span>
        </div>
        <div class="chart-container" style="height:280px;"><canvas id="projSalesChart"></canvas></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;" class="charts-row">
        <!-- Clientes ${i18n.t('summaryEnRiesgo')} -->
        <div class="card">
          <div style="font-size:.85rem;font-weight:700;margin-bottom:14px;">👥 ${i18n.t('projClientsAtRisk')}</div>
          <div style="font-size:2rem;font-weight:800;font-family:var(--font-mono);color:var(--color-${data.atRiskClients>0?'red':'green'});margin-bottom:4px;">${data.atRiskClients}</div>
          <div style="font-size:.78rem;color:var(--color-text-muted)">${i18n.t('projClientesInactivos')}</div>
          ${data.atRiskClients>0?`<div style="margin-top:10px;font-size:.75rem;color:var(--color-text-faint)">${'💡 '+i18n.t('projCampReact')}</div>`:''}
        </div>
        <!-- Probabilidad de meta -->
        <div class="card">
          <div style="font-size:.85rem;font-weight:700;margin-bottom:14px;">🎯 ${i18n.t('projGoalProbability')}</div>
          <div style="font-size:2rem;font-weight:800;font-family:var(--font-mono);color:${data.goalProb>=70?'var(--color-green)':data.goalProb>=40?'var(--color-yellow)':'var(--color-red)'};margin-bottom:4px;">${data.goalProb}%</div>
          <div class="progress-bar-wrap" style="height:8px;margin-top:10px;">
            <div class="progress-bar-fill ${data.goalProb>=70?'green':data.goalProb>=40?'yellow':'red'}" style="width:${data.goalProb}%"></div>
          </div>
          <div style="font-size:.75rem;color:var(--color-text-faint);margin-top:6px">${i18n.t('projProbabilidadMeta')}</div>
        </div>
      </div>

      <!-- Productos agotándose -->
      ${data.stockout.length > 0 ? `
        <div class="card" style="border-color:var(--color-yellow-border);background:var(--color-yellow-bg);">
          <div style="font-size:.85rem;font-weight:700;color:var(--color-yellow);margin-bottom:12px;">⚠️ ${i18n.t('projStockout')} (${data.stockout.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${data.stockout.slice(0,8).map(p=>`<span class="badge badge-yellow">${p.label} — ${p.days.toFixed(0)} ${i18n.t('finCycleDays')}</span>`).join('')}
          </div>
        </div>` : ''}

      <!-- Nota metodología -->
      <div class="card" style="margin-top:16px;background:var(--color-blue-bg);border-color:var(--color-blue-border);">
        <div style="font-size:.8rem;color:var(--color-text-muted);line-height:1.8;">
          <strong style="color:var(--color-blue)">${'ℹ️ '+i18n.t('projMetodologia')}</strong>
          ${i18n.getLang()==='es' ? i18n.t('sumTendenciaLineal').replace('{n}',data.monthsUsed)+' La confianza disminuye con menos datos históricos. Con 6+ meses la proyección es más precisa.' : i18n.t('sumTendenciaLineal').replace('{n}',data.monthsUsed)+' Confidence decreases with less data. With 6+ months the projection is more accurate.'}
        </div>
      </div>
    `;
  }

  function projCard(label, value, meta, sym, color, confidence) {
    const pct = meta > 0 ? Math.round(value/meta*100) : null;
    const status = pct!==null?(pct>=100?'green':pct>=80?'yellow':'red'):'blue';
    return `
      <div class="card" style="text-align:center;border-color:${color}33;">
        <div style="font-size:.72rem;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">${label}</div>
        <div style="font-size:1.5rem;font-weight:800;font-family:var(--font-mono);color:var(--color-text);margin-bottom:4px">${fmt(value,sym)}</div>
        ${pct!==null?`<div style="font-size:.75rem;color:var(--color-text-muted)">${i18n.getLang()==='es'?`≈ ${pct}% de meta`:`≈ ${pct}% of target`}</div>`:''}
        <div style="font-size:.68rem;color:var(--color-text-faint);margin-top:4px">${i18n.t('summaryConfianza')}: ${confidence}%</div>
        <div class="progress-bar-wrap" style="height:4px;margin-top:8px;">
          <div class="progress-bar-fill ${status}" style="width:${Math.min(pct||50,100)}%"></div>
        </div>
      </div>`;
  }

  function buildProjections(salesData, clientData, inventData, goals, sym) {
    // Tendencia mensual
    const months = {};
    salesData.forEach(r => {
      const d = storage.parseDate(r.Fecha); if (!d) return;
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months[k] = (months[k]||0) + (parseFloat(r.Ventas_Monto)||0);
    });
    const trend = Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
    const monthsUsed = trend.length;
    const avgMonthly = trend.length ? trend.reduce((s,[,v])=>s+v,0)/trend.length : 0;
    const growth = trend.length >= 2 ? (trend[trend.length-1][1] - trend[0][1]) / trend[0][1] / trend.length : 0;

    const p30 = avgMonthly * (1 + growth);
    const p60 = p30 * (1 + growth);
    const p90 = p60 * (1 + growth);
    const confidence = Math.min(Math.round(monthsUsed * 15 + 10), 90);

    // Probabilidad de meta (mes actual)
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const monthSales = salesData.filter(r=>{
      const d=storage.parseDate(r.Fecha);
      return d && d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
    }).reduce((s,r)=>s+(parseFloat(r.Ventas_Monto)||0),0);
    const projectedMonth = dayOfMonth > 0 ? (monthSales/dayOfMonth)*daysInMonth : 0;
    const goalProb = goals.sales_monthly > 0
      ? Math.min(Math.round((projectedMonth/goals.sales_monthly)*100), 100) : 50;

    // Clientes ${i18n.t('summaryEnRiesgo')}
    const atRiskClients = clientData.filter(r=>(parseFloat(r.Días_Sin_Compra)||0)>=60).length;

    // Stock agotándose
    const stockout = [];
    const prodMap = {};
    inventData.forEach(r => {
      const p = r.Producto||'Sin nombre';
      if (!prodMap[p]) prodMap[p] = { label:p, stock:0, sold:0 };
      prodMap[p].stock += parseFloat(r.Stock_Inicial)||0;
      prodMap[p].sold  += parseFloat(r.Ventas_Unidades)||0;
    });
    Object.values(prodMap).forEach(p => {
      const daily = p.sold/30;
      if (daily > 0 && p.stock/daily < 30) stockout.push({ label:p.label, days:p.stock/daily });
    });
    stockout.sort((a,b)=>a.days-b.days);

    return { p30, p60, p90, confidence, monthsUsed, goalProb, atRiskClients, stockout, trend };
  }

  function renderCharts(data, sym) {
    const el = document.getElementById('projSalesChart'); if (!el) return;
    if (window._ckCharts?.projSalesChart) window._ckCharts.projSalesChart.destroy();
    if (!window._ckCharts) window._ckCharts = {};
    const _ms2 = typeof i18n!=='undefined'?i18n.t('monthsShort'):'Ene,Feb,Mar,Abr,May,Jun,Jul,Ago,Sep,Oct,Nov,Dic';
    const names = _ms2.split(',');
    const histLabels = data.trend.map(([k])=>names[parseInt(k.split('-')[1])-1]);
    const histVals   = data.trend.map(([,v])=>v);
    const now = new Date();
    // Start future labels from the month after the last historical data point
    const lastHistKey  = data.trend.length ? data.trend[data.trend.length-1][0] : null;
    const lastHistDate = lastHistKey ? new Date(parseInt(lastHistKey.split('-')[0]), parseInt(lastHistKey.split('-')[1])-1, 1) : new Date(now.getFullYear(), now.getMonth()-1, 1);
    const futureLabels = [1,2,3].map(i=>{ const d=new Date(lastHistDate.getFullYear(),lastHistDate.getMonth()+i,1); return names[d.getMonth()]; });
    const futureVals = [data.p30, data.p60, data.p90];
    const allLabels  = [...histLabels, ...futureLabels];
    const realData   = [...histVals, null, null, null];
    const projData   = [...histVals.map((_,i)=>i===histVals.length-1?histVals[i]:null), data.p30, data.p60, data.p90];

    window._ckCharts.projSalesChart = new Chart(el, { type:'line',
      data:{ labels:allLabels, datasets:[
        { label:i18n.t('projHistorico'), data:realData, borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,.08)', borderWidth:2.5, pointRadius:5, tension:.4, fill:true },
        { label:i18n.t('projProyeccion'), data:projData, borderColor:'rgba(99,102,241,.7)', backgroundColor:'rgba(99,102,241,.05)', borderWidth:2, borderDash:[6,3], pointRadius:5, pointStyle:'triangle', tension:.4, fill:true },
      ]},
      options:{ responsive:true, maintainAspectRatio:false, animation:{duration:600},
        plugins:{ legend:{labels:{color:'#94a3b8',font:{size:11},boxWidth:10,padding:12}},
          tooltip:{backgroundColor:'#1e293b',borderColor:'#334155',borderWidth:1,titleColor:'#94a3b8',bodyColor:'#f1f5f9',padding:8,cornerRadius:6,
            callbacks:{label:ctx=>` ${ctx.dataset.label}: ${sym}${Math.round(ctx.raw||0).toLocaleString()}`}}},
        scales:{ x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11}},border:{display:false}},
          y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11},callback:v=>sym+(v>=1000000?(v/1000000).toFixed(1)+'M':v>=1000?(v/1000).toFixed(0)+'K':v)},border:{display:false}}}} });
  }

  function fmt(n,sym='$'){if(!n)return`${sym}—`;if(n>=1000000)return`${sym}${(n/1000000).toFixed(1)}M`;if(n>=1000)return`${sym}${(n/1000).toFixed(0)}K`;return`${sym}${Math.round(n).toLocaleString()}`;}
  function noData(){return`<div class="no-data-state"><div class="no-data-icon">📈</div><h2 class="no-data-title">${i18n.t('errorNoData')}</h2><p class="no-data-desc">${i18n.t('sumSubirVentas')}</p><button class="btn btn-primary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button></div>`;}

  return { render };
})();


// ════════════════════════════════════════════════════════════════
// MÓDULO ATENCIÓN AL CLIENTE
// ════════════════════════════════════════════════════════════════
const supportModule = (() => {

  function render(container) {
    const rows   = storage.applyFilters(storage.getData('support'), 'support');
    const goals  = storage.getGoals();
    const data   = calcSupportKPIs(rows, goals);
    const hasData = rows.length > 0;

    container.innerHTML = `
      <div class="module-header">
        <div class="module-title-wrap">
          <h1 class="module-title">📞 ${i18n.t('supportTitle')}</h1>
          <p class="module-subtitle">${rows.length.toLocaleString()} ${i18n.getLang()==='es'?'casos registrados':'cases recorded'}${(() => { const _dr = storage.getDataDateRange('support'); return _dr ? ' · ' + (i18n.getLang()==='es' ? 'Datos: ' : 'Data: ') + _dr.label : ''; })()}</p>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="showModal('uploadModal')">
          📂 ${i18n.t('uploadData')}
        </button>
      </div>
      ${renderGlobalFilters('support', { showSeller: true, showChannel: true })}
      ${!hasData ? noData() : renderContent(data, goals)}
    `;
    if (hasData) setTimeout(() => renderCharts(data), 50);
  }

  function renderContent(data, goals) {
    const resStatus = storage.getStatus(data.resolutionRate, goals.resolution_rate || 90);
    const ttrStatus = storage.getStatus(data.avgResponseTime, goals.response_time_hrs || 4, true);
    const csatStatus= storage.getStatus(data.csat, goals.csat || 80);
    const fcrStatus = storage.getStatus(data.fcr, 80);
    const escSt     = (data.escalationRate||0)<10?'green':(data.escalationRate||0)<20?'yellow':'red';

    // ¿Tiene columna Motivo?
    const hasMotivo = data.byMotivo && data.byMotivo.length > 0 && data.byMotivo[0].label !== 'Sin motivo';

    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(175px,1fr));margin-bottom:20px;">
        ${kpiCard('✅', i18n.getLang()==='es'?'Tasa resolución':'Resolution rate', pct(data.resolutionRate), resStatus,
          `${i18n.getLang()==='es'?'Meta':'Goal'}: ${goals.resolution_rate||90}%`, data.resolutionRate, resStatus)}
        ${kpiCard('⏱️', i18n.getLang()==='es'?'Tiempo respuesta':'Response time', data.avgResponseTime!=null?data.avgResponseTime.toFixed(1)+' hrs':'—', ttrStatus,
          `${i18n.getLang()==='es'?'Meta':'Goal'}: <${goals.response_time_hrs||4} hrs`, null, null)}
        ${kpiCard('😊', i18n.t('kpiCSAT'), pct(data.csat), csatStatus,
          `${i18n.getLang()==='es'?'Meta':'Goal'}: ${goals.csat||80}%`, data.csat, csatStatus)}
        ${kpiCard('✅', i18n.t('kpiFCR'), pct(data.fcr), fcrStatus,
          i18n.getLang()==='es'?'resolución 1er contacto':'first contact resolution', data.fcr, fcrStatus)}
        ${kpiCard('📋', i18n.getLang()==='es'?'Total casos':'Total cases', data.totalCases.toLocaleString(), 'blue',
          i18n.getLang()==='es'?'período actual':'current period', null, null)}
        ${kpiCard('📈', i18n.getLang()==='es'?'Escalación':'Escalation', pct(data.escalationRate), escSt,
          i18n.getLang()==='es'?'casos escalados':'escalated cases', null, null)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;" class="charts-row">

        <!-- Ranking de motivos — solo si hay datos -->
        <div class="chart-card">
          <div class="chart-card-header">
            <div class="chart-card-title">📊 ${i18n.t('supportMotivos')}</div>
            ${hasMotivo?'':`<span class="badge badge-blue">${i18n.t('supportNoMotivo')}</span>`}
          </div>
          ${hasMotivo ? `
            <div class="chart-container" style="height:240px;"><canvas id="supportMotivoChart"></canvas></div>
            <div style="margin-top:10px;max-height:180px;overflow-y:auto;">
              ${data.byMotivo.slice(0,8).map((m,i) => {
                const total = data.byMotivo.reduce((s,v)=>s+v.value,0);
                const pctVal = total>0?(m.value/total*100).toFixed(0)+'%':'—';
                return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(51,65,85,.3);">
                  <span style="font-size:.72rem;color:var(--color-text-faint);width:18px">#${i+1}</span>
                  <span style="font-size:.8rem;flex:1;color:var(--color-text-muted)">${m.label}</span>
                  <span style="font-size:.78rem;font-weight:700;color:var(--color-text)">${m.value}</span>
                  <span style="font-size:.7rem;color:var(--color-text-faint);width:36px;text-align:right">${pctVal}</span>
                </div>`;
              }).join('')}
            </div>` : `
            <div style="padding:20px;text-align:center;color:var(--color-text-faint);font-size:.82rem;">
              ${i18n.getLang()==='es'
                ? 'Agrega una columna <strong>Motivo</strong> en tu Excel de soporte para ver el ranking de motivos de contacto.'
                : 'Add a <strong>Motivo</strong> column in your support Excel to see the contact reason ranking.'}
            </div>`}
        </div>

        <!-- Tendencia de casos -->
        <div class="chart-card">
          <div class="chart-card-header">
            <div class="chart-card-title">📈 ${i18n.getLang()==='es'?'Tendencia de casos':'Cases trend'}</div>
          </div>
          <div class="chart-container" style="height:240px;"><canvas id="supportTrendChart"></canvas></div>
        </div>
      </div>

      <!-- Tabla ranking motivos con escalaciones -->
      ${hasMotivo ? `
        <div class="chart-card" style="margin-top:16px;">
          <div class="chart-card-header">
            <div class="chart-card-title">🚨 ${i18n.getLang()==='es'?'Motivos con más escalaciones':'Reasons with most escalations'}</div>
          </div>
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>${i18n.getLang()==='es'?'Motivo':'Reason'}</th>
                  <th class="number">${i18n.getLang()==='es'?'Casos':'Cases'}</th>
                  <th class="number">${i18n.getLang()==='es'?'Escalados':'Escalated'}</th>
                  <th class="number">${i18n.getLang()==='es'?'% Escalación':'% Escalation'}</th>
                </tr>
              </thead>
              <tbody>
                ${data.byMotivoEsc.slice(0,8).map(m => {
                  const escPct = m.total>0?(m.escalated/m.total*100).toFixed(0)+'%':'0%';
                  const escColor = m.escalated/m.total>0.3?'var(--color-red)':m.escalated/m.total>0.1?'var(--color-yellow)':'var(--color-green)';
                  return `<tr>
                    <td style="font-weight:500;color:var(--color-text)">${m.label}</td>
                    <td class="number">${m.total}</td>
                    <td class="number" style="color:${escColor};font-weight:600">${m.escalated}</td>
                    <td class="number" style="color:${escColor}">${escPct}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}
    `;
  }

  function calcSupportKPIs(rows, goals) {
    if (!rows.length) return {totalCases:0,resolutionRate:null,avgResponseTime:null,csat:null,fcr:null,escalationRate:null,byMotivo:[],byMotivoEsc:[],monthlyTrend:[]};
    const total   = rows.length;
    const resolved= rows.filter(r=>r.Resuelto_1er_Contacto===true||r.Resuelto_1er_Contacto==='true'||String(r.Resuelto_1er_Contacto)==='1').length;
    const ttrRows = rows.filter(r=>parseFloat(r.Tiempo_Respuesta_Hrs)>0);
    const csatRows= rows.filter(r=>parseFloat(r.CSAT)>0);
    const escRows = rows.filter(r=>r.Escaló===true||r.Escaló==='true'||String(r.Escaló)==='1');
    const resolutionRate  = total>0?(resolved/total)*100:null;
    const avgResponseTime = ttrRows.length?ttrRows.reduce((s,r)=>s+(parseFloat(r.Tiempo_Respuesta_Hrs)||0),0)/ttrRows.length:null;
    const csat = csatRows.length?csatRows.reduce((s,r)=>s+(parseFloat(r.CSAT)||0),0)/csatRows.length:null;
    const fcr  = resolutionRate;
    const escalationRate = total>0?(escRows.length/total)*100:null;

    // Por motivo — solo si hay datos reales (no todos "Sin motivo")
    const g = {}, gEsc = {};
    rows.forEach(r=>{
      const k=r.Motivo||'';
      if (!k) return; // omitir filas sin motivo
      g[k]=(g[k]||0)+1;
      if (!gEsc[k]) gEsc[k]={label:k,total:0,escalated:0};
      gEsc[k].total++;
      if(r.Escaló===true||r.Escaló==='true'||String(r.Escaló)==='1') gEsc[k].escalated++;
    });
    const byMotivo = Object.entries(g).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
    const byMotivoEsc = Object.values(gEsc).sort((a,b)=>b.escalated-a.escalated);

    const trend={};
    rows.forEach(r=>{
      const d=storage.parseDate(r.Fecha);if(!d)return;
      const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      trend[k]=(trend[k]||0)+1;
    });
    const monthlyTrend=Object.entries(trend).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);

    return {totalCases:total,resolutionRate,avgResponseTime,csat,fcr,escalationRate,byMotivo,byMotivoEsc,monthlyTrend};
  }

  function renderCharts(data) {
    const BASE={responsive:true,maintainAspectRatio:false,animation:{duration:500},
      plugins:{legend:{labels:{color:'#94a3b8',font:{size:11},boxWidth:10,padding:12}},
        tooltip:{backgroundColor:'#1e293b',borderColor:'#334155',borderWidth:1,titleColor:'#94a3b8',bodyColor:'#f1f5f9',padding:8,cornerRadius:6}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11}},border:{display:false}},
              y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11}},border:{display:false}}}};
    const PALETTE=['#3b82f6','#6366f1','#22c55e','#eab308','#ef4444','#a855f7','#f97316','#14b8a6'];

    // Gráfico motivos — solo si hay datos
    const top6=data.byMotivo.filter(m=>m.label&&m.label!=='Sin motivo').slice(0,6);
    if (top6.length > 0) {
      mkChart('supportMotivoChart',{type:'doughnut',data:{
        labels:top6.map(m=>m.label.length>20?m.label.slice(0,18)+'…':m.label),
        datasets:[{data:top6.map(m=>m.value),
          backgroundColor:PALETTE.slice(0,top6.length).map(c=>c+'cc'),
          borderColor:PALETTE.slice(0,top6.length),borderWidth:1.5,hoverOffset:5}]},
        options:{...BASE,cutout:'65%',scales:{x:{display:false},y:{display:false}}}});
    }

    // Tendencia
    if(data.monthlyTrend.length){
      const names=[i18n.t('monthJan'),i18n.t('monthFeb'),i18n.t('monthMar'),i18n.t('monthApr'),i18n.t('monthMay'),i18n.t('monthJun'),i18n.t('monthJul'),i18n.t('monthAug'),i18n.t('monthSep'),i18n.t('monthOct'),i18n.t('monthNov'),i18n.t('monthDec')];
      mkChart('supportTrendChart',{type:'line',data:{
        labels:data.monthlyTrend.map(([k])=>{const[,m]=k.split('-');return names[parseInt(m)-1];}),
        datasets:[{label:i18n.getLang()==='es'?'Casos':'Cases',data:data.monthlyTrend.map(([,v])=>v),
          borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.08)',borderWidth:2.5,pointRadius:4,tension:.4,fill:true}]},
        options:{...BASE}});
    }
  }

  function mkChart(id,cfg){
    const el=document.getElementById(id);if(!el)return;
    if(window._ckCharts?.[id])window._ckCharts[id].destroy();
    if(!window._ckCharts)window._ckCharts={};
    window._ckCharts[id]=new Chart(el,cfg);
  }
  function kpiCard(icon,label,value,status,sub,p,ps,hero){
    // hero=true → larger card with ghost number signature
    const heroClass = hero ? ' kpi-hero' : '';
    const ghost     = hero ? ` data-ghost="${String(value).replace(/[^0-9.,KMB%x]/g,'').slice(0,5)}"` : '';
    return`<div class="kpi-card status-${status}${heroClass}"${ghost}>
      <div class="kpi-card-header"><div class="kpi-card-icon">${icon}</div><div class="kpi-status-dot ${status}"></div></div>
      <div class="kpi-card-value">${value}</div><div class="kpi-card-label">${label}</div>
      ${sub?`<div style="font-size:.72rem;color:var(--color-text-faint);margin-top:4px">${sub}</div>`:''}
      ${p!=null?`<div class="kpi-card-progress" style="margin-top:${hero?'12':'8'}px"><div class="progress-bar-wrap"><div class="progress-bar-fill ${ps||status}" style="width:${Math.min(p,100)}%"></div></div></div>`:''}
    </div>`;
  }
  function pct(v){return v!=null?v.toFixed(1)+'%':'—';}
  function noData(){return`<div class="no-data-state"><div class="no-data-icon">📞</div>
    <h2 class="no-data-title">${i18n.t('errorNoData')}</h2>
    <p class="no-data-desc">${i18n.getLang()==='es'
      ?'Sube un Excel de soporte con columnas: Caso_ID, Fecha, Tiempo_Respuesta_Hrs, CSAT, Resuelto_1er_Contacto, Escaló. Opcional: Motivo'
      :'Upload a support Excel with columns: Caso_ID, Fecha, Tiempo_Respuesta_Hrs, CSAT, Resuelto_1er_Contacto, Escaló. Optional: Motivo'}</p>
    <button class="btn btn-primary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button>
  </div>`;}

  return { render };
})();

window.summaryModule     = summaryModule;
window.projectionsModule = projectionsModule;
window.supportModule     = supportModule;

// ════════════════════════════════════════════════════════════════
// CLAROKPIS — home-module.js
// Extraído del inline del dashboard.html — líneas 536-1065
// ════════════════════════════════════════════════════════════════

function renderHome(container) {
  const hasData  = storage.hasData();
  const goals    = storage.getGoals();
  const stats    = storage.getDataStatsSync();
  const alerts   = storage.getActiveAlerts();
  const config   = storage.getConfig();
  const filters  = storage.getFilters();

  const kpisHome = calculateHomeKPIs();
  const health   = calculateHealthIndex(kpisHome, goals);

  container.innerHTML = `
    <div class="module-header">
      <div class="module-title-wrap">
        <h1 class="module-title">🏠 ${i18n.t('homeTitle') || 'Inicio'}</h1>
        <p class="module-subtitle">${(() => { const _dr = storage.getDataDateRange('sales'); return _dr ? (i18n.getLang()==='es' ? 'Datos: ' : 'Data: ') + _dr.label : storage.formatDate(new Date(),'medium'); })()  } · ${stats.total.toLocaleString()} ${i18n.t('registros')||'registros'}</p>
      </div>
      <div class="module-actions">
        <button class="btn btn-sm btn-secondary" onclick="showModal('uploadModal')">
          📂 ${i18n.t('uploadData')}
        </button>
        <button class="btn btn-sm btn-primary" onclick="exportPDF()">
          📄 ${i18n.t('exportPDF')}
        </button>
      </div>
    </div>
    ${!hasData ? renderNoDataHome() : renderHomeWithData(kpisHome, health, alerts, goals, config, filters)}
  `;

  if (hasData) renderTrendChart();
}

// ── NO DATA STATE ─────────────────────────────────────────────────
function renderNoDataHome() {
  return `
    <div class="no-data-state">
      <div class="no-data-icon">📊</div>
      <h2 class="no-data-title">${i18n.t('noDataYet') || (i18n.t('noDataYet'))}</h2>
      <p class="no-data-desc">Sube tu primer archivo Excel para comenzar a ver tus KPIs automáticamente.</p>
      <button class="btn btn-primary btn-lg" onclick="showModal('uploadModal')">
        📂 ${i18n.t('uploadData')}
      </button>
    </div>
  `;
}

// ── HOME CON DATOS ────────────────────────────────────────────────
function renderHomeWithData(kpisHome, health, alerts, goals, config, filters) {
  const sym = config.currencySymbol || '$';
  return `
    <div class="health-card">
      <div class="health-ring-svg">${renderHealthRing(health.score)}</div>
      <div class="health-info">
        <div class="health-score-number" style="color:${getHealthColor(health.score)}">${health.score}<span style="font-size:1rem;color:var(--color-text-faint)">/100</span></div>
        <div class="health-score-label">${i18n.t('healthIndex') || i18n.t('homeHealthIndex')}</div>
        <div class="health-breakdown">
          ${health.components.map(c => `
            <div class="health-item">
              <span class="health-item-label">${c.label}</span>
              <div class="health-item-bar">
                <div class="health-item-fill" style="width:${c.score}%;background:${getStatusColor(c.status)}"></div>
              </div>
              <span class="health-item-value" style="color:${getStatusColor(c.status)}">${c.score}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="kpi-grid home-kpis" id="homeKpiGrid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));margin-bottom:16px;">
      ${kpisHome.map(kpi => renderKpiCard(kpi, sym, goals)).join('')}
    </div>

    ${renderHomeProjection(sym, goals, config)}

    <div class="alerts-section">
      <div class="alerts-section-header">
        <div class="alerts-section-title">
          🚨 ${i18n.t('activeAlerts') || 'Alertas activas'}
          ${alerts.length > 0 ? `<span class="alerts-count">${alerts.length}</span>` : ''}
        </div>
        ${alerts.length > 0 ? `<button class="btn btn-ghost btn-sm" onclick="navigateTo('summary')">${i18n.t("seeAll")||"Ver todas →"}</button>` : ''}
      </div>
      ${alerts.length === 0
        ? `<div class="alert alert-green"><span>🎉</span><div class="alert-body"><div class="alert-title">${i18n.t('noAlerts') || (i18n.getLang()==='es'?'¡Todo en orden!':'All good!')}</div></div></div>`
        : alerts.slice(0, 5).map(a => renderAlertItem(a)).join('')}
    </div>

    <div class="chart-card" style="margin-top:8px;">
      <div class="chart-card-header">
        <div class="chart-card-title">📈 ${i18n.getLang()==='es'?'Tendencia de ventas — últimos 6 meses':'Sales trend — last 6 months'}</div>
        <div class="tabs">
          <div class="tab-item active" onclick="switchTrendChart('sales')">${i18n.getLang()==='es'?'Ventas':'Sales'}</div>
          <div class="tab-item" onclick="switchTrendChart('clients')">${i18n.getLang()==='es'?'Clientes':'Clients'}</div>
        </div>
      </div>
      <div class="chart-container"><canvas id="trendChart"></canvas></div>
    </div>

    <p style="font-size:.73rem;color:var(--color-text-faint);text-align:right;margin-top:12px;">
      ${i18n.t('lastUpdate') || (i18n.getLang()==='es'?'Última actualización':'Last updated')}: ${storage.formatDate(new Date(),'long')}
    </p>
  `;
}

// ── KPI CARD ──────────────────────────────────────────────────────
function renderKpiCard(kpi, sym, goals) {
  const goal      = goals[kpi.goalKey] || 0;
  const status    = storage.getStatus(kpi.value, goal, kpi.inverted);
  const pct       = goal > 0 ? Math.min(Math.round((kpi.value / goal) * 100), 200) : 0;
  const formatted = kpi.isCurrency
    ? formatCurrency(kpi.value, sym)
    : kpi.isPercent
      ? (kpi.value?.toFixed(1) + '%')
      : (kpi.value?.toLocaleString(storage.getConfig().language==='en'?'en-US':'es-CL') ?? '—');

  // Delta vs período anterior
  const delta = typeof calcDelta === 'function'
    ? calcDelta(kpi.value, kpi.module, kpi.deltaField || 'Ventas_Monto', storage.getActiveFilters())
    : null;

  return `
    <div class="kpi-card ${status}" onclick="navigateTo('${kpi.module}')">
      <div class="kpi-card-header">
        <div class="kpi-card-icon">${kpi.icon}</div>
        <div class="kpi-status-dot ${status}"></div>
      </div>
      <div class="kpi-card-value">${kpi.value !== null && kpi.value !== undefined ? formatted : '—'}</div>
      <div class="kpi-card-label">${kpi.label}</div>
      <div class="kpi-card-footer">
        ${delta
          ? `<span class="kpi-card-delta ${delta.pct >= 0 ? 'up' : 'down'}" style="color:${delta.color}">${delta.text}</span>`
          : `<span></span>`}
        ${goal > 0 ? `<span class="kpi-card-goal">${i18n.t('vsGoal') || 'vs meta'}: ${pct}%</span>` : ''}
      </div>
      ${goal > 0 ? `
        <div class="kpi-card-progress">
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill ${status}" style="width:${Math.min(pct,100)}%"></div>
          </div>
        </div>` : ''}
    </div>`;
}

// ── ALERT ITEM ────────────────────────────────────────────────────
function renderAlertItem(alert, showResolveBtn = true) {
  const icons  = { critical:'🚨', warning:'⚠️', info:'💡' };
  const colors = { critical:'var(--color-red)', warning:'var(--color-yellow)', info:'var(--color-blue)' };
  const role   = auth.getCurrentRole();
  const canResolve = showResolveBtn && !auth.isDemo() && role !== 'owner';
  const moduleLabel = {
    sales:      i18n.t('moduleSales')     || i18n.t('homeHealthCategories').split(',')[0],
    clients:    i18n.t('moduleClients')   || i18n.t('homeHealthCategories').split(',')[2],
    finance:    i18n.t('moduleFinance')   || i18n.t('homeHealthCategories').split(',')[1],
    inventory:  i18n.t('moduleInventory'),
    team:       i18n.t('moduleTeam'),
    cx:         i18n.t('moduleCX'),
    marketing:  i18n.t('moduleMarketing'),
    support:    i18n.t('moduleSupport'),
    suppliers:  i18n.t('moduleSuppliers'),
    margin:      i18n.t('moduleMargin'),
    collections: i18n.t('moduleCollections'),
    general:     i18n.getLang()==='es' ? 'General' : 'General',
  }[alert.module] || alert.module;

  return `
    <div class="alert-item ${alert.type}" style="border-left:3px solid ${colors[alert.type]||'var(--color-border)'};">
      <span class="alert-icon">${icons[alert.type]||'⚠️'}</span>
      <div class="alert-body" style="flex:1;">
        <div class="alert-msg">${storage.getAlertMessage(alert)}</div>
        <div class="alert-meta">
          ${moduleLabel} · ${storage.formatDate(alert.createdAt,'medium')}
          ${alert.resolved && alert.resolvedBy ? ` · ✅ Resuelto por <strong>${alert.resolvedBy}</strong>` : ''}
          ${alert.actionNote ? ` · "${alert.actionNote}"` : ''}
        </div>
      </div>
      ${canResolve ? `
        <button class="btn btn-ghost btn-sm"
          onclick="event.stopPropagation();resolveAlertUI('${alert.id}')"
          title="${i18n.t('alertResolve')||'Resolver'}">✓</button>` : ''}
    </div>`;
}

// ── SUGERENCIAS DE ACCIÓN ─────────────────────────────────────────
function renderHomeSuggestions(alerts) {
  if (!alerts?.length) return '';
  const isEs = i18n.getLang() === 'es';

  const SUGGESTIONS = {
    inventory: {
      icon:'📦',
      es:{ title:i18n.t('homeStockCritico'), items:[i18n.t('homeAccionOrdenCompra'),i18n.getLang()==='es'?'Revisar el proveedor con mejor tiempo de entrega':'Review supplier with best lead time',i18n.t('homeAccionReasignarStock')] },
      en:{ title:'Critical stock', items:['Issue urgent purchase order for items below 7 days inventory','Review supplier with best lead time','Consider stock reallocation between branches'] },
    },
    sales: {
      icon:'💰',
      es:{ title:'Ventas bajo meta', items:[i18n.t('homeAccionCoaching'),i18n.t('homeAccionFunnelLeads'),i18n.t('homeAccionReactivacion')] },
      en:{ title:'Sales below goal', items:['Identify underperforming sellers and provide coaching','Review lead funnel for conversion bottlenecks','Launch reactivation campaign for clients inactive 60+ days'] },
    },
    clients: {
      icon:'👥',
      es:{ title:'Clientes en riesgo', items:[i18n.t('homeAccionContactar'),i18n.getLang()==='es'?'Analizar motivo de abandono (precio, competencia, experiencia)':'Analyze abandonment reason (price, competition, experience)',i18n.t('homeAccionFidelizacion')] },
      en:{ title:'Clients at risk', items:['Contact clients inactive 90+ days with personalized offer','Analyze abandonment reason','Activate loyalty program for at-risk segment'] },
    },
    team: {
      icon:'👨‍💼',
      es:{ title:'Rendimiento de equipo', items:[i18n.t('homeAccionVendedores'),'Revisar si hay factores externos que afecten el rendimiento',i18n.getLang()==='es'?'Considerar incentivos adicionales para cerrar el mes':'Consider additional incentives to close the month'] },
      en:{ title:'Team performance', items:['1:1 meeting with sellers below 80% of goal','Check for external factors affecting performance','Consider additional incentives to close the month'] },
    },
    cx: {
      icon:'😊',
      es:{ title:i18n.t('homeAccionCXBaja'), items:[i18n.t('homeAccionRevisarDetractores'),i18n.t('homeAccionPostVenta'),i18n.t('homeAccionCapacitar')] },
      en:{ title:'Low CX satisfaction', items:['Review detractor comments — identify common pattern','Implement post-sale follow-up in first 7 days','Train team on most frequent dissatisfaction reasons'] },
    },
    suppliers: {
      icon:'🏭',
      es:{ title:'Problemas con proveedores', items:['Contactar al proveedor para confirmar estado de la orden',i18n.t('homeAccionProveedorAlt'),i18n.t('homeAccionOrdenAnticipada')] },
      en:{ title:'Supplier issues', items:['Contact supplier to confirm order status','Evaluate alternative supplier for critical products','Place next order earlier to avoid stockout'] },
    },
    margin: {
      icon:'💹',
      es:{ title:'Descuento sobre meta', items:[i18n.t('homeAccionRevisarDescuento'),i18n.t('homeAccionPoliticaDescuento'),i18n.getLang()==='es'?'Comparar costo de proveedor vs alternativas':'Compare supplier costs vs alternatives'] },
      en:{ title:'Discount above goal', items:['Review which products have highest average discount','Set per-product discount policy','Compare supplier costs vs alternatives'] },
    },
  };

  const urgentModules = [...new Set(
    alerts.filter(a => a.type === 'critical' || a.type === 'warning').map(a => a.module)
  )].slice(0, 3);

  const items = urgentModules.map(m => SUGGESTIONS[m]).filter(Boolean);
  if (!items.length) return '';

  return `
    <div class="card" style="background:rgba(59,130,246,.06);border-color:rgba(59,130,246,.2);margin-top:8px;">
      <details>
        <summary style="cursor:pointer;font-size:.88rem;font-weight:700;color:var(--color-blue);list-style:none;display:flex;align-items:center;gap:8px;padding:2px 0;">
          <span>💡</span>
          <span>${isEs?i18n.t('homeSugerenciasAccion'):'Action suggestions'} (${items.length})</span>
          <span style="margin-left:auto;font-size:.72rem;color:var(--color-text-faint);">▼</span>
        </summary>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:14px;">
          ${items.map(s => `
            <div>
              <div style="font-size:.83rem;font-weight:700;color:var(--color-text);margin-bottom:6px;">${s.icon} ${isEs?s.es.title:s.en.title}</div>
              ${(isEs?s.es.items:s.en.items).map(item =>
                `<div style="font-size:.78rem;color:var(--color-text-muted);padding:3px 0 3px 12px;border-left:2px solid rgba(59,130,246,.3);">• ${item}</div>`
              ).join('')}
            </div>`).join('')}
        </div>
      </details>
    </div>`;
}

// ── HEALTH RING ───────────────────────────────────────────────────
function renderHealthRing(score) {
  const r    = 44;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = getHealthColor(score);
  return `
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="10"/>
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="10"
        stroke-dasharray="${dash} ${circ}" stroke-dashoffset="${circ * .25}"
        stroke-linecap="round" transform="rotate(-90 60 60)"
        style="transition:stroke-dasharray 1s ease"/>
      <text x="60" y="56" text-anchor="middle" font-family="JetBrains Mono,monospace"
        font-size="20" font-weight="800" fill="${color}">${score}</text>
      <text x="60" y="70" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif"
        font-size="9" fill="#64748b" font-weight="600">/ 100</text>
    </svg>`;
}

// ── PROYECCIÓN DEL MES ────────────────────────────────────────────
function renderHomeProjection(sym, goals, config) {
  const now        = new Date();
  const salesData  = storage.getData('sales'); // Home inmune a filtros: usa todos los datos, filtra por mes en JS
  const isEs       = i18n.getLang() === 'es';

  // Intentar mes actual; si no hay datos, usar el último mes con ventas
  let targetYear  = now.getFullYear();
  let targetMonth = now.getMonth();

  let monthSales = salesData.filter(r => {
    const d = storage.parseDate(r.Fecha);
    return d && d.getMonth() === targetMonth && d.getFullYear() === targetYear;
  }).reduce((s, r) => s + (parseFloat(r.Ventas_Monto) || 0), 0);

  // Si el mes actual no tiene ventas, buscar el último mes con datos
  let usingFallback = false;
  if (monthSales === 0 && salesData.length > 0) {
    const dates = salesData
      .map(r => storage.parseDate(r.Fecha))
      .filter(Boolean)
      .sort((a, b) => b - a);
    if (dates.length) {
      const lastDate = dates[0];
      targetYear  = lastDate.getFullYear();
      targetMonth = lastDate.getMonth();
      monthSales  = salesData.filter(r => {
        const d = storage.parseDate(r.Fecha);
        return d && d.getMonth() === targetMonth && d.getFullYear() === targetYear;
      }).reduce((s, r) => s + (parseFloat(r.Ventas_Monto) || 0), 0);
      usingFallback = true;
    }
  }

  const daysInMonth  = new Date(targetYear, targetMonth + 1, 0).getDate();
  const workTotal    = config.workingDaysThisMonth || daysInMonth;
  // workingDaysElapsed: usar config si es > 0, sino día del mes actual
  const workElapsed  = (config.workingDaysElapsed > 0 ? config.workingDaysElapsed : null)
                    || (usingFallback ? daysInMonth : now.getDate());
  const projected    = workElapsed > 0 ? (monthSales / workElapsed) * workTotal : 0;
  const goalMonthly  = goals.sales_monthly || 0;
  const projPct      = goalMonthly > 0 ? (projected / goalMonthly * 100) : null;
  const projColor    = projPct === null ? 'var(--color-blue)' : projPct >= 100 ? 'var(--color-green)' : projPct >= 80 ? 'var(--color-yellow)' : 'var(--color-red)';
  const daysLeft     = workTotal - workElapsed;

  if (!salesData.length) return '';

  return `
    <div style="background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <div style="flex:1;min-width:160px;">
        <div style="font-size:.72rem;font-weight:700;color:var(--color-text-faint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">
          📈 ${isEs?i18n.t('homeProyeccionMes'):'Month projection'}${usingFallback ? ` · ${i18n.monthName(targetMonth)} ${targetYear}` : ''}
        </div>
        <div style="font-size:1.5rem;font-weight:800;font-family:var(--font-mono);color:${projColor};">
          ${formatCurrency(projected, sym)}
        </div>
        ${projPct !== null ? `<div style="font-size:.75rem;color:${projColor};font-weight:600;">${projPct.toFixed(1)}% ${isEs?'de meta':'of goal'}</div>` : ''}
      </div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;">
        ${[
          [workElapsed, isEs?i18n.t('homeDiasTranscurridos'):'days elapsed'],
          [daysLeft,    isEs?i18n.t('homeDiasRestantes'):'days remaining', 'var(--color-blue)'],
          [workTotal,   isEs?'días laborables':'working days'],
        ].map(([v,l,c]) => `
          <div style="text-align:center;">
            <div style="font-size:1.1rem;font-weight:700;color:${c||'var(--color-text)'};">${v}</div>
            <div style="font-size:.68rem;color:var(--color-text-faint);">${l}</div>
          </div>`).join('')}
      </div>
      <button onclick="navigateTo('sales')"
        style="padding:5px 12px;background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.3);border-radius:6px;color:var(--color-blue);font-size:.75rem;cursor:pointer;white-space:nowrap;">
        ${isEs?'Ver detalle →':'See detail →'}
      </button>
    </div>`;
}

// ── CÁLCULO KPIs HOME ─────────────────────────────────────────────
function calculateHomeKPIs() {
  // Home inmune a filtros: usa todos los datos. La meta usa dedupMeta para no inflar.
  const salesData  = storage.getData('sales');
  const clientData = storage.getData('clients');

  const totalSales = salesData.reduce((s,r) => s + (parseFloat(r.Ventas_Monto)||0), 0);
  const totalGoal  = (typeof kpis !== 'undefined' && kpis.dedupMeta)
    ? kpis.dedupMeta(salesData, storage.getGoals())
    : salesData.reduce((s,r) => s + (parseFloat(r.Meta_Ventas)||0), 0);
  const goalPct    = totalGoal > 0 ? (totalSales / totalGoal) * 100 : null;
  const txs        = salesData.reduce((s,r) => s + (parseFloat(r.N_Transacciones)||(r.Ventas_Monto?1:0)), 0);
  const avgTicket  = txs > 0 ? totalSales / txs : null;

  let retention = null;
  if (clientData.length > 0) {
    const activos = clientData.filter(r => (parseFloat(r.Días_Sin_Compra)||999) <= 90).length;
    retention = (activos / clientData.length) * 100;
  }

  let nps = null;
  const npsData = clientData.filter(r => r.NPS !== null && r.NPS !== undefined && r.NPS !== '');
  if (npsData.length > 0) {
    const p = npsData.filter(r => Number(r.NPS) >= 9).length;
    const d = npsData.filter(r => Number(r.NPS) <= 6).length;
    nps = Math.round(((p - d) / npsData.length) * 100);
  }

  return [
    { icon:'💰', label:i18n.t('kpiSales')||'Ventas totales',       value:totalSales, goalKey:'sales_monthly',   module:'sales',   isCurrency:true,  isPercent:false, inverted:false, deltaField:'Ventas_Monto', delta:null },
    { icon:'🎯', label:i18n.t('kpiGoalAchievement')||'Cumplimiento', value:goalPct,    goalKey:'goal_achievement',module:'sales',   isCurrency:false, isPercent:true,  inverted:false, delta:null },
    { icon:'🛒', label:i18n.t('kpiAvgTicket')||'Ticket promedio',   value:avgTicket,  goalKey:'avg_ticket',      module:'sales',   isCurrency:true,  isPercent:false, inverted:false, delta:null },
    { icon:'💚', label:i18n.t('kpiRetention')||i18n.getLang()==='es'?'Retención':'Retention',         value:retention,  goalKey:'retention_rate',  module:'clients', isCurrency:false, isPercent:true,  inverted:false, delta:null },
    { icon:'⭐', label:i18n.t('kpiNPS')||'NPS',                     value:nps,        goalKey:'nps',             module:'cx',      isCurrency:false, isPercent:false, inverted:false, delta:null },
  ];
}

// ── HEALTH INDEX ──────────────────────────────────────────────────
function calculateHealthIndex(kpisHome, goals) {
  const weights = { sales:.25, finance:.20, clients:.20, cx:.20, ops:.15 };

  function score(value, goal, inv = false) {
    if (!value || !goal) return 50;
    const r = inv ? goal / value : value / goal;
    return Math.min(Math.round(r * 100), 100);
  }

  const salesData  = storage.getData('sales'); // Home inmune a filtros
  const totalSales = salesData.reduce((s,r) => s+(parseFloat(r.Ventas_Monto)||0), 0);
  const totalGoal  = salesData.reduce((s,r) => s+(parseFloat(r.Meta_Ventas)||0), 0);

  const sScore = score(totalSales, totalGoal || goals.sales_monthly);
  const cScore = kpisHome.find(k => k.goalKey === 'retention_rate')?.value
    ? score(kpisHome.find(k => k.goalKey === 'retention_rate').value, goals.retention_rate) : 50;
  const nScore = kpisHome.find(k => k.goalKey === 'nps')?.value
    ? score(kpisHome.find(k => k.goalKey === 'nps').value, goals.nps) : 50;

  // Finanzas y Ops — calculados si hay datos
  let fScore = 50, oScore = 50;
  const finData = storage.getData('finance');
  if (finData.length) {
    const ing = finData.reduce((s,r)=>s+(parseFloat(r.Ingresos)||0), 0);
    const cos = finData.reduce((s,r)=>s+(parseFloat(r.Costos)||0), 0);
    const gm  = ing > 0 ? ((ing-cos)/ing)*100 : 0;
    fScore = score(gm, goals.gross_margin || 40);
  }
  const invData = storage.getData('inventory');
  if (invData.length) {
    const criticos = invData.filter(r => {
      const stock = parseFloat(r.Stock_Inicial)||0;
      const ventas = parseFloat(r.Ventas_Unidades)||0;
      const dias   = ventas > 0 ? (stock / (ventas / 30)) : 999;
      return dias < 7;
    }).length;
    oScore = Math.max(0, 100 - (criticos / Math.max(invData.length, 1)) * 100 * 5);
  }

  const total = Math.round(
    sScore * weights.sales + fScore * weights.finance +
    cScore * weights.clients + nScore * weights.cx + oScore * weights.ops
  );

  return {
    score: total,
    components: [
      { label:'💰 '+i18n.t('homeHealthCategories').split(',')[0],       score:sScore, status:sScore>=100?'green':sScore>=80?'yellow':'red' },
      { label:'💵 '+i18n.t('homeHealthCategories').split(',')[1],     score:fScore, status:fScore>=100?'green':fScore>=80?'yellow':'red' },
      { label:'👥 '+i18n.t('homeHealthCategories').split(',')[2],     score:cScore, status:cScore>=100?'green':cScore>=80?'yellow':'red' },
      { label:'😊 '+i18n.t('homeHealthCategories').split(',')[3], score:nScore, status:nScore>=100?'green':nScore>=80?'yellow':'red' },
      { label:'⚙️ '+i18n.t('homeHealthCategories').split(',')[4],  score:oScore, status:oScore>=100?'green':oScore>=80?'yellow':'red' },
    ],
  };
}

// ── GRÁFICO DE TENDENCIA ──────────────────────────────────────────
let _trendChartInstance = null;

function renderTrendChart(type = 'sales') {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  if (_trendChartInstance) { _trendChartInstance.destroy(); _trendChartInstance = null; }

  const salesData = storage.getData('sales');
  const months    = getLast6Months();
  const config    = storage.getConfig();
  const sym       = config.currencySymbol || '$';

  const values = months.map(m =>
    salesData.filter(r => {
      const d = storage.parseDate(r.Fecha);
      return d && d.getFullYear() === m.year && d.getMonth() === m.month;
    }).reduce((s,r) => s+(parseFloat(r.Ventas_Monto)||0), 0)
  );

  _trendChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels:   months.map(m => m.label),
      datasets: [{
        label:           i18n.t('kpiSales') || i18n.t('homeHealthCategories').split(',')[0],
        data:            values.some(v=>v>0) ? values : months.map(()=>Math.random()*5e6+2e6),
        borderColor:     '#3b82f6',
        backgroundColor: 'rgba(59,130,246,.08)',
        borderWidth:     2.5,
        pointBackgroundColor:'#3b82f6',
        pointRadius:     4, pointHoverRadius:6,
        tension:         0.4, fill:true,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor:'#1e293b', borderColor:'#334155', borderWidth:1,
          titleColor:'#94a3b8', bodyColor:'#f1f5f9',
          callbacks: { label: ctx => ' ' + formatCurrency(ctx.raw, sym) },
        },
      },
      scales: {
        x: { grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'#64748b',font:{size:11}} },
        y: { grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'#64748b',font:{size:11,family:'JetBrains Mono'},callback:v=>formatCurrency(v,sym)} },
      },
    },
  });
}

function switchTrendChart(type) {
  document.querySelectorAll('.chart-card .tab-item').forEach((t,i) => {
    t.classList.toggle('active', (i===0&&type==='sales')||(i===1&&type==='clients'));
  });
  renderTrendChart(type);
}

function getLast6Months() {
  const _monthsStr = i18n.t('monthsShort')||'Ene,Feb,Mar,Abr,May,Jun,Jul,Ago,Sep,Oct,Nov,Dic';
  const names     = _monthsStr.split(',');

  // Detectar el último mes que tiene datos de ventas
  const salesData = storage.getData('sales');
  const monthsWithData = new Set(
    salesData.map(r => {
      const d = storage.parseDate(r.Fecha);
      return d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : null;
    }).filter(Boolean)
  );

  // Usar el último mes con datos como punto de referencia (no el mes actual)
  const latestKey = [...monthsWithData].sort().pop();
  const refDate = latestKey
    ? new Date(parseInt(latestKey.split('-')[0]), parseInt(latestKey.split('-')[1])-1, 1)
    : new Date();

  const months = [];
  for (let i=5; i>=0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth()-i, 1);
    months.push({ year:d.getFullYear(), month:d.getMonth(), label:names[d.getMonth()] });
  }
  return months;
}

// ClaroKPIs — team-module.js
// Módulo Equipo

// MÓDULO EQUIPO
// ════════════════════════════════════════════════════════════════
const teamModule = (() => {
  function render(container) {
    const rows   = storage.applyFilters(storage.getData('team'),        'team');
    const goals  = storage.getGoals();
    const config = storage.getConfig();
    const sym    = config.currencySymbol || '$';
    const data   = calcTeamKPIs(rows, goals);
    const hasData = rows.length > 0;

    container.innerHTML = `
      <div class="module-header">
        <div class="module-title-wrap">
          <h1 class="module-title">👨‍💼 ${i18n.t('teamTitle')}</h1>
          <p class="module-subtitle">${rows.length.toLocaleString()} ${i18n.t('registros')||'registros'}${(() => {
              const _dr = storage.getDataDateRange('team');
              return _dr ? ' · ' + (i18n.getLang()==='es' ? 'Datos: ' : 'Data: ') + _dr.label : '';
            })()}</p>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button>
      </div>
      ${renderGlobalFilters('team', { showSeller: true, showBranch: true, showChannel: false })}
      ${!hasData ? noData() : `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:10px 14px;background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:8px;flex-wrap:wrap;">
          <label style="display:flex;align-items:center;gap:8px;font-size:.82rem;color:var(--color-text-muted);cursor:pointer;">
            <input type="checkbox" ${storage.getFilters().hideInactiveStock?'checked':''}
              onchange="storage.setFilters({hideInactiveStock:this.checked});inventoryModule._rerender()"
              style="width:16px;height:16px;cursor:pointer;">
            ${i18n.t('invOcultarSinMov')}
          </label>
          <span style="font-size:.75rem;color:var(--color-text-faint);">
            (${i18n.t('invOcultarDesc')})
          </span>
        </div>
        ` + renderContent(data, goals, sym)}
    `;
    if (hasData) setTimeout(() => renderCharts(data, sym), 50);
  }

  function renderContent(data, goals, sym) {
    const absStatus  = storage.getStatus(data.absenteeism, goals.absenteeism || 5, true);
    const goalStatus = storage.getStatus(data.avgGoalAchievement, goals.team_goal_achievement || 90);

    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:20px;">
        ${kpiCard('👥',i18n.t('teamDotacion'),        (data.headcount||0).toLocaleString(), 'blue',i18n.t('teamPersonasPeriodo'),null,null)}
        ${kpiCard('🎯',i18n.t('teamCumplimiento'),  pct(data.avgGoalAchievement), goalStatus,`Meta: ${goals.team_goal_achievement||90}%`,data.avgGoalAchievement,goalStatus)}
        ${kpiCard('📅',i18n.t('teamAusentismo'),             pct(data.absenteeism), absStatus,i18n.t('teamDiasAusentes'),null,null)}
        ${kpiCard('💰',i18n.t('teamProductividad'),          fmt(data.productivity,sym),'green',i18n.t('teamVentasPorPersona'),null,null)}
        ${kpiCard('🔴',i18n.t('teamBajoMeta'),              (data.underGoal||0).toString(),'red',i18n.t('teamVendedoresBajo'),null,null)}
        ${kpiCard('⭐','Top performer',          data.topSeller||'—','green',i18n.t('teamMayorCumplim'),null,null)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;" class="charts-row">
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">${i18n.t('teamCumplimIndiv')}</div></div>
          <div class="chart-container" style="height:${Math.min(data.sellers.length*38+60,320)}px;"><canvas id="teamGoalChart"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">${i18n.t('teamAusentismoPers')}</div></div>
          <div class="chart-container" style="height:${Math.min(data.sellers.length*38+60,320)}px;"><canvas id="teamAbsChart"></canvas></div>
        </div>
      </div>
    `;
  }

  function calcTeamKPIs(rows, goals) {
    if (!rows.length) return { headcount:0,avgGoalAchievement:null,absenteeism:null,productivity:null,underGoal:0,topSeller:null,sellers:[] };
    // Dotación = vendedores ÚNICOS, no suma de filas
    const headcount = new Set(rows.map(r => r.Vendedor).filter(Boolean)).size || rows.length;
    const totalSales = rows.reduce((s,r)=>s+(parseFloat(r.Ventas_Monto)||0),0);
    const totalMeta  = rows.reduce((s,r)=>s+(parseFloat(r.Meta_Mes)||0),0);
    const totalDays  = rows.reduce((s,r)=>s+(parseFloat(r.Dias_Trabajados)||0),0);
    const totalAbs   = rows.reduce((s,r)=>s+(parseFloat(r.Dias_Ausentes)||0),0);

    const avgGoalAch = totalMeta > 0 ? (totalSales / totalMeta) * 100 : null;
    const absenteeism = (totalDays + totalAbs) > 0 ? (totalAbs / (totalDays + totalAbs)) * 100 : null;
    const productivity = headcount > 0 ? totalSales / headcount : null;

    // Por vendedor
    const sellerMap = {};
    rows.forEach(r => {
      const n = r.Vendedor || 'Sin nombre';
      if (!sellerMap[n]) sellerMap[n] = { name:n, sales:0, meta:0, days:0, absent:0 };
      sellerMap[n].sales  += parseFloat(r.Ventas_Monto) || 0;
      sellerMap[n].meta   += parseFloat(r.Meta_Mes) || 0;
      sellerMap[n].days   += parseFloat(r.Dias_Trabajados) || 0;
      sellerMap[n].absent += parseFloat(r.Dias_Ausentes) || 0;
    });
    const sellers = Object.values(sellerMap).map(s => ({
      ...s,
      goalPct: s.meta > 0 ? (s.sales / s.meta) * 100 : null,
      absPct:  (s.days+s.absent)>0 ? (s.absent/(s.days+s.absent))*100 : 0,
    })).sort((a,b) => (b.goalPct||0) - (a.goalPct||0));

    const underGoal = sellers.filter(s => s.goalPct !== null && s.goalPct < 80).length;
    const topSeller = sellers.length ? sellers[0].name.split(' ')[0] : null;

    return { headcount, avgGoalAchievement:avgGoalAch, absenteeism, productivity, underGoal, topSeller, sellers };
  }

  function renderCharts(data, sym) {
    const BASE={responsive:true,maintainAspectRatio:false,animation:{duration:500},plugins:{legend:{display:false},tooltip:{backgroundColor:'#1e293b',borderColor:'#334155',borderWidth:1,titleColor:'#94a3b8',bodyColor:'#f1f5f9',padding:8,cornerRadius:6}},scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11}},border:{display:false}},y:{grid:{display:false},ticks:{color:'#64748b',font:{size:11}},border:{display:false}}}};
    const s=data.sellers;
    mkChart('teamGoalChart',{type:'bar',data:{labels:s.map(v=>v.name.split(' ')[0]),datasets:[{label:'Cumplimiento %',data:s.map(v=>v.goalPct?.toFixed(1)||0),backgroundColor:s.map(v=>v.goalPct>=100?'rgba(34,197,94,.7)':v.goalPct>=80?'rgba(234,179,8,.7)':'rgba(239,68,68,.7)'),borderColor:s.map(v=>v.goalPct>=100?'#22c55e':v.goalPct>=80?'#eab308':'#ef4444'),borderWidth:1.5,borderRadius:4}]},options:{...BASE,indexAxis:'y',scales:{x:{...BASE.scales.x,ticks:{...BASE.scales.x.ticks,callback:v=>v+'%'}},y:BASE.scales.y}}});
    mkChart('teamAbsChart',{type:'bar',data:{labels:s.map(v=>v.name.split(' ')[0]),datasets:[{label:'Ausentismo %',data:s.map(v=>v.absPct?.toFixed(1)||0),backgroundColor:s.map(v=>v.absPct>10?'rgba(239,68,68,.7)':v.absPct>5?'rgba(234,179,8,.7)':'rgba(34,197,94,.7)'),borderColor:s.map(v=>v.absPct>10?'#ef4444':v.absPct>5?'#eab308':'#22c55e'),borderWidth:1.5,borderRadius:4}]},options:{...BASE,indexAxis:'y',scales:{x:{...BASE.scales.x,ticks:{...BASE.scales.x.ticks,callback:v=>v+'%'}},y:BASE.scales.y}}});
  }

  function mkChart(id,config){const el=document.getElementById(id);if(!el)return;if(window._ckCharts&&window._ckCharts[id])window._ckCharts[id].destroy();if(!window._ckCharts)window._ckCharts={};window._ckCharts[id]=new Chart(el,config);}
  function kpiCard(icon,label,value,status,sub,p,ps){return`<div class="kpi-card ${status}"><div class="kpi-card-header"><div class="kpi-card-icon">${icon}</div><div class="kpi-status-dot ${status}"></div></div><div class="kpi-card-value">${value}</div><div class="kpi-card-label">${label}</div>${sub?`<div style="font-size:.72rem;color:var(--color-text-faint);margin-top:3px">${sub}</div>`:''}${p!==null&&p!==undefined?`<div class="kpi-card-progress" style="margin-top:8px"><div class="progress-bar-wrap"><div class="progress-bar-fill ${ps||status}" style="width:${Math.min(p,100)}%"></div></div></div>`:''}</div>`;}
  function pct(v){return v!==null&&v!==undefined?v.toFixed(1)+'%':'—';}
  function fmt(n,sym='$'){if(!n)return`${sym}—`;if(n>=1000000)return`${sym}${(n/1000000).toFixed(1)}M`;if(n>=1000)return`${sym}${(n/1000).toFixed(0)}K`;return`${sym}${Math.round(n).toLocaleString()}`;}
  function noData(){return`<div class="no-data-state"><div class="no-data-icon">👨‍💼</div><h2 class="no-data-title">${i18n.t('errorNoData')}</h2><p class="no-data-desc">Sube un Excel de equipo con columnas: Vendedor, Ventas_Monto, Meta_Mes, Dias_Trabajados, Dias_Ausentes</p><button class="btn btn-primary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button></div>`;}
  return { render };
})();


// ════════════════════════════════════════════════════════════════
// MÓDULO INVENTARIO
window.teamModule       = teamModule;

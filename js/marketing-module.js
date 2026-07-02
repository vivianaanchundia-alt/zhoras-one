// ClaroKPIs — marketing-module.js
// Módulo Marketing vs Ventas

/**
 * ClaroKPIs — marketing-cx-team-inventory-modules.js
 * 4 módulos: Marketing vs Ventas, CX Satisfacción, Equipo, Inventario.
 */

// ════════════════════════════════════════════════════════════════
// MÓDULO MARKETING vs VENTAS
// ════════════════════════════════════════════════════════════════
const marketingModule = (() => {
  function render(container) {
    const rows   = storage.applyFilters(storage.getData('marketing'),  'marketing');
    const sym    = storage.getConfig().currencySymbol || '$';
    const goals  = storage.getGoals();
    const data   = calcMarketingKPIs(rows);
    const hasData = rows.length > 0;

    container.innerHTML = `
      <div class="module-header">
        <div class="module-title-wrap">
          <h1 class="module-title">📣 ${i18n.t('marketingTitle')}</h1>
          <p class="module-subtitle">${rows.length.toLocaleString()} ${i18n.t('registros')||'registros'}${(() => {
              const _dr = storage.getDataDateRange('marketing');
              return _dr ? ' · ' + (i18n.getLang()==='es' ? 'Datos: ' : 'Data: ') + _dr.label : '';
            })()}</p>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button>
      </div>
      ${renderGlobalFilters('marketing', { showSeller: false, showChannel: false, showBranch: false })}
      ${!hasData ? noData('📣','marketing','Fecha, Campaña, Canal_Marketing, Inversión, Leads, Ventas_Campaña') : renderContent(data, goals, sym)}
    `;
    if (hasData) setTimeout(() => renderCharts(data, sym), 50);
  }

  function renderContent(data, goals, sym) {
    const roiStatus  = storage.getStatus(data.roi,  goals.roi_marketing || 200);
    const roasStatus = storage.getStatus(data.roas, 3);
    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:20px;">
        ${kpiCard('💰',(i18n.getLang()==='es'?'Inversión total':'Total investment'),   fmt(data.totalInvestment,sym),'blue',i18n.t('mktPresupuesto'),null,null,true)}
        ${kpiCard('📈','ROI',               pct(data.roi),               roiStatus, `Meta: ${goals.roi_marketing||200}%`, Math.min(data.roi||0,300), roiStatus)}
        ${kpiCard('🎯','ROAS',              data.roas!==null?data.roas.toFixed(2)+'x':'—', roasStatus,(i18n.getLang()==='es'?'retorno x peso invertido':'return per unit invested'),null,null)}
        ${kpiCard('👤','CPL',               fmt(data.cpl,sym),           'blue',(i18n.getLang()==='es'?'costo por lead':'cost per lead'),null,null)}
        ${kpiCard('📊',i18n.t('mktLeadsGenerados'),   (data.totalLeads||0).toLocaleString(),'blue',(i18n.getLang()==='es'?'total del período':'total for period'),null,null)}
        ${kpiCard('💵',i18n.t('mktVentasAtribuidas'), fmt(data.attributedSales,sym),'green',(i18n.getLang()==='es'?'por campaña':'per campaign'),null,null)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;" class="charts-row">
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">${i18n.t('mktROIPorCampaña')}</div></div>
          <div class="chart-container" style="height:240px;"><canvas id="mktRoiChart"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">${i18n.t('mktInvPorCanal')}</div></div>
          <div class="chart-container" style="height:240px;"><canvas id="mktChannelChart"></canvas></div>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-card-header"><div class="chart-card-title">${i18n.t('mktInvVsVentas')}</div></div>
        <div class="chart-container" style="height:240px;"><canvas id="mktUpliftChart"></canvas></div>
      </div>
    `;
  }

  function calcMarketingKPIs(rows) {
    if (!rows.length) return { totalInvestment:0,roi:null,roas:null,cpl:null,totalLeads:0,attributedSales:0,byCampaign:[],byChannel:[] };
    const totalInv  = rows.reduce((s,r)=>s+(parseFloat(r.Inversión)||0),0);
    const totalSales= rows.reduce((s,r)=>s+(parseFloat(r.Ventas_Campaña)||parseFloat(r.Monto_Ventas)||0),0);
    const totalLeads= rows.reduce((s,r)=>s+(parseFloat(r.Leads)||0),0);
    const roi    = totalInv > 0 ? ((totalSales - totalInv) / totalInv) * 100 : null;
    const roas   = totalInv > 0 ? totalSales / totalInv : null;
    const cpl    = totalLeads > 0 ? totalInv / totalLeads : null;

    const byCampaign = groupBy(rows,'Campaña','Inversión','Ventas_Campaña');
    const byChannel  = groupBy(rows,'Canal_Marketing','Inversión','Ventas_Campaña');
    return { totalInvestment:totalInv, roi, roas, cpl, totalLeads, attributedSales:totalSales, byCampaign, byChannel };
  }

  function groupBy(rows, groupF, invF, salesF) {
    const g = {};
    rows.forEach(r => {
      const k = r[groupF]||'Sin datos';
      if(!g[k]) g[k]={label:k,inv:0,sales:0};
      g[k].inv   += parseFloat(r[invF])||0;
      g[k].sales += parseFloat(r[salesF])||0;
    });
    return Object.values(g).map(v=>({...v, roi: v.inv>0?((v.sales-v.inv)/v.inv*100):null})).sort((a,b)=>b.inv-a.inv);
  }

  function renderCharts(data, sym) {
    const BASE=mkBase(sym);
    const PALETTE=['#3b82f6','#6366f1','#22c55e','#eab308','#ef4444','#a855f7','#f97316','#14b8a6'];
    const top6c=data.byCampaign.slice(0,6);
    mkChart('mktRoiChart',{type:'bar',data:{labels:top6c.map(c=>c.label.length>15?c.label.slice(0,13)+'…':c.label),datasets:[
      {label:'ROI %',data:top6c.map(c=>c.roi?.toFixed(1)||0),backgroundColor:top6c.map(c=>(c.roi||0)>=100?'rgba(34,197,94,.7)':'rgba(239,68,68,.7)'),borderColor:top6c.map(c=>(c.roi||0)>=100?'#22c55e':'#ef4444'),borderWidth:1.5,borderRadius:5}]},
      options:{...BASE,plugins:{...BASE.plugins,legend:{display:false}},scales:{...BASE.scales,y:{...BASE.scales.y,ticks:{color:'#64748b',font:{size:11},callback:v=>v+'%'}}}}});
    const top6ch=data.byChannel.slice(0,6);
    mkChart('mktChannelChart',{type:'doughnut',data:{labels:top6ch.map(c=>c.label),datasets:[{data:top6ch.map(c=>c.inv),backgroundColor:PALETTE.slice(0,top6ch.length).map(c=>c+'cc'),borderColor:PALETTE.slice(0,top6ch.length),borderWidth:1.5,hoverOffset:5}]},
      options:{...BASE,cutout:'65%',scales:{x:{display:false},y:{display:false}}}});
    mkChart('mktUpliftChart',{type:'bar',data:{labels:top6c.map(c=>c.label.length>12?c.label.slice(0,10)+'…':c.label),datasets:[
      {label:i18n.t('mktInversion'),data:top6c.map(c=>c.inv),backgroundColor:'rgba(239,68,68,.6)',borderColor:'#ef4444',borderWidth:1.5,borderRadius:4},
      {label:i18n.t('mktVentasGeneradas'),data:top6c.map(c=>c.sales),backgroundColor:'rgba(34,197,94,.6)',borderColor:'#22c55e',borderWidth:1.5,borderRadius:4},
    ]},options:{...BASE}});
  }

  function mkChart(id,config){const el=document.getElementById(id);if(!el)return;if(window._ckCharts&&window._ckCharts[id])window._ckCharts[id].destroy();if(!window._ckCharts)window._ckCharts={};window._ckCharts[id]=new Chart(el,config);}
  function mkBase(sym){return{responsive:true,maintainAspectRatio:false,animation:{duration:500},plugins:{legend:{labels:{color:'#94a3b8',font:{size:11},boxWidth:10,padding:12}},tooltip:{backgroundColor:'#1e293b',borderColor:'#334155',borderWidth:1,titleColor:'#94a3b8',bodyColor:'#f1f5f9',padding:8,cornerRadius:6}},scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11}},border:{display:false}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11},callback:v=>sym+(v>=1000000?(v/1000000).toFixed(1)+'M':v>=1000?(v/1000).toFixed(0)+'K':v)},border:{display:false}}}};}
  function kpiCard(icon,label,value,status,sub,p,ps){return`<div class="kpi-card ${status}"><div class="kpi-card-header"><div class="kpi-card-icon">${icon}</div><div class="kpi-status-dot ${status}"></div></div><div class="kpi-card-value">${value}</div><div class="kpi-card-label">${label}</div>${sub?`<div style="font-size:.72rem;color:var(--color-text-faint);margin-top:3px">${sub}</div>`:''}${p!==null&&p!==undefined?`<div class="kpi-card-progress" style="margin-top:8px"><div class="progress-bar-wrap"><div class="progress-bar-fill ${ps||status}" style="width:${Math.min(p,100)}%"></div></div></div>`:''}</div>`;}
  function pct(v){return v!==null&&v!==undefined?v.toFixed(1)+'%':'—';}
  function fmt(n,sym='$'){if(!n)return`${sym}—`;if(n>=1000000)return`${sym}${(n/1000000).toFixed(1)}M`;if(n>=1000)return`${sym}${(n/1000).toFixed(0)}K`;return`${sym}${Math.round(n).toLocaleString()}`;}
  function noData(icon,mod,cols){return`<div class="no-data-state"><div class="no-data-icon">${icon}</div><h2 class="no-data-title">${i18n.t('errorNoData')}</h2><p class="no-data-desc">Sube un Excel de ${mod} con columnas: ${cols}</p><button class="btn btn-primary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button></div>`;}

  return { render };
})();


// ════════════════════════════════════════════════════════════════
// MÓDULO CX / SATISFACCIÓN
window.marketingModule  = marketingModule;

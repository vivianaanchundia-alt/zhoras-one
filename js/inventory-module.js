// ClaroKPIs — inventory-module.js
// Módulo Inventario

// ════════════════════════════════════════════════════════════════
const inventoryModule = (() => {
  function render(container) {
    const rows   = storage.applyFilters(storage.getData('inventory'), 'inventory');
    const goals  = storage.getGoals();
    const config = storage.getConfig();
    const sym    = config.currencySymbol || '$';
    const data   = calcInventoryKPIs(rows, goals);
    const hasData = rows.length > 0;

    container.innerHTML = `
      <div class="module-header">
        <div class="module-title-wrap">
          <h1 class="module-title">📦 ${i18n.t('inventoryTitle')}</h1>
          <p class="module-subtitle">${rows.length.toLocaleString()} ${i18n.t('registros')||'registros'}${(() => {
              const _dr = storage.getDataDateRange('inventory');
              return _dr ? ' · ' + (i18n.getLang()==='es' ? 'Datos: ' : 'Data: ') + _dr.label : '';
            })()}</p>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button>
      </div>
      ${renderGlobalFilters('inventory', { showSeller: false, showBranch: true, showChannel: false })}
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
    const daysStatus = storage.getStatus(data.avgDaysInventory, goals.inventory_days || 30, true);
    const rotStatus  = storage.getStatus(data.rotationRate, 12);
    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:20px;">
        ${kpiCard('📦',i18n.t('invDiasInv'),  data.avgDaysInventory!==null?data.avgDaysInventory.toFixed(0)+' días':'—', daysStatus, `Meta: <${goals.inventory_days||30} ${i18n.getLang()==='es'?'días':'days'}`, null, null)}
        ${kpiCard('🔄',(i18n.getLang()==='es'?'Rotación anual':'Annual turnover'),      data.rotationRate!==null?data.rotationRate.toFixed(1)+'x':'—', rotStatus,i18n.t('invVecesAlAnio'),null,null)}
        ${kpiCard('↩️',i18n.t('invDevoluciones'),        pct(data.returnRate), data.returnRate<5?'green':data.returnRate<10?'yellow':'red',i18n.t('invSobreVentas'),null,null)}
        ${kpiCard('🚨',(i18n.getLang()==='es'?'Stock crítico':'Critical stock'),       (data.criticalStock||[]).length.toString(),'red',i18n.t('invProductosMenos7'),null,null)}
        ${kpiCard('✅','Perfect Order Rate',  pct(data.perfectOrderRate),'green',i18n.t('invPedidosPerfectos'),data.perfectOrderRate,data.perfectOrderRate>=95?'green':data.perfectOrderRate>=85?'yellow':'red')}
        ${kpiCard('💵',i18n.t('invValorInv'),fmt(data.inventoryValue,sym),'blue',i18n.t('invStockCosto'),null,null)}
      </div>

      ${data.criticalStock.length > 0 ? `
        <div class="card" style="background:var(--color-red-bg);border-color:var(--color-red-border);margin-bottom:16px;">
          <div style="font-weight:700;color:var(--color-red);margin-bottom:10px;">🚨 ${data.criticalStock.length} productos con stock crítico (&lt;7 días)</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${data.criticalStock.slice(0,10).map(p=>`<span class="badge badge-red">${p.label} — ${p.days.toFixed(0)} días</span>`).join('')}
          </div>
          <div style="margin-top:10px;font-size:.78rem;color:var(--color-text-muted)">💡 Generar orden de compra urgente para estos productos.</div>
        </div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;" class="charts-row">
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">${i18n.t('invDiasPorProducto')}</div></div>
          <div class="chart-container" style="height:260px;"><canvas id="invDaysChart"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header"><div class="chart-card-title">${i18n.t('invPorCategoria')}</div></div>
          <div class="chart-container" style="height:260px;"><canvas id="invCategoryChart"></canvas></div>
        </div>
      </div>
    `;
  }

  function calcInventoryKPIs(rows, goals) {
    if (!rows.length) return { avgDaysInventory:null,rotationRate:null,returnRate:null,criticalStock:[],perfectOrderRate:null,inventoryValue:0,byCategory:[] };

    const products = {};
    rows.forEach(r => {
      const p = r.Producto || r.Categoría || 'Sin nombre';
      if (!products[p]) products[p] = { label:p, stock:0, sold:0, returns:0, cost:0, category:r.Categoría||'General' };
      products[p].stock   += parseFloat(r.Stock_Inicial)  || 0;
      products[p].sold    += parseFloat(r.Ventas_Unidades)|| 0;
      products[p].returns += parseFloat(r.Devoluciones)   || 0;
      products[p].cost     = parseFloat(r.Costo_Unitario) || products[p].cost;
    });

    const pList = Object.values(products);
    pList.forEach(p => {
      p.dailySales = p.sold / 30;
      p.days       = p.dailySales > 0 ? p.stock / p.dailySales : 999;
      p.value      = p.stock * p.cost;
    });

    const avgDays = pList.length ? pList.reduce((s,p)=>s+Math.min(p.days,365),0)/pList.length : null;
    const totalSold = pList.reduce((s,p)=>s+p.sold,0);
    const totalRet  = pList.reduce((s,p)=>s+p.returns,0);
    const returnRate = totalSold > 0 ? (totalRet/totalSold)*100 : null;
    const totalStock = pList.reduce((s,p)=>s+p.stock,0);
    const rotationRate = totalStock > 0 ? (totalSold / totalStock) * 12 : null;
    const inventoryValue = pList.reduce((s,p)=>s+p.value,0);
    const criticalStock = pList.filter(p=>p.days<7&&p.days>0).sort((a,b)=>a.days-b.days);

    const catMap = {};
    pList.forEach(p=>{ catMap[p.category]=(catMap[p.category]||0)+p.value; });
    const byCategory = Object.entries(catMap).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);

    return { avgDaysInventory:avgDays, rotationRate, returnRate, criticalStock, perfectOrderRate:90, inventoryValue, byCategory, products:pList };
  }

  function renderCharts(data, sym) {
    const BASE={responsive:true,maintainAspectRatio:false,animation:{duration:500},plugins:{legend:{labels:{color:'#94a3b8',font:{size:11},boxWidth:10,padding:12}},tooltip:{backgroundColor:'#1e293b',borderColor:'#334155',borderWidth:1,titleColor:'#94a3b8',bodyColor:'#f1f5f9',padding:8,cornerRadius:6}},scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#64748b',font:{size:11}},border:{display:false}},y:{grid:{display:false},ticks:{color:'#64748b',font:{size:11}},border:{display:false}}}};
    const PALETTE=['#3b82f6','#6366f1','#22c55e','#eab308','#ef4444','#a855f7','#f97316','#14b8a6'];
    const top10 = data.products.slice(0,10).sort((a,b)=>a.days-b.days);
    mkChart('invDaysChart',{type:'bar',data:{labels:top10.map(p=>p.label.length>14?p.label.slice(0,12)+'…':p.label),datasets:[{label:(i18n.getLang()==='es'?'Días de stock':'Days of stock'),data:top10.map(p=>Math.min(p.days,365).toFixed(0)),backgroundColor:top10.map(p=>p.days<7?'rgba(239,68,68,.7)':p.days<15?'rgba(234,179,8,.7)':'rgba(34,197,94,.7)'),borderColor:top10.map(p=>p.days<7?'#ef4444':p.days<15?'#eab308':'#22c55e'),borderWidth:1.5,borderRadius:4}]},options:{...BASE,indexAxis:'y',plugins:{...BASE.plugins,legend:{display:false}}}});
    const cats = data.byCategory.slice(0,6);
    mkChart('invCategoryChart',{type:'doughnut',data:{labels:cats.map(c=>c.label),datasets:[{data:cats.map(c=>c.value),backgroundColor:PALETTE.slice(0,cats.length).map(c=>c+'cc'),borderColor:PALETTE.slice(0,cats.length),borderWidth:1.5,hoverOffset:5}]},options:{...BASE,cutout:'65%',scales:{x:{display:false},y:{display:false}}}});
  }

  function mkChart(id,config){const el=document.getElementById(id);if(!el)return;if(window._ckCharts&&window._ckCharts[id])window._ckCharts[id].destroy();if(!window._ckCharts)window._ckCharts={};window._ckCharts[id]=new Chart(el,config);}
  function kpiCard(icon,label,value,status,sub,p,ps){return`<div class="kpi-card ${status}"><div class="kpi-card-header"><div class="kpi-card-icon">${icon}</div><div class="kpi-status-dot ${status}"></div></div><div class="kpi-card-value">${value}</div><div class="kpi-card-label">${label}</div>${sub?`<div style="font-size:.72rem;color:var(--color-text-faint);margin-top:3px">${sub}</div>`:''}${p!==null&&p!==undefined?`<div class="kpi-card-progress" style="margin-top:8px"><div class="progress-bar-wrap"><div class="progress-bar-fill ${ps||status}" style="width:${Math.min(p,100)}%"></div></div></div>`:''}</div>`;}
  function pct(v){return v!==null&&v!==undefined?v.toFixed(1)+'%':'—';}
  function fmt(n,sym='$'){if(!n)return`${sym}—`;if(n>=1000000)return`${sym}${(n/1000000).toFixed(1)}M`;if(n>=1000)return`${sym}${(n/1000).toFixed(0)}K`;return`${sym}${Math.round(n).toLocaleString()}`;}
  function noData(){return`<div class="no-data-state"><div class="no-data-icon">📦</div><h2 class="no-data-title">${i18n.t('errorNoData')}</h2><p class="no-data-desc">Sube un Excel de inventario con columnas: Producto, Stock_Inicial, Ventas_Unidades, Costo_Unitario, Devoluciones</p><button class="btn btn-primary" onclick="showModal('uploadModal')">📂 ${i18n.t('uploadData')}</button></div>`;}
  function _rerender() {
    const c = document.getElementById('contentArea');
    if (c) render(c);
  }
  return { render, _rerender };
})();
window.inventoryModule  = inventoryModule;

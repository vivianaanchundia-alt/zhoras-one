// ════════════════════════════════════════════════════════════════
// CLAROKPIS — charts.js v2.0
// Extiende la base existente con gráficos para todos los módulos.
// Todo lo anterior se mantiene intacto.
// ════════════════════════════════════════════════════════════════

const charts = (() => {

  // ── REGISTRO ─────────────────────────────────────────────────
  const registry = {};

  // ── PALETA ───────────────────────────────────────────────────
  const COLORS = {
    blue:   '#3b82f6',
    indigo: '#6366f1',
    green:  '#22c55e',
    yellow: '#f59e0b',
    red:    '#ef4444',
    purple: '#a855f7',
    pink:   '#ec4899',
    cyan:   '#06b6d4',
    orange: '#f97316',
    teal:   '#14b8a6',
  };
  const PALETTE = Object.values(COLORS);

  // ── DEFAULTS ─────────────────────────────────────────────────
  const BASE = {
    responsive:          true,
    maintainAspectRatio: false,
    animation:           { duration: 400, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        labels: {
          color:    '#6b7a8d',
          font:     { family: 'Plus Jakarta Sans', size: 11.5, weight: '500' },
          boxWidth: 10,
          boxHeight: 10,
          padding:  20,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: '#0f1623',
        borderColor:     'rgba(255,255,255,.08)',
        borderWidth:     1,
        titleColor:      '#6b7a8d',
        bodyColor:       '#e8edf5',
        padding:         12,
        cornerRadius:    10,
        titleFont:       { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
        bodyFont:        { family: 'JetBrains Mono', size: 12 },
        displayColors:   true,
        boxWidth:        8,
        boxHeight:       8,
      },
    },
    scales: {
      x: {
        grid:   { color: 'rgba(255,255,255,0.06)', drawBorder: false, tickLength: 0 },
        ticks:  { color: '#4a5568', font: { size: 10.5, family: 'Plus Jakarta Sans', weight: '500' }, maxRotation: 0 },
        border: { display: false },
      },
      y: {
        grid:   { color: 'rgba(255,255,255,0.06)', drawBorder: false },
        ticks:  { color: '#4a5568', font: { size: 10.5, family: 'JetBrains Mono' } },
        border: { display: false },
      },
    },
  };

  // ── CORE ─────────────────────────────────────────────────────
  function destroy(id) {
    if (registry[id]) { registry[id].destroy(); delete registry[id]; }
  }
  function create(id, config) {
    destroy(id);
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const chart = new Chart(canvas, config);
    registry[id] = chart;
    return chart;
  }
  function destroyAll() { Object.keys(registry).forEach(destroy); }

  // ── FORMATTERS ────────────────────────────────────────────────
  const sym = () => storage.getConfig().currencySymbol || '$';
  function fTick(v, s)    { s=s||sym(); const a=Math.abs(v); if(a>=1e6) return `${s}${(v/1e6).toFixed(1)}M`; if(a>=1e3) return `${s}${(v/1e3).toFixed(0)}K`; return `${s}${v}`; }
  function fFull(v, s)    { s=s||sym(); return ` ${s}${Math.round(v).toLocaleString('es-CL')}`; }
  function fPct(v)        { return ` ${Number(v).toFixed(1)}%`; }
  function monthLabel(key){ const [y,m]=key.split('-'); const _ms=typeof i18n!=='undefined'?i18n.t('monthsShort'):'Ene,Feb,Mar,Abr,May,Jun,Jul,Ago,Sep,Oct,Nov,Dic'; const n=_ms.split(','); return n[+m-1]+(y!==String(new Date().getFullYear())?` '${y.slice(2)}`:''); }
  function truncate(s,n)  { return s.length>n ? s.slice(0,n-1)+'…' : s; }

  // ── MERGE OPTIONS ─────────────────────────────────────────────
  function opt(overrides) {
    return {
      ...BASE,
      plugins:  { ...BASE.plugins,  ...overrides.plugins  },
      scales:   { ...BASE.scales,   ...overrides.scales   },
      ...Object.fromEntries(Object.entries(overrides).filter(([k])=>!['plugins','scales'].includes(k))),
    };
  }

  // ════════════════════════════════════════════════════════════════
  // VENTAS (existentes — mantenidos intactos + nuevos)
  // ════════════════════════════════════════════════════════════════
  function salesTrendLine(id, data) {
    return create(id, {
      type: 'line',
      data: {
        labels: data.map(m => monthLabel(m.key)),
        datasets: [
          { label: i18n.t('chartSales'), data: data.map(m=>m.value||m.monto||0), borderColor: COLORS.blue, backgroundColor:'rgba(59,130,246,.06', tension:0.4, pointRadius:4, pointHoverRadius:6, pointBackgroundColor:COLORS.blue, borderWidth:1.5, backgroundColor:'rgba(59,130,246,.06)', borderWidth:2.5, pointRadius:4, pointHoverRadius:7, tension:.4, fill:true },
          { label: i18n.t('chartGoal'),  data: data.map(m=>m.meta||null), borderColor:'rgba(245,158,11,.5)', backgroundColor:'transparent', borderWidth:1.5, borderDash:[6,3], pointRadius:0, fill:false },
        ],
      },
      options: opt({ plugins:{ ...BASE.plugins, tooltip:{ ...BASE.plugins.tooltip, callbacks:{ label: ctx=>`${ctx.dataset.label}: ${fFull(ctx.raw)}` }}}, scales:{ x:BASE.scales.x, y:{ ...BASE.scales.y, ticks:{ ...BASE.scales.y.ticks, callback: v=>fTick(v) }}}}),
    });
  }

  function salesByChannelBar(id, data) {
    const colors = data.map((_,i)=>PALETTE[i%PALETTE.length]);
    return create(id, {
      type: 'bar',
      data: { labels: data.map(d=>d.label), datasets:[{ label:i18n.t('chartSales'), data:data.map(d=>d.value), backgroundColor:colors.map(c=>c+'cc'), borderColor:colors, borderWidth:1.5, borderRadius:6, borderSkipped:false }] },
      options: opt({ plugins:{ ...BASE.plugins, legend:{display:false}, tooltip:{...BASE.plugins.tooltip, callbacks:{ label:ctx=>fFull(ctx.raw), afterLabel:ctx=>` ${data[ctx.dataIndex]?.pct?.toFixed(1)}% del total` }}}, scales:{ x:BASE.scales.x, y:{ ...BASE.scales.y, ticks:{ ...BASE.scales.y.ticks, callback:v=>fTick(v) }}}}),
    });
  }

  function salesDonut(id, data) {
    const top  = data.slice(0,6);
    const rest = data.slice(6);
    const labels = [...top.map(d=>d.label), ...(rest.length?['Otros']:[])];
    const values = [...top.map(d=>d.value), ...(rest.length?[rest.reduce((s,d)=>s+d.value,0)]:[])];
    return create(id, {
      type: 'doughnut',
      data: { labels, datasets:[{ data:values, backgroundColor:PALETTE.slice(0,labels.length).map(c=>c+'cc'), borderColor:PALETTE.slice(0,labels.length), borderWidth:1.5, hoverOffset:6 }] },
      options: opt({ cutout:'68%', plugins:{ ...BASE.plugins, tooltip:{...BASE.plugins.tooltip, callbacks:{ label:ctx=>{ const t=values.reduce((a,b)=>a+b,0); return ` ${ctx.label}: ${fFull(ctx.raw)} (${((ctx.raw/t)*100).toFixed(1)}%)`; }}}}, scales:{ x:{display:false}, y:{display:false} }}),
    });
  }

  function sellerRankingBar(id, sellers) {
    const top    = sellers.slice(0,10);
    const colors = top.map(s=>s.status==='green'?COLORS.green+'cc':s.status==='yellow'?COLORS.yellow+'cc':COLORS.red+'cc');
    return create(id, {
      type: 'bar',
      data: { labels:top.map(s=>s.name.split(' ')[0]), datasets:[
        { label:i18n.t('chartSales'), data:top.map(s=>s.monto), backgroundColor:colors, borderColor:colors.map(c=>c.slice(0,7)), borderWidth:1.5, borderRadius:4 },
        { label:i18n.t('chartGoal'),  data:top.map(s=>s.meta||0), backgroundColor:'rgba(245,158,11,.12)', borderColor:'rgba(245,158,11,.5)', borderWidth:1.5, borderRadius:4 },
      ]},
      options: opt({ indexAxis:'y', plugins:{ ...BASE.plugins, tooltip:{...BASE.plugins.tooltip, callbacks:{ label:ctx=>`${ctx.dataset.label}: ${fFull(ctx.raw)}`}}}, scales:{ x:{ ...BASE.scales.x, ticks:{...BASE.scales.x.ticks, callback:v=>fTick(v)}}, y:{ ...BASE.scales.y, grid:{display:false}}}}),
    });
  }

  function monthProgressArea(id, rows, meta) {
    const now   = new Date();
    const days  = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const daily = Array(days).fill(0);
    rows.forEach(r => { const d=storage.parseDate(r.Fecha); if(d&&d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()) daily[d.getDate()-1]+=r.Ventas_Monto||0; });
    const cum  = daily.map((_,i)=>daily.slice(0,i+1).reduce((a,b)=>a+b,0));
    const mLine= Array(days).fill(null).map((_,i)=>meta>0?(meta/days)*(i+1):null);
    return create(id, {
      type: 'line',
      data: { labels:Array.from({length:days},(_,i)=>i+1), datasets:[
        { label:'Ventas acumuladas', data:cum.map((v,i)=>i<now.getDate()?v:null), borderColor:COLORS.blue, backgroundColor:'rgba(59,130,246,.1)', borderWidth:2.5, pointRadius:0, pointHoverRadius:5, tension:.3, fill:true },
        { label:'Meta proporcional', data:mLine, borderColor:'rgba(245,158,11,.6)', backgroundColor:'transparent', borderWidth:1.5, borderDash:[6,3], pointRadius:0, fill:false },
      ]},
      options: opt({ plugins:{ ...BASE.plugins, tooltip:{...BASE.plugins.tooltip, callbacks:{label:ctx=>`${ctx.dataset.label}: ${fFull(ctx.raw)}`}}}, scales:{ x:{...BASE.scales.x, ticks:{...BASE.scales.x.ticks,maxTicksLimit:10}}, y:{...BASE.scales.y, ticks:{...BASE.scales.y.ticks,callback:v=>fTick(v)}}}}),
    });
  }

  function topProductsBar(id, data) {
    const top = data.slice(0,8);
    return create(id, {
      type: 'bar',
      data: { labels:top.map(d=>truncate(d.label,18)), datasets:[{ label:i18n.t('chartSales'), data:top.map(d=>d.value), backgroundColor:PALETTE.slice(0,8).map(c=>c+'bb'), borderColor:PALETTE.slice(0,8), borderWidth:1.5, borderRadius:6, borderSkipped:false }]},
      options: opt({ plugins:{...BASE.plugins, legend:{display:false}, tooltip:{...BASE.plugins.tooltip, callbacks:{label:ctx=>fFull(ctx.raw)}}}, scales:{ x:{...BASE.scales.x, ticks:{...BASE.scales.x.ticks,maxRotation:35}}, y:{...BASE.scales.y, ticks:{...BASE.scales.y.ticks,callback:v=>fTick(v)}}}}),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // DESCUENTO Y MARGEN
  // ════════════════════════════════════════════════════════════════

  // Tabla de productos con sparkbar de margen (renderizado HTML, no Chart.js)
  function renderMarginTable(containerId, products, goals) {
    const el = document.getElementById(containerId);
    if (!el || !products.length) return;
    const maxMonto = Math.max(...products.map(p=>p.monto));
    const goalMargin = goals?.gross_margin || 40;
    el.innerHTML = products.slice(0,20).map((p,i) => {
      const pct   = maxMonto > 0 ? (p.monto/maxMonto)*100 : 0;
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
      const discColor = p.avgDiscount===null?'#4a5568':p.avgDiscount>15?COLORS.red:p.avgDiscount>10?COLORS.yellow:COLORS.green;
      const mrgColor  = p.grossMargin===null?'#4a5568':p.grossMargin<25?COLORS.red:p.grossMargin<goalMargin?COLORS.yellow:COLORS.green;
      return `
        <div style="display:grid;grid-template-columns:28px 1fr 90px 80px 80px;align-items:center;gap:12px;padding:10px 12px;border-bottom:0.5px solid var(--color-border);cursor:pointer;"
             onclick="openClient360 && navigateTo('margin')" title="${sanitizeAttr(p.name)}">
          <span style="font-size:.85rem;text-align:center">${medal||'<span style=color:#4a5568>'+(i+1)+'</span>'}</span>
          <div>
            <div style="font-size:.82rem;font-weight:600;color:#f0f4ff;margin-bottom:4px">${sanitize(truncate(p.name,28))}</div>
            <div style="height:4px;background:#1a2234;border-radius:2px"><div style="height:100%;width:${pct}%;background:${COLORS.blue};border-radius:2px;transition:width .4s"></div></div>
            <div style="font-size:.7rem;color:#4a5568;margin-top:3px">${p.categoria}</div>
          </div>
          <div style="text-align:right;font-family:JetBrains Mono,monospace;font-size:.82rem;color:#f0f4ff">${formatCurrency(p.monto)}</div>
          <div style="text-align:right;font-family:JetBrains Mono,monospace;font-size:.82rem;color:${discColor}">${p.avgDiscount!==null?p.avgDiscount.toFixed(1)+'%':'—'}</div>
          <div style="text-align:right;font-family:JetBrains Mono,monospace;font-size:.82rem;color:${mrgColor}">${p.grossMargin!==null?p.grossMargin.toFixed(1)+'%':'—'}</div>
        </div>`;
    }).join('');
  }

  // Histograma de descuentos
  function discountHistogram(id, histogram) {
    if (!histogram?.length) return;
    return create(id, {
      type: 'bar',
      data: { labels:histogram.map(h=>h.label), datasets:[{ label:'Transacciones', data:histogram.map(h=>h.count), backgroundColor:histogram.map(h=>h.label.startsWith('0')?COLORS.green+'cc':h.label.startsWith('5')||h.label.startsWith('10')?COLORS.yellow+'cc':COLORS.red+'cc'), borderRadius:4, borderSkipped:false }]},
      options: opt({ plugins:{...BASE.plugins, legend:{display:false}, tooltip:{...BASE.plugins.tooltip, callbacks:{afterLabel:ctx=>fPct(histogram[ctx.dataIndex].pct)}}}, scales:{ x:BASE.scales.x, y:{...BASE.scales.y, ticks:{...BASE.scales.y.ticks,stepSize:1}}}}),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // CLIENTES — RFM
  // ════════════════════════════════════════════════════════════════
  function rfmBubbles(id, segments) {
    if (!segments.length) return;
    return create(id, {
      type: 'doughnut',
      data: {
        labels: segments.map(s=>s.label),
        datasets:[{ data:segments.map(s=>s.count), backgroundColor:segments.map(s=>s.color+'cc'), borderColor:segments.map(s=>s.color), borderWidth:1.5, hoverOffset:8 }],
      },
      options: opt({ cutout:'60%', plugins:{ ...BASE.plugins, tooltip:{...BASE.plugins.tooltip, callbacks:{ label:ctx=>` ${ctx.label}: ${ctx.raw} clientes (${segments[ctx.dataIndex].pct?.toFixed(1)}%)` }}}, scales:{x:{display:false},y:{display:false}}}),
    });
  }

  function clientsActivityLine(id, data) {
    const labels = ['Activos\n(0-30d)','En Riesgo\n(31-90d)','Perdidos\n(>90d)'];
    const values = [data.active||0, data.atRisk||0, data.lost||0];
    const colors = [COLORS.green, COLORS.yellow, COLORS.red];
    return create(id, {
      type: 'bar',
      data: { labels, datasets:[{ label:'Clientes', data:values, backgroundColor:colors.map(c=>c+'cc'), borderColor:colors, borderWidth:1.5, borderRadius:8, borderSkipped:false }]},
      options: opt({ plugins:{...BASE.plugins, legend:{display:false}}, scales:{ x:BASE.scales.x, y:{...BASE.scales.y, ticks:{...BASE.scales.y.ticks,stepSize:1}}}}),
    });
  }

  function npsGauge(id, npsScore) {
    // NPS va de -100 a +100 → normalizar a 0-100
    const normalized = Math.max(0, Math.min(100, ((npsScore||0) + 100) / 2));
    const color = npsScore >= 50 ? COLORS.green : npsScore >= 20 ? COLORS.yellow : COLORS.red;
    return create(id, {
      type: 'doughnut',
      data: { datasets:[{ data:[normalized, 100-normalized], backgroundColor:[color+'cc','rgba(255,255,255,.04)'], borderColor:[color,'transparent'], borderWidth:[2,0], circumference:270, rotation:225 }]},
      options: opt({ cutout:'78%', plugins:{...BASE.plugins, legend:{display:false}, tooltip:{enabled:false}}, scales:{x:{display:false},y:{display:false}}}),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // ATENCIÓN AL CLIENTE — PARETO
  // ════════════════════════════════════════════════════════════════
  function paretoMotivos(id, pareto) {
    if (!pareto.length) return;
    const top = pareto.slice(0,10);
    return create(id, {
      type: 'bar',
      data: {
        labels: top.map(m=>truncate(m.label,20)),
        datasets: [
          { type:'bar',  label:'Casos',        data:top.map(m=>m.count), backgroundColor:COLORS.blue+'cc', borderColor:COLORS.blue, borderWidth:1.5, borderRadius:4, yAxisID:'y' },
          { type:'line', label:'% Acumulado',  data:top.map(m=>m.cumulative), borderColor:COLORS.yellow, backgroundColor:'transparent', borderWidth:2, pointRadius:4, pointHoverRadius:6, tension:.4, yAxisID:'y2' },
        ],
      },
      options: opt({
        plugins:{...BASE.plugins, tooltip:{...BASE.plugins.tooltip, callbacks:{ label:ctx=>ctx.dataset.yAxisID==='y2'?` Acumulado: ${ctx.raw.toFixed(1)}%`:` Casos: ${ctx.raw}` }}},
        scales:{
          x: BASE.scales.x,
          y:  { ...BASE.scales.y, position:'left',  ticks:{...BASE.scales.y.ticks,stepSize:1} },
          y2: { ...BASE.scales.y, position:'right', min:0, max:100, grid:{display:false}, ticks:{...BASE.scales.y.ticks,callback:v=>v+'%'} },
        },
      }),
    });
  }

  function fcrByChannelBar(id, data) {
    const labels = Object.keys(data);
    const values = Object.values(data);
    const colors = values.map(v=>v===null?'#4a5568':v>=90?COLORS.green+'cc':v>=75?COLORS.yellow+'cc':COLORS.red+'cc');
    return create(id, {
      type: 'bar',
      data: { labels, datasets:[{ label:'FCR %', data:values, backgroundColor:colors, borderColor:colors.map(c=>c.slice(0,7)), borderWidth:1.5, borderRadius:6, borderSkipped:false }]},
      options: opt({ plugins:{...BASE.plugins, legend:{display:false}, tooltip:{...BASE.plugins.tooltip, callbacks:{label:ctx=>fPct(ctx.raw)}}}, scales:{ x:BASE.scales.x, y:{...BASE.scales.y, min:0, max:100, ticks:{...BASE.scales.y.ticks,callback:v=>v+'%'}}}}),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // INVENTARIO — HEATMAP / DÍAS DE STOCK
  // ════════════════════════════════════════════════════════════════
  function inventoryDaysBar(id, products) {
    const top = products.slice(0,12);
    const colors = top.map(p=>p.status==='red'?COLORS.red+'cc':p.status==='yellow'?COLORS.yellow+'cc':COLORS.green+'cc');
    return create(id, {
      type: 'bar',
      data: { labels:top.map(p=>truncate(p.name,16)), datasets:[{ label:i18n.t('chartDiasStock'), data:top.map(p=>p.daysInventory||0), backgroundColor:colors, borderColor:colors.map(c=>c.slice(0,7)), borderWidth:1.5, borderRadius:4, borderSkipped:false }]},
      options: opt({
        indexAxis:'y',
        plugins:{...BASE.plugins, legend:{display:false}, tooltip:{...BASE.plugins.tooltip, callbacks:{label:ctx=>` ${Math.round(ctx.raw)} ${i18n.t('finCycleDays')}`, afterLabel:ctx=>top[ctx.dataIndex].status==='red'?i18n.t('chartStockCritico'):''}}},
        scales:{ x:{...BASE.scales.x, ticks:{...BASE.scales.x.ticks,callback:v=>v+'d'}}, y:{...BASE.scales.y, grid:{display:false}} },
        // Línea de referencia en 7 días
      }),
    });
  }

  function rotationBar(id, products) {
    const sorted = [...products].filter(p=>p.rotation).sort((a,b)=>b.rotation-a.rotation).slice(0,10);
    return create(id, {
      type: 'bar',
      data: { labels:sorted.map(p=>truncate(p.name,16)), datasets:[{ label:i18n.t('chartRotacion'), data:sorted.map(p=>p.rotation?.toFixed(2)||0), backgroundColor:COLORS.teal+'cc', borderColor:COLORS.teal, borderWidth:1.5, borderRadius:4, borderSkipped:false }]},
      options: opt({ plugins:{...BASE.plugins, legend:{display:false}}, scales:{ x:BASE.scales.x, y:{...BASE.scales.y, ticks:{...BASE.scales.y.ticks,stepSize:.5}}}}),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // MARKETING — ROI / UPLIFT
  // ════════════════════════════════════════════════════════════════
  function roiByChannelBar(id, channels, roiData) {
    const labels = channels.map(c=>c.label);
    const roiVals= labels.map(l=>roiData[l]||0);
    const colors = roiVals.map(v=>v>=300?COLORS.green+'cc':v>=100?COLORS.yellow+'cc':COLORS.red+'cc');
    return create(id, {
      type: 'bar',
      data: { labels, datasets:[{ label:'ROI %', data:roiVals, backgroundColor:colors, borderColor:colors.map(c=>c.slice(0,7)), borderWidth:1.5, borderRadius:6, borderSkipped:false }]},
      options: opt({ plugins:{...BASE.plugins, legend:{display:false}, tooltip:{...BASE.plugins.tooltip, callbacks:{label:ctx=>fPct(ctx.raw)}}}, scales:{ x:BASE.scales.x, y:{...BASE.plugins, min:0, ...BASE.scales.y, ticks:{...BASE.scales.y.ticks,callback:v=>v+'%'}}}}),
    });
  }

  function upliftCompareBar(id, uplift) {
    if (!uplift) return;
    return create(id, {
      type: 'bar',
      data: {
        labels: [i18n.t('chartDiasSinCampana'),i18n.t('chartDiasConCampana')],
        datasets:[{ label:i18n.t('chartVentasPromDia'), data:[uplift.avgWithout, uplift.avgWith], backgroundColor:[COLORS.indigo+'88', COLORS.green+'cc'], borderColor:[COLORS.indigo, COLORS.green], borderWidth:1.5, borderRadius:8, borderSkipped:false }],
      },
      options: opt({ plugins:{...BASE.plugins, legend:{display:false}, tooltip:{...BASE.plugins.tooltip, callbacks:{label:ctx=>fFull(ctx.raw)}}}, scales:{ x:BASE.scales.x, y:{...BASE.scales.y, ticks:{...BASE.scales.y.ticks,callback:v=>fTick(v)}}}}),
    });
  }

  function campaignROIScatter(id, campaigns) {
    return create(id, {
      type: 'bubble',
      data: { datasets:[{
        label:i18n.t('chartCampanas'),
        data: campaigns.filter(c=>c.roi!==null).map(c=>({ x:c.inversion/1000, y:c.roi, r:Math.min(20, Math.max(5, Math.sqrt(c.ventas/50000))), name:c.name })),
        backgroundColor: COLORS.blue+'88',
        borderColor: COLORS.blue,
        borderWidth:1.5,
      }]},
      options: opt({ plugins:{...BASE.plugins, legend:{display:false}, tooltip:{...BASE.plugins.tooltip, callbacks:{ label:ctx=>[` ${ctx.raw.name}`,` ${i18n.t('chartInversionMiles').split(' ')[0]}: ${fTick(ctx.raw.x*1000)}`,` ROI: ${ctx.raw.y.toFixed(0)}%`] }}}, scales:{ x:{...BASE.scales.x, title:{display:true,text:i18n.t('chartInversionMiles'),color:'#4a5568'}}, y:{...BASE.scales.y, title:{display:true,text:'ROI %',color:'#4a5568'}, ticks:{...BASE.scales.y.ticks,callback:v=>v+'%'}}}}),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // FINANZAS — WATERFALL / ÁREA CASH FLOW
  // ════════════════════════════════════════════════════════════════
  function cashFlowArea(id, cashFlow) {
    if (!cashFlow.length) return;
    return create(id, {
      type: 'line',
      data: {
        labels: cashFlow.map(m=>monthLabel(m.key)),
        datasets:[
          { label:'Ingresos',    data:cashFlow.map(m=>m.ingresos), borderColor:COLORS.green, backgroundColor:'rgba(34,197,94,.08)', borderWidth:2, pointRadius:4, pointHoverRadius:6, fill:true, tension:.4 },
          { label:'Egresos',     data:cashFlow.map(m=>m.egresos),  borderColor:COLORS.red,   backgroundColor:'rgba(239,68,68,.06)',  borderWidth:2, pointRadius:4, pointHoverRadius:6, fill:true, tension:.4 },
          { label:'Saldo acum.', data:cashFlow.map(m=>m.saldoAcum),borderColor:COLORS.blue,  backgroundColor:'transparent',          borderWidth:2.5, pointRadius:4, pointHoverRadius:6, borderDash:[4,2], fill:false, tension:.4 },
        ],
      },
      options: opt({ plugins:{...BASE.plugins, tooltip:{...BASE.plugins.tooltip, callbacks:{label:ctx=>`${ctx.dataset.label}: ${fFull(ctx.raw)}`}}}, scales:{ x:BASE.scales.x, y:{...BASE.scales.y, ticks:{...BASE.scales.y.ticks,callback:v=>fTick(v)}}}}),
    });
  }

  function marginsBar(id, data) {
    return create(id, {
      type: 'bar',
      data: {
        labels: data.map(m=>monthLabel(m.key)),
        datasets:[
          { label:'Margen bruto %',   data:data.map(m=>m.margenBruto||0),  backgroundColor:COLORS.green+'88',  borderColor:COLORS.green,  borderWidth:1.5, borderRadius:4 },
          { label:'Margen oper. %',   data:data.map(m=>m.margenOper||0),   backgroundColor:COLORS.blue+'88',   borderColor:COLORS.blue,   borderWidth:1.5, borderRadius:4 },
        ],
      },
      options: opt({ plugins:{...BASE.plugins, tooltip:{...BASE.plugins.tooltip, callbacks:{label:ctx=>fPct(ctx.raw)}}}, scales:{ x:BASE.scales.x, y:{...BASE.scales.y, ticks:{...BASE.scales.y.ticks,callback:v=>v+'%'}}}}),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // EQUIPO — RADAR + CUMPLIMIENTO
  // ════════════════════════════════════════════════════════════════
  function teamRadar(id, sellers) {
    if (!sellers.length) return;
    const top5   = sellers.slice(0,5);
    const metrics= [i18n.getLang()==='es'?'Cumpl. %':'Achiev. %', i18n.getLang()==='es'?'Ticket':'Ticket', i18n.t('chartConversion'), i18n.getLang()==='es'?'Productividad':'Productivity', i18n.getLang()==='es'?'Ausentismo inv.':'Abs. inv.'];
    const maxVals= [100, Math.max(...top5.map(s=>s.avgTicket||0))||1, 100, Math.max(...top5.map(s=>s.productivity||0))||1, 100];

    return create(id, {
      type: 'radar',
      data: {
        labels: metrics,
        datasets: top5.map((s,i)=>({
          label: s.name.split(' ')[0],
          data: [
            Math.min(100, s.goalPct||0),
            maxVals[1]>0?(s.avgTicket||0)/maxVals[1]*100:0,
            Math.min(100, s.conversionRate||0),
            maxVals[3]>0?(s.productivity||0)/maxVals[3]*100:0,
            100 - Math.min(100, s.absenteeismPct||0),
          ],
          borderColor:      PALETTE[i],
          backgroundColor:  PALETTE[i]+'22',
          borderWidth:      2,
          pointBackgroundColor: PALETTE[i],
          pointRadius:      3,
        })),
      },
      options: {
        ...BASE,
        scales: { r: { min:0, max:100, grid:{color:'rgba(255,255,255,.06)'}, ticks:{display:false,stepSize:25}, pointLabels:{color:'#8899aa',font:{size:11,family:'Plus Jakarta Sans'}} }},
      },
    });
  }

  function teamGoalBar(id, sellers) {
    const colors = sellers.map(s=>s.status==='green'?COLORS.green+'cc':s.status==='yellow'?COLORS.yellow+'cc':COLORS.red+'cc');
    return create(id, {
      type: 'bar',
      data: { labels:sellers.map(s=>s.name.split(' ')[0]), datasets:[{ label:'Cumplimiento %', data:sellers.map(s=>s.goalPct||0), backgroundColor:colors, borderColor:colors.map(c=>c.slice(0,7)), borderWidth:1.5, borderRadius:6, borderSkipped:false }]},
      options: opt({ plugins:{...BASE.plugins, legend:{display:false}, tooltip:{...BASE.plugins.tooltip, callbacks:{label:ctx=>fPct(ctx.raw)}}}, scales:{ x:BASE.scales.x, y:{...BASE.scales.y, min:0, max:120, ticks:{...BASE.scales.y.ticks,callback:v=>v+'%'}}}}),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // CX — NPS STACKED / PARETO ETIQUETAS
  // ════════════════════════════════════════════════════════════════
  function npsStackedBar(id, cx) {
    const total = (cx.promoters||0)+(cx.passives||0)+(cx.detractors||0);
    if (!total) return;
    return create(id, {
      type: 'bar',
      data: {
        labels:['NPS'],
        datasets:[
          { label:`Promotores (${cx.promoters})`,   data:[pct(cx.promoters,total)],   backgroundColor:COLORS.green+'cc',  borderColor:COLORS.green,  borderWidth:1, borderRadius:{topLeft:6,topRight:6} },
          { label:`Pasivos (${cx.passives})`,        data:[pct(cx.passives,total)],    backgroundColor:COLORS.yellow+'cc', borderColor:COLORS.yellow, borderWidth:1 },
          { label:`Detractores (${cx.detractors})`,  data:[pct(cx.detractors,total)],  backgroundColor:COLORS.red+'cc',    borderColor:COLORS.red,    borderWidth:1, borderRadius:{bottomLeft:6,bottomRight:6} },
        ],
      },
      options: opt({ indexAxis:'y', plugins:{...BASE.plugins, tooltip:{...BASE.plugins.tooltip, callbacks:{label:ctx=>fPct(ctx.raw)}}}, scales:{ x:{...BASE.scales.x,stacked:true,min:0,max:100,ticks:{...BASE.scales.x.ticks,callback:v=>v+'%'}}, y:{...BASE.scales.y,stacked:true,grid:{display:false}}}}),
    });
  }

  function cxTagPareto(id, tagPareto) {
    if (!tagPareto.length) return;
    const top = tagPareto.slice(0,12);
    return create(id, {
      type: 'bar',
      data: {
        labels: top.map(t=>truncate(t.tag,20)),
        datasets:[
          { type:'bar',  label:'Frecuencia',   data:top.map(t=>t.count), backgroundColor:COLORS.indigo+'cc', borderColor:COLORS.indigo, borderWidth:1.5, borderRadius:4, yAxisID:'y' },
          { type:'line', label:'% Acumulado',  data:top.map(t=>t.cumulative), borderColor:COLORS.yellow, backgroundColor:'transparent', borderWidth:2, pointRadius:4, pointHoverRadius:6, tension:.4, yAxisID:'y2' },
        ],
      },
      options: opt({
        plugins:{...BASE.plugins, tooltip:{...BASE.plugins.tooltip, callbacks:{label:ctx=>ctx.dataset.yAxisID==='y2'?` Acumulado: ${ctx.raw.toFixed(1)}%`:` Casos: ${ctx.raw}`}}},
        scales:{ x:BASE.scales.x, y:{...BASE.scales.y,position:'left',ticks:{...BASE.scales.y.ticks,stepSize:1}}, y2:{...BASE.scales.y,position:'right',min:0,max:100,grid:{display:false},ticks:{...BASE.scales.y.ticks,callback:v=>v+'%'}} },
      }),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // PROVEEDORES
  // ════════════════════════════════════════════════════════════════
  function supplierSpendBar(id, supplierList) {
    const top = supplierList.slice(0,8);
    const colors = top.map(s=>s.risk==='high'?COLORS.red+'cc':s.risk==='medium'?COLORS.yellow+'cc':COLORS.green+'cc');
    return create(id, {
      type: 'bar',
      data: { labels:top.map(s=>truncate(s.name,20)), datasets:[{ label:i18n.t('chartGastoTotal'), data:top.map(s=>s.spend), backgroundColor:colors, borderColor:colors.map(c=>c.slice(0,7)), borderWidth:1.5, borderRadius:4, borderSkipped:false }]},
      options: opt({ indexAxis:'y', plugins:{...BASE.plugins, legend:{display:false}, tooltip:{...BASE.plugins.tooltip, callbacks:{label:ctx=>fFull(ctx.raw), afterLabel:ctx=>` ${top[ctx.dataIndex].concPct?.toFixed(1)}% ${i18n.t('chartDelTotal')}`}}}, scales:{ x:{...BASE.scales.x,ticks:{...BASE.scales.x.ticks,callback:v=>fTick(v)}}, y:{...BASE.scales.y,grid:{display:false}}}}),
    });
  }

  function supplierLeadTimeBar(id, supplierList) {
    const withLT = supplierList.filter(s=>s.avgLT).slice(0,8);
    return create(id, {
      type: 'bar',
      data: { labels:withLT.map(s=>truncate(s.name,16)), datasets:[{ label:i18n.t('chartLeadTime'), data:withLT.map(s=>s.avgLT?.toFixed(1)||0), backgroundColor:COLORS.cyan+'cc', borderColor:COLORS.cyan, borderWidth:1.5, borderRadius:4, borderSkipped:false }]},
      options: opt({ plugins:{...BASE.plugins, legend:{display:false}, tooltip:{...BASE.plugins.tooltip, callbacks:{label:ctx=>` ${ctx.raw} ${i18n.t('finCycleDays')}`}}}, scales:{ x:BASE.scales.x, y:{...BASE.scales.y,ticks:{...BASE.scales.y.ticks,callback:v=>v+'d'}}}}),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // HOME — SPARKLINES (mini gráficos inline)
  // ════════════════════════════════════════════════════════════════
  function sparkline(id, values, color) {
    color = color || COLORS.blue;
    destroy(id);
    const canvas = document.getElementById(id);
    if (!canvas || !values?.length) return null;
    const chart = new Chart(canvas, {
      type: 'line',
      data: { labels:values.map((_,i)=>i), datasets:[{ data:values, borderColor:color, backgroundColor:color+'18', borderWidth:1.5, pointRadius:0, tension:.4, fill:true }]},
      options: { responsive:true, maintainAspectRatio:false, animation:{duration:300}, plugins:{legend:{display:false},tooltip:{enabled:false}}, scales:{x:{display:false},y:{display:false}} },
    });
    registry[id] = chart;
    return chart;
  }

  // ════════════════════════════════════════════════════════════════
  // PROYECCIONES
  // ════════════════════════════════════════════════════════════════
  function forecastLine(id, historical, forecast30, forecast60, forecast90) {
    const allLabels = [...historical.map(m=>monthLabel(m.key)),'30d','60d','90d'];
    const histValues= historical.map(m=>m.value||m.monto||0);
    const lastVal   = histValues[histValues.length-1]||0;
    return create(id, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets:[
          { label:i18n.t('chartHistorico'),    data:[...histValues,...Array(3).fill(null)],  borderColor:COLORS.blue,   backgroundColor:'rgba(59,130,246,.08)', borderWidth:2.5, pointRadius:4, pointHoverRadius:6, fill:true,  tension:.4 },
          { label:i18n.t('chartProyeccion'),   data:[...Array(histValues.length-1).fill(null),lastVal,forecast30,forecast60,forecast90], borderColor:COLORS.yellow, backgroundColor:'rgba(245,158,11,.06)', borderWidth:2, pointRadius:4, pointHoverRadius:6, borderDash:[6,3], fill:true, tension:.4 },
        ],
      },
      options: opt({ plugins:{...BASE.plugins, tooltip:{...BASE.plugins.tooltip, callbacks:{label:ctx=>`${ctx.dataset.label}: ${fFull(ctx.raw)}`}}}, scales:{ x:BASE.scales.x, y:{...BASE.scales.y,ticks:{...BASE.scales.y.ticks,callback:v=>fTick(v)}}}}),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // HEALTH SCORE — RING ANIMADO (SVG, no Chart.js)
  // ════════════════════════════════════════════════════════════════
  function renderHealthRing(containerId, score) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const color = score >= 80 ? COLORS.green : score >= 60 ? COLORS.yellow : COLORS.red;
    const R = 54, C = 2*Math.PI*R;
    const offset = C - (score/100)*C;
    el.innerHTML = `
      <svg viewBox="0 0 120 120" style="width:120px;height:120px;display:block;margin:0 auto">
        <circle cx="60" cy="60" r="${R}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="10"/>
        <circle cx="60" cy="60" r="${R}" fill="none" stroke="${color}" stroke-width="10"
          stroke-dasharray="${C}" stroke-dashoffset="${C}"
          stroke-linecap="round" transform="rotate(-90 60 60)"
          style="transition:stroke-dashoffset 1s ease;stroke-dashoffset:${offset}"/>
        <text x="60" y="60" text-anchor="middle" dominant-baseline="central"
          style="font-size:22px;font-weight:800;fill:${color};font-family:JetBrains Mono,monospace">${score}</text>
        <text x="60" y="80" text-anchor="middle"
          style="font-size:9px;fill:#8899aa;font-family:Plus Jakarta Sans,sans-serif">/ 100</text>
      </svg>`;
  }

  // ════════════════════════════════════════════════════════════════
  // PALETA DE IMPRESIÓN PDF (#7 / V3-1)
  // ════════════════════════════════════════════════════════════════
  // Chart.js dibuja DENTRO del <canvas> con colores calibrados para el
  // dashboard oscuro (texto gris, rejillas blancas al 6%, rellenos al
  // 6%) — el CSS de exportación no puede tocar eso. Hay DOS orígenes de
  // gráficos: los creados aquí (registry interno) y los 10 módulos que
  // usan window._ckCharts directamente — iterar solo uno deja la mitad
  // del PDF en tema oscuro. Chart.instances no existe en Chart.js v4
  // (se removió del API público en v3+); en su lugar se resuelve cada
  // <canvas> del área de exportación con Chart.getChart(cv), que
  // funciona sin importar en qué registro vive la instancia.
  function _cadaGrafico(fn) {
    document.querySelectorAll('#contentArea canvas').forEach(cv => {
      const ch = window.Chart && Chart.getChart(cv);
      if (ch) fn(ch);
    });
  }

  // Ejes conocidos del proyecto — incluye 'y2' (Pareto: paretoMotivos,
  // cxTagPareto), que Cyber Neo detectó ausente (ZO-002): iterar solo
  // x/y/r dejaba ese eje secundario en gris oscuro sobre PDF blanco.
  const _EJES = ['x', 'y', 'r', 'y2'];

  // Anotaciones (chartjs-plugin-annotation, ej. línea de punto de
  // equilibrio en finance-module.js) con borderColor blanco/casi blanco
  // calibrado para el fondo oscuro: sobre papel blanco es invisible sin
  // importar la opacidad (ZO-002) — a diferencia de los rellenos de
  // datos, aquí no basta con subir opacidad, hay que cambiar el color.
  function _fixAnnotationBorder(c) {
    if (typeof c !== 'string') return c;
    const m = c.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)$/);
    if (!m) return c;
    const [, r, g, b] = m;
    return (+r >= 200 && +g >= 200 && +b >= 200) ? '#334155' : c;
  }

  function aplicarTemaImpresion() {
    _cadaGrafico(chart => {
      const snap = { ticks: {}, grid: {}, datasets: [], annotationBorders: {} };
      _EJES.forEach(axis => {
        const sc = chart.options.scales?.[axis];
        if (!sc) return;
        if (sc.ticks) { snap.ticks[axis] = sc.ticks.color; sc.ticks.color = '#111'; }
        if (sc.grid)  { snap.grid[axis]  = sc.grid.color;  sc.grid.color  = '#cbd5e1'; }
      });
      const legend = chart.options.plugins?.legend?.labels;
      if (legend) { snap.legendColor = legend.color; legend.color = '#111'; }
      const tooltip = chart.options.plugins?.tooltip;
      if (tooltip) { snap.tooltipTitleColor = tooltip.titleColor; tooltip.titleColor = '#111'; }

      const annotations = chart.options.plugins?.annotation?.annotations;
      if (annotations) {
        Object.entries(annotations).forEach(([key, a]) => {
          if (a && typeof a.borderColor === 'string') {
            snap.annotationBorders[key] = a.borderColor;
            a.borderColor = _fixAnnotationBorder(a.borderColor);
          }
        });
      }

      chart.data.datasets.forEach(ds => {
        const boost = c => {
          if (typeof c !== 'string') return c;
          const m = c.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)$/);
          return m ? `rgba(${m[1]},${m[2]},${m[3]},.4)` : c;
        };
        if (Array.isArray(ds.backgroundColor)) {
          snap.datasets.push({ backgroundColor: [...ds.backgroundColor] });
          ds.backgroundColor = ds.backgroundColor.map(boost);
        } else {
          snap.datasets.push({ backgroundColor: ds.backgroundColor });
          ds.backgroundColor = boost(ds.backgroundColor);
        }
      });

      chart.$_printSnapshot = snap;
      chart.update('none');
    });
  }

  function restaurarTemaPantalla() {
    _cadaGrafico(chart => {
      const snap = chart.$_printSnapshot;
      if (!snap) return;
      _EJES.forEach(axis => {
        const sc = chart.options.scales?.[axis];
        if (!sc) return;
        if (sc.ticks && axis in snap.ticks) sc.ticks.color = snap.ticks[axis];
        if (sc.grid  && axis in snap.grid)  sc.grid.color  = snap.grid[axis];
      });
      const legend = chart.options.plugins?.legend?.labels;
      if (legend && 'legendColor' in snap) legend.color = snap.legendColor;
      const tooltip = chart.options.plugins?.tooltip;
      if (tooltip && 'tooltipTitleColor' in snap) tooltip.titleColor = snap.tooltipTitleColor;

      const annotations = chart.options.plugins?.annotation?.annotations;
      if (annotations && snap.annotationBorders) {
        Object.entries(annotations).forEach(([key, a]) => {
          if (a && key in snap.annotationBorders) a.borderColor = snap.annotationBorders[key];
        });
      }

      chart.data.datasets.forEach((ds, i) => {
        if (snap.datasets[i]) ds.backgroundColor = snap.datasets[i].backgroundColor;
      });

      delete chart.$_printSnapshot;
      chart.update('none');
    });
  }

  // ── HELPER compartido ─────────────────────────────────────────
  function pct(n,d) { return d>0?(n/d)*100:0; }
  function formatCurrency(n) {
    const s = storage.getConfig().currencySymbol||'$';
    if (!n) return `${s}—`;
    const a = Math.abs(n);
    if (a>=1e6) return `${s}${(n/1e6).toFixed(1)}M`;
    if (a>=1e3) return `${s}${(n/1e3).toFixed(0)}K`;
    return `${s}${Math.round(n).toLocaleString('es-CL')}`;
  }

  // ── API PÚBLICA ───────────────────────────────────────────────
  return {
    // Core
    create, destroy, destroyAll,
    // Ventas (base)
    salesTrendLine, salesByChannelBar, salesDonut,
    sellerRankingBar, monthProgressArea, topProductsBar,
    // Descuento/Margen
    renderMarginTable, discountHistogram,
    // Clientes
    rfmBubbles, clientsActivityLine, npsGauge,
    // Atención
    paretoMotivos, fcrByChannelBar,
    // Inventario
    inventoryDaysBar, rotationBar,
    // Marketing
    roiByChannelBar, upliftCompareBar, campaignROIScatter,
    // Finanzas
    cashFlowArea, marginsBar,
    // Equipo
    teamRadar, teamGoalBar,
    // CX
    npsStackedBar, cxTagPareto,
    // Proveedores
    supplierSpendBar, supplierLeadTimeBar,
    // Utilidades
    sparkline, forecastLine,
    renderHealthRing,
    // Paleta de impresión PDF (#7)
    aplicarTemaImpresion, restaurarTemaPantalla,
    // Helpers
    monthLabel,
    // Constantes
    COLORS, PALETTE,
  };
})();

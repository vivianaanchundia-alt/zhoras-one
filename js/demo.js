// ════════════════════════════════════════════════════════════════
// CLAROKPIS — demo.js v1.0
// Carga los archivos JSON estáticos de Comercial Los Andes SpA
// al IndexedDB/localStorage para la demo del producto.
// Reemplaza el loadDemoData() inline del dashboard.html
// ════════════════════════════════════════════════════════════════

async function loadDemoData() {
  // No recargar si ya hay datos
  if (storage.hasData()) return;

  try {
    showDemoLoading(true);

    // Cargar todos los módulos en paralelo
    const [
      ventas, clientes, cx, soporte,
      marketing, inventario, finanzas,
      equipo, proveedores, cobranzas
    ] = await Promise.all([
      fetchDemo('ventas'),
      fetchDemo('clientes'),
      fetchDemo('cx'),
      fetchDemo('soporte'),
      fetchDemo('marketing'),
      fetchDemo('inventario'),
      fetchDemo('finanzas'),
      fetchDemo('equipo'),
      fetchDemo('proveedores'),
      fetchDemo('cobranzas'),
    ]);

    // Guardar cada módulo con su fileId
    const mods = [
      { key:'sales',     data:ventas,      name:'ventas.xlsx',      from:'2025-12-01', to:'2026-05-31' },
      { key:'clients',   data:clientes,    name:'clientes.xlsx',    from:'2026-01-01', to:'2026-05-31' },
      { key:'cx',        data:cx,          name:'cx.xlsx',          from:'2025-12-01', to:'2026-05-31' },
      { key:'support',   data:soporte,     name:'soporte.xlsx',     from:'2025-12-01', to:'2026-05-31' },
      { key:'marketing', data:marketing,   name:'marketing.xlsx',   from:'2025-12-01', to:'2026-05-31' },
      { key:'inventory', data:inventario,  name:'inventario.xlsx',  from:'2025-12-01', to:'2026-05-31' },
      { key:'finance',   data:finanzas,    name:'finanzas.xlsx',    from:'2025-12-01', to:'2026-05-31' },
      { key:'team',      data:equipo,      name:'equipo.xlsx',      from:'2025-12-01', to:'2026-05-31' },
      { key:'suppliers',   data:proveedores, name:'proveedores.xlsx',  from:'2025-12-01', to:'2026-05-31' },
      { key:'collections',  data:cobranzas,   name:'cobranzas.xlsx',   from:'2026-01-01', to:'2026-06-24' },
    ];

    for (const m of mods) {
      if (!m.data?.length) continue;
      const file = await storage.addFile({
        name:      m.name,
        module:    m.key,
        rows:      m.data.length,
        dateRange: { from: m.from, to: m.to },
        size:      0,
      });
      await storage.addData(m.key, m.data, file.id);
    }

    // Configuración de la empresa demo
    storage.setConfig({
      businessType:         'products',
      currency:             'CLP',
      currencySymbol:       '$',
      currencyLabel:        'CLP',
      companyName:          'Comercial Los Andes SpA',
      companyLogo:          '',
      workingDaysThisMonth: 22,
      workingDaysElapsed:   18,
      language:             'es',
      taxes:                [{ name: 'IVA', rate: 19 }], // Explícito: no depende del default
    });

    // Metas de la empresa demo
    storage.setGoals({
      sales_monthly:        21500000,
      avg_ticket:           95000,
      growth_rate:          10,
      conversion_rate:      22,
      retention_rate:       80,
      churn_rate:           8,
      ltv_cac_ratio:        3,
      nps:                  50,
      csat:                 80,
      resolution_rate:      90,
      response_time_hrs:    4,
      gross_margin:         42,
      cash_days:            30,
      inventory_days:       30,
      team_goal_achievement:90,
      absenteeism:          5,
      roi_marketing:        300,
      max_discount:         10,
    });

    // Metas individuales por vendedor (promedio últimos 3 meses + 10% growth)
    // Fuente: análisis demo-ventas.json → promedio mar-may 2026 por vendedor
    const goalsVendedor = {
      'María López':  { sales_monthly: 4400000 },  // avg $3.99M → meta $4.4M
      'Ana García':   { sales_monthly: 4100000 },  // avg $3.70M → meta $4.1M
      'Luis Pérez':   { sales_monthly: 3500000 },  // avg $3.18M → meta $3.5M
      'Carolina Roa': { sales_monthly: 3000000 },  // avg $2.74M → meta $3.0M
      'Diego Muñoz':  { sales_monthly: 2500000 },  // avg $2.29M → meta $2.5M
    };
    Object.entries(goalsVendedor).forEach(([nombre, metas]) => {
      Object.entries(metas).forEach(([key, val]) => {
        storage.setGoalVendedor(nombre, key, val);
      });
    });

    // Metas individuales por sucursal (promedio últimos 3 meses + ~10% growth)
    const goalsSucursal = {
      'Santiago Centro': { sales_monthly: 8500000 },  // avg $7.69M → meta $8.5M
      'Providencia':     { sales_monthly: 3500000 },  // avg $3.18M → meta $3.5M
      'Las Condes':      { sales_monthly: 3000000 },  // avg $2.74M → meta $3.0M
      'Online':          { sales_monthly: 2500000 },  // avg $2.29M → meta $2.5M
    };
    Object.entries(goalsSucursal).forEach(([nombre, metas]) => {
      Object.entries(metas).forEach(([key, val]) => {
        storage.setGoalSucursal(nombre, key, val);
      });
    });

    // Filtros por defecto
    storage.setFilters({
      period:      'prevmonth', // datos demo terminan may-2026; 'month'=jun daría 0 filas
      compareMode: 'none',
      sucursal:    'all',
      vendedor:    'all',
      canal:       'all',
    });

    // Alertas pre-cargadas (las 9 alertas del demo)
    _loadDemoAlerts();

    showDemoLoading(false);

    // Notificar que los datos están listos
    document.dispatchEvent(new CustomEvent('clarokpis:dataUpdated'));

    // Rebuild sidebar con datos
    if (typeof buildSidebarNav === 'function') buildSidebarNav();

  } catch(e) {
    console.error('[demo] Error cargando datos:', e);
    showDemoLoading(false);
    // Fallback al generador inline si los JSON no están disponibles
    await _loadDemoDataInline();
  }
}

// ── FETCH DEMO JSON ───────────────────────────────────────────────
async function fetchDemo(modulo) {
  try {
    const res = await fetch(`./data/demo-${modulo}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch(e) {
    console.warn(`[demo] No se pudo cargar demo-${modulo}.json:`, e.message);
    return [];
  }
}

// ── ALERTAS DEMO ──────────────────────────────────────────────────
function _loadDemoAlerts() {
  const alertas = [
    {
      type:'critical', module:'inventory', kpi:'stock',
      messageKey:'alertStockCritico',
      params:{ nombre:'Zapatillas Running Air', dias:4, stock:12 },
      value:4, goal:7,
    },
    {
      type:'critical', module:'inventory', kpi:'stock',
      messageKey:'alertStockCritico',
      params:{ nombre:'Botas Cuero Premium', dias:2.7, stock:8 },
      value:2.7, goal:7,
    },
    {
      type:'warning', module:'sales', kpi:'goal_achievement',
      messageKey:'alertSalesGoal',
      params:{ pct:'84', falta:'$3.6M' },
      value:84, goal:100,
    },
    {
      type:'warning', module:'team', kpi:'goal_achievement',
      messageKey:'alertTeamBajo',
      params:{ nombre:'Luis Pérez', pct:'74' },
      value:74, goal:90,
    },
    {
      type:'warning', module:'team', kpi:'goal_achievement',
      messageKey:'alertTeamBajo',
      params:{ nombre:'Carolina Roa', pct:'78' },
      value:78, goal:90,
    },
    {
      type:'warning', module:'clients', kpi:'churn',
      messageKey:'alertClientesRiesgo',
      params:{ n:31, pct:'12.4' },
      value:31, goal:0,
    },
    {
      type:'warning', module:'margin', kpi:'avg_discount',
      messageKey:'alertDescuento',
      params:{ pct:'7.8', meta:'10', prod:'Sandalias Verano', max:'22' },
      value:7.8, goal:10,
    },
    {
      type:'warning', module:'suppliers', kpi:'overdue_orders',
      messageKey:'alertSupplierOC',
      params:{ proveedor:'Accesorios Import. Ltda', dias:5 },
      value:1, goal:0,
    },
    {
      type:'info', module:'marketing', kpi:'roi',
      messageKey:'alertMarketingROI',
      params:{ campana:"Día de la Madre", roi:'450' },
      value:450, goal:300,
    },
    {
      type:'critical', module:'collections', kpi:'overdue_critical',
      messageKey:'collAlertVencida',
      params:{ cliente:'Calzados El Maule', id:'F-2026-008', dias:87, monto:'$19.1M' },
      value:87, goal:60,
    },
    {
      type:'warning', module:'collections', kpi:'concentration',
      messageKey:'collAlertConcentracion',
      params:{ pct:'62', n:3 },
      value:62, goal:60,
    },
  ];

  alertas.forEach(a => storage.addAlert(a));
}

// ── LOADING STATE ─────────────────────────────────────────────────
function showDemoLoading(show) {
  let el = document.getElementById('demoLoadingOverlay');

  if (show) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'demoLoadingOverlay';
      el.style.cssText = [
        'position:fixed;inset:0;',
        'background:rgba(10,15,30,.92);',
        'z-index:9999;',
        'display:flex;flex-direction:column;',
        'align-items:center;justify-content:center;',
        'gap:16px;font-family:Plus Jakarta Sans,system-ui,sans-serif;',
      ].join('');
      el.innerHTML = `
        <div style="font-size:2.5rem">📊</div>
        <div style="font-size:1rem;font-weight:700;color:#f0f4ff">
          Cargando demo de Comercial Los Andes SpA
        </div>
        <div style="display:flex;gap:6px" id="demoLoadingDots">
          ${[0,1,2].map(i=>`
            <div style="
              width:8px;height:8px;border-radius:50%;
              background:#3b82f6;
              animation:pulse 1.2s ease-in-out ${i*0.2}s infinite">
            </div>`).join('')}
        </div>
        <div style="font-size:.78rem;color:#8899aa;margin-top:4px">
          Esto solo ocurre la primera vez
        </div>`;
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
  } else {
    if (el) {
      el.style.opacity = '0';
      el.style.transition = 'opacity .4s';
      setTimeout(() => el?.remove(), 400);
    }
  }
}

// ── FALLBACK INLINE ───────────────────────────────────────────────
// Si los JSON no están disponibles (servidor local sin fetch),
// genera datos sintéticos en memoria — igual que antes
async function _loadDemoDataInline() {
  console.warn('[demo] Usando generador inline como fallback');

  const R=()=>Math.random();
  const ri=(a,b)=>Math.floor(R()*(b-a+1))+a;
  const pick=a=>a[Math.floor(R()*a.length)];
  const f1k=n=>Math.round(n/1000)*1000;

  const MO=['2025-12','2026-01','2026-02','2026-03','2026-04','2026-05'];
  const MD=[31,31,28,31,30,31];
  const BR=['Santiago Centro','Providencia','Las Condes'];

  const PR=[
    {n:'Zapatillas Running Air',c:'Calzado Deportivo',p:89900,co:47500},
    {n:'Zapatillas Trail Pro',c:'Calzado Deportivo',p:109900,co:58200},
    {n:'Zapatillas Urbanas',c:'Calzado Casual',p:69900,co:37000},
    {n:'Botas Cuero Premium',c:'Calzado Formal',p:149900,co:79400},
    {n:'Botas Cordura',c:'Calzado Formal',p:119900,co:63500},
    {n:'Sandalias Verano',c:'Calzado Casual',p:49900,co:26400},
    {n:'Mocasines Cuero',c:'Calzado Formal',p:89900,co:47600},
    {n:'Bolso Cuero Premium',c:'Accesorios',p:129900,co:68800},
    {n:'Mochila Urbana',c:'Accesorios',p:69900,co:37000},
    {n:'Cinturón Cuero',c:'Accesorios',p:29900,co:15800},
    {n:'Cartera Mujer',c:'Accesorios',p:89900,co:47600},
    {n:'Ropa Deportiva Set',c:'Ropa',p:59900,co:31700},
  ];

  const SE=[
    {n:'María López',   b:'Providencia',     m:5200000, t:[0.92,0.95,0.98,1.01,1.06,1.04]},
    {n:'Ana García',    b:'Santiago Centro', m:4800000, t:[0.88,0.91,0.94,0.98,1.02,0.97]},
    {n:'Luis Pérez',    b:'Online',          m:4500000, t:[0.98,1.05,1.02,0.95,0.88,0.74]},
    {n:'Carolina Roa',  b:'Las Condes',      m:3800000, t:[0.82,0.85,0.88,0.84,0.80,0.78]},
    {n:'Diego Muñoz',   b:'Santiago Centro', m:3200000, t:[0.94,0.98,1.02,1.06,1.08,1.11]},
  ];

  const MT=[22800000,19400000,17200000,20100000,22600000,21500000];
  const sr=[];

  MO.forEach((m,mi)=>{
    SE.forEach(s=>{
      let rem=f1k(s.m*s.t[mi]);
      for(let d=1;d<=MD[mi]&&rem>0;d++){
        const dow=new Date(m+'-'+String(d).padStart(2,'0')).getDay();
        if(s.b!=='Online'&&dow===0&&R()>0.3) continue;
        if(R()>0.80) continue;
        for(let t=0;t<ri(1,3)&&rem>0;t++){
          const p=pick(PR),u=ri(1,3);
          const desc=R()*0.12;
          const pvp=p.p;
          const pf=Math.round(pvp*(1-desc));
          const mn=f1k(Math.min(pf*u,rem));
          rem-=mn;
          sr.push({
            Fecha:m+'-'+String(d).padStart(2,'0'),
            Vendedor:s.n, Sucursal:s.b,
            Canal_Venta:s.b==='Online'?'Online':'Presencial',
            Producto:p.n, Categoría:p.c,
            Ventas_Monto:mn, Ventas_Unidades:u,
            Meta_Ventas:Math.round(s.m/MD[mi]*1.05),
            N_Transacciones:1, Leads:ri(1,7), Dias_Cierre:ri(0,5),
            Cliente_ID:'C'+String(ri(1,200)).padStart(4,'0'),
            PVP:pvp, Precio_Facturado:pf,
          });
        }
      }
    });
  });

  const fS=await storage.addFile({name:'ventas.xlsx',module:'sales',rows:sr.length,dateRange:{from:'2025-12-01',to:'2026-05-31'},size:0});
  await storage.addData('sales',sr,fS.id);

  // Clientes básicos
  const cr=[];
  for(let i=0;i<200;i++){
    let dias,nps,frec;
    if(i<76){dias=ri(0,30);nps=ri(8,10);frec=ri(6,14);}
    else if(i<128){dias=ri(31,60);nps=ri(6,9);frec=ri(3,9);}
    else if(i<164){dias=ri(61,90);nps=ri(5,8);frec=ri(2,6);}
    else{dias=ri(91,200);nps=ri(1,6);frec=ri(1,4);}
    cr.push({
      Cliente_ID:'C'+String(i+1).padStart(4,'0'),
      Nombre_Cliente:'Cliente '+String(i+1).padStart(3,'0'),
      Canal_Adquisición:pick(['Instagram','Google Ads','Referido','Tienda Física']),
      NPS:nps, Días_Sin_Compra:dias, Frecuencia_Compra:frec,
      Sucursal:BR[i%3],
      Fecha:'2026-0'+ri(1,5)+'-'+String(ri(1,28)).padStart(2,'0'),
    });
  }
  const fC=await storage.addFile({name:'clientes.xlsx',module:'clients',rows:cr.length,dateRange:{from:'2026-01-01',to:'2026-05-31'},size:0});
  await storage.addData('clients',cr,fC.id);

  // Inventario básico
  const ir=PR.map((p,i)=>({
    Producto:p.n, Categoría:p.c,
    Stock_Inicial:i===0?12:i===3?8:ri(50,200),
    Ventas_Unidades:i===0?510:i===3?186:ri(80,260),
    Compras_Unidades:ri(80,250),
    Devoluciones:ri(0,12),
    Costo_Unitario:p.co, PVP:p.p, Sucursal:BR[0],
  }));
  const fI=await storage.addFile({name:'inventario.xlsx',module:'inventory',rows:ir.length,size:0});
  await storage.addData('inventory',ir,fI.id);

  // Finanzas básicas
  const fr=MO.map((m,mi)=>({
    Fecha:m+'-01', Ingresos:f1k(MT[mi]*(0.97+R()*0.06)),
    Costos:f1k(MT[mi]*(0.51+R()*0.04)),
    Gastos_Operacionales:f1k(4200000+R()*600000),
    Cuentas_Por_Cobrar:f1k(MT[mi]*0.3),
  }));
  const fF=await storage.addFile({name:'finanzas.xlsx',module:'finance',rows:fr.length,size:0});
  await storage.addData('finance',fr,fF.id);

  // Equipo básico
  const tr=[];
  MO.forEach((m,mi)=>SE.forEach(s=>{
    const aus=ri(0,2);
    tr.push({Fecha:m+'-01',Vendedor:s.n,Sucursal:s.b,
      Ventas_Monto:f1k(s.m*s.t[mi]),Meta_Mes:s.m,
      Dias_Trabajados:[22,21,20,22,21,22][mi]-aus,
      Dias_Ausentes:aus,Dotacion:1,Leads:ri(40,180)});
  }));
  const fT=await storage.addFile({name:'equipo.xlsx',module:'team',rows:tr.length,size:0});
  await storage.addData('team',tr,fT.id);

  // Marketing básico
  const mr=[
    {Fecha:'2025-12-01',Campaña:'Cyber Monday',Canal_Marketing:'Meta Ads',Inversión:1250000,Leads:680,Ventas_Campaña:6800000,Fecha_Inicio_Campaña:'2025-11-28',Fecha_Fin_Campaña:'2025-12-03'},
    {Fecha:'2026-02-10',Campaña:'San Valentín',Canal_Marketing:'Meta Ads',Inversión:560000,Leads:390,Ventas_Campaña:2240000,Fecha_Inicio_Campaña:'2026-02-08',Fecha_Fin_Campaña:'2026-02-14'},
    {Fecha:'2026-05-10',Campaña:'Día de la Madre',Canal_Marketing:'Meta Ads',Inversión:1480000,Leads:820,Ventas_Campaña:8140000,Fecha_Inicio_Campaña:'2026-05-08',Fecha_Fin_Campaña:'2026-05-14'},
  ];
  const fM=await storage.addFile({name:'marketing.xlsx',module:'marketing',rows:mr.length,size:0});
  await storage.addData('marketing',mr,fM.id);

  // Config y metas
  storage.setConfig({
    businessType:'products', currency:'CLP', currencySymbol:'$', currencyLabel:'CLP',
    companyName:'Comercial Los Andes SpA', workingDaysThisMonth:22, workingDaysElapsed:18,
  });
  storage.setGoals({
    sales_monthly:21500000, retention_rate:80, nps:50, csat:80,
    resolution_rate:90, response_time_hrs:4, churn_rate:8,
    conversion_rate:22, avg_ticket:95000, growth_rate:10,
    gross_margin:42, cash_days:30, inventory_days:30,
    team_goal_achievement:90, absenteeism:5, roi_marketing:300, max_discount:10,
  });

  _loadDemoAlerts();
  document.dispatchEvent(new CustomEvent('clarokpis:dataUpdated'));
  if (typeof buildSidebarNav === 'function') buildSidebarNav();
}

// ── RECARGAR DEMO ─────────────────────────────────────────────────
async function reloadDemoData() {
  if (!auth.isDemo()) return;
  const msg = i18n.getLang() === 'es'
    ? '¿Recargar datos del demo? Se perderán los cambios.'
    : 'Reload demo data? Changes will be lost.';
  if (!confirm(msg)) return;

  await storage.clearAllData();
  await loadDemoData();

  if (typeof renderCurrentModule === 'function') renderCurrentModule();
  if (typeof showToast === 'function') showToast('🔄 Demo recargado', 'green');
}

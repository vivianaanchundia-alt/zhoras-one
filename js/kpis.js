// ════════════════════════════════════════════════════════════════
// CLAROKPIS — kpis.js v2.0
// Cálculo de KPIs para todos los módulos.
// Extiende la base existente (Ventas) con todos los módulos.
// ════════════════════════════════════════════════════════════════

const kpis = (() => {

  // ════════════════════════════════════════════════════════════════
  // HELPERS INTERNOS
  // ════════════════════════════════════════════════════════════════

  const sum     = (rows, f)    => rows.reduce((s, r) => s + (parseFloat(r[f]) || 0), 0);
  const avg     = (rows, f)    => rows.length ? sum(rows, f) / rows.length : 0;
  const min     = (rows, f)    => rows.length ? Math.min(...rows.map(r => parseFloat(r[f]) || 0)) : 0;
  const max     = (rows, f)    => rows.length ? Math.max(...rows.map(r => parseFloat(r[f]) || 0)) : 0;
  const median  = (arr)        => { const s = [...arr].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };
  const uniq    = (rows, f)    => new Set(rows.map(r => r[f]).filter(Boolean));
  const pct     = (n, d)       => d > 0 ? (n / d) * 100 : null;
  const safe    = (n)          => (n === null || n === undefined || isNaN(n)) ? null : n;

  function sumOrCount(rows, field) {
    const withField = rows.filter(r => parseFloat(r[field]) > 0);
    return withField.length > rows.length * 0.3 ? sum(rows, field) : rows.length;
  }

  // ── dedupMeta: meta correcta para un conjunto de filas filtradas ──
  // Meta_Ventas es el valor mensual por vendedor, repetido en cada fila.
  // Sumar todas las filas da un resultado inflado (ej: 14 filas × meta = 14× la meta real).
  // Esta función deduplica: toma UN valor por combinación (Vendedor, mes).
  // Funciona correctamente para cualquier filtro: período, sucursal, vendedor, canal.
  function dedupMeta(rows, goals) {
    if (!rows.length) return (goals && goals.sales_monthly) || 0;
    // Si el usuario configuró una meta global en el panel Y los datos no tienen
    // Meta_Ventas (columna opcional), usar goals.sales_monthly como fallback.
    // Si los datos SÍ tienen Meta_Ventas, esos valores tienen prioridad porque
    // representan metas por vendedor/mes más precisas que el global del panel.
    const seen = new Map(); // 'Vendedor|YYYY-MM' → meta
    rows.forEach(r => {
      const meta = parseFloat(r.Meta_Ventas) || 0;
      if (!meta) return;
      const month = (r.Fecha || '').slice(0, 7);
      const key   = (r.Vendedor || '') + '|' + month;
      if (!seen.has(key)) seen.set(key, meta);
    });
    const total = Array.from(seen.values()).reduce((s, v) => s + v, 0);
    // Fallback: si no hay Meta_Ventas en los datos → usar meta del panel
    return total || (goals && goals.sales_monthly) || 0;
  }

  // dedupMetaByVendor: meta correcta agrupada por vendedor (para ranking)
  function dedupMetaByVendor(rows) {
    const byVendor = {}; // vendedor → Map('YYYY-MM' → meta)
    rows.forEach(r => {
      const meta   = parseFloat(r.Meta_Ventas) || 0;
      const vendor = r.Vendedor || 'Sin asignar';
      const month  = (r.Fecha || '').slice(0, 7);
      if (!byVendor[vendor]) byVendor[vendor] = new Map();
      if (meta && !byVendor[vendor].has(month)) byVendor[vendor].set(month, meta);
    });
    const result = {};
    Object.entries(byVendor).forEach(([v, monthMap]) => {
      result[v] = Array.from(monthMap.values()).reduce((s, m) => s + m, 0);
    });
    return result;
  }

  function groupBy(rows, groupField, valueField) {
    const groups = {};
    rows.forEach(r => {
      const key = r[groupField] || 'Sin datos';
      groups[key] = (groups[key] || 0) + (parseFloat(r[valueField]) || 0);
    });
    const total = Object.values(groups).reduce((s, v) => s + v, 0);
    return Object.entries(groups)
      .map(([label, value]) => ({ label, value, pct: total > 0 ? (value/total)*100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }

  function groupByCount(rows, field) {
    const groups = {};
    rows.forEach(r => {
      const key = r[field] || 'Sin datos';
      groups[key] = (groups[key] || 0) + 1;
    });
    const total = rows.length;
    return Object.entries(groups)
      .map(([label, count]) => ({ label, count, pct: total > 0 ? (count/total)*100 : 0 }))
      .sort((a, b) => b.count - a.count);
  }

  function calcMonthlyTrend(rows, valueField = 'Ventas_Monto') {
    const months = {};
    rows.forEach(r => {
      const d = storage.parseDate(r.Fecha);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!months[key]) months[key] = { key, value: 0, count: 0 };
      months[key].value += parseFloat(r[valueField]) || 0;
      months[key].count++;
    });
    return Object.values(months).sort((a,b) => a.key.localeCompare(b.key)).slice(-12);
  }

  function calcMonthForecast(rows, meta, valueField = 'Ventas_Monto') {
    const now          = new Date();
    const daysInMonth  = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const dayOfMonth   = now.getDate();
    if (!dayOfMonth) return null;

    const thisMonthRows = rows.filter(r => {
      const d = storage.parseDate(r.Fecha);
      return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const current = sum(thisMonthRows, valueField);
    if (!current) return null;

    const dailyAvg  = current / dayOfMonth;
    const forecast  = dailyAvg * daysInMonth;
    const daysLeft  = daysInMonth - dayOfMonth;
    const pctMeta   = meta > 0 ? (forecast / meta) * 100 : null;
    return { forecast, dailyAvg, daysLeft, pctMeta, current };
  }

  // ════════════════════════════════════════════════════════════════
  // MÓDULO VENTAS
  // ════════════════════════════════════════════════════════════════
  function calcSales(rows, goals = {}) {
    if (!rows?.length) return _emptySales();

    const totalMonto        = sum(rows, 'Ventas_Monto');
    const totalUnidades     = sum(rows, 'Ventas_Unidades');
    const totalTransacciones = sumOrCount(rows, 'N_Transacciones');
    const totalLeads        = sum(rows, 'Leads');
    const totalMeta         = dedupMeta(rows, goals);
    const uniqueSellers     = uniq(rows, 'Vendedor').size;
    const uniqueClients     = uniq(rows, 'Cliente_ID').size;

    const goalAchievement   = pct(totalMonto, totalMeta);
    const avgTicket         = totalTransacciones > 0 ? totalMonto / totalTransacciones : null;
    const conversionRate    = pct(totalTransacciones, totalLeads);

    const diasRows          = rows.filter(r => parseFloat(r.Dias_Cierre) > 0);
    const avgDiasCierre     = diasRows.length ? avg(diasRows, 'Dias_Cierre') : null;
    const ltv               = avgTicket ? avgTicket * 12 * 2 : null;

    // Venta cruzada
    const clientProds = {};
    rows.forEach(r => {
      if (r.Cliente_ID && r.Producto) {
        (clientProds[r.Cliente_ID] = clientProds[r.Cliente_ID] || new Set()).add(r.Producto);
      }
    });
    const totalCPs  = Object.keys(clientProds).length;
    const multiCPs  = Object.values(clientProds).filter(s => s.size > 1).length;
    const crossSellRate = pct(multiCPs, totalCPs);

    // Descuento promedio (nuevo)
    const discountData  = calcDiscount(rows);

    // Productos ganadores (nuevo)
    const productRanking = calcProductRanking(rows);

    const monthForecast  = calcMonthForecast(rows, totalMeta);
    const byChannel      = groupBy(rows, 'Canal_Venta', 'Ventas_Monto');
    const byBranch       = groupBy(rows, 'Sucursal',    'Ventas_Monto');
    const byProduct      = groupBy(rows, 'Producto',    'Ventas_Monto');
    const byCategory     = groupBy(rows, 'Categoría',   'Ventas_Monto');
    const sellerRanking  = calcSellerRanking(rows);
    const monthlyTrend   = calcMonthlyTrend(rows);

    return {
      totalMonto, totalUnidades, totalTransacciones, totalLeads, totalMeta,
      goalAchievement, avgTicket, conversionRate, avgDiasCierre, ltv,
      crossSellRate, growth: null, monthForecast,
      discountData, productRanking,
      byChannel, byBranch, byProduct, byCategory,
      sellerRanking, monthlyTrend,
      uniqueSellers, uniqueClients, rowCount: rows.length,
    };
  }

  function _emptySales() {
    return {
      totalMonto:0, totalUnidades:0, totalTransacciones:0, totalLeads:0,
      totalMeta:0, goalAchievement:null, avgTicket:null, conversionRate:null,
      avgDiasCierre:null, ltv:null, crossSellRate:null, growth:null,
      monthForecast:null, discountData:null, productRanking:[],
      byChannel:[], byBranch:[], byProduct:[], byCategory:[],
      sellerRanking:[], monthlyTrend:[], uniqueSellers:0, uniqueClients:0, rowCount:0,
    };
  }

  function calcSellerRanking(rows) {
    const metaByVendor = dedupMetaByVendor(rows);
    const sellers = {};
    rows.forEach(r => {
      const name = r.Vendedor || 'Sin asignar';
      if (!sellers[name]) sellers[name] = { name, monto:0, unidades:0, transacciones:0, leads:0, meta:0, branch: r.Sucursal||'' };
      sellers[name].monto         += parseFloat(r.Ventas_Monto) || 0;
      sellers[name].unidades      += parseFloat(r.Ventas_Unidades) || 0;
      sellers[name].transacciones += parseFloat(r.N_Transacciones) || (r.Ventas_Monto ? 1 : 0);
      sellers[name].leads         += parseFloat(r.Leads) || 0;
    });
    return Object.values(sellers).map(s => ({
      ...s,
      meta:           metaByVendor[s.name] || 0,
      avgTicket:      s.transacciones > 0 ? s.monto / s.transacciones : 0,
      conversionRate: pct(s.transacciones, s.leads),
      goalPct:        pct(s.monto, metaByVendor[s.name] || 0),
      status:         (metaByVendor[s.name] || 0) > 0 ? storage.getStatus(s.monto, metaByVendor[s.name]) : 'na',
    })).sort((a, b) => b.monto - a.monto);
  }

  // ════════════════════════════════════════════════════════════════
  // DESCUENTO Y MARGEN POR PRODUCTO (nuevo)
  // ════════════════════════════════════════════════════════════════
  function calcDiscount(rows) {
    const withDiscount = rows.filter(r =>
      parseFloat(r.PVP) > 0 && parseFloat(r.Precio_Facturado) > 0
    );
    if (!withDiscount.length) return null;

    const discounts = withDiscount.map(r => {
      const pvp  = parseFloat(r.PVP);
      const fact = parseFloat(r.Precio_Facturado);
      return ((pvp - fact) / pvp) * 100;
    });

    return {
      count:   withDiscount.length,
      avg:     discounts.reduce((s,v) => s+v, 0) / discounts.length,
      max:     Math.max(...discounts),
      min:     Math.min(...discounts),
      median:  median(discounts),
      histogram: _buildHistogram(discounts, [0,5,10,15,20,25,100]),
    };
  }

  function calcProductRanking(rows) {
    const products = {};
    rows.forEach(r => {
      const name = r.Producto || 'Sin producto';
      if (!products[name]) products[name] = {
        name, categoria: r.Categoría||'',
        monto:0, unidades:0, transacciones:0,
        discounts:[], pvp: parseFloat(r.PVP)||0,
      };
      const p = products[name];
      p.monto        += parseFloat(r.Ventas_Monto) || 0;
      p.unidades     += parseFloat(r.Ventas_Unidades) || 0;
      p.transacciones += parseFloat(r.N_Transacciones) || 1;
      if (parseFloat(r.PVP) > 0 && parseFloat(r.Precio_Facturado) > 0) {
        const pvp  = parseFloat(r.PVP);
        const fact = parseFloat(r.Precio_Facturado);
        p.discounts.push(((pvp - fact) / pvp) * 100);
        if (!p.pvp) p.pvp = pvp;
      }
    });

    const total = Object.values(products).reduce((s,p) => s + p.monto, 0);
    return Object.values(products).map(p => ({
      ...p,
      avgTicket:       p.transacciones > 0 ? p.monto / p.transacciones : 0,
      pctOfTotal:      total > 0 ? (p.monto / total) * 100 : 0,
      avgDiscount:     p.discounts.length ? p.discounts.reduce((s,v)=>s+v,0)/p.discounts.length : null,
      maxDiscount:     p.discounts.length ? Math.max(...p.discounts) : null,
      discountCount:   p.discounts.length,
    })).sort((a, b) => b.monto - a.monto);
  }

  function calcMarginByProduct(salesRows, inventoryRows) {
    const costMap = {};
    (inventoryRows || []).forEach(r => {
      if (r.Producto && parseFloat(r.Costo_Unitario) > 0) {
        costMap[r.Producto] = parseFloat(r.Costo_Unitario);
      }
    });

    const products = {};
    salesRows.forEach(r => {
      const name = r.Producto || 'Sin producto';
      if (!products[name]) products[name] = {
        name, categoria: r.Categoría||'',
        monto:0, unidades:0, discounts:[], pvp: parseFloat(r.PVP)||0,
      };
      const p = products[name];
      p.monto    += parseFloat(r.Ventas_Monto) || 0;
      p.unidades += parseFloat(r.Ventas_Unidades) || 0;
      if (parseFloat(r.PVP) > 0 && parseFloat(r.Precio_Facturado) > 0) {
        const pvp  = parseFloat(r.PVP);
        const fact = parseFloat(r.Precio_Facturado);
        p.discounts.push(((pvp - fact) / pvp) * 100);
      }
    });

    return Object.values(products).map(p => {
      const avgDiscount  = p.discounts.length ? p.discounts.reduce((s,v)=>s+v,0)/p.discounts.length : null;
      const avgFacturado = p.pvp && avgDiscount !== null ? p.pvp * (1 - avgDiscount/100) : null;
      // Precio neto facturado (sin IVA) — el costo unitario ya es neto, así el margen es real
      const netFacturado = avgFacturado !== null ? storage.getNetAmount(avgFacturado) : null;
      const costo        = costMap[p.name] || null;
      const grossMargin  = netFacturado && costo ? ((netFacturado - costo) / netFacturado) * 100 : null;

      return {
        ...p, avgDiscount, avgFacturado, netFacturado, costo, grossMargin,
        grossMarginAmt: netFacturado && costo ? netFacturado - costo : null,
        status: grossMargin !== null ? storage.getStatus(grossMargin, 40) : 'na',
      };
    }).sort((a, b) => (b.grossMargin||0) - (a.grossMargin||0));
  }

  // ════════════════════════════════════════════════════════════════
  // MÓDULO CLIENTES + RFM
  // ════════════════════════════════════════════════════════════════
  function calcClients(rows, goals = {}) {
    if (!rows?.length) return _emptyClients();

    const total         = rows.length;
    const active        = rows.filter(r => (parseFloat(r.Días_Sin_Compra)||0) <= 30).length;
    const atRisk        = rows.filter(r => { const d = parseFloat(r.Días_Sin_Compra)||0; return d > 30 && d <= 90; }).length;
    const lost          = rows.filter(r => (parseFloat(r.Días_Sin_Compra)||0) > 90).length;
    const newClients    = rows.filter(r => (parseFloat(r.Días_Sin_Compra)||0) <= 7).length;

    const retentionRate = pct(active, total);
    const churnRate     = pct(lost, total);

    const npsRows       = rows.filter(r => parseFloat(r.NPS) >= 0);
    const npsAvg        = npsRows.length ? avg(npsRows, 'NPS') : null;
    const promoters     = npsRows.filter(r => parseFloat(r.NPS) >= 9).length;
    const passives      = npsRows.filter(r => { const n=parseFloat(r.NPS); return n>=7&&n<=8; }).length;
    const detractors    = npsRows.filter(r => parseFloat(r.NPS) <= 6).length;
    const npsScore      = npsRows.length ? pct(promoters, npsRows.length) - pct(detractors, npsRows.length) : null;

    const freqRows      = rows.filter(r => parseFloat(r.Frecuencia_Compra) > 0);
    const avgFrequency  = freqRows.length ? avg(freqRows, 'Frecuencia_Compra') : null;

    const rfmSegments   = calcRFM(rows);
    const byChannel     = groupByCount(rows, 'Canal_Adquisición');
    const byBranch      = groupByCount(rows, 'Sucursal');

    // Probabilidad churn (score RFM)
    const churnRisk     = rows.map(r => ({
      id:    r.Cliente_ID,
      name:  r.Nombre_Cliente,
      dias:  parseFloat(r.Días_Sin_Compra) || 0,
      nps:   parseFloat(r.NPS),
      freq:  parseFloat(r.Frecuencia_Compra) || 1,
      risk:  _calcChurnRisk(r),
    })).sort((a, b) => b.dias - a.dias);

    return {
      total, active, atRisk, lost, newClients,
      retentionRate, churnRate,
      npsAvg, npsScore, promoters, passives, detractors,
      avgFrequency, rfmSegments, byChannel, byBranch,
      churnRisk, rowCount: rows.length,
    };
  }

  function _emptyClients() {
    return {
      total:0, active:0, atRisk:0, lost:0, newClients:0,
      retentionRate:null, churnRate:null, npsAvg:null, npsScore:null,
      promoters:0, passives:0, detractors:0, avgFrequency:null,
      rfmSegments:[], byChannel:[], byBranch:[], churnRisk:[], rowCount:0,
    };
  }

  // ── DERIVAR CLIENTES DESDE VENTAS ────────────────────────────
  // Si el usuario no tiene Excel de clientes (o le faltan columnas RFM),
  // construye un array compatible leyendo el Excel de ventas.
  // Devuelve filas con: Cliente_ID, Nombre_Cliente, Días_Sin_Compra,
  // Frecuencia_Compra, Ventas_Monto (LTV), Canal_Adquisición.
  // NPS queda en null — el usuario puede enriquecer con encuestas.
  function deriveClientsFromSales(salesRows, referenceDate) {
    if (!salesRows || !salesRows.length) return [];
    const refDate = referenceDate || new Date();
    const map = {};

    salesRows.forEach(r => {
      const id = r.Cliente_ID || r.Nombre_Cliente;
      if (!id) return; // sin ID de cliente no se puede agrupar

      const fecha = r.Fecha ? new Date(r.Fecha) : null;
      const monto = parseFloat(r.Ventas_Monto) || 0;

      if (!map[id]) {
        map[id] = {
          Cliente_ID:        id,
          Nombre_Cliente:    r.Nombre_Cliente || id,
          Canal_Adquisición: r.Canal_Venta || null,
          Sucursal:          r.Sucursal || null,
          _lastDate:         fecha,
          _count:            0,
          _totalMonto:       0,
        };
      }
      map[id]._count++;
      map[id]._totalMonto += monto;
      if (fecha && (!map[id]._lastDate || fecha > map[id]._lastDate)) {
        map[id]._lastDate = fecha;
      }
    });

    return Object.values(map).map(c => {
      const diasSinCompra = c._lastDate
        ? Math.max(0, Math.floor((refDate - c._lastDate) / 86400000))
        : 999;
      return {
        Cliente_ID:          c.Cliente_ID,
        Nombre_Cliente:      c.Nombre_Cliente,
        Días_Sin_Compra:     diasSinCompra,
        Frecuencia_Compra:   c._count,
        Ventas_Monto:        c._totalMonto,
        Canal_Adquisición:   c.Canal_Adquisición,
        Sucursal:            c.Sucursal,
        NPS:                 null,
        _derived:            true, // flag para badge visual
      };
    });
  }

  function calcRFM(rows) {
    if (!rows.length) return [];
    const segments = {
      champions:         { label:'Champions',          icon:'🏆', color:'#22c55e', clients:[] },
      loyal:             { label:'Clientes Leales',    icon:'⭐', color:'#3b82f6', clients:[] },
      potential:         { label:'Potenciales',        icon:'🌱', color:'#14b8a6', clients:[] },
      new_customers:     { label:'Nuevos',             icon:'🆕', color:'#6366f1', clients:[] },
      at_risk:           { label:'En Riesgo',          icon:'⚠️', color:'#f59e0b', clients:[] },
      hibernating:       { label:'Hibernando',         icon:'😴', color:'#94a3b8', clients:[] },
      lost:              { label:'Perdidos',           icon:'❌', color:'#ef4444', clients:[] },
    };

    rows.forEach(r => {
      const dias  = parseFloat(r.Días_Sin_Compra) || 0;
      const freq  = parseFloat(r.Frecuencia_Compra) || 1;
      const nps   = parseFloat(r.NPS) || 5;
      let seg;

      if (dias <= 15 && freq >= 8 && nps >= 9)       seg = 'champions';
      else if (dias <= 30 && freq >= 5)               seg = 'loyal';
      else if (dias <= 30 && freq >= 2)               seg = 'potential';
      else if (dias <= 7)                             seg = 'new_customers';
      else if (dias > 30 && dias <= 60)               seg = 'at_risk';
      else if (dias > 60 && dias <= 120)              seg = 'hibernating';
      else                                            seg = 'lost';

      segments[seg].clients.push({
        id:   r.Cliente_ID,
        name: r.Nombre_Cliente,
        dias, freq, nps,
        canal: r.Canal_Adquisición,
      });
    });

    return Object.entries(segments).map(([key, s]) => ({
      key, ...s,
      count: s.clients.length,
      pct:   pct(s.clients.length, rows.length),
    })).filter(s => s.count > 0);
  }

  function _calcChurnRisk(row) {
    const dias = parseFloat(row.Días_Sin_Compra) || 0;
    const freq = parseFloat(row.Frecuencia_Compra) || 1;
    const avgDays = 365 / freq;
    const ratio   = dias / avgDays;
    if (ratio > 2.5) return 'high';
    if (ratio > 1.5) return 'medium';
    return 'low';
  }

  // Ficha cliente 360°
  function calcClient360(clientId, salesRows, cxRows, supportRows) {
    const purchases = (salesRows || []).filter(r => r.Cliente_ID === clientId);
    const cxData    = (cxRows    || []).filter(r => r.Cliente_ID === clientId);
    const suppData  = (supportRows || []).filter(r => r.Cliente_ID === clientId);

    if (!purchases.length) return null;

    const totalSpend   = sum(purchases, 'Ventas_Monto');
    const transactions = purchases.length;
    const avgTicket    = transactions > 0 ? totalSpend / transactions : 0;

    const prodCount = {};
    purchases.forEach(r => { if (r.Producto) prodCount[r.Producto] = (prodCount[r.Producto]||0)+1; });
    const favProduct = Object.entries(prodCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';

    const chanCount = {};
    purchases.forEach(r => { if (r.Canal_Venta) chanCount[r.Canal_Venta] = (chanCount[r.Canal_Venta]||0)+1; });
    const favChannel = Object.entries(chanCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';

    const dates = purchases.map(r => storage.parseDate(r.Fecha)).filter(Boolean).sort((a,b)=>a-b);
    const firstPurchase = dates[0] ? dates[0].toISOString().split('T')[0] : null;
    const lastPurchase  = dates[dates.length-1] ? dates[dates.length-1].toISOString().split('T')[0] : null;
    const daysSince     = lastPurchase ? Math.floor((Date.now() - new Date(lastPurchase)) / 86400000) : null;

    const freqAnnual    = dates.length > 1
      ? (dates.length / ((dates[dates.length-1] - dates[0]) / (365*24*3600*1000))) || 0
      : 0;
    const ltvEstimate   = avgTicket * Math.max(freqAnnual, 1) * 2;

    const npsHistory    = cxData.map(r => ({ fecha: r.Fecha, score: parseFloat(r.NPS_Score) })).filter(r => r.score >= 0);
    const npsAvg        = npsHistory.length ? npsHistory.reduce((s,r)=>s+r.score,0)/npsHistory.length : null;

    const churnRisk     = daysSince !== null
      ? (daysSince > 90 ? 'high' : daysSince > 45 ? 'medium' : 'low')
      : 'low';

    return {
      clientId, totalSpend, transactions, avgTicket,
      favProduct, favChannel, firstPurchase, lastPurchase,
      daysSince, freqAnnual, ltvEstimate,
      npsAvg, npsHistory,
      churnRisk,
      purchaseHistory: purchases.sort((a,b) => new Date(b.Fecha) - new Date(a.Fecha)).slice(0, 20),
      supportHistory:  suppData.sort((a,b)  => new Date(b.Fecha) - new Date(a.Fecha)).slice(0, 10),
      cxHistory:       cxData.sort((a,b)    => new Date(b.Fecha) - new Date(a.Fecha)).slice(0, 10),
    };
  }

  // ════════════════════════════════════════════════════════════════
  // MÓDULO ATENCIÓN AL CLIENTE
  // ════════════════════════════════════════════════════════════════
  function calcSupport(rows, goals = {}) {
    if (!rows?.length) return _emptySupport();

    const total     = rows.length;
    const resolved1 = rows.filter(r => parseFloat(r.Resuelto_1er_Contacto) === 1 || r.Resuelto_1er_Contacto === true).length;
    const escalated = rows.filter(r => parseFloat(r.Escaló) === 1 || r.Escaló === true).length;
    const fcr       = pct(resolved1, total);
    const escalPct  = pct(escalated, total);

    const csatRows  = rows.filter(r => parseFloat(r.CSAT) > 0);
    const csatAvg   = csatRows.length ? avg(csatRows, 'CSAT') : null;

    const ttrRows   = rows.filter(r => parseFloat(r.Tiempo_Respuesta_Hrs) > 0);
    const avgTTR    = ttrRows.length ? avg(ttrRows, 'Tiempo_Respuesta_Hrs') : null;

    const byChannel = groupByCount(rows, 'Canal_Venta');
    const byBranch  = groupByCount(rows, 'Sucursal');
    const byMotivo  = groupByCount(rows, 'Motivo');

    // FCR por canal
    const fcrByChannel = {};
    byChannel.forEach(c => {
      const chanRows = rows.filter(r => (r.Canal_Venta||'Sin datos') === c.label);
      const res1     = chanRows.filter(r => parseFloat(r.Resuelto_1er_Contacto)===1||r.Resuelto_1er_Contacto===true).length;
      fcrByChannel[c.label] = pct(res1, chanRows.length);
    });

    // Pareto de motivos (acumulado para línea 80%)
    let cumulative = 0;
    const motivoPareto = byMotivo.map(m => {
      cumulative += m.pct;
      return { ...m, cumulative };
    });

    const trend = calcMonthlyTrend(rows, 'CSAT');

    return {
      total, resolved1, escalated, fcr, escalPct,
      csatAvg, avgTTR, byChannel, byBranch, byMotivo,
      fcrByChannel, motivoPareto, trend, rowCount: rows.length,
    };
  }

  function _emptySupport() {
    return {
      total:0, resolved1:0, escalated:0, fcr:null, escalPct:null,
      csatAvg:null, avgTTR:null, byChannel:[], byBranch:[],
      byMotivo:[], fcrByChannel:{}, motivoPareto:[], trend:[], rowCount:0,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // MÓDULO CX / SATISFACCIÓN
  // ════════════════════════════════════════════════════════════════
  function calcCX(rows, goals = {}) {
    if (!rows?.length) return _emptyCX();

    const npsRows    = rows.filter(r => parseFloat(r.NPS_Score) >= 0);
    const promoters  = npsRows.filter(r => parseFloat(r.NPS_Score) >= 9).length;
    const passives   = npsRows.filter(r => { const n=parseFloat(r.NPS_Score); return n>=7&&n<=8; }).length;
    const detractors = npsRows.filter(r => parseFloat(r.NPS_Score) <= 6).length;
    const npsScore   = npsRows.length
      ? pct(promoters, npsRows.length) - pct(detractors, npsRows.length)
      : null;
    const npsAvg     = npsRows.length ? avg(npsRows, 'NPS_Score') : null;

    const csatRows   = rows.filter(r => parseFloat(r.CSAT_Score) > 0);
    const csatAvg    = csatRows.length ? avg(csatRows, 'CSAT_Score') : null;

    const cesRows    = rows.filter(r => parseFloat(r.CES_Score) > 0);
    const cesAvg     = cesRows.length ? avg(cesRows, 'CES_Score') : null;

    const ttrRows    = rows.filter(r => parseFloat(r.TTR_Hrs) > 0);
    const avgTTR     = ttrRows.length ? avg(ttrRows, 'TTR_Hrs') : null;

    const fcrRows    = rows.filter(r => r.FCR !== undefined && r.FCR !== '');
    const fcrPct     = fcrRows.length ? pct(fcrRows.filter(r=>parseFloat(r.FCR)===1||r.FCR===true).length, fcrRows.length) : null;

    const lost       = rows.filter(r => parseFloat(r.Perdido_Post_Reclamo)===1||r.Perdido_Post_Reclamo===true).length;
    const lostRate   = pct(lost, rows.length);

    // Pareto de etiquetas (soporta Etiqueta, Etiqueta_2, Etiqueta_3)
    const tagFreq = {};
    rows.forEach(r => {
      ['Etiqueta','Etiqueta_2','Etiqueta_3'].forEach(col => {
        const tag = (r[col]||'').trim();
        if (tag) tagFreq[tag] = (tagFreq[tag]||0) + 1;
      });
    });
    let cumTag = 0;
    const tagPareto = Object.entries(tagFreq)
      .sort(([,a],[,b]) => b-a)
      .map(([tag, count]) => {
        cumTag += (count / rows.length) * 100;
        return { tag, count, pct: (count/rows.length)*100, cumulative: cumTag };
      });

    // CX Score compuesto (0-100)
    const cxScore = _calcCXScore(npsScore, csatAvg, cesAvg, fcrPct);

    const byChannel  = groupByCount(rows, 'Canal_Venta');
    const byBranch   = groupByCount(rows, 'Sucursal');
    const npsMonthly = calcMonthlyTrend(rows, 'NPS_Score');

    return {
      npsScore, npsAvg, promoters, passives, detractors,
      csatAvg, cesAvg, avgTTR, fcrPct, lost, lostRate,
      tagPareto, cxScore, byChannel, byBranch, npsMonthly,
      rowCount: rows.length,
    };
  }

  function _emptyCX() {
    return {
      npsScore:null, npsAvg:null, promoters:0, passives:0, detractors:0,
      csatAvg:null, cesAvg:null, avgTTR:null, fcrPct:null, lost:0, lostRate:null,
      tagPareto:[], cxScore:null, byChannel:[], byBranch:[], npsMonthly:[], rowCount:0,
    };
  }

  function _calcCXScore(nps, csat, ces, fcr) {
    let score = 0, weight = 0;
    if (nps !== null)  { score += Math.max(0, Math.min(100, (nps + 100) / 2)); weight++; }
    if (csat !== null) { score += Math.max(0, Math.min(100, (csat / 5) * 100)); weight++; }
    if (ces !== null)  { score += Math.max(0, Math.min(100, ((5 - ces) / 4) * 100)); weight++; }
    if (fcr !== null)  { score += Math.max(0, Math.min(100, fcr)); weight++; }
    return weight > 0 ? score / weight : null;
  }

  // ════════════════════════════════════════════════════════════════
  // MÓDULO INVENTARIO
  // ════════════════════════════════════════════════════════════════
  function calcInventory(rows, goals = {}) {
    if (!rows?.length) return _emptyInventory();

    const products = {};
    rows.forEach(r => {
      const name = r.Producto || 'Sin producto';
      if (!products[name]) products[name] = {
        name, categoria: r.Categoría||'', sucursal: r.Sucursal||'',
        stockInicial:0, compras:0, ventas:0, devoluciones:0,
        costoUnitario: parseFloat(r.Costo_Unitario)||0,
      };
      const p = products[name];
      p.stockInicial  += parseFloat(r.Stock_Inicial)    || 0;
      p.compras       += parseFloat(r.Compras_Unidades)  || 0;
      p.ventas        += parseFloat(r.Ventas_Unidades)   || 0;
      p.devoluciones  += parseFloat(r.Devoluciones)      || 0;
      if (parseFloat(r.Costo_Unitario) > 0) p.costoUnitario = parseFloat(r.Costo_Unitario);
    });

    const productList = Object.values(products).map(p => {
      const stockFinal   = p.stockInicial + p.compras - p.ventas + p.devoluciones;
      const stockProm    = (p.stockInicial + stockFinal) / 2;
      const rotation     = stockProm > 0 ? p.ventas / stockProm : null;
      const daysInv      = rotation ? 365 / rotation : null;
      const devRate      = p.ventas > 0 ? (p.devoluciones / p.ventas) * 100 : null;
      const stockValue   = stockFinal * p.costoUnitario;
      const status       = daysInv !== null
        ? (daysInv < 7 ? 'red' : daysInv < 14 ? 'yellow' : 'green')
        : 'na';

      return {
        ...p, stockFinal, stockProm, rotation,
        daysInventory: daysInv, devRate, stockValue, status,
      };
    });

    const critical     = productList.filter(p => p.daysInventory !== null && p.daysInventory < 7);
    const warning      = productList.filter(p => p.daysInventory !== null && p.daysInventory >= 7 && p.daysInventory < 14);
    const totalValue   = productList.reduce((s,p) => s + (p.stockValue||0), 0);
    const avgRotation  = productList.filter(p=>p.rotation).reduce((s,p)=>s+p.rotation,0) / (productList.filter(p=>p.rotation).length||1);
    const avgDaysInv   = productList.filter(p=>p.daysInventory).reduce((s,p)=>s+p.daysInventory,0) / (productList.filter(p=>p.daysInventory).length||1);

    const byCategory   = groupBy(rows, 'Categoría', 'Ventas_Unidades');

    return {
      productList: productList.sort((a,b) => (a.daysInventory||999) - (b.daysInventory||999)),
      critical, warning, totalValue, avgRotation, avgDaysInv,
      byCategory, rowCount: rows.length,
    };
  }

  function _emptyInventory() {
    return {
      productList:[], critical:[], warning:[], totalValue:0,
      avgRotation:null, avgDaysInv:null, byCategory:[], rowCount:0,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // MÓDULO MARKETING
  // ════════════════════════════════════════════════════════════════
  function calcMarketing(rows, salesRows, goals = {}) {
    if (!rows?.length) return _emptyMarketing();

    const totalInversion  = sum(rows, 'Inversión');
    const totalLeads      = sum(rows, 'Leads');
    const totalVentas     = sum(rows, 'Ventas_Campaña');

    const roi    = totalInversion > 0 ? ((totalVentas - totalInversion) / totalInversion) * 100 : null;
    const roas   = totalInversion > 0 ? totalVentas / totalInversion : null;
    const cpl    = totalLeads > 0 ? totalInversion / totalLeads : null;

    // KPIs por campaña
    const campaigns = rows.map(r => {
      const inv  = parseFloat(r.Inversión)     || 0;
      const ven  = parseFloat(r.Ventas_Campaña) || 0;
      const leads= parseFloat(r.Leads)          || 0;
      return {
        name:      r.Campaña     || 'Sin nombre',
        channel:   r.Canal_Marketing || '',
        fecha:     r.Fecha,
        inversion: inv,
        ventas:    ven,
        leads,
        roi:       inv > 0 ? ((ven - inv) / inv) * 100 : null,
        roas:      inv > 0 ? ven / inv : null,
        cpl:       leads > 0 ? inv / leads : null,
        status:    inv > 0 ? storage.getStatus((ven-inv)/inv*100, goals.roi_marketing||300) : 'na',
      };
    }).sort((a, b) => (b.roi||0) - (a.roi||0));

    // Uplift: ventas en días de campaña vs días sin campaña
    const uplift = calcUplift(rows, salesRows);

    const byChannel = groupBy(rows, 'Canal_Marketing', 'Ventas_Campaña');
    const roiByChannel = {};
    byChannel.forEach(c => {
      const chanRows = rows.filter(r => (r.Canal_Marketing||'Sin datos') === c.label);
      const inv  = sum(chanRows, 'Inversión');
      const ven  = sum(chanRows, 'Ventas_Campaña');
      roiByChannel[c.label] = inv > 0 ? ((ven-inv)/inv)*100 : null;
    });

    return {
      totalInversion, totalLeads, totalVentas, roi, roas, cpl,
      campaigns, uplift, byChannel, roiByChannel, rowCount: rows.length,
    };
  }

  function calcUplift(marketingRows, salesRows) {
    if (!marketingRows?.length || !salesRows?.length) return null;

    const campaignDays = new Set();
    marketingRows.forEach(r => {
      const start = storage.parseDate(r.Fecha_Inicio_Campaña || r.Fecha);
      const end   = storage.parseDate(r.Fecha_Fin_Campaña    || r.Fecha);
      if (!start) return;
      const endD = end || start;
      for (let d = new Date(start); d <= endD; d.setDate(d.getDate()+1)) {
        campaignDays.add(d.toISOString().split('T')[0]);
      }
    });

    const withCampaign    = salesRows.filter(r => campaignDays.has(r.Fecha));
    const withoutCampaign = salesRows.filter(r => !campaignDays.has(r.Fecha));

    if (!withCampaign.length || !withoutCampaign.length) return null;

    const avgWith    = sum(withCampaign,    'Ventas_Monto') / withCampaign.length;
    const avgWithout = sum(withoutCampaign, 'Ventas_Monto') / withoutCampaign.length;
    const upliftPct  = avgWithout > 0 ? ((avgWith - avgWithout) / avgWithout) * 100 : null;

    return { avgWith, avgWithout, upliftPct, daysWithCampaign: withCampaign.length, daysWithout: withoutCampaign.length };
  }

  function _emptyMarketing() {
    return {
      totalInversion:0, totalLeads:0, totalVentas:0, roi:null, roas:null, cpl:null,
      campaigns:[], uplift:null, byChannel:[], roiByChannel:{}, rowCount:0,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // MÓDULO FINANZAS
  // ════════════════════════════════════════════════════════════════
  function calcFinance(rows, goals = {}) {
    if (!rows?.length) return _emptyFinance();

    const totalIngresos  = sum(rows, 'Ingresos');
    const totalCostos    = sum(rows, 'Costos');
    const totalGastos    = sum(rows, 'Gastos_Operacionales');
    const totalCxC       = sum(rows, 'Cuentas_Por_Cobrar');

    const margenBruto    = totalIngresos > 0 ? ((totalIngresos - totalCostos) / totalIngresos) * 100 : null;
    const margenOper     = totalIngresos > 0 ? ((totalIngresos - totalCostos - totalGastos) / totalIngresos) * 100 : null;
    const resultadoNeto  = totalIngresos - totalCostos - totalGastos;

    // Días de cobro
    const ingDiario  = totalIngresos / 30;
    const diasCobro  = ingDiario > 0 ? totalCxC / ingDiario : null;

    // Flujo de caja mensual
    const cashFlow   = calcCashFlowMonthly(rows);

    // Saldo acumulado y días de caja
    const saldoFinal = cashFlow.length ? cashFlow[cashFlow.length-1].saldoAcum : 0;
    const egresosDiarios = (totalCostos + totalGastos) / Math.max(cashFlow.length * 30, 30);
    const diasCaja   = egresosDiarios > 0 ? saldoFinal / egresosDiarios : null;

    // Proyección 30 días (simple: tendencia últimos 3 meses)
    const lastMonths = cashFlow.slice(-3);
    const avgNetFlow = lastMonths.length
      ? lastMonths.reduce((s,m) => s + m.neto, 0) / lastMonths.length
      : 0;
    const saldoProyectado30 = saldoFinal + avgNetFlow;

    const monthlyTrend = calcMonthlyTrend(rows, 'Ingresos');

    return {
      totalIngresos, totalCostos, totalGastos, totalCxC,
      margenBruto, margenOper, resultadoNeto,
      diasCobro, cashFlow, saldoFinal, diasCaja,
      saldoProyectado30, avgNetFlow, monthlyTrend,
      rowCount: rows.length,
    };
  }

  function calcCashFlowMonthly(rows) {
    const months = {};
    rows.forEach(r => {
      const d = storage.parseDate(r.Fecha);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!months[key]) months[key] = { key, ingresos:0, egresos:0 };
      months[key].ingresos += (parseFloat(r.Ingresos)||0);
      months[key].egresos  += (parseFloat(r.Costos)||0) + (parseFloat(r.Gastos_Operacionales)||0);
    });

    let saldoAcum = 0;
    return Object.values(months).sort((a,b) => a.key.localeCompare(b.key)).map(m => {
      const neto = m.ingresos - m.egresos;
      saldoAcum += neto;
      return { ...m, neto, saldoAcum };
    });
  }

  function _emptyFinance() {
    return {
      totalIngresos:0, totalCostos:0, totalGastos:0, totalCxC:0,
      margenBruto:null, margenOper:null, resultadoNeto:0,
      diasCobro:null, cashFlow:[], saldoFinal:0, diasCaja:null,
      saldoProyectado30:0, avgNetFlow:0, monthlyTrend:[], rowCount:0,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // MÓDULO EQUIPO
  // ════════════════════════════════════════════════════════════════
  function calcTeam(rows, goals = {}) {
    if (!rows?.length) return _emptyTeam();

    const sellers = {};
    rows.forEach(r => {
      const name = r.Vendedor || 'Sin nombre';
      if (!sellers[name]) sellers[name] = {
        name, branch: r.Sucursal||'', canal: r.Canal_Venta||'',
        monto:0, meta:0, leads:0, diasTrab:0, diasAus:0, dotacion:0, months:0,
      };
      const s = sellers[name];
      s.monto    += parseFloat(r.Ventas_Monto)   || 0;
      s.meta     += parseFloat(r.Meta_Mes)        || 0;
      s.leads    += parseFloat(r.Leads)           || 0;
      s.diasTrab += parseFloat(r.Dias_Trabajados) || 0;
      s.diasAus  += parseFloat(r.Dias_Ausentes)   || 0;
      s.dotacion  = parseFloat(r.Dotacion)        || 1;
      s.months++;
    });

    const sellerList = Object.values(sellers).map(s => ({
      ...s,
      goalPct:        pct(s.monto, s.meta),
      absenteeismPct: s.diasTrab > 0 ? pct(s.diasAus, s.diasTrab + s.diasAus) : null,
      productivity:   s.diasTrab > 0 ? s.monto / s.diasTrab : null,
      avgLeads:       s.months > 0 ? s.leads / s.months : 0,
      status:         s.meta > 0 ? storage.getStatus(s.monto, s.meta) : 'na',
    })).sort((a, b) => (b.goalPct||0) - (a.goalPct||0));

    const totalMonto   = sellerList.reduce((s,v) => s+v.monto, 0);
    const totalMeta    = sellerList.reduce((s,v) => s+v.meta, 0);
    const teamGoalPct  = pct(totalMonto, totalMeta);
    const totalDiasAus = sellerList.reduce((s,v) => s+v.diasAus, 0);
    const totalDiasTrab= sellerList.reduce((s,v) => s+v.diasTrab, 0);
    const absenteeism  = totalDiasTrab > 0 ? pct(totalDiasAus, totalDiasTrab + totalDiasAus) : null;

    const underGoal    = sellerList.filter(s => s.goalPct !== null && s.goalPct < 80);
    const byBranch     = groupBy(rows, 'Sucursal', 'Ventas_Monto');
    const trend        = calcMonthlyTrend(rows, 'Ventas_Monto');

    return {
      sellerList, totalMonto, totalMeta, teamGoalPct,
      absenteeism, underGoal, byBranch, trend, rowCount: rows.length,
    };
  }

  function _emptyTeam() {
    return {
      sellerList:[], totalMonto:0, totalMeta:0, teamGoalPct:null,
      absenteeism:null, underGoal:[], byBranch:[], trend:[], rowCount:0,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // MÓDULO PROVEEDORES (nuevo)
  // ════════════════════════════════════════════════════════════════
  function calcSuppliers(rows, goals = {}) {
    if (!rows?.length) return _emptySuppliers();

    const totalSpend     = sum(rows, 'Costo_Total');
    const totalOrders    = rows.length;

    // KPIs por proveedor
    const suppliers = {};
    rows.forEach(r => {
      const name = r.Proveedor_Nombre || r.Proveedor_ID || 'Sin nombre';
      if (!suppliers[name]) suppliers[name] = {
        name, id: r.Proveedor_ID||'', pais: r.País_Origen||'',
        spend:0, orders:0, leadTimes:[], onTime:0, late:0,
      };
      const s = suppliers[name];
      s.spend  += parseFloat(r.Costo_Total) || 0;
      s.orders++;

      const lt = parseFloat(r.Lead_Time_Días);
      if (lt > 0) s.leadTimes.push(lt);

      if (r.Fecha_Entrega_Real && r.Fecha_Entrega_Esperada) {
        const real = storage.parseDate(r.Fecha_Entrega_Real);
        const exp  = storage.parseDate(r.Fecha_Entrega_Esperada);
        if (real && exp) {
          real <= exp ? s.onTime++ : s.late++;
        }
      }
    });

    const supplierList = Object.values(suppliers).map(s => {
      const avgLT    = s.leadTimes.length ? s.leadTimes.reduce((a,b)=>a+b,0)/s.leadTimes.length : null;
      const otd      = (s.onTime + s.late) > 0 ? pct(s.onTime, s.onTime + s.late) : null;
      const concPct  = totalSpend > 0 ? pct(s.spend, totalSpend) : 0;

      return {
        ...s, avgLT, otd, concPct,
        risk: concPct >= 60 ? 'high' : concPct >= 40 ? 'medium' : 'low',
      };
    }).sort((a, b) => b.spend - a.spend);

    // OTD global
    const totalOnTime = supplierList.reduce((s,v) => s + v.onTime, 0);
    const totalLate   = supplierList.reduce((s,v) => s + v.late, 0);
    const globalOTD   = (totalOnTime + totalLate) > 0 ? pct(totalOnTime, totalOnTime + totalLate) : null;

    // Órdenes pendientes/vencidas
    const today   = new Date();
    const pending = rows.filter(r => !r.Fecha_Entrega_Real && r.Fecha_Entrega_Esperada);
    const overdue = pending.filter(r => {
      const exp = storage.parseDate(r.Fecha_Entrega_Esperada);
      return exp && exp < today;
    });

    const byCategory = groupBy(rows, 'Categoría', 'Costo_Total');

    return {
      totalSpend, totalOrders, supplierList, globalOTD,
      pending, overdue, byCategory, rowCount: rows.length,
    };
  }

  function _emptySuppliers() {
    return {
      totalSpend:0, totalOrders:0, supplierList:[], globalOTD:null,
      pending:[], overdue:[], byCategory:[], rowCount:0,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // ÍNDICE DE SALUD DEL NEGOCIO (0-100)
  // ════════════════════════════════════════════════════════════════
  function calcHealthIndex(allKPIs, goals) {
    const scores = [];

    // Ventas (25%)
    if (allKPIs.sales?.goalAchievement !== null) {
      scores.push({ score: Math.min(100, allKPIs.sales.goalAchievement), weight: 25 });
    }

    // Finanzas (20%)
    if (allKPIs.finance?.margenBruto !== null) {
      const gm = goals.gross_margin || 40;
      scores.push({ score: Math.min(100, (allKPIs.finance.margenBruto / gm) * 100), weight: 20 });
    }

    // Clientes (20%)
    if (allKPIs.clients?.retentionRate !== null) {
      const ret = goals.retention_rate || 80;
      scores.push({ score: Math.min(100, (allKPIs.clients.retentionRate / ret) * 100), weight: 20 });
    }

    // CX (20%)
    if (allKPIs.cx?.cxScore !== null) {
      scores.push({ score: Math.min(100, allKPIs.cx.cxScore), weight: 20 });
    }

    // Operaciones: inventario + equipo (15%)
    const opScores = [];
    if (allKPIs.team?.teamGoalPct !== null) opScores.push(Math.min(100, allKPIs.team.teamGoalPct));
    if (allKPIs.inventory?.productList?.length) {
      const critPct = (allKPIs.inventory.critical.length / allKPIs.inventory.productList.length) * 100;
      opScores.push(Math.max(0, 100 - critPct * 5));
    }
    if (opScores.length) {
      scores.push({ score: opScores.reduce((s,v)=>s+v,0)/opScores.length, weight: 15 });
    }

    if (!scores.length) return null;
    const totalWeight = scores.reduce((s,v) => s + v.weight, 0);
    return Math.round(scores.reduce((s,v) => s + v.score * v.weight, 0) / totalWeight);
  }

  // ════════════════════════════════════════════════════════════════
  // AGENDA "QUÉ HACER HOY"
  // ════════════════════════════════════════════════════════════════
  function generarAgendaHoy(allData, goals) {
    const acciones = [];
    const today    = new Date();
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();

    // 1. Stock crítico
    if (allData.inventory?.productList) {
      allData.inventory.productList
        .filter(p => p.daysInventory !== null && p.daysInventory < 7)
        .slice(0, 2)
        .forEach(p => acciones.push({
          urgencia: 'alta',
          icon: '📦',
          texto: i18n.t('todayActionStock', { days: Math.round(p.daysInventory), units: Math.round(p.stockFinal) }) + ` — ${sanitize(p.name)}`,
          modulo: 'inventory',
        }));
    }

    // 2. Vendedor bajo meta a mitad de mes
    if (dayOfMonth >= daysInMonth * 0.4 && allData.team?.sellerList) {
      const esperado = dayOfMonth / daysInMonth;
      allData.team.sellerList
        .filter(s => s.goalPct !== null && s.goalPct < esperado * 100 * 0.85)
        .slice(0, 2)
        .forEach(s => acciones.push({
          urgencia: 'media',
          icon: '👤',
          texto: i18n.t('todayActionSeller', { name: s.name, pct: Math.round(s.goalPct) }),
          modulo: 'team',
        }));
    }

    // 3. Clientes en riesgo (60-90 días)
    if (allData.clients?.churnRisk) {
      const enRiesgo = allData.clients.churnRisk.filter(c => c.dias > 60 && c.dias <= 90).length;
      if (enRiesgo > 0) acciones.push({
        urgencia: 'media',
        icon: '💌',
        texto: i18n.t('todayActionClients', { n: enRiesgo, days: 60 }),
        modulo: 'clients',
      });
    }

    // 4. Descuento sobre meta
    if (allData.sales?.discountData) {
      const d    = allData.sales.discountData;
      const meta = goals.max_discount || 10;
      if (d.avg > meta) acciones.push({
        urgencia: 'baja',
        icon: '💹',
        texto: i18n.t('todayActionDiscount', { pct: d.avg.toFixed(1), goal: meta }),
        modulo: 'margin',
      });
    }

    // 5. Órdenes de compra vencidas
    if (allData.suppliers?.overdue?.length > 0) acciones.push({
      urgencia: 'alta',
      icon: '🏭',
      texto: `${allData.suppliers.overdue.length} orden(es) de compra vencidas sin confirmar`,
      modulo: 'suppliers',
    });

    return acciones
      .sort((a, b) => ({ alta:0, media:1, baja:2 }[a.urgencia] - { alta:0, media:1, baja:2 }[b.urgencia]))
      .slice(0, 3);
  }

  // ════════════════════════════════════════════════════════════════
  // HELPER HISTOGRAMA
  // ════════════════════════════════════════════════════════════════
  function _buildHistogram(values, buckets) {
    const result = [];
    for (let i = 0; i < buckets.length - 1; i++) {
      const lo    = buckets[i];
      const hi    = buckets[i+1];
      const count = values.filter(v => v >= lo && v < hi).length;
      result.push({ label: `${lo}–${hi}%`, count, pct: values.length ? (count/values.length)*100 : 0 });
    }
    return result;
  }

  // ── API PÚBLICA ──────────────────────────────────────────────
  return {
    // Módulos
    calcSales,
    dedupMeta,
    dedupMetaByVendor,
    calcClients,
    calcSupport,
    calcCX,
    calcInventory,
    calcMarketing,
    calcFinance,
    calcTeam,
    calcSuppliers,
    // Específicos
    calcDiscount,
    calcProductRanking,
    calcMarginByProduct,
    calcClient360,
    calcRFM,
    deriveClientsFromSales,
    calcUplift,
    calcHealthIndex,
    generarAgendaHoy,
    // Helpers exportados
    groupBy,
    groupByCount,
    calcMonthlyTrend,
    calcMonthForecast,
    calcSellerRanking,
    // Utils
    sum, avg, pct, safe,
  };
})();



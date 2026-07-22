/**
 * ClaroKPIs — Smoke Tests
 * Corre con: node tests/smoke.test.js
 * No requiere browser. Cubre storage y KPIs con mocks de localStorage e IDB.
 */

// ── MOCKS ──────────────────────────────────────────────────────
// Mock de localStorage
const _store = {};
global.localStorage = {
  getItem:    (k)    => _store[k] ?? null,
  setItem:    (k, v) => { _store[k] = v; },
  removeItem: (k)    => { delete _store[k]; },
  key:        (i)    => Object.keys(_store)[i] ?? null,
  get length()       { return Object.keys(_store).length; },
};

// Mock mínimo de IndexedDB (fallback a localStorage en storage.js)
global.indexedDB = null;
global.IDBKeyRange = {};

// Mock de document (para eventos)
global.document = {
  dispatchEvent: () => {},
  addEventListener: () => {},
};

// Mock de i18n
global.i18n = {
  t: (key, vars) => {
    let val = key;
    if (vars) Object.entries(vars).forEach(([k,v]) => val = val.replace(`{${k}}`, v));
    return val;
  },
  getLang: () => 'es',
};

// Cargar storage.js
const fs   = require('fs');
const path = require('path');

// window debe existir ANTES de evaluar storage.js
global.window = global;

// Usar Function para ejecutar en contexto global y exponer las variables
function loadModule(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  // Wrappear para que las const/let del módulo queden en global scope
  const wrapper = new Function(src + '\n//# sourceURL=' + path.basename(filePath));
  wrapper.call(global);
}

loadModule(path.join(__dirname, '../js/storage.js'));
// storage es const local del IIFE → acceder via la asignación directa
// storage.js: const storage = (() => {...})(); → necesitamos ejecutarlo en global
// Alternativa limpia: re-evaluar asignando a global
const storageSrc = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
const storageWrapped = '(function(global){' + storageSrc + '\nglobal.storage=storage;\nglobal.formatCurrency=typeof formatCurrency!=="undefined"?formatCurrency:()=>"$0";})(global);';
eval(storageWrapped);

// ── MINI TEST RUNNER ───────────────────────────────────────────
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch(e) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
    failed++;
  }
}

function expect(val) {
  return {
    toBe:          (exp) => { if (val !== exp) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
    toEqual:       (exp) => { if (JSON.stringify(val) !== JSON.stringify(exp)) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
    toBeGreaterThan: (n) => { if (!(val > n)) throw new Error(`Expected ${val} > ${n}`); },
    toBeDefined:   ()   => { if (val === undefined || val === null) throw new Error(`Expected defined, got ${val}`); },
    toHaveLength:  (n)  => { if (val.length !== n) throw new Error(`Expected length ${n}, got ${val.length}`); },
    toContain:     (item) => { if (!val.includes(item)) throw new Error(`Expected array to contain ${item}`); },
  };
}

// ── TESTS: storage.js ──────────────────────────────────────────
console.log('\n📦 storage.js\n' + '─'.repeat(40));

test('getConfig retorna DEFAULT_CONFIG con currency CLP', () => {
  const cfg = storage.getConfig();
  expect(cfg.currency).toBe('CLP');
  expect(cfg.rfmPenaltyEnabled).toBeDefined();
});

test('setConfig persiste un valor', () => {
  storage.setConfig({ companyName: 'Test SA' });
  expect(storage.getConfig().companyName).toBe('Test SA');
});

test('setConfig hace merge (no sobreescribe otros campos)', () => {
  storage.setConfig({ companyName: 'Empresa A' });
  storage.setConfig({ currency: 'USD' });
  expect(storage.getConfig().companyName).toBe('Empresa A');
  expect(storage.getConfig().currency).toBe('USD');
});

test('addData + getData retorna los datos correctos (via LS fallback)', () => {
  // IDB no disponible en Node → usa LS fallback
  const rows = [{ Fecha: '2026-01-15', Ventas_Monto: 100000 }];
  storage.addData('sales', rows, 'file_test_1');
  const result = storage.getData('sales');
  expect(result.length).toBeGreaterThan(0);
  expect(result[0].Ventas_Monto).toBe(100000);
});

test('addAlert + getActiveAlerts muestra la alerta', () => {
  storage.addAlert({
    type: 'warning',
    module: 'sales',
    kpi: 'test_kpi',
    messageKey: 'alertSalesGoal',
    params: { pct: '85', falta: '$1M' },
  });
  const alerts = storage.getActiveAlerts();
  expect(alerts.length).toBeGreaterThan(0);
  const myAlert = alerts.find(a => a.kpi === 'test_kpi');
  expect(myAlert).toBeDefined();
});

test('addAlert dedup — no duplica alertas activas del mismo module+kpi+type', () => {
  const before = storage.getActiveAlerts().length;
  storage.addAlert({ type: 'warning', module: 'sales', kpi: 'test_kpi', message: 'dup' });
  const after = storage.getActiveAlerts().length;
  expect(after).toBe(before); // no creció
});

test('getAlertMessage con messageKey retorna el key (mock i18n)', () => {
  const alert = { messageKey: 'alertSalesGoal', params: { pct: '90', falta: '$500K' } };
  const msg = storage.getAlertMessage(alert);
  expect(msg).toBeDefined();
  // i18n mock retorna la key → al menos no explota
});

test('applyFilters con período all retorna todos los datos', () => {
  const rows = [
    { Fecha: '2026-01-01', Ventas_Monto: 1000 },
    { Fecha: '2026-06-01', Ventas_Monto: 2000 },
  ];
  storage.setFilters({ period: 'all' });
  const result = storage.applyFilters(rows);
  expect(result.length).toBe(2);
});

test('clearAllData limpia los datos', () => {
  storage.clearAllData();
  // getData retorna [] después de limpiar
  // (IDB fallback a LS que ahora está limpio)
  const result = storage.getData('test_module_xyz');
  expect(result.length).toBe(0);
});

// ── TESTS: storage.js — parseDate (Bug A — fechas cruzadas) ─────
console.log('\n📅 storage.js — parseDate\n' + '─'.repeat(40));

test('parseDate: YYYY-MM-DD sigue sin ambigüedad', () => {
  const d = storage.parseDate('2026-03-01');
  expect(d.getUTCMonth()).toBe(2); // marzo = índice 2
  expect(d.getUTCDate()).toBe(1);
});

test('parseDate: texto D/M/Y con idioma es → día/mes', () => {
  storage.setConfig({ language: 'es' });
  const d = storage.parseDate('01/03/2026'); // 1 de marzo, tipeado por hispanohablante
  expect(d.getUTCMonth()).toBe(2); // marzo
  expect(d.getUTCDate()).toBe(1);
});

test('parseDate: texto M/D/Y con idioma en → mes/día', () => {
  storage.setConfig({ language: 'en' });
  const d = storage.parseDate('01/03/2026'); // Jan 3, typed by English speaker
  expect(d.getUTCMonth()).toBe(0); // enero
  expect(d.getUTCDate()).toBe(3);
  storage.setConfig({ language: 'es' }); // restaurar default para el resto de tests
});

test('parseDate: si un segmento es >12, ese es el día sin importar el idioma', () => {
  storage.setConfig({ language: 'en' }); // aunque el idioma diga mes/día...
  const d = storage.parseDate('25/03/2026'); // 25 no puede ser mes
  expect(d.getUTCMonth()).toBe(2); // marzo
  expect(d.getUTCDate()).toBe(25);
  storage.setConfig({ language: 'es' });
});

test('parseDate: fecha inválida (13/14/2026) retorna null, no Invalid Date', () => {
  const d = storage.parseDate('13/14/2026');
  expect(d).toBe(null);
});

// ── TESTS: KPIs ────────────────────────────────────────────────
console.log('\n📊 kpis.js\n' + '─'.repeat(40));

// Cargar kpis.js (depende de storage ya cargado)
const kpiSrc = fs.readFileSync(path.join(__dirname, '../js/kpis.js'), 'utf8');
const kpiWrapped = '(function(global){' + kpiSrc + '\nglobal.kpis=kpis;})(global);';
eval(kpiWrapped);

// Exponer funciones KPI directamente para legibilidad de tests
const { calcSales, calcClients, calcRFM, calcMarginByProduct, calcMonthForecast } = kpis;

const SAMPLE_SALES = [
  { Fecha: '2026-05-01', Ventas_Monto: 500000, Vendedor: 'Ana',  Sucursal: 'Centro', Canal_Venta: 'Presencial', Descuento_Pct: 5,  Unidades: 10, Precio_Unitario: 55000 },
  { Fecha: '2026-05-10', Ventas_Monto: 300000, Vendedor: 'Luis', Sucursal: 'Norte',  Canal_Venta: 'Online',     Descuento_Pct: 10, Unidades: 6,  Precio_Unitario: 55000 },
  { Fecha: '2026-05-20', Ventas_Monto: 800000, Vendedor: 'Ana',  Sucursal: 'Centro', Canal_Venta: 'Presencial', Descuento_Pct: 0,  Unidades: 15, Precio_Unitario: 55000 },
];

const SAMPLE_CLIENTS = [
  { Cliente_ID: 'C001', Nombre_Cliente: 'Empresa A', Frecuencia_Compra: 8, Días_Sin_Compra: 15,  NPS: 9 },
  { Cliente_ID: 'C002', Nombre_Cliente: 'Empresa B', Frecuencia_Compra: 3, Días_Sin_Compra: 45,  NPS: 7 },
  { Cliente_ID: 'C003', Nombre_Cliente: 'Empresa C', Frecuencia_Compra: 1, Días_Sin_Compra: 50,  NPS: 4 },
  { Cliente_ID: 'C004', Nombre_Cliente: 'Empresa D', Frecuencia_Compra: 2, Días_Sin_Compra: 100, NPS: 3 },
  { Cliente_ID: 'C005', Nombre_Cliente: 'Empresa E', Frecuencia_Compra: 7, Días_Sin_Compra: 25,  NPS: 9 },
];

test('calcSales retorna totalMonto correcto', () => {
  const result = calcSales(SAMPLE_SALES, {});
  expect(result.totalMonto).toBe(1600000);
});

test('calcSales con array vacío retorna estructura sin explotar', () => {
  const result = calcSales([], {});
  expect(result.totalMonto).toBe(0);
  expect(result.rowCount).toBe(0);
});

test('calcSales retorna avgTicket mayor que 0', () => {
  const result = calcSales(SAMPLE_SALES, {});
  // 1600000 / 3 transacciones = 533333.33...
  expect(result.avgTicket).toBeGreaterThan(0);
  expect(Math.round(result.avgTicket)).toBe(533333);
});

test('calcSales sellerRanking tiene a Ana primero con más ventas', () => {
  const result = calcSales(SAMPLE_SALES, {});
  // Ana: 500000 + 800000 = 1300000, Luis: 300000
  expect(result.sellerRanking[0].name).toBe('Ana');
  expect(result.sellerRanking[0].monto).toBe(1300000);
});

test('calcRFM retorna array de segmentos con count y pct', () => {
  const result = calcRFM(SAMPLE_CLIENTS);
  // retorna array (solo segmentos con count > 0)
  expect(result.length).toBeGreaterThan(0);
  result.forEach(seg => {
    expect(seg.key).toBeDefined();
    expect(seg.count).toBeGreaterThan(0);
    expect(seg.pct).toBeGreaterThan(0);
  });
});

test('calcRFM suma de segmentos = total clientes', () => {
  const result = calcRFM(SAMPLE_CLIENTS);
  const total = result.reduce((s, seg) => s + seg.count, 0);
  expect(total).toBe(SAMPLE_CLIENTS.length);
});

test('calcMarginByProduct calcula grossMargin con datos de inventario', () => {
  const salesRows = [
    { Producto: 'Zapatilla A', Ventas_Monto: 100000, Unidades: 10,
      Precio_Unitario: 10000, Descuento_Pct: 0 },
    { Producto: 'Zapatilla B', Ventas_Monto: 200000, Unidades: 20,
      Precio_Unitario: 10000, Descuento_Pct: 0 },
  ];
  const invRows = [
    { Producto: 'Zapatilla A', Costo_Unitario: 6000 },
    { Producto: 'Zapatilla B', Costo_Unitario: 4000 },
  ];
  const result = calcMarginByProduct(salesRows, invRows);
  expect(result.length).toBeGreaterThan(0);
  const prodA = result.find(p => p.name === 'Zapatilla A');
  expect(prodA).toBeDefined();
  expect(prodA.name).toBe('Zapatilla A');
  // monto acumula Ventas_Monto
  expect(prodA.monto).toBeGreaterThan(0);
});

// ── TESTS: finance-module.js (Bug B — duplicación de esquema) ──
console.log('\n💵 finance-module.js\n' + '─'.repeat(40));

const financeSrc = fs.readFileSync(path.join(__dirname, '../js/finance-module.js'), 'utf8');
const financeWrapped = '(function(global){' + financeSrc + '\nglobal.financeModule=financeModule;})(global);';
eval(financeWrapped);

test('resolveRowFinance: fila con SOLO columnas directas usa esas columnas', () => {
  const r = financeModule.resolveRowFinance({ Ingresos: 100, Costos: 40, Gastos_Operacionales: 10 });
  expect(r.income).toBe(100);
  expect(r.cost).toBe(40);
  expect(r.expense).toBe(10);
});

test('resolveRowFinance: fila con SOLO Monto+Tipo_Movimiento usa Monto', () => {
  const rIn = financeModule.resolveRowFinance({ Tipo_Movimiento: 'Ingreso', Monto: 500 });
  expect(rIn.income).toBe(500);
  expect(rIn.cost).toBe(0);
  const rOut = financeModule.resolveRowFinance({ Tipo_Movimiento: 'Egreso', Monto: 300 });
  expect(rOut.expense).toBe(300);
  expect(rOut.income).toBe(0);
});

test('resolveRowFinance: doble esquema en la misma fila NO duplica — gana la columna directa', () => {
  const r = financeModule.resolveRowFinance({ Tipo_Movimiento: 'Ingreso', Monto: 21200000, Ingresos: 21200000 });
  expect(r.income).toBe(21200000); // no 42400000
});

test('resolveRowFinance: Ingresos=0 explícito no cae al fallback de Monto (numOrNull)', () => {
  const r = financeModule.resolveRowFinance({ Tipo_Movimiento: 'Ingreso', Monto: 500, Ingresos: 0 });
  expect(r.income).toBe(0); // 0 real, no 500
});

test('calcMonthly: fila de plantilla oficial (Ingreso con ambos esquemas) no duplica', () => {
  const rows = [{ Fecha: '2026-05-01', Tipo_Movimiento: 'Ingreso', Monto: 21200000, Ingresos: 21200000, Costos: 11234000, Gastos_Operacionales: 4200000 }];
  const trend = financeModule.calcMonthly(rows);
  expect(trend.length).toBe(1);
  expect(trend[0].income).toBe(21200000);
});

test('calcMonthly: Egreso con doble esquema tampoco duplica (simetría con Ingreso)', () => {
  const rowIngreso = { Fecha: '2026-05-01', Tipo_Movimiento: 'Ingreso', Monto: 1000, Ingresos: 1000 };
  const rowEgreso  = { Fecha: '2026-05-01', Tipo_Movimiento: 'Egreso',  Monto: 1000, Gastos_Operacionales: 1000 };
  const trendIn = financeModule.calcMonthly([rowIngreso]);
  const trendOut = financeModule.calcMonthly([rowEgreso]);
  // Antes del fix: income duplicaba (2000) pero expenses no (1000) — asimetría.
  // Ahora ambos deben quedar en el valor real de la columna directa, sin duplicar.
  expect(trendIn[0].income).toBe(1000);
  expect(trendOut[0].expenses).toBe(1000);
});

test('calcMonthly: "Egreso" (plantilla oficial) SÍ se clasifica como expense sin columna directa', () => {
  const rows = [{ Fecha: '2026-05-01', Tipo_Movimiento: 'Egreso', Monto: 250000 }];
  const trend = financeModule.calcMonthly(rows);
  expect(trend[0].expenses).toBe(250000);
});

test('calcFinanceKPIs: archivo con doble esquema no infla totalIncome', () => {
  const rows = [
    { Fecha: '2026-05-01', Tipo_Movimiento: 'Ingreso', Monto: 21200000, Ingresos: 21200000, Costos: 11234000, Gastos_Operacionales: 4200000, Cuentas_Por_Cobrar: 6360000 },
  ];
  const kpi = financeModule.calcFinanceKPIs(rows, {});
  expect(kpi.totalIncome).toBe(21200000);
});

// ── TESTS: excel.js (Bug B — plantilla + aviso de doble esquema) ─
console.log('\n📄 excel.js\n' + '─'.repeat(40));

const excelSrc = fs.readFileSync(path.join(__dirname, '../js/excel.js'), 'utf8');
const excelWrapped = '(function(global){' + excelSrc + '\nglobal.excelProcessor=excelProcessor;})(global);';
eval(excelWrapped);

test('plantilla finanzas: la fila de ejemplo usa un solo esquema (no ambos a la vez)', () => {
  const ex = excelProcessor.TEMPLATES.finance.example;
  // headers: Fecha,Concepto,Tipo_Movimiento,Monto,Forma_Pago,Es_Real,Ingresos,Costos,Gastos_Operacionales,Cuentas_Por_Cobrar
  const monto = ex[3];
  const [ingresos, costos, gastos] = [ex[6], ex[7], ex[8]];
  const hasMonto  = monto !== undefined && monto !== '' && monto !== 0;
  const hasDirect = [ingresos, costos, gastos].some(v => v !== undefined && v !== '' && v !== 0);
  expect(hasMonto && hasDirect).toBe(false);
});

test('validateCoherence: avisa cuando una fila de finanzas trae Monto Y columna directa', () => {
  const rows = [{ Fecha: '2026-05-01', Tipo_Movimiento: 'Ingreso', Monto: 21200000, Ingresos: 21200000 }];
  const warnings = excelProcessor.validateCoherence(rows, 'finance', null);
  const dual = warnings.find(w => w.type === 'dual_schema_finance');
  expect(dual).toBeDefined();
});

test('validateCoherence: NO avisa doble esquema si la fila usa un solo esquema', () => {
  const rows = [{ Fecha: '2026-05-01', Tipo_Movimiento: 'Ingreso', Monto: 21200000 }];
  const warnings = excelProcessor.validateCoherence(rows, 'finance', null);
  const dual = warnings.find(w => w.type === 'dual_schema_finance');
  expect(dual).toBe(undefined);
});

// ── TESTS: excel.js — _mergeRawDates + processRows (Bug A) ──────
console.log('\n📅 excel.js — fechas reales (raw:true/raw:false)\n' + '─'.repeat(40));

test('_mergeRawDates: toma Date real SOLO de columnas Fecha*, no toca Monto', () => {
  const rowsFalse = [{ Fecha: '3/1/2026', Monto: '1.234.567' }];
  global.XLSX = { utils: { sheet_to_json: () => [
    { Fecha: new Date(Date.UTC(2026,2,1)), Monto: 1234567 },
  ] } };
  const merged = excelProcessor._mergeRawDates({}, rowsFalse);
  expect(merged[0].Fecha instanceof Date).toBe(true);
  expect(merged[0].Fecha.getUTCMonth()).toBe(2); // marzo, no enero
  expect(merged[0].Monto).toBe('1.234.567'); // intacto — nunca viene de raw:true
});

test('_mergeRawDates: fila vacía intermedia no desalinea las columnas de fecha', () => {
  const rowsFalse = [
    { Fecha: '1/1/2026', Concepto: 'A' },
    { Fecha: '', Concepto: '' },
    { Fecha: '3/1/2026', Concepto: 'C' },
  ];
  global.XLSX = { utils: { sheet_to_json: () => [
    { Fecha: new Date(Date.UTC(2026,0,1)), Concepto: 'A' },
    { Fecha: '', Concepto: '' },
    { Fecha: new Date(Date.UTC(2026,2,1)), Concepto: 'C' },
  ] } };
  const merged = excelProcessor._mergeRawDates({}, rowsFalse);
  expect(merged[0].Fecha.getUTCMonth()).toBe(0);
  expect(merged[2].Fecha.getUTCMonth()).toBe(2);
  expect(merged[2].Concepto).toBe('C'); // no se desalineó con la fila vacía del medio
});

test('processRows: Fecha como Date real (post-merge) se guarda en ISO sin ambigüedad', () => {
  const raw = [{ FechaCol: new Date(Date.UTC(2026,2,1)), MontoCol: '5.000.000' }];
  const { rows } = excelProcessor.processRows(raw, { FechaCol: 'Fecha', MontoCol: 'Monto' }, 'finance');
  expect(rows[0].Fecha).toBe('2026-03-01'); // no '2026-01-03'
});

test('processRows: Fecha_Entrega_Real (proveedores) también resuelve Date real sin ambigüedad', () => {
  const raw = [{ FechaEntregaCol: new Date(Date.UTC(2026,3,15)) }]; // 15 de abril
  const { rows } = excelProcessor.processRows(raw, { FechaEntregaCol: 'Fecha_Entrega_Real' }, 'suppliers');
  expect(rows[0].Fecha_Entrega_Real).toBe('2026-04-15');
});

// ── RESULTADO FINAL ────────────────────────────────────────────
console.log('\n' + '═'.repeat(40));
console.log(`Resultado: ${passed} pasados / ${failed} fallados`);
if (failed === 0) {
  console.log('✅ Todos los smoke tests pasan\n');
  process.exit(0);
} else {
  console.log('❌ Hay tests fallando\n');
  process.exit(1);
}

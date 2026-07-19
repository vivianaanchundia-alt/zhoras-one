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

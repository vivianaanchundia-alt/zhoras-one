#!/usr/bin/env node
/**
 * ClaroKPIs — Build script de minificación
 * Uso: node build.js
 * Output: carpeta dist/ con assets minificados
 * 
 * Reduce ~750KB de JS a ~200KB → mejora carga en mobile LATAM
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SRC = __dirname;
const DIST = path.join(__dirname, 'dist');

// Archivos JS en orden de carga (mismo orden que dashboard.html)
const JS_FILES = [
  'js/i18n.js',
  'js/plans.js',
  'js/checkout.js',
  'js/auth.js', 
  'js/storage.js',
  'js/demo.js',
  'js/excel.js',
  'js/kpis.js',
  'js/charts.js',
  'js/utils.js',
  'js/alerts-module.js',
  'js/upload-module.js',
  'js/home-module.js',
  'js/settings-module.js',
  'js/sales-module.js',
  'js/clients-module.js',
  'js/finance-module.js',
  'js/marketing-module.js',
  'js/cx-module.js',
  'js/team-module.js',
  'js/inventory-module.js',
  'js/summary-projections-support-modules.js',
  'js/suppliers-module.js',
  'js/margin-module.js',
  'js/collections-module.js',
  'js/goals-module.js',
  'js/app.js',
];

const CSS_FILES = [
  'main.css',
  'dashboard.css',
  'mobile.css',
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function formatKB(bytes) {
  return (bytes / 1024).toFixed(0) + 'KB';
}

console.log('\n🔨 ClaroKPIs Build\n' + '═'.repeat(40));

ensureDir(path.join(DIST, 'js'));

let totalOrig = 0, totalMin = 0;

// ── MINIFICAR JS ────────────────────────────────────────────────
console.log('\n📦 Minificando JavaScript...');
for (const file of JS_FILES) {
  const src = path.join(SRC, file.replace('js/', ''));
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠️  No encontrado: ${src}`);
    continue;
  }
  
  const dest = path.join(DIST, file);
  ensureDir(path.dirname(dest));
  
  const origSize = fs.statSync(src).size;
  
  try {
    execSync(
      `terser "${src}" --compress "passes=2,drop_console=true,pure_funcs=[\'console.log\']" --mangle --output "${dest}"`,
      { stdio: 'pipe' }
    );
    const minSize = fs.statSync(dest).size;
    const pct = Math.round((1 - minSize/origSize) * 100);
    console.log(`  ✅ ${path.basename(file)}: ${formatKB(origSize)} → ${formatKB(minSize)} (-${pct}%)`);
    totalOrig += origSize;
    totalMin  += minSize;
  } catch(e) {
    console.error(`  ❌ Error en ${file}:`, e.message.slice(0,100));
    // Fallback: copiar sin minificar
    fs.copyFileSync(src, dest);
  }
}

// ── COPIAR CSS (sin minificar por ahora) ───────────────────────
console.log('\n🎨 Copiando CSS...');
for (const file of CSS_FILES) {
  const src = path.join(SRC, file);
  if (!fs.existsSync(src)) continue;
  const dest = path.join(DIST, file);
  fs.copyFileSync(src, dest);
  console.log(`  ✅ ${file}`);
}

// ── COPIAR HTML, DATA, ASSETS ──────────────────────────────────
console.log('\n📄 Copiando archivos estáticos...');
const STATIC = ['dashboard.html', 'index.html', 'onboarding.html', 
                'instrucciones.html', 'legal.html', 'manifest.json', 'sw.js', 
                'netlify.toml', 'version.txt'];
for (const file of STATIC) {
  const src = path.join(SRC, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DIST, file));
    console.log(`  ✅ ${file}`);
  }
}

// Copiar carpeta data/ (demo JSONs)
const dataDir = path.join(SRC, 'data');
if (fs.existsSync(dataDir)) {
  const distData = path.join(DIST, 'data');
  ensureDir(distData);
  for (const f of fs.readdirSync(dataDir)) {
    fs.copyFileSync(path.join(dataDir, f), path.join(distData, f));
  }
  console.log(`  ✅ data/ (${fs.readdirSync(dataDir).length} archivos)`);
}

// ── RESUMEN ─────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(40));
console.log(`📊 Resumen:`);
console.log(`  JS original:   ${formatKB(totalOrig)}`);
console.log(`  JS minificado: ${formatKB(totalMin)}`);
console.log(`  Reducción:     ${Math.round((1 - totalMin/totalOrig)*100)}%`);
console.log(`  Output:        dist/`);
console.log('\n✅ Build completado\n');

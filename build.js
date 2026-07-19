#!/usr/bin/env node
/**
 * ClaroKPIs — Build script de minificación
 * Uso: node build.js
 * Output: carpeta dist/ con assets minificados
 *
 * Reduce ~750KB de JS a ~200KB → mejora carga en mobile LATAM
 */

const terser = require('terser');
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

async function main() {
  console.log('\n🔨 ClaroKPIs Build\n' + '═'.repeat(40));

  ensureDir(path.join(DIST, 'js'));

  let totalOrig = 0, totalMin = 0;

  // ── MINIFICAR JS ────────────────────────────────────────────────
  // Usa la API de terser directamente (no el CLI vía shell): invocar
  // el binario con execSync depende de que "terser" esté en el PATH
  // del shell que ejecuta el build, y eso varía entre plataformas
  // (en Windows, cmd.exe no hereda node_modules/.bin salvo que el
  // comando corra como script de npm). La API funciona igual en
  // cualquier SO porque usa el paquete ya resuelto por Node.
  console.log('\n📦 Minificando JavaScript...');
  for (const file of JS_FILES) {
    const src = path.join(SRC, file);
    if (!fs.existsSync(src)) {
      console.warn(`  ⚠️  No encontrado: ${src}`);
      continue;
    }

    const dest = path.join(DIST, file);
    ensureDir(path.dirname(dest));

    const code = fs.readFileSync(src, 'utf8');
    const origSize = Buffer.byteLength(code, 'utf8');

    try {
      const result = await terser.minify(code, {
        compress: { passes: 2, drop_console: true, pure_funcs: ['console.log'] },
        mangle: true,
      });
      if (result.error) throw result.error;
      fs.writeFileSync(dest, result.code);
      const minSize = Buffer.byteLength(result.code, 'utf8');
      const pct = Math.round((1 - minSize / origSize) * 100);
      console.log(`  ✅ ${path.basename(file)}: ${formatKB(origSize)} → ${formatKB(minSize)} (-${pct}%)`);
      totalOrig += origSize;
      totalMin  += minSize;
    } catch (e) {
      console.error(`  ❌ Error en ${file}:`, (e.message || String(e)).slice(0, 150));
      // Fallback: copiar sin minificar
      fs.copyFileSync(src, dest);
    }
  }

  // ── COPIAR CSS (a dist/css/ para que el HTML los encuentre) ────
  console.log('\n🎨 Copiando CSS...');
  for (const file of CSS_FILES) {
    const src = path.join(SRC, 'css', file);
    if (!fs.existsSync(src)) { console.warn(`  ⚠️  No encontrado: ${src}`); continue; }
    const dest = path.join(DIST, 'css', file);
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    console.log(`  ✅ css/${file}`);
  }

  // ── BUILD ID (cache-busting + versión del Service Worker) ──────
  // Cambia en cada build: el navegador nunca sirve un JS/CSS "immutable"
  // (ver Cache-Control en netlify.toml) cacheado de un deploy anterior,
  // y el Service Worker (Bloque 6.1) detecta la versión nueva y borra
  // las cachés viejas en su evento "activate".
  const BUILD_ID = Date.now().toString(36);
  console.log(`\n🏷️  Build ID: ${BUILD_ID}`);

  // Agrega ?v=BUILD_ID a los <link>/<script> de recursos LOCALES
  // (css/, js/) de un HTML. Los de CDN no se tocan — ya llevan versión
  // pinneada + integrity (Bloque 0.5.8); agregarles ?v rompería el SRI.
  function addCacheBusting(html) {
    return html
      .replace(/(href="css\/[^"?]+\.css)"/g, `$1?v=${BUILD_ID}"`)
      .replace(/(src="js\/[^"?]+\.js)"/g, `$1?v=${BUILD_ID}"`);
  }

  // ── COPIAR HTML, DATA, ASSETS ──────────────────────────────────
  console.log('\n📄 Copiando archivos estáticos...');
  const STATIC = ['dashboard.html', 'index.html', 'onboarding.html',
                  'instrucciones.html', 'legal.html', 'manifest.json',
                  'netlify.toml', 'version.txt'];

  // Variables de entorno que se inyectan en los HTML (desde Netlify).
  // Los fuentes en GitHub tienen placeholders — nunca claves reales.
  const ENV_INJECT = {
    '{{SUPABASE_URL}}':          process.env.SUPABASE_URL          || '',
    '{{SUPABASE_ANON_KEY}}':     process.env.SUPABASE_ANON_KEY     || '',
    '{{CLERK_PUBLISHABLE_KEY}}': process.env.CLERK_PUBLISHABLE_KEY || '',
  };

  // HTML que reciben inyección de credenciales
  const INJECT_INTO = ['dashboard.html', 'index.html', 'onboarding.html'];

  for (const file of STATIC) {
    const src = path.join(SRC, file);
    if (fs.existsSync(src)) {
      if (file.endsWith('.html')) {
        let html = fs.readFileSync(src, 'utf8');
        if (INJECT_INTO.includes(file)) {
          for (const [placeholder, valor] of Object.entries(ENV_INJECT)) {
            html = html.split(placeholder).join(valor);
          }
        }
        html = addCacheBusting(html);
        fs.writeFileSync(path.join(DIST, file), html);
        console.log(`  ✅ ${file}${INJECT_INTO.includes(file) ? ' (credenciales inyectadas)' : ''} (cache-busting v=${BUILD_ID})`);
      } else {
        fs.copyFileSync(src, path.join(DIST, file));
        console.log(`  ✅ ${file}`);
      }
    }
  }

  // sw.js: inyecta el BUILD_ID en vez de copiarlo tal cual — es lo que
  // hace que el Service Worker detecte la versión nueva (Bloque 6.1).
  const swSrc = path.join(SRC, 'sw.js');
  if (fs.existsSync(swSrc)) {
    const swContent = fs.readFileSync(swSrc, 'utf8').split('{{BUILD_ID}}').join(BUILD_ID);
    fs.writeFileSync(path.join(DIST, 'sw.js'), swContent);
    console.log(`  ✅ sw.js (versión ${BUILD_ID})`);
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
  console.log(`  Reducción:     ${totalOrig ? Math.round((1 - totalMin / totalOrig) * 100) : 0}%`);
  console.log(`  Output:        dist/`);
  console.log('\n✅ Build completado\n');
}

main().catch(e => {
  console.error('\n❌ Build falló:', e);
  process.exit(1);
});

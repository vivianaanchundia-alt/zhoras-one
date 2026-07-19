/**
 * ZHORAS ONE — tests/responsive.js
 * Recorre las pantallas clave en 375px, 768px y 1440px, captura una
 * screenshot de cada una y falla si detecta scroll horizontal. Corre
 * en local, sin costo — reemplaza la revisión manual del Bloque 6.5,
 * que es lenta y se olvida bajo presión de deploy.
 *
 * Requiere Playwright (no instalado por defecto en este proyecto —
 * solo lo usa este script):
 *   npm install --save-dev playwright
 *   npx playwright install chromium
 *
 * Uso:
 *   node tests/responsive.js <URL_BASE>
 *   node tests/responsive.js https://deploy-preview-1--zhorasone.netlify.app
 *
 * Necesita una URL real (preview o producción) — no sirve contra los
 * archivos fuente sin build.js (los placeholders {{...}} quedarían
 * sin resolver y Clerk/Supabase no cargarían).
 */

const path = require('path');
const fs = require('fs');

const BASE_URL = process.argv[2];
if (!BASE_URL) {
  console.error('Uso: node tests/responsive.js <URL_BASE>');
  console.error('Ej:  node tests/responsive.js https://zhorasone.com');
  process.exit(1);
}

const VIEWPORTS = [
  { nombre: '375px (iPhone SE)', width: 375, height: 812 },
  { nombre: '390px (iPhone estándar)', width: 390, height: 844 },
  { nombre: '768px (tablet)', width: 768, height: 1024 },
  { nombre: '1440px (escritorio)', width: 1440, height: 900 },
];

// Pantallas a cubrir (Bloque 6.5). Las que requieren sesión real
// (panel de suscripción, gate de vencido, modal de cancelación) no se
// pueden automatizar sin una cuenta de prueba — se marcan como tal y
// se revisan a mano en el Deploy Preview del Bloque 9.
const PANTALLAS = [
  { nombre: 'landing', path: '/index.html', necesitaSesion: false },
  { nombre: 'dashboard (redirige a login sin sesión)', path: '/dashboard.html', necesitaSesion: false },
];

const OUT_DIR = path.join(__dirname, '..', '.responsive-screenshots');

async function main() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    console.error('❌ Playwright no está instalado. Corre primero:');
    console.error('   npm install --save-dev playwright && npx playwright install chromium');
    process.exit(1);
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  let fallos = 0;

  for (const pantalla of PANTALLAS) {
    if (pantalla.necesitaSesion) {
      console.log(`⏭️  ${pantalla.nombre}: necesita sesión real, revisar a mano`);
      continue;
    }
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const url = BASE_URL.replace(/\/$/, '') + pantalla.path;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(300); // deja asentar fuentes/CSS

        const anchoScroll    = await page.evaluate(() => document.documentElement.scrollWidth);
        const anchoViewport  = await page.evaluate(() => window.innerWidth);

        const archivo = path.join(OUT_DIR, `${pantalla.nombre.replace(/[^a-z0-9]/gi, '_')}_${vp.width}.png`);
        await page.screenshot({ path: archivo, fullPage: true });

        if (anchoScroll > anchoViewport + 1) {
          console.error(`❌ Scroll horizontal en "${pantalla.nombre}" @ ${vp.nombre}: scrollWidth=${anchoScroll} > viewport=${anchoViewport}`);
          fallos++;
        } else {
          console.log(`✅ ${pantalla.nombre} @ ${vp.nombre} — sin scroll horizontal`);
        }
      } catch (e) {
        console.error(`❌ Error cargando "${pantalla.nombre}" @ ${vp.nombre}:`, e.message);
        fallos++;
      } finally {
        await page.close();
      }
    }
  }

  await browser.close();

  console.log(`\nScreenshots guardadas en ${OUT_DIR}`);
  console.log('La revisión visual de las screenshots sigue siendo necesaria — este script detecta roturas de layout (scroll horizontal), no fealdad.');

  if (fallos > 0) {
    console.error(`\n❌ ${fallos} problema(s) encontrado(s)`);
    process.exit(1);
  }
  console.log('\n✅ Todo limpio');
}

main().catch(e => {
  console.error('Error fatal:', e);
  process.exit(1);
});

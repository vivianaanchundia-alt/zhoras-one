/**
 * ZHORAS ONE — Service Worker
 *
 * Network-first para HTML/CSS/JS: código y contenido vivo, nunca debe
 * servirse una versión vieja mientras haya red — la caché es la red de
 * seguridad offline, no la fuente primaria. Cache-first solo para
 * imágenes y fuentes (activos inmutables que no aportan nada al
 * revalidarse en cada carga).
 *
 * CACHE_VERSION se inyecta en cada build (build.js reemplaza
 * {{BUILD_ID}} por un identificador único del deploy). Antes estaba
 * hardcodeada en "v1" y nunca cambió: cuando existió un bug histórico
 * de CSS servido desde la ruta equivocada, el Service Worker cacheó
 * esa versión rota — y como el nombre de caché nunca cambiaba, el
 * bloque de "activate" que borra cachés viejas nunca tenía nada que
 * borrar. En escritorio alguien limpió el caché a mano; en móvil la
 * versión rota se sirvió indefinidamente. Con versión dinámica, cada
 * deploy fuerza una caché nueva y el bloque de activate SÍ borra la
 * anterior.
 */

const CACHE_VERSION = '{{BUILD_ID}}';
const CACHE_STATIC   = `zhoras-static-${CACHE_VERSION}`;
const CACHE_ASSETS    = `zhoras-assets-${CACHE_VERSION}`; // imágenes y fuentes

// Solo las rutas de entrada — el resto (JS/CSS) se cachea solo al
// pedirse la primera vez. Una lista completa de módulos aquí se
// desincroniza cada vez que se agrega o renombra un archivo (ya pasó:
// la lista anterior referenciaba archivos que ya no existían).
const PRECACHE_FILES = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/manifest.json',
];

// ── INSTALL: pre-cachear las rutas de entrada ────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(PRECACHE_FILES.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install error:', err))
  );
});

// ── ACTIVATE: borrar TODA caché que no sea de esta versión ───────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_STATIC && k !== CACHE_ASSETS).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function _isAsset(url) {
  return /\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf)$/i.test(url.pathname)
    || url.hostname.includes('fonts.gstatic.com');
}

// ── FETCH: network-first para código/contenido, cache-first para assets ──
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (_isAsset(url)) {
    event.respondWith(cacheFirst(event.request, CACHE_ASSETS));
    return;
  }

  const esPropio = url.hostname === self.location.hostname;
  const esCDNConfiable = url.hostname.includes('jsdelivr.net')
    || url.hostname.includes('sentry-cdn.com')
    || url.hostname.includes('fonts.googleapis.com');

  if (esPropio || esCDNConfiable) {
    event.respondWith(networkFirst(event.request, CACHE_STATIC));
  }
});

// ── ESTRATEGIAS ───────────────────────────────────────────────────

/** Cache First: sirve desde caché, si no hay va a red y guarda. */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline — recurso no disponible', { status: 503 });
  }
}

/** Network First: intenta red primero, cae a caché solo si no hay conexión. */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// ── MENSAJES desde el cliente ─────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});

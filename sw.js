/**
 * ClaroKPIs — Service Worker
 * Estrategia: Cache First para assets estáticos, Network First para datos.
 * Permite uso offline completo después del primer acceso.
 */

const CACHE_NAME    = 'clarokpis-v1';
const CACHE_STATIC  = 'clarokpis-static-v1';
const CACHE_CDN     = 'clarokpis-cdn-v1';

// Archivos locales que se cachean siempre
const STATIC_FILES = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/instrucciones.html',
  '/css/main.css',
  '/css/dashboard.css',
  '/css/mobile.css',
  '/js/i18n.js',
  '/js/auth.js',
  '/js/storage.js',
  '/js/excel.js',
  '/js/kpis.js',
  '/js/charts.js',
  '/js/sales-module.js',
  '/js/clients-module.js',
  '/js/finance-module.js',
  '/js/marketing-cx-team-inventory-modules.js',
  '/js/summary-projections-support-modules.js',
  '/manifest.json',
];

// CDN — se cachean la primera vez que se usan
const CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
];

// ── INSTALL: Pre-cachear archivos estáticos ───────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_FILES.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install error (some files may not exist yet):', err))
  );
});

// ── ACTIVATE: Limpiar caches viejos ──────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_CDN && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Estrategia por tipo de recurso ────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  // CDN: Cache First con fallback a red
  if (url.hostname.includes('jsdelivr') || url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic')) {
    event.respondWith(cacheFirst(event.request, CACHE_CDN));
    return;
  }

  // Archivos locales: Cache First con revalidación en background
  if (url.hostname === self.location.hostname || url.protocol === 'file:') {
    event.respondWith(staleWhileRevalidate(event.request, CACHE_STATIC));
    return;
  }
});

// ── ESTRATEGIAS ───────────────────────────────────────────────

/** Cache First: sirve desde caché, si no hay va a red y guarda */
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

/** Stale While Revalidate: sirve desde caché inmediatamente, actualiza en background */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || await fetchPromise || new Response('Offline', { status: 503 });
}

// ── MENSAJES desde el cliente ────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});

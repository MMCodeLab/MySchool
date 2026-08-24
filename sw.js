const CACHE_VERSION = 'schola-v2';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const SHELL_ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/config.js',
  'js/state.js',
  'js/components.js',
  'js/formulario-data.js',
  'js/router.js',
  'js/api/ai-text.js',
  'js/api/translate.js',
  'js/api/wikipedia.js',
  'js/api/ocr.js',
  'js/views/studio.js',
  'js/views/italiano.js',
  'js/views/matematica.js',
  'js/views/inglese.js',
  'js/views/storia.js',
  'js/views/settings.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('schola-') && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // App shell: cache-first, fall back to network.
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        const clone = res.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
        return res;
      }).catch(() => cached))
    );
  } else {
    // Servizi esterni (AI, traduzione, Wikipedia, Tesseract.js): rete prima,
    // con fallback alla cache se offline. Le risposte di questi servizi
    // cambiano ad ogni richiesta (tranne gli script statici), quindi la rete
    // ha sempre la priorita'.
    event.respondWith(
      fetch(request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
        }
        return res;
      }).catch(() => caches.match(request))
    );
  }
});

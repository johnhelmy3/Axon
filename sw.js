// AXON service worker — bump CACHE_VERSION when you change index.html
const CACHE_VERSION = 'axon-v11';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE_VERSION).then(function (c) { return c.addAll(CORE); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Never touch the Anthropic API
  if (url.hostname === 'api.anthropic.com') return;

  // Google Fonts + Firebase SDK: stale-while-revalidate
  // (www.gstatic.com serves the optional Firebase sign-in SDK; caching it lets sign-in load faster after the first visit)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'www.gstatic.com') {
    e.respondWith(
      caches.open(CACHE_VERSION).then(function (cache) {
        return cache.match(req).then(function (hit) {
          var net = fetch(req).then(function (res) { cache.put(req, res.clone()); return res; }).catch(function () { return hit; });
          return hit || net;
        });
      })
    );
    return;
  }

  // Same-origin: cache-first, fall back to network, then to cached index for navigations
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).catch(function () {
          if (req.mode === 'navigate') return caches.match('./index.html');
        });
      })
    );
  }
});

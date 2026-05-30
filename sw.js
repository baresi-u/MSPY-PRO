// MSPY Pro — Service Worker v1
const CACHE = 'mspy-pro-v1';

// File yang di-cache saat install
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap'
];

// Install: cache semua file penting
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      // Gunakan addAll dengan individual try agar satu gagal tidak block semuanya
      return Promise.allSettled(PRECACHE.map(url => c.add(url).catch(()=>{})));
    }).then(() => self.skipWaiting())
  );
});

// Activate: hapus cache lama
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first untuk aset, network-first untuk API
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Lewati request API Anthropic & nominatim — selalu network
  if (url.includes('anthropic.com') || url.includes('nominatim') ||
      url.includes('openstreetmap.org/') || url.includes('tile.openstreetmap')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('{"error":"offline"}', {
        status: 503,
        headers: {'Content-Type': 'application/json'}
      }))
    );
    return;
  }

  // Cache-first untuk semua aset lainnya
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Simpan ke cache kalau response valid
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback untuk navigasi
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

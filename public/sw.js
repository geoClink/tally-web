// Minimal service worker — enables PWA install prompt on Android
// Passthrough fetch (no offline cache) — keeps behavior identical to no-SW

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', e => e.respondWith(fetch(e.request)))

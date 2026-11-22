// Service worker: guarda o app no aparelho para funcionar sem internet.
const VERSION = 'aurea-1795355729241';
const FILES = [
  "./",
  "./anim.js",
  "./app.css",
  "./app.js",
  "./charts.js",
  "./core.js",
  "./core/AureaFit-web.mjs",
  "./core/kotlin-kotlin-stdlib.mjs",
  "./core/kotlin_org_jetbrains_kotlin_kotlin_dom_api_compat.mjs",
  "./core/kotlinx-serialization-kotlinx-serialization-core.mjs",
  "./core/kotlinx-serialization-kotlinx-serialization-json.mjs",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./index.html",
  "./manifest.webmanifest",
  "./store.js"
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).catch(() => caches.match('./index.html'))));
});
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Áurea', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Áurea', { body: d.body || '', tag: d.tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './#/notifications' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./#/notifications'))));
});

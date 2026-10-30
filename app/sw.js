'use strict';

// Bump VERSION whenever a cached file changes. Keep each installed shell coherent.
const VERSION = '2026-10-30-v1-0-1';
const PREFIX = `suisui-pwa-${encodeURIComponent(self.registration.scope)}-`;
const CACHE = PREFIX + VERSION;
const SHELL = [
  './', './index.html', './privacy.html', './styles.css', './app.js', './pwa.js',
  './manifest.webmanifest', './vendor/anime.umd.min.js', './vendor/lucide.min.js',
  './assets/lake.jpg', './icons/apple-touch-icon.png', './icons/icon-192.png',
  './icons/icon-512.png', './icons/icon-maskable-512.png'
].map(file => new URL(file, self.registration.scope).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache =>
    cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  url.search = '';
  url.hash = '';
  if (!SHELL.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(url.href) || fetch(event.request);
  })());
});

// Lock-screen notification: tapping it returns to the open app or launches it on the requested view.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './?view=preview', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => client.url.startsWith(self.registration.scope));
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  })());
});

// Reserved for an optional reminder server. iOS requires every push to show a notification.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || '碎碎清单', {
    body: data.body || '打开看看今天的待办。', tag: data.tag || 'suisui-today', icon: 'icons/icon-192.png', data: { url: data.url || './?view=preview' }
  }));
});

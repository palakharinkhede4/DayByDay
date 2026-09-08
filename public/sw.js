// DayByDay Service Worker — required for iOS web app push + showNotification support
// iOS 16.4+ only supports notifications fired through the service worker registration, NOT new Notification()

const CACHE_NAME = 'daybyday-v4.0.1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/icon-192.png',
  '/icon.png',
  '/icon.svg',
  '/manifest.json',
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

// Activate: claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
    ])
  );
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith('/api/') ||
    event.request.url.startsWith('capacitor://') ||
    url.origin !== self.location.origin
  ) {
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html').then((r) => r || fetch(event.request))
      )
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// Push: handle server-sent Web Push events
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'DayByDay', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'DayByDay Encouragement';
  const options = {
    body: data.body || 'A teammate just cheered you on!',
    icon: '/icon-192.png',
    badge: '/icon.svg',
    tag: data.tag || ('daybyday-push-' + Date.now()),
    renotify: true,
    data: data,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click: focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow('/');
      })
  );
});

// Message: safe postMessage-based notification dispatch
// Used when we need to fire a notification from a non-gesture context (timer/poll)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data;
    self.registration
      .showNotification(title || 'DayByDay', {
        body: body || 'You have a new encouragement!',
        icon: '/icon-192.png',
        badge: '/icon.svg',
        tag: tag || ('daybyday-msg-' + Date.now()),
        renotify: true,
      })
      .catch(() => {});
  }
});

// Service worker: ilova internetsiz OCHILISHI uchun.
//
//   * shell (index.html) — avval internetdan, internet bo'lmasa keshdan;
//   * static fayllar (JS/CSS/wasm/rasm) — avval keshdan (fayllar nomida hash bor,
//     yangi versiya chiqsa nom ham o'zgaradi — eskirish xavfi yo'q);
//   * Supabase so'rovlari (rest/realtime/auth) — UMUMAN keshlanmaydi, ular
//     to'g'ridan-to'g'ri tarmoqqa ketadi. Ma'lumot oflayn bo'lsa qurilma
//     o'z IndexedDB keshidan ishlaydi (src/lib/offline.js).

const SHELL = 'pos-shell-v1';
const RUN = 'pos-run-v1';
const CORE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/app-icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.allSettled(CORE.map((path) => cache.add(path)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== SHELL && key !== RUN) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

function isStaticSameOrigin(url) {
  return url.origin === self.location.origin
    && !url.pathname.startsWith('/node_modules')
    && !/\.(?:hot-update|map)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (!isStaticSameOrigin(url)) return;

  // Sahifa so'rovi: yangi versiyani beramiz, internet bo'lmasa keshdagi shell.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL);
        cache.put('/index.html', fresh.clone());
        return fresh;
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Fayllar: keshda bo'lsa — o'sha, bo'lmasa tarmoqdan olib keshga qo'yamiz.
  event.respondWith((async () => {
    const cache = await caches.open(RUN);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok && fresh.type === 'basic') cache.put(req, fresh.clone());
      return fresh;
    } catch {
      // Build tugatilgan bo'lib, eski sahifa yangi fayl so'rasa: shell'ga qaytamiz.
      if (req.destination === 'document') return (await caches.match('/index.html')) || Response.error();
      return Response.error();
    }
  })());
});

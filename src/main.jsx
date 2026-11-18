import React from 'react';
import ReactDOM from 'react-dom/client';

// Uch kirish manzil:
//   /      — yangi mijoz uchun tanituv sahifasi (landing)
//   /app   — POS ilovasi
//   /o/xyz — do'konning onlayn menyusi (Instagram/Telegram bio'sidagi link)
// Desktop ilova (file://) va ?app=1 har doim POS'ga boradi. Kiritilgan foydalanuvchi
// (sessiyasi bor) / manzilida ham darhol Kassaga tushadi — telefon va eski
// yorliqlar uchun hech narsa o'zgarmaydi. ?landing=1 — saytni shu holda ko'rish.
function wantsApp() {
  const { protocol, pathname, search } = window.location;
  if (protocol === 'file:') return true;
  const query = new URLSearchParams(search);
  if (query.has('app')) return true;
  if (query.has('landing')) return false;
  if (/^\/app(\/|$)/i.test(pathname)) return true;
  return hasSavedSession();
}

// Onlayn do'kon manzili: /o/<slug>. Sessiyasi bor do'kon egasi ham shu
// manzilda mijoz menyusini ko'radi — bio'ga qo'yilgan link aynan shu.
function onlineSlug() {
  const m = /^\/o\/([a-z0-9][a-z0-9_-]{2,39})/i.exec(window.location.pathname);
  return m ? m[1].toLowerCase() : null;
}

function hasSavedSession() {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      const raw = localStorage.getItem(key) || '';
      if (raw.includes('access_token') && raw.includes('refresh_token')) return true;
    }
  } catch { /* maxfiy oynada localStorage bo'lmasligi mumkin */ }
  return false;
}

const root = ReactDOM.createRoot(document.getElementById('root'));

async function boot() {
  const slug = onlineSlug();
  if (slug) {
    const { default: Shop } = await import('./online/OnlineShop.jsx');
    root.render(
      <React.StrictMode>
        <Shop slug={slug} />
      </React.StrictMode>,
    );
    return;
  }

  const module = wantsApp() ? import('./App.jsx') : import('./landing/Landing.jsx');
  const { default: Screen } = await module;
  root.render(
    <React.StrictMode>
      <Screen />
    </React.StrictMode>,
  );
}

boot();

// Internetsiz ochilishi uchun shell keshi. Dev rejimda o'chirilgan — aks holda
// Vite'ning yangi modullari eskirgan holda qoladi. Electron (file://) ichida
// service worker ishlamaydi, shuning uchun faqat http(s) va build'da.
if (import.meta.env.PROD && 'serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

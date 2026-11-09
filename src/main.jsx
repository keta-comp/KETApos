import React from 'react';
import ReactDOM from 'react-dom/client';

// Ikkita kirish manzil:
//   /    — yanga mijoz uchun tanituv sahifasi (landing)
//   /app — POS ilovasi
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

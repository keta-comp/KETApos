import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Internetsiz ochilishi uchun shell keshi. Dev rejimda o'chirilgan — aks holda
// Vite'ning yangi modullari eskirgan holda qoladi. Electron (file://) ichida
// service worker ishlamaydi, shuning uchun faqat http(s) va build'da.
if (import.meta.env.PROD && 'serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

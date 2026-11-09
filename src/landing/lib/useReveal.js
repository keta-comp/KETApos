import { useEffect } from 'react';

// Sectionlar ekranga kirganda ochiladi (CSS transform/opacity).
// IntersectionObserver ishlatiladi, lekin u yashirin tabl'da kechikishi mumkin —
// shuning uchun scroll bo'yicha oddiy tekshiruv ham qo'shib qo'yilgan: hech
// qanday holda matn ko'rinmay qolmaydi.
export function useReveal(watch = []) {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('.lp-reveal'));
    if (!nodes.length) return undefined;

    const shown = new WeakSet();
    const show = (n) => { if (!shown.has(n)) { shown.add(n); n.classList.add('lp-in'); } };

    let timer = 0;
    const check = () => {
      timer = 0;
      const h = window.innerHeight || document.documentElement.clientHeight;
      for (const n of nodes) {
        if (shown.has(n)) continue;
        const r = n.getBoundingClientRect();
        if (r.top < h * 0.92 && r.bottom > 0) show(n);
      }
    };
    const schedule = () => { if (!timer) timer = setTimeout(check, 60); };

    let io = null;
    check();
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          io.unobserve(entry.target);
        }
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      nodes.forEach((n) => io.observe(n));
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (io) io.disconnect();
      clearTimeout(timer);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, watch);
}

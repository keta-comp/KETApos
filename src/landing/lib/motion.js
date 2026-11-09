import { useEffect } from 'react';

// Harakat qoidalari:
//  * sensorli qurilmada (hover yo'q) 3D tilt umuman yoqilmaydi;
//  * prefers-reduced-motion yoqilganda ham yo'q;
//  * transform faqat requestAnimationFrame ichida, will-change esa faqat
//    sichqoncha kartaga teksganda — doimiy emas.

export function motionAllowed() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Bitta elementga sichqoncha 3D tilt + scroll parallaks.
 * Qatorda turgan animatsiyaga (floating) tegmaydi — u ichki qatlamda.
 */
export function useStageMotion(ref, { tilt = 5, parallax = 40 } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !motionAllowed()) return undefined;

    let raf = 0;
    let px = 0;
    let py = 0;
    let shift = 0;
    let leaveTimer = 0;

    const apply = () => {
      raf = 0;
      el.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0) rotateX(${(-py * tilt).toFixed(2)}deg) rotateY(${(px * tilt).toFixed(2)}deg)`;
    };
    const request = () => { if (!raf) raf = requestAnimationFrame(apply); };

    const onEnter = () => {
      clearTimeout(leaveTimer);
      el.style.willChange = 'transform';
      // Sichqoncha ortidan yugurish uchun qisqa silliqlash;
      // qo'yib yuborilganda sekin qaytish ishlatiladi.
      el.style.transition = 'transform 0.12s linear';
    };
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      px = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5) * 2;
      py = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5) * 2;
      request();
    };
    const onLeave = () => {
      px = 0;
      py = 0;
      el.style.willChange = 'auto';
      el.style.transition = 'transform 0.6s var(--lp-ease)';
      request();
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => { el.style.transition = ''; }, 640);
    };
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const off = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      shift = clamp(off, -1, 1) * parallax;
      request();
    };

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(leaveTimer);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      el.style.transform = '';
      el.style.transition = '';
      el.style.willChange = 'auto';
    };
  }, [ref, tilt, parallax]);
}

/**
 * Kartalar uchun sichqonchani kuzatib boruvchi tilt (maksimal `max` gradus).
 */
export function useCardTilt(selector, { max = 5, lift = 6 } = {}) {
  useEffect(() => {
    if (!motionAllowed()) return undefined;
    const cards = Array.from(document.querySelectorAll(selector));
    if (!cards.length) return undefined;

    const cleanups = cards.map((card) => {
      let raf = 0;
      let rx = 0;
      let ry = 0;
      let up = false;

      const apply = () => {
        raf = 0;
        card.style.transform = up
          ? `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translate3d(0, -${lift}px, 0)`
          : '';
      };
      const request = () => { if (!raf) raf = requestAnimationFrame(apply); };

      const onEnter = () => {
        up = true;
        card.style.willChange = 'transform';
        card.style.transition = 'transform 0.12s linear';
        request();
      };
      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        ry = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5) * 2 * max;
        rx = -clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5) * 2 * max;
        request();
      };
      const onLeave = () => {
        up = false;
        rx = 0;
        ry = 0;
        card.style.willChange = 'auto';
        card.style.transition = '';
        request();
      };

      card.addEventListener('pointerenter', onEnter);
      card.addEventListener('pointermove', onMove);
      card.addEventListener('pointerleave', onLeave);
      return () => {
        if (raf) cancelAnimationFrame(raf);
        card.removeEventListener('pointerenter', onEnter);
        card.removeEventListener('pointermove', onMove);
        card.removeEventListener('pointerleave', onLeave);
        card.style.transform = '';
        card.style.transition = '';
        card.style.willChange = 'auto';
      };
    });

    return () => cleanups.forEach((fn) => fn());
  }, [selector, max, lift]);
}

/**
 * Ko'rinmaydigan uzluksiz animatsiyani to'xtatadi: qahramon rasmi
 * ekrandan chiqib ketganda suzish sikli ishlamaydi.
 */
export function usePauseWhenHidden(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([entry]) => el.classList.toggle('lp-paused', !entry.isIntersecting),
      { rootMargin: '160px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
}

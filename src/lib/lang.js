import { useSyncExternalStore } from 'react';

// Qoraqalpoqcha asosiy til; o'zbekcha — almashtirib ko'rish uchun.
// Tanlangan til qurilmada saqlanadi, birinchi ochilishda kaa beriladi.
const KEY = 'ketapos.lang';

export const LANGS = [
  { id: 'kaa', label: 'Qaraqalpaqsha', short: 'QQ' },
  { id: 'uz', label: 'Ózbeksha', short: 'UZ' },
];

const subs = new Set();

function read() {
  try {
    return localStorage.getItem(KEY) === 'uz' ? 'uz' : 'kaa';
  } catch {
    return 'kaa';
  }
}

let current = typeof window === 'undefined' ? 'kaa' : read();

function applyDoc() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = current;
}
applyDoc();

export function getLang() {
  return current;
}

export function setLang(next) {
  const id = LANGS.some((l) => l.id === next) ? next : 'kaa';
  if (id === current) return;
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // localStorage yopiq bo'lsa (maxfiy rejim) til shu sessiyada saqlanmaydi.
  }
  applyDoc();
  subs.forEach((f) => f());
}

export function onLang(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function useLang() {
  const lang = useSyncExternalStore(onLang, getLang, () => 'kaa');
  return { lang, setLang, isKaa: lang === 'kaa' };
}

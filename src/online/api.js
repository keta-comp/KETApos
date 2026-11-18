import { supabase } from '../supabase/client.js';

// Mijoz tomoni: do'konga kirmaydi, sessiyasi yo'q. Shu uchun faqat bazada
// anon'ga ochilgan uchta funksiya chaqiriladi (online_menu / online_submit /
// online_status) va xabarlar shu yerda o'zbekcha kalitga aylantiriladi.
// Render paytida t() orqali qoraqalpoqchaga o'tadi.

const CLIENT_KEY = 'ketapos.online.client';
const ORDERS_KEY = 'ketapos.online.orders';

export const ERRORS = {
  DOKON_TOPILMADI: 'Bu havola yopiq ko‘rinadi — sahifani yangilab ko‘ring.',
  DOKON_YOPIQ: 'Do‘kon hozir onlayn zakaz qabul qilmaydi.',
  DOKON_YETKAZMAYDI: 'Bu do‘kon yetkazib bermaydi — „Olib ketish“ni tanlang.',
  KOD_KERTILMADI: 'Sahifa ma’lumoti buzilgan — sahifani yangilab qayta urinib ko‘ring.',
  NOM_KERTILMADI: 'Ismingizni yozing.',
  TELEF_NOTOGRI: 'Telefon raqami noto‘g‘ri. Masalan: +998 77 763 02 16.',
  TURI_NOTOGRI: 'Zakaz turini tanlang.',
  MANZIL_KERTILMADI: 'Yetkazib berish manzilini yozing.',
  BUYURTMA_BOSH: 'Savat bo‘sh — kamida bitta mahsulot tanlang.',
  MAHSULOT_KOP: 'Zakazda juda ko‘p mahsulot — kamaytirib qayta urinib ko‘ring.',
  MAHSULOT_TOPILMADI: 'Mahsulotlardan biri endi sotilmaydi — savatni yangilang.',
  QOLDIQ_YETARLI_EMAS: 'Biror mahsulot qoldig‘i yetarli emas.',
  MINIMUM_YETISHMADI: 'Zakaz summasi minimal miqdordan kam.',
  TEZ_ORQILA: 'Juda ko‘p zakaz yuborildi — birozdan so‘ng qayta urinib ko‘ring.',
  NET: 'Internet bilan bog‘lanib bo‘lmadi — ulanishni tekshirib qayta urinib ko‘ring.',
  DEFAULT: 'Amal bajarilmadi — qayta urinib ko‘ring.',
};

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // maxfiy oynada saqlanmaydi — zakaz baribir yuboriladi
  }
}

// Bir brauzer bir zakazni ikki marta yuborsa baza uni tanib oladi: kalit shu kod.
function makeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

let memoryId = null;

export function clientId() {
  const saved = readStore(CLIENT_KEY, null);
  if (typeof saved === 'string' && saved.length >= 8) {
    memoryId = saved;
    return saved;
  }
  // localStorage yopiq bo'lsa ham kod sessiya davomida bir xil qoladi.
  if (!memoryId) memoryId = makeId();
  writeStore(CLIENT_KEY, memoryId);
  return memoryId;
}

// Yuborilgan zakazdan keyin kod yangilanadi — aks holda brauzerdagi ikkinchi
// zakaz birinchi bilan bir xil deb o'qiladi (idempotent kalit).
export function rotateClientId() {
  const made = makeId();
  writeStore(CLIENT_KEY, made);
  return made;
}

// Mijoz o'z zakazini keyinroq tekshirishi uchun kodlarni shu do'kon bo'yicha saqlaymiz.
export function savedTokens(slug) {
  const map = readStore(ORDERS_KEY, {});
  return Array.isArray(map[slug]) ? map[slug] : [];
}

export function rememberToken(slug, token) {
  if (!slug || !token) return;
  const map = readStore(ORDERS_KEY, {});
  const list = Array.isArray(map[slug]) ? map[slug] : [];
  writeStore(ORDERS_KEY, { ...map, [slug]: [token, ...list.filter((x) => x !== token)].slice(0, 5) });
}

function fail(error) {
  const text = String(error?.message || '');
  const code = Object.keys(ERRORS).find((key) => key !== 'NET' && key !== 'DEFAULT' && text.includes(key));
  if (code) throw new Error(ERRORS[code], { cause: error });
  if (/Failed to fetch|NetworkError|ERR_[A-Z_]+|timed out|fetch failed/i.test(text) || error?.name === 'TypeError') {
    throw new Error(ERRORS.NET, { cause: error });
  }
  throw new Error(ERRORS.DEFAULT, { cause: error });
}

export async function fetchMenu(slug) {
  if (!supabase) throw new Error(ERRORS.DEFAULT);
  const { data, error } = await supabase.rpc('online_menu', { p_slug: slug });
  if (error) fail(error);
  return data;
}

export async function submitOrder(payload) {
  const { data, error } = await supabase.rpc('online_submit', { p: payload });
  if (error) fail(error);
  if (data?.token) rememberToken(payload.slug, data.token);
  return data;
}

export async function fetchStatus(token) {
  const { data, error } = await supabase.rpc('online_status', { p_token: token });
  if (error) fail(error);
  return data;
}

// Mahsulot rasmi "product-images" bucket'ida ochiq o'qiladi.
export function photoUrl(path) {
  if (!path || !supabase) return null;
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

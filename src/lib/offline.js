// Oflayn qatlami.
//
// Internet uzilsa kassa ishlashi davom etishi uchun qurilmada (IndexedDB) saqlanadi:
//   kv     — oxirgi muvaffaqiyatli o'qish natijalari: menyu, stollar, sozlamalar
//   queue  — oflaynda qilingan amallar, tartib bilan serverga yuboriladi
//   shots  — "hali serverga yetmagan" buyurtmaning qurilmadagi holati (ro'yxatlar uchun)
//   ids    — lokal buyurtma id -> serverdagi haqiqiy id
//
// Oflaynda ochilgan har bir buyurtma client_id bilan yuboriladi. Serverda
// (venue_id, client_id) unikal — shuning uchun navbat ikki marta yuborilsa ham
// takror buyurtma tug'maydi va raqam ikkinchi marta olinmaydi.

const DB_NAME = 'pos-offline';
const DB_VERSION = 1;

let handle = null;
let broken = false;

function open() {
  if (handle) return Promise.resolve(handle);
  if (broken || typeof indexedDB === 'undefined') return Promise.reject(new Error('idb-yoq'));
  return new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      broken = true;
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'seq', autoIncrement: true });
      if (!db.objectStoreNames.contains('shots')) db.createObjectStore('shots', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('ids')) db.createObjectStore('ids', { keyPath: 'local' });
    };
    req.onsuccess = () => { handle = req.result; resolve(handle); };
    req.onerror = () => { broken = true; reject(req.error); };
    req.onblocked = () => { broken = true; reject(new Error('band')); };
  });
}

async function run(store, mode, work) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = work(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

// ---------- Kesh ----------

export const cacheKey = (fn, args = {}) => `${fn}|${JSON.stringify(args)}`;

export async function cacheRead(key) {
  try {
    const row = await run('kv', 'readonly', (s) => s.get(key));
    return row ? { data: row.value, at: row.at } : null;
  } catch {
    return null;
  }
}

export async function cacheWrite(key, value) {
  try {
    await run('kv', 'readwrite', (s) => s.put({ key, value, at: Date.now() }));
  } catch { /* kesh yo'q bo'lsa ham ish davom etadi */ }
}

// ---------- Navbat ----------

export function queueAdd(rec) {
  return run('queue', 'readwrite', (s) => s.add(rec)).catch(() => null);
}

export function queueAll() {
  return run('queue', 'readonly', (s) => s.getAll()).then((rows) => rows || []).catch(() => []);
}

export function queuePut(rec) {
  return run('queue', 'readwrite', (s) => s.put(rec)).catch(() => null);
}

export function queueDelete(seq) {
  return run('queue', 'readwrite', (s) => s.delete(seq)).catch(() => null);
}

// ---------- Lokal -> server id ----------

export async function serverId(local) {
  if (!local) return local;
  try {
    const row = await run('ids', 'readonly', (s) => s.get(String(local)));
    return row ? row.server : null;
  } catch {
    return null;
  }
}

export function rememberId(local, server) {
  return run('ids', 'readwrite', (s) => s.put({ local: String(local), server: String(server) })).catch(() => null);
}

// ---------- Holat: onlayn / oflayn ----------

let forced = false;
try {
  forced = new URLSearchParams(window.location.search).has('offline');
} catch { /* ilova brauzerdan tashqarida ishlaganda */ }

let offline = forced;
const watchers = new Set();

let identity = { id: null, name: '' };

// Kim ochganini lokal buyurtma yozib qo'yish uchun (AppContext aytadi).
export function setIdentity(next) {
  identity = { id: next?.id || null, name: next?.name || '' };
}

export function getIdentity() {
  return identity;
}

export function isOffline() {
  return forced || offline;
}

export function onStatus(cb) {
  watchers.add(cb);
  return () => watchers.delete(cb);
}

function setStatus(next) {
  if (offline === next) return;
  offline = next;
  for (const cb of watchers) cb(forced || offline);
}

// So'rov servergacha yetmaganmi (aks holda bu — biznes xatosi).
export function isNetworkError(err) {
  const text = String(err?.message || err || '');
  return /Failed to fetch|NetworkError|Load failed|ERR_[A-Z_]+|timed out|ECONN|Client does not support/i.test(text)
    || err?.name === 'TypeError'
    || err?.name === 'AbortError';
}

export function reportNetworkFailure() {
  if (!forced) setStatus(true);
}

// navigator.onLine ishonchsiz: internet tiklanganini haqiqiy so'rov bilib
// olgach shu funksiya oflayn belgisini olib tashlaydi (sync.js qo'ng'iroqadi).
export function reportOnline() {
  if (!forced) setStatus(false);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { if (!forced) setStatus(false); });
  window.addEventListener('offline', () => setStatus(true));
}

// ---------- Yordamchi hisoblar ----------

export function newClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const hex = '0123456789abcdef';
  const block = (n) => Array.from({ length: n }, () => hex[Math.floor(Math.random() * 16)]).join('');
  return `${block(8)}-${block(4)}-4${block(3)}-${hex[8 + Math.floor(Math.random() * 4)]}${block(3)}-${block(12)}`;
}

// Qurilma vaqti — bazadagi ts_text() bilan bir xil ko'rinishda.
export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const money = (n) => Math.round(Number(n) || 0);

// Serverga yetmagan buyurtma raqami vaqtinchalik: haqiqiy № sync'dan keyin keladi.
export const pendingTag = (clientId) => `T-${String(clientId || '').slice(0, 4).toUpperCase()}`;

// Oflayn holatdagi buyurtma — serverdagi order_jsonb shakli bilan bir xil.
export function localOrder({ clientId, p, tableName }) {
  const items = (p.items || []).map((it, i) => ({
    id: `${clientId}-${i + 1}`,
    order_id: clientId,
    product_id: it.product_id || null,
    name: it.name,
    price: money(it.price),
    qty: Number(it.qty) || 0,
    total: money(money(it.price) * (Number(it.qty) || 0)),
    note: it.note || '',
  }));
  const subtotal = items.reduce((s, it) => s + it.total, 0);
  const percent = Number(p.discount_percent) || 0;
  const discount = Math.round((subtotal * percent) / 100);
  const total = subtotal - discount;
  const paid = p.paid || null;

  return {
    id: clientId,
    client_id: clientId,
    number: pendingTag(clientId),
    pending: true,
    type: p.table_id ? (p.type || 'dine_in') : 'takeaway',
    table_id: p.table_id || null,
    table_name: tableName || null,
    status: paid ? 'paid' : 'open',
    kitchen_status: p.send_to_kitchen ? 'new' : 'none',
    subtotal,
    discount_percent: percent,
    discount,
    total,
    payment_method: paid ? paid.method : null,
    received: paid ? paid.received : null,
    change_amount: paid && paid.received != null ? Math.max(0, money(paid.received) - total) : null,
    note: p.note || '',
    created_at: p.created_at || stamp(),
    paid_at: paid ? paid.at : null,
    created_by: identity.id,
    staff_name: identity.name || 'Xodim',
    item_count: items.reduce((s, it) => s + it.qty, 0),
    items,
  };
}

// Serverdagi buyurtma oflaynda tahrirlansa — uning lokal nusxasi saqlanadi (real=true).
export function shadowOrder(order, patch = {}) {
  const next = { ...order, ...patch, pending: true, client_id: order.client_id || null };
  const items = (patch.items || next.items || []).map((it) => ({
    ...it,
    total: money(it.price) * (Number(it.qty) || 0),
  }));
  const subtotal = items.reduce((s, it) => s + Math.round(it.total), 0);
  const percent = Number(patch.discount_percent ?? next.discount_percent) || 0;
  const discount = Math.round((subtotal * percent) / 100);
  return { ...next, items, subtotal, discount_percent: percent, discount, total: subtotal - discount, item_count: items.reduce((s, it) => s + (Number(it.qty) || 0), 0) };
}

// ---------- Shot (lokal holat) ----------

async function shotAll() {
  try {
    return (await run('shots', 'readonly', (s) => s.getAll())) || [];
  } catch {
    return [];
  }
}

export async function shotGet(id) {
  if (!id) return null;
  try {
    const row = await run('shots', 'readonly', (s) => s.get(String(id)));
    return row ? row.order : null;
  } catch {
    return null;
  }
}

export async function shotSet(order, real = false) {
  try {
    await run('shots', 'readwrite', (s) => s.put({ id: String(order.id), order, real: Boolean(real) }));
  } catch { /* saqlanmasa ham ish davom etadi */ }
}

// Serverga hali yetmagan buyurtmaning qurilmadagi holati (lokal yoki shadow).
export const pendingOrder = shotGet;

// Qurilmada ochilgan, lekin serverda hali qatori yo'q buyurtmalar.
export async function pendingOrders() {
  return (await shotAll()).filter((s) => !s.real && s.order).map((s) => s.order);
}

// Navbatda shu buyurtmaga oid amal qolmasa — lokal holat kerak emas.
export async function shotDrop(id) {
  try {
    const queue = await queueAll();
    const still = queue.some((r) => String(r.local) === String(id) || String(r.order_id) === String(id));
    if (still) return;
    await run('shots', 'readwrite', (s) => s.delete(String(id)));
  } catch { /* tekshiruvning o'zi xato bo'lsa */ }
}

export async function patchShot(id, mutate, real = false) {
  const order = await shotGet(id);
  if (!order) return null;
  const next = mutate(order);
  await shotSet(next, real);
  return next;
}

// Serverdagi buyurtmani oflaynda o'zgartirish uchun asos kerak: uni saqlangan
// ro'yxatlardan (ochiq/oshxona/tarix) qidiramiz.
export async function findCachedOrder(orderId) {
  if (!orderId) return null;
  let rows = [];
  try {
    rows = (await run('kv', 'readonly', (s) => s.getAll())) || [];
  } catch {
    return null;
  }
  for (const row of rows) {
    const value = row.value;
    const list = Array.isArray(value) ? value : [];
    const found = list.find((o) => o && String(o.id) === String(orderId));
    if (found) return found;
  }
  return null;
}

// ---------- Ro'yxatlarga lokal buyurtmalarni qo'shish ----------
const fitsList = (o, kitchen) => (kitchen
  ? o.status !== 'cancelled' && ['new', 'cooking', 'ready'].includes(o.kitchen_status)
  : o.status === 'open');

export async function mergePendingOrders(list, { kitchen = false } = {}) {
  const shots = await shotAll();
  const base = list || [];
  if (!shots.length) return base;
  const byId = new Map(shots.map((s) => [String(s.id), s.order]));
  const rows = base.filter((o) => fitsList(byId.get(String(o.id)) || o, kitchen))
    .map((o) => byId.get(String(o.id)) || o);
  const extra = shots.filter((s) => !s.real && fitsList(s.order, kitchen)).map((s) => s.order);
  const out = [...rows, ...extra];
  out.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  return kitchen ? out : out.reverse();
}

export async function mergePendingTables(states) {
  const shots = (await shotAll()).filter((s) => s.order?.table_id);
  if (!shots.length) return states;
  const byTable = new Map(shots.map((s) => [String(s.order.table_id), s.order]));
  return (states || []).map((t) => {
    const o = byTable.get(String(t.id));
    if (!o) return t;
    if (o.status !== 'open') {
      return { ...t, order_id: null, order_number: null, order_total: null, order_since: null, order_kitchen: 'none', item_count: 0 };
    }
    return {
      ...t,
      order_id: o.id,
      order_number: o.number,
      order_pending: true,
      order_total: o.total,
      order_since: o.created_at,
      order_kitchen: o.kitchen_status,
      item_count: o.item_count,
    };
  });
}

// Oflaynda sotilgan miqdor — qoldiq "hamon bor" ko'rinmasligi uchun.
export async function pendingQtyByProduct() {
  const shots = (await shotAll()).filter((s) => !s.real && s.order?.status !== 'cancelled');
  const out = {};
  for (const s of shots) {
    for (const it of s.order?.items || []) {
      if (!it.product_id) continue;
      out[String(it.product_id)] = (out[String(it.product_id)] || 0) + (Number(it.qty) || 0);
    }
  }
  return out;
}

export async function queueStats() {
  const queue = await queueAll();
  const shots = await shotAll();
  const failed = queue.filter((r) => r.failed);
  return {
    waiting: queue.length - failed.length,
    failed: failed.length,
    orders: shots.length,
    total: shots.reduce((s, x) => s + (x.order?.status === 'cancelled' ? 0 : (x.order?.total || 0)), 0),
    records: queue,
  };
}

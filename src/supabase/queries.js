import { supabase } from './client.js';
import {
  cacheKey, cacheRead, cacheWrite, findCachedOrder, isNetworkError, isOffline, localOrder,
  mergePendingOrders, mergePendingTables, newClientId, pendingOrder, pendingOrders,
  pendingQtyByProduct, queueAdd,
  rememberId, reportNetworkFailure, shadowOrder, shotSet, stamp,
} from '../lib/offline.js';

// Ma'lumot qatlami: eski src/db/store.js funksiyalari bilan bir xil nom va bir xil qator
// shakli, lekin ma'lumot Supabase Postgres'da (har do'konga alohida venue_id).
// O'qish va yozish async; yozishdan keyin barcha sahifalar qayta yuklanishi uchun signal beriladi.
//
// Oflayn: o'qishda oxirgi muvaffaqiyatli natija IndexedDB'dan olinadi, buyurtma
// amallari esa navbatga qo'yiladi (see src/lib/offline.js va src/lib/sync.js).

const OFFLINE_NONE = 'Internet yo‘q va saqlangan ma’lumot topilmadi — onlayn bo‘lgach qayta urinib ko‘ring.';
const OFFLINE_OP = 'Bu amalni oflayn bajarsa bo‘lmaydi — internet kerak.';

const listeners = new Set();

export function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function bump() {
  for (const cb of listeners) cb();
}

// Realtime orqali kelgan tashqi o'zgarish: sahifalarni qayta yuklaymiz, lekin
// lokal yozuv deb hisoblamaymiz (write() signal beradi, bu yerda faqat xabar).
// Bir necha event ketma-ket kelsa — bitta qayta yuklash.
let externalTimer = null;

export function bumpExternal() {
  if (externalTimer) return;
  externalTimer = setTimeout(() => {
    externalTimer = null;
    bump();
  }, 350);
}

const MESSAGES = {
  AVVAL_KIRING: 'Sessiya uzilgan — qaytadan kiring.',
  BUYURTMA_BOSH: "Savat bo'sh, kamida bitta mahsulot tanlang.",
  STOL_TANLANG: 'Stol tanlang.',
  STOL_BAND: 'Bu stol band — unda ochiq buyurtma bor.',
  STOL_TOPILMADI: 'Stol topilmadi (balki o‘chirilgan).',
  STOLD_OCHIQ_BUYURTMA: "Bu stolda ochiq buyurtma bor. Avval uni yoping.",
  TURI_NOTOGRI: "Buyurtma turi noto‘g‘ri.",
  QOLDIQ_YETARLI_EMAS: 'Qoldiq yetarli emas.',
  QOLDIQ_YETARLI_EMAS_CHIQIM: "Qoldiq yetarli emas (mavjud miqdordan ko‘p).",
  MIQDOR_NOTOGRI: "Miqdor 0 dan katta bo‘lishi kerak.",
  SUMMA_NOTOGRI: "Summa 0 dan katta bo‘lishi kerak.",
  SUMMA_YETARLI_EMAS: 'Kiritilgan summa yetarli emas.',
  BUYURTMA_TOPILMADI: 'Buyurtma topilmadi yoki sizning do‘koningizga tegishli emas.',
  FAQAT_OCHIQ_TAHRIR: "Faqat ochiq buyurtmani tahrirlash mumkin.",
  FAQAT_OCHIQ_TOLOV: "Bu buyurtma allaqachon to‘langan yoki bekor qilingan.",
  FAQAT_OCHIQ_BEKOR: 'Faqat ochiq buyurtmani bekor qilish mumkin.',
  FAQAT_OCHIQ_TOLOV_BEKOR: 'Faqat ochiq buyurtmani bekor qilish mumkin.',
  HOLAT_NOTOGRI: "Noto‘g‘ri holat.",
  TOLOV_TURI_NOTOGRI: "To‘lov turi noto‘g‘ri.",
  KATEGORIYADA_MAHSULOT_BOR: "Bu kategoriyada mahsulotlar bor. Avval ularni boshqa kategoriyaga o‘tkazing.",
  KATEGORIYA_TOPILMADI: 'Kategoriya topilmadi.',
  MAHSULOT_TOPILMADI: 'Mahsulot topilmadi.',
  RASM_PAPKASI_NOTOGRI: 'Rasm papkasi noto‘g‘ri — qaytadan yuklab ko‘ring.',
  NOM_KERTILMADI: 'Nomni kiriting.',
  DOKON_TO_LI: "Bu do'konda allaqachon buyurtmalar bor — import faqat yangi do'kon uchun.",
  RUXSAT_YOQ: 'Bu amalni sizning rolingiz bajara olmaydi — do‘kon egasiga ayting.',
  FAQAT_EGA: 'Buni faqat do‘kon egasi qilishi mumkin.',
  EGA_NOTOGRIDAN: 'Egani roli o‘zgarmaydi va u o‘chirilmaydi.',
  XODIM_TOPILMADI: 'Xodim topilmadi yoki sizning do‘koningizga tegishli emas.',
  DOKON_TOXTATILGAN: "Bu do‘kon platforma tomonidan to‘xtatildi — yozishlar vaqtinchalik yopiq.",
  DOKON_TOPILMADI: 'Do‘kon topilmadi — balki o‘chirilgan.',
  ARIZA_TOPILMADI: 'Ariza topilmadi — balki o‘chirilgan.',
  DOKON_EGASI_BOR: 'Bu do‘konning egasi allaqachon bor — egalik kodi ishlatilgan.',
  AKKAUNT_MAVLUD_EMAS: 'Bunday email bilan akkaunt yo‘q — avval xodim ro‘yxatdan o‘tsin.',
  EMAIL_NOTOGRI: 'Emailni to‘liq yozing.',
  OXIRGI_ADMIN: 'Bu platformaning oxirgi administratori — o‘chirib bo‘lmaydi.',
  ADMIN_TOPILMADI: 'Administrator topilmadi.',
  'relation does not exist': "Baza tayyor emas — sxemani qo'llash kerak.",
};

function translate(message) {
  if (!message) return 'Noma’lum xatolik';
  for (const [code, text] of Object.entries(MESSAGES)) {
    if (message.includes(code)) return text;
  }
  return message;
}

function fail(error) {
  throw new Error(translate(error.message), { cause: error });
}

// supabase-js tarmoq uzilganda xatoni "otadi", biznes xatosini esa qaytaradi.
async function tryRpc(fn, args) {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

// Oflaynda qolgan buyurtmalar ro'yxatlarga qo'shiladi, serverdagi qatorlar esa
// ularning lokal holatiga almashtiriladi.
async function decorate(fn, args, data) {
  if (fn === 'pos_open_orders') return mergePendingOrders(data || []);
  if (fn === 'pos_kitchen_orders') return mergePendingOrders(data || [], { kitchen: true });
  if (fn === 'pos_table_states') return mergePendingTables(data || []);
  if (fn === 'pos_products') return deductStock(data || []);
  if (fn === 'pos_orders') return mergeHistory(args, data || []);
  return data;
}

async function deductStock(products) {
  const rows = await pendingQtyByProduct();
  if (!Object.keys(rows).length) return products;
  return products.map((p) => (p.track_stock && rows[p.id] ? { ...p, stock_qty: Number(p.stock_qty) - rows[p.id] } : p));
}

// Hisobdagi "oxirgi amallar" oflayn buyurtmalar bilan to'ldiriladi.
async function mergeHistory(args, list) {
  const wanted = args.p_status || null;
  const merged = await mergePendingOrders(list, {});
  const from = args.p_from;
  const to = args.p_to;
  const inRange = (o) => {
    const day = String(o.created_at || '').slice(0, 10);
    if (!day) return false;
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  };
  const mine = (await pendingOrders()).filter((o) => (wanted ? o.status === wanted : o.status !== 'cancelled') && inRange(o));
  if (!mine.length) return merged;
  const seen = new Set(merged.map((o) => String(o.id)));
  const out = [...merged, ...mine.filter((o) => !seen.has(String(o.id)))];
  out.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return out;
}

async function read(fn, args = {}) {
  const key = cacheKey(fn, args);
  if (!isOffline()) {
    const { data, error } = await tryRpc(fn, args);
    if (!error) {
      cacheWrite(key, data);
      return decorate(fn, args, data);
    }
    if (!isNetworkError(error)) fail(error);
    reportNetworkFailure();
  }
  const hit = await cacheRead(key);
  if (!hit) throw new Error(OFFLINE_NONE);
  return decorate(fn, args, hit.data);
}

async function write(fn, args = {}) {
  if (isOffline()) throw new Error(OFFLINE_OP);
  const { data, error } = await tryRpc(fn, args);
  if (error) {
    if (isNetworkError(error)) {
      reportNetworkFailure();
      throw new Error(OFFLINE_OP);
    }
    fail(error);
  }
  bump();
  return data;
}

const flag = (v) => v === 1 || v === true || v === '1' || v === 'true';
const id = (v) => (v === undefined || v === null || v === '' || v !== v ? null : String(v));

// ---------- Sozlamalar ----------

export async function getSettings() {
  return (await read('pos_settings')) || {};
}

export async function saveSettings(obj) {
  const patch = {};
  for (const [key, value] of Object.entries(obj)) patch[key] = String(value);
  await write('save_settings', { p: patch });
}

// ---------- Kategoriyalar ----------

export async function getCategories() {
  return (await read('pos_categories')) || [];
}

export async function addCategory({ name, emoji = '', color = '#f97316' }) {
  const res = await write('add_category', { p: { name, emoji, color } });
  return res?.id;
}

export async function updateCategory(categoryId, fields) {
  await write('update_category', { p_id: categoryId, p: fields });
}

export async function deleteCategory(categoryId) {
  await write('delete_category', { p_id: categoryId });
}

// ---------- Mahsulotlar ----------

export async function getProducts({ activeOnly = false, categoryId = null } = {}) {
  return (await read('pos_products', {
    p_active_only: activeOnly ? true : null,
    p_category_id: id(categoryId),
  })) || [];
}

export async function getProduct(productId) {
  const list = await getProducts();
  return list.find((p) => p.id === String(productId)) || null;
}

function productPatch(p) {
  const out = {};
  const put = (key, value) => {
    if (value !== undefined && value !== null) out[key] = value;
  };
  put('category_id', id(p.category_id));
  put('name', p.name);
  put('price', p.price);
  put('emoji', p.emoji);
  if (p.active !== undefined) out.active = flag(p.active);
  if (p.track_stock !== undefined) out.track_stock = flag(p.track_stock);
  put('stock_qty', p.stock_qty);
  put('low_stock', p.low_stock);
  put('unit', p.unit);
  return out;
}

export async function addProduct(p) {
  const res = await write('add_product', { p: productPatch(p) });
  return res?.id;
}

export async function updateProduct(productId, fields) {
  await write('update_product', { p_id: productId, p: productPatch(fields) });
}

export async function deleteProduct(productId) {
  return write('delete_product', { p_id: productId });
}

// ---------- Mahsulot rasmi ----------
// Fayllar "product-images" bucket'ida <venue_id>/<product_id>.jpg yo'lida;
// bazada faqat shu yo'l saqlanadi.

const PHOTO_BUCKET = 'product-images';

export function photoPublicUrl(path) {
  if (!path || !supabase) return null;
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadProductPhoto({ venueId, productId, blob }) {
  const path = `${venueId}/${productId}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) fail(error);
  await write('set_product_photo', { p_product: productId, p_path: path });
  return path;
}

export async function clearProductPhoto({ productId, path }) {
  await write('set_product_photo', { p_product: productId, p_path: null });
  // faylni o'chirish muvaffaqiyatsiz bo'lsa ham ish davom etadi (yo'l allaqachon null)
  supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

// ---------- Stollar ----------

export async function getTables() {
  const list = await getTableStates();
  return list.map(({ name, zone, seats, sort_order, id: tId }) => ({ id: tId, name, zone, seats, sort_order }));
}

export async function getTableStates() {
  return (await read('pos_table_states')) || [];
}

export async function getZones() {
  return (await read('pos_zones')) || [];
}

export async function addTable({ name, zone = 'Asosiy zal', seats = 4 }) {
  const res = await write('add_table', { p: { name, zone, seats } });
  return res?.id;
}

export async function updateTable(tableId, fields) {
  await write('update_table', { p_id: tableId, p: fields });
}

export async function deleteTable(tableId) {
  await write('delete_table', { p_id: tableId });
}

// ---------- Buyurtmalar ----------

function orderPayload({ type, table_id, items, discount_percent, note, sendToKitchen }) {
  const p = {
    type,
    items: (items || []).map((it) => ({
      product_id: id(it.product_id),
      name: it.name,
      price: Math.round(Number(it.price) || 0),
      qty: Number(it.qty) || 0,
      note: it.note || '',
    })),
    discount_percent: Number(discount_percent) || 0,
    note: note || '',
  };
  if (table_id !== undefined) p.table_id = id(table_id);
  if (sendToKitchen !== undefined) p.send_to_kitchen = Boolean(sendToKitchen);
  return p;
}

// Buyurtma amallari — oflayn bo'lsa navbatga yoziladi, bo'lmasa serverga ketadi.
// Shardov: buyurtma lokal holati (shot) mavjud bo'lsa, keyingi amal ham shu
// holat ustiga yoziladi — aks holda ro'yxatlar eskirib qoladi.

async function tableTitle(tableId) {
  if (!tableId) return null;
  const hit = await cacheRead(cacheKey('pos_table_states', {}));
  const found = (hit?.data || []).find((t) => String(t.id) === String(tableId));
  return found?.name || null;
}

async function cachedOrder(orderId) {
  const hit = await cacheRead(cacheKey('pos_order', { p_id: orderId }));
  return hit?.data || (await findCachedOrder(orderId));
}

function applyState(o, kind, args) {
  if (kind === 'pay') {
    const received = args.received != null ? Math.round(Number(args.received)) : null;
    return {
      ...o,
      status: 'paid',
      payment_method: args.method,
      received,
      change_amount: received != null ? Math.max(0, received - o.total) : null,
      paid_at: stamp(),
    };
  }
  if (kind === 'cancel') return { ...o, status: 'cancelled', kitchen_status: 'none' };
  if (kind === 'kitchen') return { ...o, kitchen_status: o.kitchen_status === 'none' ? 'new' : o.kitchen_status };
  if (kind === 'kstatus') return { ...o, kitchen_status: args.status };
  return o;
}

async function queueOrderOp(kind, orderId, args) {
  const base = (await pendingOrder(orderId)) || (await cachedOrder(orderId));
  if (!base) throw new Error(OFFLINE_NONE);
  const next = kind === 'update' ? shadowOrder(base, args.p) : applyState(base, kind, args);
  const local = Boolean(next.client_id);
  await shotSet(next, !local);
  await queueAdd({ kind, local: local ? next.id : null, order_id: next.id, args, at: Date.now() });
  bump();
  return next;
}

// Oflaynda yoziladigan buyurtma — serverga ochilgandan keyin keladi.
async function queueCreate(clientId, p) {
  const order = localOrder({ clientId, p, tableName: await tableTitle(p.table_id) });
  await shotSet(order, false);
  await queueAdd({ kind: 'create', local: clientId, order_id: clientId, args: { p: { ...p, created_at: order.created_at } }, at: Date.now() });
  bump();
  return order;
}

// Bajarilishi shu buyurtmaning sync'iga bog'liqmi? (lokal yoki navbatda turgan)
async function queued(orderId) {
  return Boolean(await pendingOrder(orderId));
}

export async function createOrder(payload) {
  const p = orderPayload(payload);
  const clientId = newClientId();
  if (isOffline()) return queueCreate(clientId, p);

  const { data, error } = await tryRpc('create_order', { p: { ...p, client_id: clientId } });
  if (error) {
    if (!isNetworkError(error)) fail(error);
    // So'rov serverga yetib borgan bo'lishi ham mumkin — client_id tufayli
    // navbatdagi qayta yuborish takror buyurtma tug'maydi.
    reportNetworkFailure();
    return queueCreate(clientId, p);
  }
  await rememberId(clientId, data?.id);
  bump();
  return data;
}

export async function updateOrder(orderId, payload) {
  const p = orderPayload(payload);
  if (isOffline() || (await queued(orderId))) return queueOrderOp('update', orderId, { p });
  return write('update_order', { p_id: orderId, p });
}

export async function sendToKitchen(orderId) {
  if (isOffline() || (await queued(orderId))) return queueOrderOp('kitchen', orderId, {});
  return write('send_to_kitchen', { p_id: orderId });
}

export async function payOrder(orderId, { method, received = null }) {
  const args = { method, received: method === 'cash' && received !== null ? Math.round(Number(received)) : null };
  if (isOffline() || (await queued(orderId))) return queueOrderOp('pay', orderId, args);
  return write('pay_order', { p_id: orderId, p_method: args.method, p_received: args.received });
}

export async function cancelOrder(orderId) {
  if (isOffline() || (await queued(orderId))) return queueOrderOp('cancel', orderId, {});
  await write('cancel_order', { p_id: orderId });
}

export async function setKitchenStatus(orderId, status) {
  if (isOffline() || (await queued(orderId))) return queueOrderOp('kstatus', orderId, { status });
  await write('set_kitchen_status', { p_id: orderId, p_status: status });
}

export async function getOrder(orderId) {
  if (!orderId) return null;
  const shot = await pendingOrder(orderId);
  if (shot) return shot;
  return (await read('pos_order', { p_id: orderId })) || null;
}

export async function getOpenOrders() {
  return (await read('pos_open_orders')) || [];
}

export async function getKitchenOrders() {
  return (await read('pos_kitchen_orders')) || [];
}

export async function getOrders({ from = null, to = null, status = null, limit = 200 } = {}) {
  return (await read('pos_orders', { p_from: from, p_to: to, p_status: status, p_limit: limit })) || [];
}

// ---------- Ombor ----------

export async function stockIn(productId, qty, note = '') {
  await write('stock_in', { p_product: productId, p_qty: Number(qty), p_note: note });
}

export async function stockOut(productId, qty, note = '') {
  await write('stock_out', { p_product: productId, p_qty: Number(qty), p_note: note });
}

export async function getMovements({ productId = null, limit = 100 } = {}) {
  return (await read('pos_movements', { p_product: id(productId), p_limit: limit })) || [];
}

export async function getLowStock() {
  return (await read('pos_low_stock')) || [];
}

// ---------- Xarajatlar ----------

export async function addExpense({ title, amount, category = 'Boshqa' }) {
  const res = await write('add_expense', { p: { title, amount: Math.round(Number(amount)), category } });
  return res?.id;
}

export async function getExpenses(from = null, to = null) {
  return (await read('pos_expenses', { p_from: from, p_to: to })) || [];
}

export async function deleteExpense(expenseId) {
  await write('delete_expense', { p_id: expenseId });
}

// ---------- Hisobot ----------

export async function getReport(from, to) {
  const r = await read('pos_report', { p_from: from, p_to: to });
  return {
    order_count: Number(r?.order_count ?? 0),
    revenue: Number(r?.revenue ?? 0),
    discount_total: Number(r?.discount_total ?? 0),
    avg_check: Number(r?.avg_check ?? 0),
    byDay: (r?.byDay ?? []).map((d) => ({ ...d, order_count: Number(d.order_count), revenue: Number(d.revenue) })),
    byMethod: (r?.byMethod ?? []).map((m) => ({ ...m, order_count: Number(m.order_count), revenue: Number(m.revenue) })),
    topProducts: (r?.topProducts ?? []).map((p) => ({ ...p, qty: Number(p.qty), revenue: Number(p.revenue) })),
    expenses: r?.expenses ?? [],
    expenseTotal: Number(r?.expenseTotal ?? 0),
    profit: Number(r?.profit ?? 0),
  };
}

// ---------- Eski (lokal) ma'lumotni import qilish ----------

export async function importLegacyDump(dump) {
  return write('import_legacy', { p: dump });
}

// ---------- Jamoa: xodimlar va taklif kodlari ----------

export async function getStaff() {
  const [staff, activity] = await Promise.all([
    read('pos_staff'),
    read('pos_staff_activity').catch(() => ({})),
  ]);
  return (staff || []).map((s) => ({
    ...s,
    orders_today: Number(activity?.[s.user_id]?.orders ?? 0),
    total_today: Number(activity?.[s.user_id]?.total ?? 0),
  }));
}

export async function getInvites() {
  return (await read('pos_invites')) || [];
}

export async function issueInvite(role) {
  const code = await write('issue_invite', { p_role: role });
  return code;
}

export async function revokeInvite(inviteId) {
  await write('revoke_invite', { p_id: inviteId });
}

export async function updateStaff(staffId, fields) {
  const p = {};
  if (fields.role !== undefined) p.role = fields.role;
  if (fields.display_name !== undefined) p.display_name = fields.display_name;
  await write('update_staff', { p_id: staffId, p });
}

export async function removeStaff(staffId) {
  await write('remove_staff', { p_id: staffId });
}

export async function setMyName(name) {
  await write('set_my_name', { p_name: name });
}

// ---------- Platforma (super-admin) ----------
// Bu funksiyalarni faqat platforma egasining qurilmasi chaqiradi. Keshga
// yozilmaydi: boshqa do'konlarning ma'lumoti oddiy mijoz qurilmasisa tushib
// qolmasligi kerak, oflaynda esa panelning o'zi keraksiz.

async function adminRead(fn, args = {}) {
  const { data, error } = await tryRpc(fn, args);
  if (error) {
    if (isNetworkError(error)) {
      reportNetworkFailure();
      throw new Error(OFFLINE_OP);
    }
    fail(error);
  }
  return data;
}

const num = (v) => Number(v ?? 0);

export async function getPlatformStats() {
  const r = await adminRead('admin_stats');
  return {
    venues: num(r?.venues),
    venuesActive: num(r?.venues_active),
    venuesSuspended: num(r?.venues_suspended),
    users: num(r?.users),
    staff: num(r?.staff),
    owners: num(r?.owners),
    orders: num(r?.orders),
    ordersToday: num(r?.orders_today),
    ordersOpen: num(r?.orders_open),
    revenue: num(r?.revenue),
    revenueToday: num(r?.revenue_today),
    revenueMonth: num(r?.revenue_month),
    demoNew: num(r?.demo_new),
    demoTotal: num(r?.demo_total),
    daily: (r?.daily ?? []).map((d) => ({ day: d.day, orders: num(d.orders), revenue: num(d.revenue) })),
  };
}

export async function getPlatformVenues({ query = null, status = null } = {}) {
  const list = await adminRead('admin_venues', { p_query: query || null, p_status: status || null });
  return (list || []).map((v) => ({ ...v, revenue: num(v.revenue), orders: num(v.orders), staff_count: num(v.staff_count) }));
}

export async function getPlatformVenue(venueId) {
  return adminRead('admin_venue_detail', { p_id: venueId });
}

export async function setPlatformVenueStatus(venueId, status) {
  await write('admin_set_venue_status', { p_id: venueId, p_status: status });
}

export async function updatePlatformVenue(venueId, fields) {
  const p = {};
  for (const key of ['name', 'kind', 'phone', 'address', 'notes']) {
    if (fields[key] !== undefined) p[key] = fields[key];
  }
  await write('admin_update_venue', { p_id: venueId, p });
}

export async function createPlatformVenue({ name, kind = 'fastfood', phone = null, address = null, notes = null }) {
  return write('admin_create_venue', { p: { name, kind, phone, address, notes } });
}

export async function reissueOwnerCode(venueId) {
  return write('admin_reissue_owner_code', { p_venue: venueId });
}

export async function getDemoRequests() {
  return (await adminRead('admin_demo_requests')) || [];
}

export async function setDemoHandled(demoId, handled) {
  await write('admin_set_demo_handled', { p_id: demoId, p_handled: Boolean(handled) });
}

export async function deleteDemoRequest(demoId) {
  await write('admin_delete_demo', { p_id: demoId });
}

export async function getPlatformAdmins() {
  return (await adminRead('admin_admins')) || [];
}

export async function addPlatformAdmin(email) {
  return write('admin_add_admin', { p_email: email });
}

export async function removePlatformAdmin(userId) {
  await write('admin_remove_admin', { p_user_id: userId });
}


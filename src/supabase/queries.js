import { supabase } from './client.js';

// Ma'lumot qatlami: eski src/db/store.js funksiyalari bilan bir xil nom va bir xil qator
// shakli, lekin ma'lumot Supabase Postgres'da (har do'konga alohida venue_id).
// O'qish va yozish async; yozishdan keyin barcha sahifalar qayta yuklanishi uchun signal beriladi.

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

async function read(fn, args = {}) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) fail(error);
  return data;
}

async function write(fn, args = {}) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) fail(error);
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

export async function createOrder(payload) {
  return write('create_order', { p: orderPayload(payload) });
}

export async function updateOrder(orderId, payload) {
  return write('update_order', { p_id: orderId, p: orderPayload(payload) });
}

export async function sendToKitchen(orderId) {
  return write('send_to_kitchen', { p_id: orderId });
}

export async function payOrder(orderId, { method, received = null }) {
  return write('pay_order', {
    p_id: orderId,
    p_method: method,
    p_received: method === 'cash' && received !== null ? Math.round(Number(received)) : null,
  });
}

export async function cancelOrder(orderId) {
  await write('cancel_order', { p_id: orderId });
}

export async function setKitchenStatus(orderId, status) {
  await write('set_kitchen_status', { p_id: orderId, p_status: status });
}

export async function getOrder(orderId) {
  if (!orderId) return null;
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


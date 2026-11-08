import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// 3-qadam (eski SQLite ma'lumotni import qilish) uchun uchdan-uchga sinov.
// Ishga tushirish: SUPABASE_SECRET_KEY=sb_secret_... npm run smoke:import
const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('.env da VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY yo‘q');
if (!secret) throw new Error('SUPABASE_SECRET_KEY kerak (sb_secret_...)');

const stamp = Date.now();
const password = 'Smoke-test-2026';
const venueName = `Smoke Import ${stamp}`;
const createdIds = [];
let failed = 0;
let checks = 0;

function check(name, ok, extra = '') {
  checks++;
  if (!ok) failed++;
  console.log(`${ok ? 'O‘TDI ' : 'XATO  '} ${name}${extra ? ' — ' + extra : ''}`);
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const pool = [];
function anon() {
  const c = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `smokeimp-${pool.length}-${Math.random()}` },
  });
  pool.push(c);
  return c;
}

async function makeUser(email) {
  const res = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (res.error) throw new Error(`createUser(${email}): ${res.error.message}`);
  const uid = res.data?.id ?? res.data?.user?.id;
  if (typeof uid !== 'string') throw new Error(`createUser(${email}) UUID qaytarmadi`);
  createdIds.push(uid);
  return uid;
}

async function login(email) {
  const sb = anon();
  const res = await sb.auth.signInWithPassword({ email, password });
  if (res.error) throw new Error(`login ${email}: ${res.error.message}`);
  return sb;
}

async function rpc(sb, fn, args, label = fn) {
  const res = await sb.rpc(fn, args);
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data;
}

async function rpcErr(sb, fn, args, expect, label) {
  const res = await sb.rpc(fn, args);
  check(`${label || fn} rad etildi (${expect})`, Boolean(res.error) && String(res.error.message).includes(expect), res.error?.message || 'QABUL QILDI!');
  return res.error;
}

async function cleanOldRuns() {
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw new Error(users.error.message);
  for (const u of users.data.users.filter((x) => String(x.email).startsWith('smoke.'))) {
    await admin.auth.admin.deleteUser(u.id);
  }
  await admin.from('venues').delete().like('name', 'Smoke %');
}

// Eski SQLite dump'iga o‘xshash ma'lumot: int ID'lar, 'YYYY-MM-DD HH:MI:SS' vaqt, 1/0 belgilar.
function legacyDump() {
  return {
    categories: [
      { id: 1, name: 'Burgerlar', emoji: '🍔', color: '#f97316', sort_order: 0 },
      { id: 2, name: 'Ichimliklar', emoji: '🥤', color: '#06b6d4', sort_order: 1 },
    ],
    products: [
      { id: 1, category_id: 1, name: 'Gamburger', price: 25000, emoji: '🍔', active: 1, track_stock: 1, stock_qty: 40, low_stock: 10, unit: 'dona', sort_order: 0 },
      { id: 2, category_id: 2, name: 'Coca-Cola 0.5L', price: 8000, emoji: '🥤', active: 1, track_stock: 1, stock_qty: 12, low_stock: 12, unit: 'dona', sort_order: 1 },
      { id: 3, category_id: 1, name: 'Nofaol burger', price: 21000, emoji: '🍔', active: 0, track_stock: 0, stock_qty: 0, low_stock: 5, unit: 'dona', sort_order: 2 },
      // Kategoriya bo‘g‘inini topolmaydigan qator — import uni o‘tkazib yuborishi kerak.
      { id: 4, category_id: 99, name: 'Tashlab yuboriladi', price: 5000, emoji: '❌', active: 1, track_stock: 0, stock_qty: 0, low_stock: 5, unit: 'dona', sort_order: 3 },
    ],
    tables: [
      { id: 1, name: '1-stol', zone: 'Asosiy zal', seats: 4, sort_order: 0 },
      { id: 2, name: 'T1', zone: 'Terrasa', seats: 4, sort_order: 1 },
    ],
    orders: [
      {
        id: 1, number: 1001, type: 'dine_in', table_id: 1, status: 'paid', kitchen_status: 'served',
        subtotal: 58000, discount_percent: 10, discount: 5800, total: 52200,
        payment_method: 'cash', received: 60000, change_amount: 7800, note: 'tezkor',
        created_at: '2026-03-05 12:30:00', paid_at: '2026-03-05 12:45:00',
      },
      {
        id: 2, number: 1002, type: 'takeaway', table_id: null, status: 'cancelled', kitchen_status: 'none',
        subtotal: 8000, discount_percent: 0, discount: 0, total: 8000,
        payment_method: null, received: null, change_amount: null, note: '',
        created_at: '2026-03-06 18:05:00', paid_at: null,
      },
      {
        id: 3, number: 1003, type: 'yolg‘on_tur', table_id: 7, status: 'open', kitchen_status: 'new',
        subtotal: 25000, discount_percent: 0, discount: 0, total: 25000,
        payment_method: 'crypto', received: 0, change_amount: 0, note: '',
        created_at: '2026-03-07 09:00:00', paid_at: null,
      },
    ],
    order_items: [
      { id: 1, order_id: 1, product_id: 1, name: 'Gamburger', price: 25000, qty: 2, total: 50000, note: 'atsiz' },
      { id: 2, order_id: 1, product_id: 2, name: 'Coca-Cola 0.5L', price: 8000, qty: 1, total: 8000, note: '' },
      { id: 3, order_id: 99, product_id: 1, name: 'Yetim qator', price: 1000, qty: 1, total: 1000, note: '' },
    ],
    stock_movements: [
      { id: 1, product_id: 1, delta: -2, reason: 'sale', note: 'Buyurtma №1001', order_id: 1, created_at: '2026-03-05 12:45:00' },
      { id: 2, product_id: 2, delta: 50, reason: 'kirim', note: 'Yetkazib beruvchi', order_id: null, created_at: '2026-03-04 08:00:00' },
      { id: 3, product_id: 99, delta: -1, reason: 'chiqim', note: 'Yo‘q mahsulot', order_id: null, created_at: '2026-03-04 08:00:00' },
    ],
    expenses: [
      { id: 1, title: 'Qumtoli', amount: 35000, category: 'Xom ashyo', created_at: '2026-03-05 10:00:00' },
      { id: 2, title: 'Nol yoki manfiy', amount: 0, category: 'Boshqa', created_at: '2026-03-05 10:00:00' },
    ],
    settings: { store_name: 'Eski nomi', store_phone: '+998 71 000 00 00', next_order_number: '1004', auto_print: '1' },
  };
}

let sb;

try {
  console.log('0) Akkaunt va do‘kon');
  await cleanOldRuns();
  await makeUser(`smoke.owner.${stamp}@proton.me`);
  sb = await login(`smoke.owner.${stamp}@proton.me`);
  await rpc(sb, 'register_venue', { p_name: venueName, p_kind: 'cafe', p_phone: '+998 90 000 00 01', p_address: 'Import testi' });
  const seededCats = await rpc(sb, 'pos_categories');
  const seededProds = await rpc(sb, 'pos_products', {});
  check('register_venue boshlang‘ich menyu bilan ochildi', seededCats.length > 0 && seededProds.length > 0, `${seededCats.length} kat / ${seededProds.length} mah`);

  console.log('1) Importdan oldin so‘ralgan xato emas');
  const res = await sb.rpc('import_legacy', { p: legacyDump() });
  check('boshlang‘ich menyu ustiga import o‘tdi', !res.error, res.error?.message || '');
  const sum = res.data || {};
  check('2 kategoriya kirdi', sum.categories === 2, JSON.stringify(sum));
  check('3 mahsulot kirdi (bog‘inmagan 1 tasi tashlandi)', sum.products === 3, JSON.stringify(sum));
  check('2 stol kirdi', sum.tables === 2, JSON.stringify(sum));
  check('3 buyurtma kirdi', sum.orders === 3, JSON.stringify(sum));
  check('2 tarkib qatori kirdi (yetim tashlandi)', sum.order_items === 2, JSON.stringify(sum));
  check('2 ombor harakati kirdi (yo‘q mahsulotniki tashlandi)', sum.movements === 2, JSON.stringify(sum));
  check('2 xarajat kirdi', sum.expenses === 2, JSON.stringify(sum));

  console.log('2) Ma‘lumotlar to‘g‘ri xaritalandi');
  const cats = await rpc(sb, 'pos_categories');
  const prods = await rpc(sb, 'pos_products', {});
  const tables = await rpc(sb, 'pos_table_states');
  check('boshlang‘ich menyu o‘chirildi', cats.length === 2 && prods.length === 3 && tables.length === 2, `${cats.length}/${prods.length}/${tables.length}`);
  const cola = prods.find((p) => p.name === 'Coca-Cola 0.5L');
  check('mahsulot kategoriyasiga bog‘landi', Boolean(cola) && cats.some((c) => c.id === cola.category_id), cola?.category_name);
  check('narx/qoldiq saqlandi', cola?.price === 8000 && Number(cola?.stock_qty) === 12 && cola?.track_stock === 1, JSON.stringify({ p: cola?.price, s: cola?.stock_qty, t: cola?.track_stock }));
  check('active=0 belgisi saqlandi', prods.find((p) => p.name === 'Nofaol burger')?.active === 0, String(prods.find((p) => p.name === 'Nofaol burger')?.active));
  check('stol zonasi saqlandi', tables.some((t) => t.name === 'T1' && t.zone === 'Terrasa'), JSON.stringify(tables.map((t) => t.name + '/' + t.zone)));

  const orders = await rpc(sb, 'pos_orders', { p_from: null, p_to: null, p_status: null, p_limit: 50 });
  const o1 = orders.find((o) => o.number === 1001);
  check('buyurtma raqami saqlandi', Boolean(o1), '');
  check('chegirma va jami saqlandi', o1?.subtotal === 58000 && Number(o1?.discount_percent) === 10 && o1?.discount === 5800 && o1?.total === 52200, JSON.stringify(o1 && [o1.subtotal, o1.discount_percent, o1.discount, o1.total]));
  check('sana/soat ko‘rinishi saqlandi', String(o1?.created_at).startsWith('2026-03-05 12:30:00'), o1?.created_at);
  check('tolangan holat va qaytim', o1?.status === 'paid' && o1?.payment_method === 'cash' && o1?.received === 60000 && o1?.change_amount === 7800, JSON.stringify(o1 && [o1.status, o1.payment_method, o1.received, o1.change_amount]));
  check('stolga bog‘lanish uuid’ga o‘tdi', Boolean(o1?.table_name) && o1.table_name === '1-stol', o1?.table_name);
  check('tarkib mahsulotga bog‘landi', o1?.items?.length === 2 && Boolean(o1.items.find((i) => i.product_id === cola?.id)), JSON.stringify(o1?.items?.map((i) => [i.name, Boolean(i.product_id)])));
  check('tarkib tartibi saqlandi', o1?.items?.[0]?.name === 'Gamburger' && o1?.items?.[0]?.note === 'atsiz', JSON.stringify(o1?.items?.map((i) => i.name)));
  const o3 = orders.find((o) => o.number === 1003);
  check('noto‘g‘ri tur/status holatlari tozalandi', o3?.type === 'takeaway' && o3?.kitchen_status === 'new' && o3?.payment_method === null, JSON.stringify(o3 && [o3.type, o3.kitchen_status, o3.payment_method]));
  check('yuqolgan stol bo‘g‘ini null bo‘ldi', o3?.table_id === null, String(o3?.table_id));
  check('bekor buyurtma saqlandi', orders.find((o) => o.number === 1002)?.status === 'cancelled', '');

  console.log('3) Ombor, xarajatlar, sozlamalar, hisoblagich');
  const low = await rpc(sb, 'pos_low_stock');
  check('kam qoldiq hisobi ishladi', low.some((p) => p.name === 'Coca-Cola 0.5L'), JSON.stringify(low.map((p) => p.name)));
  const movementList = await rpc(sb, 'pos_movements', { p_product: cola?.id ?? null, p_limit: 50 });
  check('harakatlar xaritalangan mahsulotga yozildi', movementList.length === 1 && Number(movementList[0].delta) === 50 && movementList[0].reason === 'kirim', JSON.stringify(movementList.map((m) => [m.product_name, m.delta, m.reason])));
  const expenses = await rpc(sb, 'pos_expenses', { p_from: '2026-03-01', p_to: '2026-03-31' });
  check('xarajatlar sanasi saqlandi', expenses.length === 2 && String(expenses[0].created_at).startsWith('2026-03-05'), JSON.stringify(expenses.map((e) => [e.title, e.amount])));
  check('0 sumlik xarajat 1 ga to‘g‘rilandi', expenses.some((e) => e.amount === 1), JSON.stringify(expenses.map((e) => e.amount)));
  const settings = await rpc(sb, 'pos_settings');
  check('sozlamalar importlandi', settings.store_name === 'Eski nomi' && settings.auto_print === '1', JSON.stringify(settings));
  check('next_order_number sozlama sifatida importlanmadi', settings.next_order_number === undefined, String(settings.next_order_number));

  const nextOrder = await rpc(sb, 'create_order', {
    p: { type: 'takeaway', items: [{ product_id: cola.id, name: cola.name, price: cola.price, qty: 1 }], discount_percent: 0, note: '' },
  });
  check('hisoblagich importdan keyin davom etdi (№1004)', nextOrder.number === 1004, String(nextOrder.number));
  await rpc(sb, 'cancel_order', { p_id: nextOrder.id });

  console.log('4) Hisobot va qayta import');
  const report = await rpc(sb, 'pos_report', { p_from: '2026-03-01', p_to: '2026-03-31' });
  check('importlangan savdo hisobotga kirdi', report.order_count === 1 && report.revenue === 52200, JSON.stringify([report.order_count, report.revenue]));
  const again = await sb.rpc('import_legacy', { p: legacyDump() });
  check('buyurtma bor do‘konda qayta import rad etildi', Boolean(again.error) && String(again.error.message).includes('DOKON_TO_LI'), again.error?.message || 'QABUL QILDI!');

  console.log('5) Anon va boshqa do‘kondan himoya');
  const anonSb = anon();
  const anonCall = await anonSb.rpc('import_legacy', { p: legacyDump() });
  check('anon import rad etildi', Boolean(anonCall.error), anonCall.error?.message || 'RUXSAT BERDI!');
  const otherEmail = `smoke.other.${stamp}@proton.me`;
  await makeUser(otherEmail);
  const otherSb = await login(otherEmail);
  await rpc(otherSb, 'register_venue', { p_name: `Smoke Import Boshqa ${stamp}`, p_kind: 'fastfood', p_phone: '', p_address: '' });
  const otherRes = await otherSb.rpc('import_legacy', { p: legacyDump() });
  check('boshqa do‘konga yozmadi', !otherRes.error, otherRes.error?.message || '');
  const myOrders = await rpc(sb, 'pos_orders', { p_from: null, p_to: null, p_status: null, p_limit: 50 });
  check('do‘konim buyurtmalari o‘zgartirilmadi', myOrders.length === 4, String(myOrders.length));
  const theirCats = await rpc(otherSb, 'pos_categories');
  check('ikkinchi do‘kon o‘z importini oldi', theirCats.length === 2, String(theirCats.length));
} catch (e) {
  check(' kutilmagan xato', false, e.message);
} finally {
  if (sb) {
    try {
      const { data: u } = await sb.auth.getUser();
      if (u?.id) {
        const st = await admin.from('staff').select('venue_id').eq('user_id', u.id).maybeSingle();
        if (st?.venue_id) await admin.from('venues').delete().eq('id', st.venue_id);
      }
    } catch {}
  }
  for (const id of createdIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  await admin.from('venues').delete().like('name', 'Smoke %');
  for (const c of pool) await c.auth.signOut().catch(() => {});
  console.log(`\n${checks - failed}/${checks} o‘tdi`);
}

process.exit(failed ? 1 : 0);

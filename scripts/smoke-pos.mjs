import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// 2-bosqich (POS ma'lumot qatlami) uchun uchdan-uchga sinov.
// Ishga tushirish: SUPABASE_SECRET_KEY=sb_secret_... npm run smoke:pos
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
const venueName = `Smoke Kafe ${stamp}`;
const otherName = `Smoke Boshqa ${stamp}`;
const createdIds = [];
const venueNames = [venueName, otherName];
let venueId = null;
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
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `smokepos-${pool.length}-${Math.random()}` },
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
}

async function cleanOldRuns() {
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw new Error(users.error.message);
  for (const u of users.data.users.filter((x) => String(x.email).startsWith('smoke.'))) {
    await admin.auth.admin.deleteUser(u.id);
  }
  await admin.from('venues').delete().like('name', 'Smoke %');
}

let sb; // owner sessiyasi (finally uchun)

try {
  console.log('0) Test akkauntlar');
  await cleanOldRuns();
  await makeUser(`smoke.owner.${stamp}@proton.me`);
  await makeUser(`smoke.other.${stamp}@proton.me`);
  await makeUser(`smoke.stranger.${stamp}@proton.me`);
  sb = await login(`smoke.owner.${stamp}@proton.me`);
  check('owner kirdi', true);

  console.log('1) register_venue + boshlang‘ich menyu');
  await rpc(sb, 'register_venue', { p_name: venueName, p_kind: 'fastfood', p_phone: '+998 90 000 00 00', p_address: 'Test' });
  const me = await sb.from('staff').select('venue_id, venues(kind)').eq('user_id', (await sb.auth.getUser()).data.user.id).maybeSingle();
  if (me.error) throw new Error(`staff so‘rovi: ${me.error.message}`);
  venueId = me.data.venue_id;
  check('do‘kon yaratildi', venueId && me.data.venues?.kind === 'fastfood', JSON.stringify(me.data));

  const cats = await rpc(sb, 'pos_categories', {});
  const prods = await rpc(sb, 'pos_products', {});
  check('6 kategoriya (fastfood: pitsasiz)', cats.length === 6, cats.map((c) => c.name).join(', '));
  check('25 ta mahsulot (4 pitsa tushadi)', prods.length === 25, `${prods.length}`);
  const cola = prods.find((p) => p.name === 'Coca-Cola 0.5L');
  check('mahsulot shakli (active=1, stock=48)', cola?.active === 1 && cola?.track_stock === 1 && cola?.stock_qty === 48, JSON.stringify(cola));
  check('kategoriya biriktirilgan', Boolean(cola?.category_name && cola?.category_color), cola?.category_name);
  const tables = await rpc(sb, 'pos_table_states', {});
  check('8 stol', tables.length === 8, `${tables.length}`);
  const zones = await rpc(sb, 'pos_zones', {});
  check('zonalar', zones.length === 1 && zones[0] === 'Asosiy zal', JSON.stringify(zones));
  const settings = await rpc(sb, 'pos_settings', {});
  check('sozlamalar seedlangan', settings.store_name === venueName && settings.auto_print === '0', JSON.stringify(settings));

  console.log('2) Buyurtma yaratish va hisoblash');
  const o1 = await rpc(sb, 'create_order', {
    p: {
      type: 'takeaway',
      items: [
        { product_id: cola.id, name: cola.name, price: 8000, qty: 2 },
        { product_id: prods[0].id, name: prods[0].name, price: 25000, qty: 1 },
      ],
      discount_percent: 10,
      note: 'sinov',
      send_to_kitchen: false,
    },
  });
  check('buyurtma №1001', o1.number === 1001, `${o1.number}`);
  check('subtotal 41000', o1.subtotal === 41000, `${o1.subtotal}`);
  check('discount 4100 / total 36900', o1.discount === 4100 && o1.total === 36900, `${o1.discount}/${o1.total}`);
  check('items ichida', o1.items.length === 2 && o1.items[0].total === 16000, JSON.stringify(o1.items?.[0]));
  check('status open / kitchen none', o1.status === 'open' && o1.kitchen_status === 'none', `${o1.status}/${o1.kitchen_status}`);
  check('created_at matn ko‘rinishi', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(o1.created_at), o1.created_at);

  await rpcErr(sb, 'create_order', { p: { type: 'takeaway', items: [] } }, 'BUYURTMA_BOSH');
  await rpcErr(sb, 'create_order', { p: { type: 'dine_in', items: [{ name: 'X', price: 1000, qty: 1 }] } }, 'STOL_TANLANG');
  await rpcErr(sb, 'create_order', {
    p: { type: 'takeaway', items: [{ product_id: cola.id, name: cola.name, price: 8000, qty: 999 }] },
  }, 'QOLDIQ_YETARLI_EMAS');

  console.log('3) Stol bandlash');
  const table1 = tables[0];
  const o2 = await rpc(sb, 'create_order', {
    p: { type: 'dine_in', table_id: table1.id, items: [{ product_id: prods[0].id, name: prods[0].name, price: 25000, qty: 1 }], send_to_kitchen: true },
  });
  check('dine_in buyurtma №1002', o2.number === 1002 && o2.table_name === table1.name && o2.kitchen_status === 'new', `${o2.number}/${o2.table_name}`);
  await rpcErr(sb, 'create_order', {
    p: { type: 'dine_in', table_id: table1.id, items: [{ name: 'X', price: 1000, qty: 1 }] },
  }, 'STOL_BAND');
  const stateBusy = (await rpc(sb, 'pos_table_states', {})).find((t) => t.id === table1.id);
  check('stol band holada', stateBusy.order_id === o2.id && stateBusy.item_count === 1, JSON.stringify(stateBusy));

  console.log('4) Ochiq buyurtmalar / oshxona');
  const open = await rpc(sb, 'pos_open_orders', {});
  check('2 ochiq buyurtma', open.length === 2 && open[0].number === 1002, open.map((o) => o.number).join(','));
  const kitchen = await rpc(sb, 'pos_kitchen_orders', {});
  check('oshxonada 1 ta', kitchen.length === 1 && kitchen[0].id === o2.id, kitchen.map((o) => o.number).join(','));
  await rpc(sb, 'send_to_kitchen', { p_id: o1.id });
  const kitchen2 = await rpc(sb, 'pos_kitchen_orders', {});
  check('yuborilgandan keyin 2 ta', kitchen2.length === 2, `${kitchen2.length}`);
  await rpc(sb, 'set_kitchen_status', { p_id: o2.id, p_status: 'cooking' });
  await rpc(sb, 'set_kitchen_status', { p_id: o2.id, p_status: 'ready' });
  check('holat ready', (await rpc(sb, 'pos_order', { p_id: o2.id })).kitchen_status === 'ready');
  await rpcErr(sb, 'set_kitchen_status', { p_id: o2.id, p_status: 'teleport' }, 'HOLAT_NOTOGRI');

  console.log('5) Tahrirlash');
  const upd = await rpc(sb, 'update_order', {
    p_id: o1.id,
    p: {
      type: 'takeaway',
      items: [
        { product_id: cola.id, name: cola.name, price: 8000, qty: 2 },
        { product_id: prods[0].id, name: prods[0].name, price: 25000, qty: 3 },
      ],
      discount_percent: 0,
    },
  });
  check('yangi jami 91000', upd.subtotal === 91000 && upd.total === 91000 && upd.items.length === 2, `${upd.total}`);
  check('raqam o‘zgarmadi', upd.number === 1001);

  console.log('6) To‘lov va ombor');
  const afterSale = (await rpc(sb, 'pos_products', {})).find((p) => p.id === cola.id).stock_qty;
  check('to‘lovdan oldin qoldiq 48', afterSale === 48, `${afterSale}`);
  await rpcErr(sb, 'pay_order', { p_id: o1.id, p_method: 'cash', p_received: 1000 }, 'SUMMA_YETARLI_EMAS');
  const paid = await rpc(sb, 'pay_order', { p_id: o1.id, p_method: 'cash', p_received: 100000 });
  check('paid + qaytim 9000', paid.status === 'paid' && paid.change_amount === 9000 && paid.received === 100000, `${paid.change_amount}`);
  check('paid_at to‘ldi', /^\d{4}-\d{2}-\d{2} /.test(paid.paid_at), paid.paid_at);
  check('oshxona holati saqlandi', paid.kitchen_status === 'new', paid.kitchen_status);
  await rpcErr(sb, 'pay_order', { p_id: o1.id, p_method: 'cash' }, 'FAQAT_OCHIQ_TOLOV');

  const afterPay = (await rpc(sb, 'pos_products', {})).find((p) => p.id === cola.id);
  const movements = await rpc(sb, 'pos_movements', { p_limit: 10 });
  const sale = movements.find((m) => m.reason === 'sale');
  check('sotuv harakati yozildi', sale && sale.delta === -2 && sale.order_id === o1.id, JSON.stringify(sale));
  check('cola qoldigi 46 (2 dona sotildi)', afterPay.stock_qty === 46, `${afterPay.stock_qty}`);

  console.log('7) Ombor amallari');
  await rpc(sb, 'stock_in', { p_product: cola.id, p_qty: 10, p_note: 'kirim sinov' });
  check('kirimdan keyin 56', (await rpc(sb, 'pos_products', {})).find((p) => p.id === cola.id).stock_qty === 56);
  await rpcErr(sb, 'stock_out', { p_product: cola.id, p_qty: -5 }, 'MIQDOR_NOTOGRI');
  await rpcErr(sb, 'stock_out', { p_product: cola.id, p_qty: 500 }, 'QOLDIQ_YETARLI_EMAS_CHIQIM');
  await rpc(sb, 'stock_out', { p_product: cola.id, p_qty: 45, p_note: 'chiqim sinov' });
  const low = await rpc(sb, 'pos_low_stock', {});
  check('kam qoldiq ro‘yxati', low.some((p) => p.id === cola.id) && low.every((p) => p.stock_qty <= p.low_stock), low.map((p) => p.name).join(', '));
  const mvs = await rpc(sb, 'pos_movements', { p_product: cola.id, p_limit: 5 });
  check('mahsulot bo‘yicha harakatlar', mvs.length === 3 && mvs[0].reason === 'chiqim', mvs.map((m) => m.reason).join(','));

  console.log('8) Kategoriya/mahsulot/stol boshqaruvi');
  const newCat = await rpc(sb, 'add_category', { p: { name: 'Qo‘shimcha', emoji: '🧊', color: '#111111' } });
  const newProd = await rpc(sb, 'add_product', { p: { category_id: newCat.id, name: 'Soviq suv', price: 4000, emoji: '💧', track_stock: true, stock_qty: 3, low_stock: 1 } });
  await rpc(sb, 'update_product', { p_id: newProd.id, p: { price: 4500 } });
  check('mahsulot qo‘shildi va tahrirlandi', (await rpc(sb, 'pos_products', { p_category_id: newCat.id }))
    .every((p) => p.price === 4500));
  await rpcErr(sb, 'delete_category', { p_id: newCat.id }, 'KATEGORIYADA_MAHSULOT_BOR');
  await rpc(sb, 'delete_product', { p_id: newProd.id });
  check('ishlatilmagan mahsulot o‘chdi', (await rpc(sb, 'pos_products', { p_active_only: true })).every((p) => p.id !== newProd.id));
  const usedDel = await rpc(sb, 'delete_product', { p_id: prods[0].id });
  check('ishlatilgan mahsulot arxivlandi', usedDel === 'archived'
    && (await rpc(sb, 'pos_products', { p_active_only: true })).every((p) => p.id !== prods[0].id));

  const newTable = await rpc(sb, 'add_table', { p: { name: 'Yangi stol', zone: 'Terrasa', seats: 2 } });
  await rpc(sb, 'update_table', { p_id: newTable.id, p: { seats: 6 } });
  const ts = await rpc(sb, 'pos_table_states', {});
  check('stol qo‘shildi/tahrirlandi', ts.some((t) => t.id === newTable.id && t.seats === 6 && t.zone === 'Terrasa'));
  await rpcErr(sb, 'delete_table', { p_id: table1.id }, 'STOLD_OCHIQ_BUYURTMA');
  await rpc(sb, 'delete_table', { p_id: newTable.id });
  check('bo‘sh stol o‘chdi', !(await rpc(sb, 'pos_table_states', {})).some((t) => t.id === newTable.id));

  console.log('9) Bekor qilish va xarajatlar');
  await rpc(sb, 'cancel_order', { p_id: o2.id });
  const freed = (await rpc(sb, 'pos_table_states', {})).find((t) => t.id === table1.id);
  check('stol bo‘shadi', !freed.order_id);
  await rpcErr(sb, 'cancel_order', { p_id: o2.id }, 'FAQAT_OCHIQ_BEKOR');

  const exp = await rpc(sb, 'add_expense', { p: { title: 'Masalliqlar', amount: 120000, category: 'Masalliqlar' } });
  await rpcErr(sb, 'add_expense', { p: { title: 'Xato', amount: 0 } }, 'SUMMA_NOTOGRI');
  const today = (await rpc(sb, 'pos_order', { p_id: o1.id })).paid_at.slice(0, 10);
  const report = await rpc(sb, 'pos_report', { p_from: today, p_to: today });
  check('hisobot tushumi 91000', report.revenue === 91000 && report.order_count === 1, `${report.revenue}/${report.order_count}`);
  check('hisobot xarajati', report.expenseTotal === 120000 && report.profit === 91000 - 120000, `${report.expenseTotal}`);
  check('kunlik diagramma', report.byDay.length === 1 && report.byDay[0].day === today, JSON.stringify(report.byDay));
  check('to‘lov turi', report.byMethod.length === 1 && report.byMethod[0].payment_method === 'cash');
  check('top mahsulotlar', report.topProducts.length === 2 && report.topProducts[0].qty === 3 && report.topProducts[0].revenue === 75000, JSON.stringify(report.topProducts[0]));
  await rpc(sb, 'delete_expense', { p_id: exp.id });
  check('xarajat o‘chdi', (await rpc(sb, 'pos_expenses', { p_from: '2000-01-01', p_to: '2100-01-01' })).length === 0);

  console.log('10) Sozlamalar');
  await rpc(sb, 'save_settings', { p: { store_name: 'Smoke Boshqa nom', receipt_footer: 'Rahmat!' } });
  const s2 = await rpc(sb, 'pos_settings', {});
  check('sozlama saqlandi', s2.store_name === 'Smoke Boshqa nom' && s2.receipt_footer === 'Rahmat!' && s2.auto_print === '0', JSON.stringify(s2));

  console.log('11) Do‘konlararo izolyatsiya (RLS)');
  const other = await login(`smoke.other.${stamp}@proton.me`);
  await rpc(other, 'register_venue', { p_name: otherName, p_kind: 'cafe' });
  const otherProds = await rpc(other, 'pos_products', {});
  check('ikkinchi do‘kon: kafe menyusi', otherProds.length === 29 && (await rpc(other, 'pos_table_states', {})).length === 16, `${otherProds.length}`);
  check('qo‘shni do‘kon buyurtmani ko‘rmaydi', (await rpc(other, 'pos_order', { p_id: o1.id })) === null);
  check('qo‘shni do‘kon ro‘yxatini ko‘rmaydi', (await rpc(other, 'pos_open_orders', {})).length === 0);
  await rpcErr(other, 'pay_order', { p_id: o1.id, p_method: 'card' }, 'BUYURTMA_TOPILMADI');
  await rpcErr(other, 'stock_in', { p_product: cola.id, p_qty: 5 }, 'MAHSULOT_TOPILMADI');
  const otherFirst = await rpc(other, 'create_order', { p: { type: 'takeaway', items: [{ name: 'Test', price: 1000, qty: 1 }] } });
  check('o‘z hisoblagichi (1001)', otherFirst.number === 1001, `${otherFirst.number}`);

  const stranger = await login(`smoke.stranger.${stamp}@proton.me`);
  // Do'konga ulanmagan akkaunt: rol qatlami (5-bosqich) RUXSAT_YOQ deb javob beradi.
  await rpcErr(stranger, 'create_order', { p: { type: 'takeaway', items: [{ name: 'X', price: 100, qty: 1 }] } }, 'RUXSAT_YOQ');
  check('docsinga ulanmagan: mahsulot yo‘q', (await rpc(stranger, 'pos_products', {})).length === 0);
  const noAuth = anon();
  const anonCall = await noAuth.rpc('pos_products', {});
  check('anon RPC rad etildi', Boolean(anonCall.error), anonCall.error?.message || 'RUXSAT BERDI!');

  console.log('12) Tarix so‘rovlari');
  const hist = await rpc(sb, 'pos_orders', { p_status: 'paid', p_from: today, p_to: today });
  check('to‘langanlar ro‘yxati', hist.length === 1 && hist[0].items.length === 2, `${hist.length}`);
  check('limit ishlaydi', (await rpc(sb, 'pos_orders', { p_limit: 1 })).length === 1);
} catch (e) {
  check('kutilmagan xato', false, e.message);
} finally {
  console.log('13) Tozalash');
  for (const id of createdIds) await admin.auth.admin.deleteUser(id);
  const drop = await admin.from('venues').delete().in('name', venueNames);
  check('do‘konlar o‘chirildi', !drop.error, JSON.stringify(drop.error || ''));
  const left = await admin.from('venues').select('id').in('name', venueNames);
  check('qoldiq qalmadi', left.data?.length === 0, JSON.stringify(left.data));
  const orphan = await admin.from('orders').select('id').eq('venue_id', venueId);
  check('buyurtma qatorlari cascade bilan o‘chdi', !orphan.error && orphan.data?.length === 0, JSON.stringify(orphan.error || orphan.data));
  console.log(`\n${checks - failed}/${checks} tekshiruv o‘tdi`);
}

process.exit(failed ? 1 : 0);

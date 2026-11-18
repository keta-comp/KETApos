import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Onlayn zakaz moduli (schema_11) uchun baza tekshiruvi: mijoz slugsiz vitrinani
// ko'radi, zakaz yuboradi, xodim qabul qilib uni kassaga aylantiradi.
// Ishlatish:
//   DATABASE_URL=... npm run db:apply supabase/schema_11_online.sql
//   SUPABASE_SECRET_KEY=sb_secret_... npm run smoke:online

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('.env da VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY yo‘q');
if (!secret) throw new Error('SUPABASE_SECRET_KEY kerak (sb_secret_...)');

const stamp = Date.now();
const password = 'Smoke-test-2026';
const emails = {
  ownerA: `smoke.online.a.${stamp}@proton.me`,
  ownerB: `smoke.online.b.${stamp}@proton.me`,
  cashier: `smoke.online.cashier.${stamp}@proton.me`,
  waiter: `smoke.online.waiter.${stamp}@proton.me`,
};
const nameA = `Smoke Onlayn A ${stamp}`;
const nameB = `Smoke Onlayn B ${stamp}`;

let failed = false;
let n = 0;
const userIds = [];
const venueIds = [];

function check(label, ok, extra = '') {
  console.log(`${ok ? 'O‘TDI ' : 'XATO  '} ${label}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed = true;
}
const isErr = (res, code) => Boolean(res.error) && String(res.error.message).includes(code);
const newId = () => `smoke-${stamp}-${(n += 1)}`;
const phone = (tail) => `+998 90 ${tail}`;

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function userClient() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `smoke-${Math.random()}` },
  });
}

async function makeUser(email) {
  const res = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (res.error) throw new Error(`createUser(${email}): ${res.error.message}`);
  userIds.push(res.data.id || res.data.user.id);
  return userClient();
}

async function asOwner(sb, email, venueName) {
  const up = await sb.auth.signInWithPassword({ email, password });
  if (up.error) throw new Error(`login ${email}: ${up.error.message}`);
  const reg = await sb.rpc('register_venue', {
    p_name: venueName, p_kind: 'fastfood', p_phone: phone('000 00 11'),
    p_address: 'Sinov', p_owner_name: 'Ega Sinovchi',
  });
  if (reg.error || !reg.data) throw new Error(`register_venue: ${reg.error?.message || 'bo‘sh'}`);
  venueIds.push(reg.data);
  return reg.data;
}

async function newProduct(sb, catName, prodName, price) {
  const cat = await sb.rpc('add_category', { p: { name: catName, emoji: '🍔', color: '#f97316' } });
  if (cat.error) throw new Error(`add_category: ${cat.error.message}`);
  const prod = await sb.rpc('add_product', {
    p: { category_id: cat.data, name: prodName, price, emoji: '🍔' },
  });
  if (prod.error) throw new Error(`add_product: ${prod.error.message}`);
  return prod.data.id;
}

const submit = (sb, body) => sb.rpc('online_submit', { p: { client_id: newId(), ...body } });

async function cleanup() {
  for (const id of venueIds) await admin.from('venues').delete().eq('id', id);
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
  const old = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (!old.error) {
    for (const u of old.data.users.filter((x) => String(x.email).startsWith('smoke.online.'))) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }
  await admin.from('venues').delete().like('name', 'Smoke Onlayn %');
}

try {
  console.log('0) Test akkauntlari va ikkita do‘kon');
  const pre = await anon.rpc('online_menu', { p_slug: 'preflight' });
  if (pre.error && /could not find|does not exist/i.test(String(pre.error.message))) {
    throw new Error(`schema_11 qo‘llanilmagan (${pre.error.message}). `
      + 'Avval: DATABASE_URL=... npm run db:apply supabase/schema_11_online.sql');
  }
  const ownerA = await makeUser(emails.ownerA);
  const ownerB = await makeUser(emails.ownerB);
  const cashier = await makeUser(emails.cashier);
  const waiter = await makeUser(emails.waiter);
  const venueA = await asOwner(ownerA, emails.ownerA, nameA);
  await asOwner(ownerB, emails.ownerB, nameB);

  const invite = await ownerA.rpc('issue_invite', { p_role: 'cashier' });
  const inviteW = await ownerA.rpc('issue_invite', { p_role: 'waiter' });
  await cashier.auth.signInWithPassword({ email: emails.cashier, password });
  await waiter.auth.signInWithPassword({ email: emails.waiter, password });
  const c1 = await cashier.rpc('redeem_invite', { p_code: invite.data, p_name: 'Kassir Sinov' });
  const w1 = await waiter.rpc('redeem_invite', { p_code: inviteW.data, p_name: 'Ofitsant Sinov' });
  check('kassir va ofitsant A do‘koniga qo‘shildi', c1.data === 'cashier' && w1.data === 'waiter');

  const hot = await newProduct(ownerA, 'Sinov', 'Lag‘mon', 12000);
  const tea = await newProduct(ownerA, 'Sinov', 'Choy', 2500);
  const otherShopProduct = await newProduct(ownerB, 'Sinov B', 'Boshqa mahsulot', 20000);
  check('menyular tayyor', Boolean(hot && tea && otherShopProduct));

  console.log('1) Vitrina yoqilishi va bitta link');
  const before = await ownerA.rpc('online_get_shop');
  check('online_get_shop: o‘chirilgan holatda url yo‘q',
    !before.error && before.data?.enabled === false && before.data?.url === null,
    JSON.stringify(before.error || before.data));

  const shop = await ownerA.rpc('online_set_shop', { p: { enabled: true, delivery: true, min_total: 15000 } });
  const slug = shop.data?.slug;
  check('online_set_shop: slug va /o/<slug> linki',
    !shop.error && /^[0-9a-f]{8}$/.test(slug || '') && shop.data?.url === `/o/${slug}`,
    JSON.stringify(shop.error || shop.data));
  const shopAgain = await ownerA.rpc('online_set_shop', { p: { accepting: true } });
  check('slug o‘zgarmaydi (ikkinchi marta yoqilganda)', shopAgain.data?.slug === slug);

  console.log('2) Mijoz (anon) menyu');
  const menu = await anon.rpc('online_menu', { p_slug: slug });
  const items = menu.data?.categories?.[0]?.products || [];
  check('online_menu: nom, kategoriya va narxlar',
    !menu.error && menu.data?.name === nameA && items.length === 2 && items.every((p) => p.available),
    JSON.stringify(menu.error || { name: menu.data?.name, k: items.length }));
  const noMenu = await anon.rpc('online_menu', { p_slug: 'deadbeef' });
  check('noma’lum slug: bo‘sh javob (xatolik emas)', !noMenu.error && noMenu.data === null,
    JSON.stringify(noMenu.error));

  console.log('3) Zakaz yuborish va narx mijozdan olinmaydi');
  const okey = phone('111 22 01');
  const firstClient = newId();
  const sent = await anon.rpc('online_submit', {
    p: {
      slug, client_id: firstClient, name: 'Aziza', phone: okey, type: 'pickup',
      items: [{ product_id: hot, qty: 2, price: 1, name: 'Arzon deb aldash' }],
    },
  });
  const token = sent.data?.token;
  check('online_submit: server narxi 2×12000', !sent.error && sent.data?.total === 24000 && sent.data?.status === 'new',
    JSON.stringify(sent.error || sent.data));
  check('token 16 belgi', /^[0-9A-F]{16}$/.test(token || ''), token);

  const repeat = await anon.rpc('online_submit', {
    p: { slug, client_id: firstClient, name: 'Aziza', phone: okey, type: 'pickup', items: [{ product_id: hot, qty: 1 }] },
  });
  check('bir xil client_id: takror deb qaytadi',
    !repeat.error && repeat.data?.duplicated === true && repeat.data?.token === token,
    JSON.stringify(repeat.error || repeat.data));

  console.log('4) Tekshiruvlar va himoya');
  const min = await submit(anon, { slug, name: 'Baxtiyor', phone: phone('111 22 02'), type: 'pickup', items: [{ product_id: tea, qty: 1 }] });
  check('minimal zakazdan kam', isErr(min, 'MINIMUM_YETISHMADI'), min.error?.message || JSON.stringify(min.data));
  const badPhone = await submit(anon, { slug, name: 'Baxtiyor', phone: '12', type: 'pickup', items: [{ product_id: hot, qty: 1 }] });
  check('telefon noto‘g‘ri', isErr(badPhone, 'TELEF_NOTOGRI'), badPhone.error?.message);
  const noName = await submit(anon, { slug, name: 'A', phone: phone('111 22 03'), type: 'pickup', items: [{ product_id: hot, qty: 1 }] });
  check('ism qisqa', isErr(noName, 'NOM_KERTILMADI'), noName.error?.message);
  const noCode = await anon.rpc('online_submit', { p: { slug, name: 'Aziza', phone: phone('111 22 04'), type: 'pickup', items: [{ product_id: hot, qty: 1 }], client_id: 'x' } });
  check('kuzatuv kodi qisqa', isErr(noCode, 'KOD_KERTILMADI'), noCode.error?.message);
  const emptyCart = await submit(anon, { slug, name: 'Aziza', phone: phone('111 22 05'), type: 'pickup', items: [] });
  check('savat bo‘sh', isErr(emptyCart, 'BUYURTMA_BOSH'), emptyCart.error?.message);
  const many = await submit(anon, {
    slug, name: 'Aziza', phone: phone('111 22 06'), type: 'pickup',
    items: Array.from({ length: 31 }, () => ({ product_id: hot, qty: 1 })),
  });
  check('31 ta pozitsiya rad etildi', isErr(many, 'MAHSULOT_KOP'), many.error?.message);
  const foreign = await submit(anon, { slug, name: 'Aziza', phone: phone('111 22 07'), type: 'pickup', items: [{ product_id: otherShopProduct, qty: 1 }] });
  check('boshqa do‘kon mahsuloti: MAHSULOT_TOPILMADI', isErr(foreign, 'MAHSULOT_TOPILMADI'), foreign.error?.message);
  const junk = await submit(anon, { slug, name: 'Aziza', phone: phone('111 22 08'), type: 'pickup', items: [{ product_id: '1', qty: 1 }] });
  check('buzilgan product_id: xatolik, 500 emas', isErr(junk, 'MAHSULOT_TOPILMADI'), junk.error?.message);
  const bigQty = await submit(anon, { slug, name: 'Aziza', phone: phone('111 22 09'), type: 'pickup', items: [{ product_id: hot, qty: 100 }] });
  check('99 dan ortiq dona rad etildi', isErr(bigQty, 'MAHSULOT_TOPILMADI'), bigQty.error?.message);
  const noAddr = await submit(anon, { slug, name: 'Aziza', phone: phone('111 22 10'), type: 'delivery', items: [{ product_id: hot, qty: 1 }] });
  check('manzilsiz yetkazib berish', isErr(noAddr, 'MANZIL_KERTILMADI'), noAddr.error?.message);

  const delivered = await submit(anon, {
    slug, name: 'Otabek', phone: phone('111 22 11'), type: 'delivery',
    address: 'G‘azalkent ko‘chasi 12, 34-uy', items: [{ product_id: hot, qty: 2 }],
  });
  const dToken = delivered.data?.token;
  check('yetkazib berish zakazi qabul qilindi', !delivered.error && delivered.data?.total === 24000,
    JSON.stringify(delivered.error || delivered.data));

  console.log('5) Xodim jouyari');
  const list = await ownerA.rpc('online_list');
  const pending = await ownerA.rpc('online_pending');
  check('online_list: 2 ta zakaz', !list.error && list.data?.length === 2, JSON.stringify(list.error || list.data?.length));
  check('online_pending: 2 ta javobsiz', pending.data === 2, JSON.stringify(pending.data));
  const cashList = await cashier.rpc('online_list');
  check('kassir jouyarni ko‘radi', !cashList.error && cashList.data?.length === 2, cashList.error?.message);
  const waitList = await waiter.rpc('online_list');
  check('ofitsant jouyarni ko‘rmaydi', !waitList.error && (waitList.data || []).length === 0, JSON.stringify(waitList.data));
  const waitShop = await waiter.rpc('online_set_shop', { p: { enabled: false } });
  check('ofitsant vitrinani yoqa olmaydi', isErr(waitShop, 'FAQAT_EGA'), waitShop.error?.message);
  const anonShop = await anon.rpc('online_set_shop', { p: { enabled: false } });
  check('anon online_set_shop yopiq', Boolean(anonShop.error), anonShop.error?.message || 'OCHIB QOLDI!');
  const anonList = await anon.rpc('online_list');
  check('anon online_list yopiq', Boolean(anonList.error), anonList.error?.message || 'OCHIB QOLDI!');

  const rawOrders = await anon.from('online_orders').select('*');
  const rawShops = await cashier.from('online_shops').select('*');
  check('jadvallarni to‘g‘ridan-to‘g‘ri o‘qib bo‘lmaydi',
    (rawOrders.error || rawOrders.data?.length === 0) && (rawShops.error || rawShops.data?.length === 0),
    JSON.stringify({ o: rawOrders.error?.message || rawOrders.data?.length, s: rawShops.error?.message || rawShops.data?.length }));

  console.log('6) Qabul qilish → kassa buyurtmasi');
  const first = (list.data || []).find((o) => o.token === token);
  const accepted = await ownerA.rpc('online_accept', { p_id: first.id });
  check('online_accept: kassada №paydo bo‘ldi',
    !accepted.error && Boolean(accepted.data?.id) && Number(accepted.data?.number) > 0,
    JSON.stringify(accepted.error || accepted.data));
  const acceptedAgain = await ownerA.rpc('online_accept', { p_id: first.id });
  check('ikkinchi marta bosilsa takror buyurtma tug‘ilmaydi',
    !acceptedAgain.error && acceptedAgain.data?.duplicated === true && acceptedAgain.data?.id === accepted.data?.id,
    JSON.stringify(acceptedAgain.error || acceptedAgain.data));

  const st = await anon.rpc('online_status', { p_token: token });
  check('mijoz holati: qabul qilindi + raqam', !st.error && st.data?.status === 'accepted' && Number(st.data?.number) > 0,
    JSON.stringify(st.error || st.data));
  check('holat javobida telefon yo‘q', !('phone' in (st.data || {})) && !('customer_phone' in (st.data || {})));

  const second = (list.data || []).find((o) => o.token === dToken);
  const rejected = await cashier.rpc('online_reject', { p_id: second.id, p_reason: 'Mahsulot tugadi' });
  check('kassir zakazni rad eta oldi', !rejected.error && rejected.data?.status === 'rejected',
    JSON.stringify(rejected.error || rejected.data));
  const rejectAgain = await cashier.rpc('online_reject', { p_id: second.id, p_reason: 'yana' });
  check('rad etilganni qayta rad qilib bo‘lmaydi', isErr(rejectAgain, 'FAQAT_OCHIQ_BEKOR'), rejectAgain.error?.message);
  const acceptRejected = await cashier.rpc('online_accept', { p_id: second.id });
  check('rad etilganni qabul qilib bo‘lmaydi', isErr(acceptRejected, 'RAD_ETILGAN'), acceptRejected.error?.message);
  const stRej = await anon.rpc('online_status', { p_token: dToken });
  check('mijoz sababni ko‘radi', stRej.data?.status === 'rejected' && stRej.data?.reason === 'Mahsulot tugadi',
    JSON.stringify(stRej.data));
  const pendingAfter = await ownerA.rpc('online_pending');
  check('online_pending: javobsiz qolmadi', pendingAfter.data === 0, JSON.stringify(pendingAfter.data));

  console.log('7) Do‘kon o‘chirilgan / to‘xtatilgan holat');
  await ownerA.rpc('online_set_shop', { p: { delivery: false } });
  const noDelivery = await submit(anon, {
    slug, name: 'Aziza', phone: phone('111 22 12'), type: 'delivery', address: 'Sinov ko‘chasi 1',
    items: [{ product_id: hot, qty: 2 }],
  });
  check('yetkazib bermaydigan do‘konga delivery', isErr(noDelivery, 'DOKON_YETKAZMAYDI'), noDelivery.error?.message);

  await ownerA.rpc('online_set_shop', { p: { accepting: false } });
  const closed = await submit(anon, { slug, name: 'Aziza', phone: phone('111 22 13'), type: 'pickup', items: [{ product_id: hot, qty: 2 }] });
  check('qabul qilmaydigan do‘kon', isErr(closed, 'DOKON_YOPIQ'), closed.error?.message);
  const closedMenu = await anon.rpc('online_menu', { p_slug: slug });
  check('menyu „accepting: false“ ko‘rsatadi', closedMenu.data?.accepting === false, JSON.stringify(closedMenu.data?.accepting));
  await ownerA.rpc('online_set_shop', { p: { accepting: true, delivery: true } });

  await ownerA.rpc('online_set_shop', { p: { enabled: false } });
  const offMenu = await anon.rpc('online_menu', { p_slug: slug });
  const offSubmit = await submit(anon, { slug, name: 'Aziza', phone: phone('111 22 14'), type: 'pickup', items: [{ product_id: hot, qty: 2 }] });
  check('o‘chirilgan vitrina: menyu yo‘q', offMenu.data === null, JSON.stringify(offMenu.data));
  check('o‘chirilgan vitrina: zakaz qabul qilmaydi', isErr(offSubmit, 'DOKON_TOPILMADI'), offSubmit.error?.message);
  await ownerA.rpc('online_set_shop', { p: { enabled: true } });

  await admin.from('venues').update({ status: 'suspended' }).eq('id', venueA);
  const suspMenu = await anon.rpc('online_menu', { p_slug: slug });
  const suspSubmit = await submit(anon, { slug, name: 'Aziza', phone: phone('111 22 15'), type: 'pickup', items: [{ product_id: hot, qty: 2 }] });
  check('to‘xtatilgan do‘kon: menyu yopiq', suspMenu.data === null, JSON.stringify(suspMenu.data));
  check('to‘xtatilgan do‘kon: zakaz yopiq', isErr(suspSubmit, 'DOKON_YOPIQ'), suspSubmit.error?.message);
  await admin.from('venues').update({ status: 'active' }).eq('id', venueA);

  console.log('8) Telefon ketma-ket urinsa cheklov');
  const spam = [];
  for (let i = 0; i < 6; i += 1) {
    // har bir so'rov yangi client_id bilan — cheklov telefon bo'yicha ishlaydi
    const r = await anon.rpc('online_submit', {
      p: { slug, name: 'Spam', phone: phone('555 66 77'), type: 'pickup', items: [{ product_id: hot, qty: 1 }], client_id: `spam-${stamp}-${i}` },
    });
    spam.push(r.error ? 'TEZ_ORQILA' : 'ok');
  }
  check('4 tadan keyin TEZ_ORQILA', spam.filter((x) => x === 'ok').length === 4 && spam[4] === 'TEZ_ORQILA', spam.join(','));

  console.log('\n' + (failed ? 'XATOLAR BOR.' : 'HAMMASI O‘TDI.'));
} catch (e) {
  failed = true;
  console.error('To‘xtadi:', e.message);
} finally {
  await cleanup();
  console.log('Test ma‘lumotlari o‘chirildi.');
}
process.exit(failed ? 1 : 0);

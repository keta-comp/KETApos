import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Oflayn bosqichi tekshiruvi: client_id orqali takror yuborish bir buyurtma bo'lib qolishi.
// Ishlatish: SUPABASE_SECRET_KEY=sb_secret_... node scripts/smoke-offline.mjs

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
const password = 'Offline-test-2026';
const email = `smoke.offline.${stamp}@proton.me`;
const venueName = `Smoke Oflayn ${stamp}`;
const clientId = crypto.randomUUID();
const createdIds = [];
let venueId = null;
let failed = false;

function check(name, ok, extra = '') {
  console.log(`${ok ? 'O‘TDI ' : 'XATO  '} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed = true;
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const owner = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'smoke-offline-owner' } });
const other = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'smoke-offline-other' } });

async function rpc(sb, fn, args) {
  const res = await sb.rpc(fn, args);
  if (res.error) throw new Error(`${fn}: ${res.error.message}`);
  return res.data;
}

try {
  console.log('0) Akkaunt va do‘kon');
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (!users.error) {
    for (const u of users.data.users.filter((x) => String(x.email).startsWith('smoke.'))) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }
  await admin.from('venues').delete().like('name', 'Smoke Oflayn %');

  const made = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (made.error) throw new Error(`createUser: ${made.error.message}`);
  createdIds.push(made.data.id || made.data.user.id);
  const signed = await owner.auth.signInWithPassword({ email, password });
  if (signed.error) throw new Error(`login: ${signed.error.message}`);
  const otherSigned = await other.auth.signInWithPassword({ email, password });
  if (otherSigned.error) throw new Error(`login (2): ${otherSigned.error.message}`);

  venueId = await rpc(owner, 'register_venue', {
    p_name: venueName, p_kind: 'fastfood', p_phone: '+998 90 000 00 00',
    p_address: 'Sinov', p_owner_name: 'Oflayn Sinov',
  });
  const products = await rpc(owner, 'pos_products', { p_active_only: true });
  const productId = products[0]?.id;
  check('do‘kon yaratildi, menyu bor', Boolean(venueId && productId), '');

  const basket = {
    type: 'takeaway',
    items: [{ product_id: productId, name: products[0].name, price: products[0].price, qty: 2 }],
    send_to_kitchen: true,
  };

  console.log('1) Bitta client_id — ikki marta yuborilsa ham bitta buyurtma');
  const first = await rpc(owner, 'create_order', { p: { ...basket, client_id: clientId } });
  check('birinchi yuborish buyurtma ochdi', Boolean(first?.id && first?.number), JSON.stringify({ id: first?.id, number: first?.number }));

  const again = await rpc(other, 'create_order', { p: { ...basket, client_id: clientId } });
  check('takror yuborish xato bermadi', Boolean(again?.id), JSON.stringify(again));
  check('takror yuborish shu buyurtmani qaytardi', String(again?.id) === String(first.id), JSON.stringify({ first: first.id, again: again?.id }));
  check('raqam ham bir xil (yangi raqam olinmadi)', again?.number === first.number, JSON.stringify({ first: first.number, again: again?.number }));

  const list = await rpc(owner, 'pos_orders', { p_limit: 50 });
  const rows = list.filter((o) => String(o.id) === String(first.id));
  check('bazada bitta qator', rows.length === 1, JSON.stringify({ count: rows.length }));
  check('takror buyurtma tug‘ilmadi (jami 1 ta)', list.length === 1, JSON.stringify(list.map((o) => o.number)));

  const clientIds = await admin.from('orders').select('id, client_id').eq('venue_id', venueId);
  check('client_id saqlandi', !clientIds.error && clientIds.data?.[0]?.client_id === clientId, JSON.stringify(clientIds.error || clientIds.data));

  console.log('2) Navbat davom etadi: to‘lov bir marta, takrori shu holatni qaytaradi');
  const paid = await rpc(owner, 'pay_order', { p_id: first.id, p_method: 'cash', p_received: 100000 });
  check('to‘lov qabul qilindi', paid?.status === 'paid', JSON.stringify(paid?.status));
  const againPaid = await rpc(owner, 'create_order', { p: { ...basket, client_id: clientId } });
  check('to‘lovdan keyingi takror ham shu buyurtma', String(againPaid?.id) === String(first.id) && againPaid?.status === 'paid', JSON.stringify({ status: againPaid?.status, id: againPaid?.id }));

  console.log('3) client_idsiz (eski mijozlar) ishlaydi, har yuborish — yangi buyurtma');
  const legacy1 = await rpc(owner, 'create_order', { p: basket });
  const legacy2 = await rpc(owner, 'create_order', { p: basket });
  check('client_idsiz ikki buyurtma — ikki xil id', Boolean(legacy1?.id && legacy2?.id) && legacy1.id !== legacy2.id, JSON.stringify({ a: legacy1?.id, b: legacy2?.id }));

  console.log('4) Oflaynda ochilgan vaqt saqlanadi (kechikkan yuborish hisobga ta’sir qilmasin)');
  const localStamp = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  const ago = new Date(Date.now() - 3 * 3600 * 1000);
  const back = await rpc(owner, 'create_order', { p: { ...basket, client_id: crypto.randomUUID(), created_at: localStamp(ago) } });
  const backRow = await admin.from('orders').select('created_at').eq('id', back.id).single();
  const drift = Math.abs(new Date(backRow.data.created_at) - ago) / 60000;
  check('created_at bilan yuborilganda o‘z vaqti qoldi', drift < 2, JSON.stringify({ requested: localStamp(ago), stored: backRow.data.created_at, minutes: Math.round(drift) }));

  const bogus = await rpc(owner, 'create_order', { p: { ...basket, client_id: crypto.randomUUID(), created_at: '1999-01-01 10:00:00' } });
  const bogusRow = await admin.from('orders').select('created_at').eq('id', bogus.id).single();
  check('juda eski sana rad etildi (hozirgi vaqt qo‘yildi)', String(bogusRow.data.created_at).slice(0, 4) === String(new Date().getFullYear()), JSON.stringify(bogusRow.data.created_at));

  console.log('5) Boshqa do‘konda shu client_id — boshqa buyurtma (venue bo‘yicha unikal)');
  const email2 = `smoke.offline2.${stamp}@proton.me`;
  const made2 = await admin.auth.admin.createUser({ email: email2, password, email_confirm: true });
  if (made2.error) throw new Error(`createUser(2): ${made2.error.message}`);
  createdIds.push(made2.data.id || made2.data.user.id);
  const owner2 = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'smoke-offline-owner2' } });
  const signed2 = await owner2.auth.signInWithPassword({ email: email2, password });
  if (signed2.error) throw new Error(`login(2): ${signed2.error.message}`);
  const secondVenue = await rpc(owner2, 'register_venue', {
    p_name: `${venueName} 2`, p_kind: 'cafe', p_phone: '+998 90 000 00 00',
    p_address: 'Sinov', p_owner_name: 'Oflayn Sinov 2',
  });
  const cross = await rpc(owner2, 'create_order', { p: { ...basket, client_id: clientId } });
  check('ikkinchi do‘konda alohida buyurtma ochdi', Boolean(cross?.id) && String(cross.id) !== String(first.id), JSON.stringify({ cross: cross?.id, first: first.id }));
  const firstVenueRows = await admin.from('orders').select('id').eq('venue_id', venueId).eq('client_id', clientId);
  check('birinchi do‘konda hali bitta qator', !firstVenueRows.error && firstVenueRows.data?.length === 1, JSON.stringify(firstVenueRows.error || firstVenueRows.data));
  await admin.from('venues').delete().eq('id', secondVenue);
} catch (e) {
  check('kutilmagan xato', false, e.message);
} finally {
  console.log('6) Tozalash');
  for (const id of createdIds) await admin.auth.admin.deleteUser(id);
  await admin.from('venues').delete().like('name', 'Smoke Oflayn %');
  const left = await admin.from('orders').select('id').eq('venue_id', venueId);
  check('sinov ma’lumotlari qolmadi', !left.error && left.data?.length === 0, JSON.stringify(left.error || left.data));
  process.exit(failed ? 1 : 0);
}

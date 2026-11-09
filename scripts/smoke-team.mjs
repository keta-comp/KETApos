import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Jamoa bosqichi tekshiruvi: rollar bo'yicha ruxsat, xodimlar boshqaruvi va Realtime.
// Ishlatish: SUPABASE_SECRET_KEY=sb_secret_... node scripts/smoke-team.mjs

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
  owner: `smoke.owner.${stamp}@proton.me`,
  waiter: `smoke.waiter.${stamp}@proton.me`,
  cashier: `smoke.cashier.${stamp}@proton.me`,
  cook: `smoke.cook.${stamp}@proton.me`,
};
const venueName = `Smoke Jamoa ${stamp}`;
const createdIds = [];
const channels = [];
let failed = false;

function check(name, ok, extra = '') {
  console.log(`${ok ? 'O‘TDI ' : 'XATO  '} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed = true;
}
const isErr = (res, code) => Boolean(res.error) && String(res.error.message).includes(code);

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const clients = [];

function client() {
  const c = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `smoke-${clients.length}-${Math.random()}` },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  clients.push(c);
  return c;
}

async function makeUser(email) {
  const res = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (res.error) throw new Error(`createUser(${email}): ${res.error.message}`);
  const uid = res.data.id || res.data.user.id;
  createdIds.push(uid);
  return uid;
}

async function login(email) {
  const sb = client();
  const res = await sb.auth.signInWithPassword({ email, password });
  if (res.error) throw new Error(`login ${email}: ${res.error.message}`);
  return sb;
}

async function cleanOldRuns() {
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) return;
  for (const u of users.data.users.filter((x) => String(x.email).startsWith('smoke.'))) {
    await admin.auth.admin.deleteUser(u.id);
  }
  await admin.from('venues').delete().like('name', 'Smoke Jamoa %');
}

let venueId = null;

try {
  console.log('0) Test akkauntlari');
  await cleanOldRuns();
  await makeUser(emails.owner);
  await makeUser(emails.waiter);
  await makeUser(emails.cashier);
  await makeUser(emails.cook);
  const owner = await login(emails.owner);
  check('4 akkaunt yaratildi va egasi kirdi', true);

  console.log('1) register_venue + ism saqlanadi');
  const reg = await owner.rpc('register_venue', {
    p_name: venueName, p_kind: 'fastfood', p_phone: '+998 90 000 00 00',
    p_address: 'Sinov', p_owner_name: 'Ega Sinovchi',
  });
  venueId = reg.data;
  check('register_venue (5 argument)', !reg.error && Boolean(reg.data), reg.error?.message || '');
  const staff0 = await owner.rpc('pos_staff');
  check('pos_staff: egasi o‘z ismini ko‘radi', !staff0.error && staff0.data?.[0]?.display_name === 'Ega Sinovchi', JSON.stringify(staff0.error || staff0.data));

  console.log('2) Taklif kodlari va xodimlar qo‘shilishi');
  const codes = {};
  for (const role of ['waiter', 'cashier', 'kitchen']) {
    const inv = await owner.rpc('issue_invite', { p_role: role });
    codes[role] = inv.data;
    check(`issue_invite ${role}`, !inv.error && /^[A-F0-9]{6,12}$/.test(inv.data || ''), inv.error?.message || inv.data);
  }
  const waiter = await login(emails.waiter);
  const cashier = await login(emails.cashier);
  const cook = await login(emails.cook);
  const j1 = await waiter.rpc('redeem_invite', { p_code: codes.waiter, p_name: 'Ofitsant Sinov' });
  const j2 = await cashier.rpc('redeem_invite', { p_code: codes.cashier, p_name: 'Kassir Sinov' });
  const j3 = await cook.rpc('redeem_invite', { p_code: codes.kitchen, p_name: 'Oshpaz Sinov' });
  check('ofitsant qo‘shildi', !j1.error && j1.data === 'waiter', j1.error?.message || j1.data);
  check('kassir qo‘shildi', !j2.error && j2.data === 'cashier', j2.error?.message || j2.data);
  check('oshpaz qo‘shildi', !j3.error && j3.data === 'kitchen', j3.error?.message || j3.data);

  const staffList = await owner.rpc('pos_staff');
  check('pos_staff: 4 kishi, rollar to‘g‘ri', staffList.data?.length === 4 && staffList.data.some((s) => s.role === 'owner') && staffList.data.filter((s) => s.is_self).length === 1, JSON.stringify(staffList.error || staffList.data?.map((s) => `${s.role}:${s.display_name}`)));
  const invites = await owner.rpc('pos_invites');
  check('pos_invites: 3 kod ishlatilgan', !invites.error && invites.data?.length === 3 && invites.data.every((i) => i.used_by), JSON.stringify(invites.error || invites.data?.[0]));
  const waiterStaff = await waiter.rpc('pos_staff');
  check('ofitsant pos_staff ola olmaydi', waiterStaff.data?.length === 0 || isErr(waiterStaff, 'RUXSAT'), JSON.stringify(waiterStaff.error || waiterStaff.data));

  console.log('3) Rollar bo‘yicha ruxsat (baza darajasida)');
  const products = await owner.rpc('pos_products', { p_active_only: true });
  const productId = products.data?.[0]?.id;
  check('menyu yuklandi', Boolean(productId), products.error?.message || '');

  const cookAdd = await cook.rpc('add_product', { p: { name: 'Cook product', price: 1000 } });
  check('oshpaz mahsulot qo‘sha olmaydi', isErr(cookAdd, 'RUXSAT_YOQ'), cookAdd.error?.message || 'QABUL QILDI!');
  const waiterCat = await waiter.rpc('add_category', { p: { name: 'Waiter kategoriya' } });
  check('ofitsant kategoriya qo‘sha olmaydi', isErr(waiterCat, 'RUXSAT_YOQ'), waiterCat.error?.message || 'QABUL QILDI!');
  const cashExpense = await cashier.rpc('add_expense', { p: { title: 'x', amount: 100, category: 'Boshqa' } });
  check('kassir xarajat qo‘sha olmaydi', isErr(cashExpense, 'RUXSAT_YOQ'), cashExpense.error?.message || 'QABUL QILDI!');
  const bypass = await cook.rpc('_add_product', { p: { name: 'bypass', price: 1 } });
  check('ichki _add_product to‘g‘ridan-to‘g‘ri yopiq', Boolean(bypass.error), bypass.error?.message || 'OCHIB QOLDI!');

  console.log('4) Buyurtma oqimi: ofitsant ochadi, kassir yopadi');
  const created = await waiter.rpc('create_order', {
    p: { type: 'takeaway', items: [{ product_id: productId, name: 'Sinov', price: 1000, qty: 2 }], send_to_kitchen: true },
  });
  check('ofitsant create_order', !created.error && Boolean(created.data?.id), created.error?.message || '');
  const orderId = created.data?.id;

  const openOrders = await owner.rpc('pos_open_orders');
  const mine = openOrders.data?.find((o) => o.id === orderId);
  check('buyurtmada ofitsant nomi ko‘rinadi', mine?.staff_name === 'Ofitsant Sinov', JSON.stringify(mine && { staff_name: mine.staff_name, number: mine.number }));

  const cookPay = await cook.rpc('pay_order', { p_id: orderId, p_method: 'cash', p_received: 5000 });
  check('oshpaz to‘lay olmaydi', isErr(cookPay, 'RUXSAT_YOQ'), cookPay.error?.message || 'QABUL QILDI!');
  const waiterPay = await waiter.rpc('pay_order', { p_id: orderId, p_method: 'cash', p_received: 5000 });
  check('ofitsant to‘lay olmaydi (faqat kassir)', isErr(waiterPay, 'RUXSAT_YOQ'), waiterPay.error?.message || 'QABUL QILDI!');

  const second = await cashier.rpc('create_order', {
    p: { type: 'takeaway', items: [{ product_id: productId, name: 'Sinov', price: 1000, qty: 1 }] },
  });
  check('kassir create_order', !second.error, second.error?.message || '');
  const paid = await cashier.rpc('pay_order', { p_id: second.data?.id, p_method: 'cash', p_received: 5000 });
  check('kassir pay_order', !paid.error, paid.error?.message || '');
  const cookStatus = await cook.rpc('set_kitchen_status', { p_id: orderId, p_status: 'cooking' });
  check('oshpaz tayyorlash holatini o‘zgartiraadi', !cookStatus.error, cookStatus.error?.message || '');
  const cashStatus = await cashier.rpc('set_kitchen_status', { p_id: orderId, p_status: 'ready' });
  check('kassir oshxona holatini o‘zgartira olmaydi', isErr(cashStatus, 'RUXSAT_YOQ'), cashStatus.error?.message || 'QABUL QILDI!');

  console.log('5) Xodimlarni boshqarish');
  const cookRow = staffList.data?.find((s) => s.role === 'kitchen');
  const rename = await owner.rpc('update_staff', { p_id: cookRow.id, p: { role: 'cashier', display_name: 'Oshpaz→Kassir' } });
  check('rol va ism o‘zgardi', !rename.error, rename.error?.message || '');
  const afterRename = await owner.rpc('pos_staff');
  check('yangi rol ro‘yxatda', afterRename.data?.some((s) => s.id === cookRow.id && s.role === 'cashier'), JSON.stringify(afterRename.error || ''));
  const ownerRow = staffList.data?.find((s) => s.role === 'owner');
  const touchOwner = await owner.rpc('update_staff', { p_id: ownerRow.id, p: { role: 'waiter' } });
  check('egani o‘zgartirib bo‘lmaydi', isErr(touchOwner, 'EGA_NOTOGRIDAN'), touchOwner.error?.message || 'QABUL QILDI!');
  const removeWaiter = await owner.rpc('remove_staff', { p_id: staffList.data?.find((s) => s.role === 'waiter')?.id });
  check('xodim o‘chirildi', !removeWaiter.error, removeWaiter.error?.message || '');
  const afterRemove = await owner.rpc('pos_staff');
  check('ro‘yxat 3 kishiga qaytdi', afterRemove.data?.length === 3, JSON.stringify(afterRemove.data?.map((s) => s.role)));
  const removeOwner = await owner.rpc('remove_staff', { p_id: ownerRow.id });
  check('ega o‘chirilmaydi', isErr(removeOwner, 'EGA_NOTOGRIDAN'), removeOwner.error?.message || 'QABUL QILDI!');
  const setMy = await cashier.rpc('set_my_name', { p_name: 'Kassir Yangi Ism' });
  const afterName = await cashier.from('staff').select('display_name').eq('user_id', (await cashier.auth.getUser()).data.user.id).maybeSingle();
  check('o‘z ismini o‘zi yozdi', !setMy.error && afterName.data?.display_name === 'Kassir Yangi Ism', JSON.stringify(setMy.error || afterName.data));
  const newCode = await owner.rpc('issue_invite', { p_role: 'kitchen' });
  const revoke = await owner.rpc('revoke_invite', { p_id: (await owner.rpc('pos_invites')).data.find((i) => i.code === newCode.data)?.id });
  const afterRevoke = await owner.rpc('pos_invites');
  check('kod bekor qilindi', !revoke.error && !afterRevoke.data.some((i) => i.code === newCode.data), JSON.stringify(revoke.error || afterRevoke.data?.length));

  // 7-bosqich (xafsizlik): kod muddati va urinishlar limiti.
  const lateCode = await owner.rpc('issue_invite', { p_role: 'waiter' });
  await admin.from('invite_codes').update({ expires_at: new Date(Date.now() - 3600e3).toISOString() }).eq('code', lateCode.data);
  const lateEmail = `smoke.late.${stamp}@proton.me`;
  await makeUser(lateEmail);
  const late = await login(lateEmail);
  const expired = await late.rpc('redeem_invite', { p_code: lateCode.data, p_name: 'Kechikkan' });
  check('muddati tugagan kod rad etildi', isErr(expired, 'KOD_TUGADI'), expired.error?.message || 'QABUL QILDI!');

  // Noto'g'ri kod endi xato ko'tarmaydi (qiymat qaytaradi) — shuning uchun
  // hisoblagich tranzaksiyada saqlanadi va 15 urinishdan so'ng KO_P_URILDI chiqadi.
  let throttled = false;
  const trace = [];
  for (let i = 0; i < 17 && !throttled; i += 1) {
    const bad = await late.rpc('redeem_invite', { p_code: 'BADC0DE12AB', p_name: 'X' });
    trace.push(String(bad.error?.message || bad.data));
    if (isErr(bad, 'KO_P_URILDI')) throttled = true;
  }
  check('15 xato urinishdan so‘ng kod kiritish to‘xtadi', throttled, trace[trace.length - 1] || 'limit ishlamadi');

  console.log('6) Realtime: bir qurilmadagi yozuv boshqasiga yetib boradi');
  const events = [];
  const statuses = [];
  const ch = cashier.channel(`smoke-live-${stamp}`, { config: { broadcast: { self: false }, presence: { key: 'kassir' } } });
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `venue_id=eq.${venueId}` }, (p) => events.push(p));
  const subscribed = await new Promise((resolve) => {
    ch.subscribe((status) => {
      statuses.push(status);
      if (status === 'SUBSCRIBED') resolve(status);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve(status);
    });
    setTimeout(() => resolve(`timeout (${statuses.join('>')})`), 15000);
  });
  channels.push(ch);
  check('realtime kanaliga ulanish', subscribed === 'SUBSCRIBED', String(subscribed));

  const live = await owner.rpc('create_order', {
    p: { type: 'delivery', items: [{ product_id: productId, name: 'Jonli', price: 1500, qty: 1 }] },
  });
  check('egasi yangi buyurtma ochdi', !live.error, live.error?.message || '');
  const deadline = Date.now() + 12000;
  while (events.length === 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
  }
  check('kassir realtime event oldi', events.some((e) => String(e.new?.id) === String(live.data?.id)), JSON.stringify({ events: events.map((e) => `${e.eventType}:${e.new?.number}`), statuses }));
  check('event faqat shu do‘kondan keladi', events.length > 0 && events.every((e) => String(e.new?.venue_id) === String(venueId)), JSON.stringify(events.map((e) => e.new?.venue_id)));

  const presence = await new Promise((resolve) => {
    ch.track({ name: 'Kassir Sinov' }).then(() => {
      const t = setTimeout(() => resolve(ch.presenceState()), 2500);
      const wait = setInterval(() => {
        if (Object.keys(ch.presenceState()).length > 0) { clearTimeout(t); clearInterval(wait); resolve(ch.presenceState()); }
      }, 200);
    });
  });
  check('presence: qatnashchi ko‘rinadi', Object.keys(presence || {}).length > 0, JSON.stringify(Object.values(presence || {}).flat()[0] || ''));
} catch (e) {
  check('kutilmagan xato', false, e.message);
} finally {
  console.log('7) Tozalash');
  for (const id of createdIds) await admin.auth.admin.deleteUser(id);
  await admin.from('venues').delete().eq('id', venueId);
  await admin.from('venues').delete().like('name', 'Smoke Jamoa %');
  const left = await admin.from('staff').select('id').eq('venue_id', venueId);
  check('sinov ma’lumotlari qolmadi', !left.error && left.data?.length === 0, JSON.stringify(left.error || left.data));
  process.exit(failed ? 1 : 0);
}

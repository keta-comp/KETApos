import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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
const emails = {
  owner: `smoke.owner.${stamp}@proton.me`,
  waiter: `smoke.waiter.${stamp}@proton.me`,
  stranger: `smoke.stranger.${stamp}@proton.me`,
  reuse: `smoke.reuse.${stamp}@proton.me`,
};
const createdIds = [];
let failed = false;

function check(name, ok, extra = '') {
  console.log(`${ok ? 'O‘TDI ' : 'XATO  '} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed = true;
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const clients = [];

function client() {
  const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: `smoke-${clients.length}-${Math.random()}` } });
  clients.push(c);
  return c;
}

async function makeUser(email) {
  const res = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (res.error) throw new Error(`createUser(${email}): ${res.error.message}`);
  const uid = res.data?.id ?? res.data?.user?.id;
  if (typeof uid !== 'string') throw new Error(`createUser(${email}) UUID qaytarmadi: ${JSON.stringify(res.data)}`);
  createdIds.push(uid);
  return uid;
}

async function cleanOldRuns() {
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) return check('eski sinovlarni topish', false, users.error.message);
  for (const u of users.data.users.filter((x) => String(x.email).startsWith('smoke.'))) {
    await admin.auth.admin.deleteUser(u.id);
  }
  await admin.from('venues').delete().like('name', 'Smoke Kafe %');
}

async function login(email) {
  const sb = client();
  const res = await sb.auth.signInWithPassword({ email, password });
  check(`signInWithPassword ${email.split('@')[0]}`, !res.error && Boolean(res.data.session), res.error?.message || '');
  if (res.error) throw new Error('login failed');
  return sb;
}

const venueName = `Smoke Kafe ${stamp}`;
let venueId = null;

try {
  console.log('0) Admin API bilan tasdiqlangan test akkauntlar');
  await cleanOldRuns();
  await makeUser(emails.owner);
  await makeUser(emails.waiter);
  await makeUser(emails.stranger);
  await makeUser(emails.reuse);
  check('admin API ishlaydi', true);

  const owner = await login(emails.owner);

  console.log('1) register_venue (fastfood)');
  const reg = await owner.rpc('register_venue', {
    p_name: venueName,
    p_kind: 'fastfood',
    p_phone: '+998 90 000 00 00',
    p_address: 'Test manzil',
  });
  check('register_venue xatosiz', !reg.error, reg.error?.message || '');

  console.log('2) A‘zolika so‘rovi (RLS)');
  const me = await owner.from('staff')
    .select('role, venue_id, venues(id, name, kind)')
    .eq('user_id', (await owner.auth.getUser()).data.user.id)
    .maybeSingle();
  check('staff → owner', !me.error && me.data?.role === 'owner', JSON.stringify(me.error || me.data));
  check('venues → fastfood', me.data?.venues?.kind === 'fastfood' && me.data?.venues?.name === venueName, JSON.stringify(me.data?.venues));
  const id = me.data?.venue_id;
  venueId = id;

  console.log('3) issue_invite(waiter)');
  const invite = await owner.rpc('issue_invite', { p_role: 'waiter' });
  check('12 belgili kod chiqdi', !invite.error && /^[A-F0-9]{12}$/.test(invite.data || ''), invite.error?.message || invite.data);

  console.log('4) Ofitsant kodni ishlatadi');
  const waiter = await login(emails.waiter);
  const joined = await waiter.rpc('redeem_invite', { p_code: invite.data });
  check('redeem_invite → waiter', !joined.error && joined.data === 'waiter', joined.error?.message || joined.data);

  console.log('5) Ishlatilgan kod boshqaga yaramaydi');
  const reuseUser = await login(emails.reuse);
  const reused = await reuseUser.rpc('redeem_invite', { p_code: invite.data });
  const rejected = (r, code) => (Boolean(r.error) && String(r.error.message).includes(code)) || r.data === code;
  check('takroriy kod rad', rejected(reused, 'KOD_NOTOGRI'), reused.error?.message || String(reused.data));

  console.log('6) Menfiy tekshiruvlar va RLS');
  const stranger = await login(emails.stranger);
  const badKind = await stranger.rpc('register_venue', { p_name: `Bad ${stamp}`, p_kind: 'restoran', p_phone: '', p_address: '' });
  check('noto‘g‘ri kind rad etildi', Boolean(badKind.error) && badKind.error.message.includes('DOKON_TURI_NOTOGRI'), badKind.error?.message || 'QABUL QILDI!');
  const noName = await stranger.rpc('register_venue', { p_name: '   ', p_kind: 'cafe' });
  check('bo‘sh nom rad etildi', Boolean(noName.error) && noName.error.message.includes('NOM_KERTILMADI'), noName.error?.message || 'QABUL QILDI!');
  const strangerVenues = await stranger.from('venues').select('id').eq('id', venueId);
  check('aksiz foydalanuvchi do‘konni ko‘rmaydi', strangerVenues.data?.length === 0, JSON.stringify(strangerVenues.data));
  const waiterInvite = await waiter.rpc('issue_invite', { p_role: 'kitchen' });
  check('ofitsant kod chiqa olmaydi', Boolean(waiterInvite.error), waiterInvite.error?.message || 'RUXSAT BERDI!');
  const staffList = await owner.from('staff').select('role').eq('venue_id', venueId);
  check('egasi 2 xodimni ko‘radi', !staffList.error && staffList.data?.length === 2, JSON.stringify(staffList.error || staffList.data));
  const badCode = await stranger.rpc('redeem_invite', { p_code: 'ZZZZZZ' });
  check('noto‘g‘ri kod rad (KOD_NOTOGRI / AVVAL_KIRING)', Boolean(badCode.error) || rejected(badCode, 'KOD_NOTOGRI'), badCode.error?.message || String(badCode.data));

  console.log('7) Xodimning o‘z ko‘rinishi');
  const curRole = await waiter.from('staff').select('id').limit(1);
  check('ofitsant o‘z qatorini ko‘radi', !curRole.error && curRole.data?.length === 1, JSON.stringify(curRole.error || curRole.data));
} catch (e) {
  check('kutilmagan xato', false, e.message);
} finally {
  console.log('8) Tozalash');
  for (const id of createdIds) {
    const del = await admin.auth.admin.deleteUser(id);
    check(`user ${id.slice(0, 8)} o‘chirildi`, !del.error, del.error?.message || '');
  }
  const dropVenues = await admin.from('venues').delete().in('name', [venueName, `Bad ${stamp}`]);
  check('sinov do‘konlari o‘chirildi', !dropVenues.error, JSON.stringify(dropVenues.error || ''));
  const leftovers = await admin.from('venues').select('id, name').in('name', [venueName, `Bad ${stamp}`]);
  check('sinov do‘koni qolmadi', !leftovers.error && leftovers.data?.length === 0, JSON.stringify(leftovers.error || leftovers.data));
  const orphanStaff = await admin.from('staff').select('user_id').eq('venue_id', venueId);
  check('xodim qatorlari cascade bilan o‘chdi', orphanStaff.data?.length === 0, JSON.stringify(orphanStaff.data));
}

process.exit(failed ? 1 : 0);

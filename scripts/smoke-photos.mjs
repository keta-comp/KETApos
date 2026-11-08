import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

// Mahsulot rasmlari uchun uchdan-uchga sinov (Supabase Storage + RLS + set_product_photo).
// Ishga tushirish: SUPABASE_SECRET_KEY=sb_secret_... npm run smoke:photos
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

const BUCKET = 'product-images';
const stamp = Date.now();
const password = 'Smoke-test-2026';
const venueName = `Smoke Rasm ${stamp}`;
const otherName = `Smoke Rasm Boshqa ${stamp}`;
const emails = {
  owner: `smoke.owner.${stamp}@proton.me`,
  other: `smoke.other.${stamp}@proton.me`,
  stranger: `smoke.stranger.${stamp}@proton.me`,
};
const createdIds = [];
const venueNames = [venueName, otherName];
const paths = [];
let checks = 0;
let failed = 0;

function check(name, ok, extra = '') {
  checks++;
  if (!ok) failed++;
  console.log(`${ok ? 'O‘TDI ' : 'XATO  '} ${name}${extra ? ' — ' + extra : ''}`);
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

function anon() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: `smokephoto-${Math.random()}` } });
}

async function makeUser(email) {
  const res = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (res.error) throw new Error(`createUser(${email}): ${res.error.message}`);
  const uid = res.data?.id ?? res.data?.user?.id;
  if (typeof uid !== 'string') throw new Error(`createUser(${email}) UUID qaytarmadi`);
  createdIds.push(uid);
}

async function login(email) {
  const sb = anon();
  const res = await sb.auth.signInWithPassword({ email, password });
  if (res.error) throw new Error(`login ${email}: ${res.error.message}`);
  return sb;
}

async function rpc(sb, fn, args) {
  const res = await sb.rpc(fn, args);
  if (res.error) throw new Error(`${fn}: ${res.error.message}`);
  return res.data;
}

async function rpcErr(sb, fn, args, expect, label) {
  const res = await sb.rpc(fn, args);
  check(`${label || fn} rad etildi (${expect})`, Boolean(res.error) && String(res.error.message).includes(expect), res.error?.message || 'QABUL QILDI!');
}

async function upload(sb, path, body) {
  const res = await sb.storage.from(BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (res.data) paths.push(path);
  return res;
}

async function publicStatus(path) {
  return (await fetch(`${url}/storage/v1/object/public/${BUCKET}/${path}`)).status;
}

// CDN birinchi so'rovda hali 404 qaytarishi mumkin — qisqa vaqt kutamiz.
async function publicReady(path) {
  for (let i = 0; i < 8; i++) {
    if ((await publicStatus(path)) === 200) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function cleanOldRuns() {
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw new Error(users.error.message);
  for (const u of users.data.users.filter((x) => String(x.email).startsWith('smoke.'))) {
    await admin.auth.admin.deleteUser(u.id);
  }
  await admin.from('venues').delete().like('name', 'Smoke Rasm %');
  await purgeOrphanFolders();
}

// O'chirilgan do'konlarning rasm papkalarini tozalaydi (service_role RLS'dan ustun).
async function purgeOrphanFolders() {
  const top = await admin.storage.from(BUCKET).list();
  if (top.error) return;
  for (const folder of (top.data || []).filter((f) => !f.id)) {
    const live = await admin.from('venues').select('id').eq('id', folder.name).maybeSingle();
    if (live.data) continue;
    const objs = await admin.storage.from(BUCKET).list(folder.name);
    if (objs.data?.length) {
      await admin.storage.from(BUCKET).remove(objs.data.map((o) => `${folder.name}/${o.name}`));
    }
  }
}

let sb;
let venueId;

try {
  console.log('0) Test akkauntlar');
  await cleanOldRuns();
  for (const email of Object.values(emails)) await makeUser(email);
  sb = await login(emails.owner);
  await rpc(sb, 'register_venue', { p_name: venueName, p_kind: 'fastfood' });
  const me = await sb.from('staff').select('venue_id').eq('user_id', (await sb.auth.getUser()).data.user.id).maybeSingle();
  if (me.error) throw new Error(`staff so‘rovi: ${me.error.message}`);
  venueId = me.data.venue_id;
  check('owner do‘koni tayyor', Boolean(venueId), venueId);

  console.log('1) Kategoriya + mahsulot');
  const cat = await rpc(sb, 'add_category', { p: { name: `Smoke Rasm ${stamp}`, emoji: '🍔', color: '#f97316' } });
  const prod = await rpc(sb, 'add_product', { p: { category_id: cat.id, name: 'Smoke Burger', price: 15000 } });
  check('mahsulot qo‘shildi', Boolean(prod?.id), prod?.id);

  console.log('2) Rasm yuklash (o‘z do‘kon papkasiga)');
  const jpeg = await sharp({ create: { width: 900, height: 1600, channels: 3, background: { r: 220, g: 120, b: 40 } } }).jpeg().toBuffer();
  const ownPath = `${venueId}/${prod.id}.jpg`;
  const up = await upload(sb, ownPath, jpeg);
  check('bucketga yuklandi', !up.error && up.data?.path === ownPath, up.error?.message || '');
  await rpc(sb, 'set_product_photo', { p_product: prod.id, p_path: ownPath });
  const listed = (await rpc(sb, 'pos_products', {})).find((p) => p.id === prod.id);
  check('pos_products photo_path qaytardi', listed?.photo_path === ownPath, listed?.photo_path);
  check('public URL ochiladi', await publicReady(ownPath));

  console.log('3) Rasmni almashtirish va tozalash');
  await upload(sb, ownPath, jpeg);
  check('upsert bilan almashtirildi', (await publicStatus(ownPath)) === 200);
  await rpc(sb, 'set_product_photo', { p_product: prod.id, p_path: null });
  check('photo_path ochildi', (await rpc(sb, 'pos_products', {})).find((p) => p.id === prod.id)?.photo_path === null);
  const rm = await sb.storage.from(BUCKET).remove([ownPath]);
  check('fayl o‘chirildi', !rm.error && rm.data?.length === 1, JSON.stringify(rm.error || rm.data));
  paths.splice(paths.indexOf(ownPath), 1);
  const after = await sb.storage.from(BUCKET).list(venueId);
  check('fayl papkada qolmadi', !after.error && !after.data.some((o) => o.name === `${prod.id}.jpg`), JSON.stringify(after.error || after.data));

  console.log('4) Sxema xavfsizligi');
  await rpcErr(sb, 'set_product_photo', { p_product: prod.id, p_path: `${venueId.replace(/-/g, '')}x/${prod.id}.jpg` }, 'RASM_PAPKASI_NOTOGRI', 'begona papka yo‘li');
  await rpcErr(sb, 'set_product_photo', { p_product: '00000000-0000-0000-0000-000000000000', p_path: ownPath }, 'MAHSULOT_TOPILMADI', 'yo‘q mahsulot');

  console.log('5) Do‘konlararo izolatsiya');
  const other = await login(emails.other);
  await rpc(other, 'register_venue', { p_name: otherName, p_kind: 'cafe' });
  const otherMe = await other.from('staff').select('venue_id').eq('user_id', (await other.auth.getUser()).data.user.id).maybeSingle();
  const otherVenue = otherMe.data.venue_id;
  const stolen = await upload(other, `${venueId}/hack.jpg`, jpeg);
  check('begona papkaga yozish rad etildi', Boolean(stolen.error), stolen.error?.message || 'YUKLANDI!');
  if (!stolen.error) paths.push(`${venueId}/hack.jpg`);
  const otherProd = (await rpc(other, 'pos_products', {}))[0];
  await rpcErr(other, 'set_product_photo', { p_product: otherProd.id, p_path: `${venueId}/${otherProd.id}.jpg` }, 'RASM_PAPKASI_NOTOGRI', 'o‘z papkasidan tashqari');
  const ownOther = `${otherVenue}/${otherProd.id}.jpg`;
  const up2 = await upload(other, ownOther, jpeg);
  check('ikkinchi do‘kon o‘z papkasiga yozadi', !up2.error, up2.error?.message || '');
  const del = await other.storage.from(BUCKET).remove([ownPath]);
  check('qo‘shni faylni o‘chira olmaydi', Boolean(del.error) || del.data?.length === 0, JSON.stringify(del.error || del.data));
  if (!del.error) paths.push(ownPath);
  await other.storage.from(BUCKET).remove([ownOther]);

  console.log('6) Do‘konga ulanmagan va anon');
  const stranger = await login(emails.stranger);
  const strayUp = await upload(stranger, `${venueId}/stray.jpg`, jpeg);
  check('ulanmagan foydalanuvchi yuklay olmaydi', Boolean(strayUp.error), strayUp.error?.message || 'YUKLANDI!');
  if (!strayUp.error) paths.push(`${venueId}/stray.jpg`);
  await rpcErr(stranger, 'set_product_photo', { p_product: prod.id, p_path: ownPath }, 'AVVAL_KIRING', 'ulanmagan RPC');
  const noAuth = anon();
  const anonUp = await noAuth.storage.from(BUCKET).upload(`${venueId}/anon.jpg`, jpeg, { contentType: 'image/jpeg' });
  check('anon yuklash rad etildi', Boolean(anonUp.error), anonUp.error?.message || 'YUKLANDI!');
  if (!anonUp.error) paths.push(`${venueId}/anon.jpg`);
  await rpcErr(noAuth, 'set_product_photo', { p_product: prod.id, p_path: ownPath }, 'permission denied', 'anon RPC');
} catch (e) {
  check('kutilmagan xato', false, e.message);
} finally {
  console.log('7) Tozalash');
  if (sb) {
    for (const p of paths) await sb.storage.from(BUCKET).remove([p]).catch?.(() => {});
  }
  for (const id of createdIds) await admin.auth.admin.deleteUser(id);
  const drop = await admin.from('venues').delete().in('name', venueNames);
  check('do‘konlar o‘chirildi', !drop.error, JSON.stringify(drop.error || ''));
  await purgeOrphanFolders();
  if (venueId) {
    const left = await admin.storage.from(BUCKET).list(venueId);
    check('rasm fayllari qolmadi', !left.error && left.data?.length === 0, JSON.stringify(left.error || left.data));
  }
  console.log(`\n${checks - failed}/${checks} tekshiruv o‘tdi`);
}

process.exit(failed ? 1 : 0);

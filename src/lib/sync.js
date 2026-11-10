// Navbatni serverga yuborish.
//
// Tartib bu yerda muhim: oflaynda ochilgan buyurtma avval create_order orqali
// yuboriladi (client_id bilan — takrorlansa eski buyurtma qaytadi), shundan
// keyingina uning to'lovi/stoli/holati yuboriladi. Shuning uchun navbat
// eng eski yozuvdan boshlab, ketma-ket bajariladi.

import { supabase } from '../supabase/client.js';
import { bumpExternal } from '../supabase/queries.js';
import {
  isNetworkError, isOffline, queueDelete, queueMine, queuePut,
  rememberId, reportNetworkFailure, reportOnline, serverId, shotDrop,
} from './offline.js';
import { t } from './i18n.js';

const CALL = {
  create: (rec) => ['create_order', { p: { ...rec.args.p, client_id: rec.local } }],
  update: (rec, id) => ['update_order', { p_id: id, p: rec.args.p }],
  kitchen: (rec, id) => ['send_to_kitchen', { p_id: id }],
  pay: (rec, id) => ['pay_order', { p_id: id, p_method: rec.args.method, p_received: rec.args.received }],
  cancel: (rec, id) => ['cancel_order', { p_id: id }],
  kstatus: (rec, id) => ['set_kitchen_status', { p_id: id, p_status: rec.args.status }],
};

// Biznes xatosi "allaqachon bajarilgan" degan ma'noni beradimi — masalan,
// so'rov serverga yetib borib, javob bizga qaytmagan bo'lishi mumkin.
async function alreadyDone(rec, id) {
  const { data } = await supabase.rpc('pos_order', { p_id: id });
  const o = data;
  if (!o) return false;
  if (rec.kind === 'pay') return o.status === 'paid';
  if (rec.kind === 'cancel') return o.status === 'cancelled';
  if (rec.kind === 'kitchen') return o.kitchen_status !== 'none';
  if (rec.kind === 'kstatus') return o.kitchen_status === rec.args.status;
  return false;
}

async function runOne(rec) {
  const build = CALL[rec.kind];
  if (!build) {
    await markFailed(rec, t('Navbatdagi noma’lum amal'));
    return 'fail';
  }

  let id = null;
  if (rec.kind !== 'create') {
    id = rec.local ? await serverId(rec.local) : rec.order_id;
    if (!id) {
      await markFailed(rec, t('Buyurtma serverga yuborilmagan — avval uni yuborish kerak'));
      return 'fail';
    }
  }

  const [fn, args] = rec.kind === 'create' ? build(rec) : build(rec, id);
  let result;
  try {
    result = await supabase.rpc(fn, args);
  } catch (err) {
    if (isNetworkError(err)) return 'net';
    await markFailed(rec, t(err?.message || String(err)));
    return 'fail';
  }

  if (result.error) {
    if (isNetworkError(result.error)) return 'net';
    if (rec.kind !== 'create' && (await alreadyDone(rec, id))) {
      await finish(rec);
      return 'ok';
    }
    await markFailed(rec, t(result.error.message));
    return 'fail';
  }

  if (rec.kind === 'create' && result.data?.id) await rememberId(rec.local, result.data.id);
  await finish(rec);
  return 'ok';
}

async function markFailed(rec, message) {
  rec.tries = (rec.tries || 0) + 1;
  rec.failed = message;
  rec.failedAt = Date.now();
  await queuePut(rec);
}

async function finish(rec) {
  await queueDelete(rec.seq);
  await shotDrop(rec.local || rec.order_id);
}

let running = false;
const listeners = new Set();

// AppContext navbat tugaganda xabar berishi uchun.
export function onSynced(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function drain({ force = false } = {}) {
  if (running) return null;
  const queue = await queueMine();
  if (!queue.length) return { synced: 0, failed: 0, empty: true };
  if (isOffline() && !force) return null;

  running = true;
  let synced = 0;
  let failed = 0;
  try {
    for (const rec of queue) {
      if (rec.failed && !force) continue;
      const out = await runOne(force ? { ...rec, failed: null } : rec);
      if (out === 'net') {
        reportNetworkFailure();
        break;
      }
      if (out === 'ok') synced += 1;
      else failed += 1;
    }
  } finally {
    running = false;
  }

  if (synced || failed) {
    if (synced) bumpExternal();
    for (const cb of listeners) cb({ synced, failed });
  }
  return { synced, failed };
}

// Internet tiklanganmi — kichik so'rov bilan tekshiramiz (navigator.onLine
// aldashi mumkin: sim-karta uzilganda ham u onlayn bo'lib qoladi).
async function probe() {
  try {
    const { error } = await supabase.rpc('pos_settings');
    if (!error || !isNetworkError(error)) reportOnline();
  } catch { /* internet yo'q — oflayn holatida qolamiz */ }
}

// Internet tiklanishi, ilova o'ngachaga qaytishi va sekin interval — navbatni
// o'zi yuborib boradi. force=true bilan qo'ldan ham ishga tushiriladi.
export function watchSync() {
  let probing = false;
  const kick = () => {
    if (isOffline()) {
      if (probing) return;
      probing = true;
      probe().finally(() => { probing = false; });
      return;
    }
    drain();
  };
  window.addEventListener('online', kick);
  document.addEventListener('visibilitychange', kick);
  const timer = setInterval(kick, 20000);
  kick();
  return () => {
    window.removeEventListener('online', kick);
    document.removeEventListener('visibilitychange', kick);
    clearInterval(timer);
  };
}

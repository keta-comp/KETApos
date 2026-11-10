import { useState } from 'react';
import { WifiOff, RefreshCw, Trash2, CircleCheck, Clock } from 'lucide-react';
import Modal from './Modal.jsx';
import { useApp } from '../state/AppContext.jsx';
import { useData } from '../state/useData.js';
import { fmtSum } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { pendingOrders, queueDelete, shotDrop } from '../lib/offline.js';

const KIND = {
  create: 'Buyurtma ochish',
  update: 'Buyurtmani tahrirlash',
  pay: 'To‘lov',
  cancel: 'Bekor qilish',
  kitchen: 'Oshxonaga yuborish',
  kstatus: 'Tayyorlash holati',
};

// Oflaynda qilingan amallar — internet tiklanganda shu tartibda yuboriladi.
export default function QueueModal({ onClose }) {
  const { offline, queue, syncNow, toast, refresh } = useApp();
  const { data: orders } = useData(() => pendingOrders(), []);
  const [busy, setBusy] = useState(false);

  async function push() {
    setBusy(true);
    try {
      const out = await syncNow();
      if (!out) toast(t('Internet yo‘q — hozir yuborsa bo‘lmaydi'), 'error');
      else if (!out.synced && !out.failed) toast(t('Navbat bo‘sh'), 'info');
    } finally {
      setBusy(false);
    }
  }

  async function drop(rec) {
    if (!window.confirm(t('Bu yozuv navbatdan olib tashlansinmi? U serverga yuborilmaydi.'))) return;
    await queueDelete(rec.seq);
    await shotDrop(rec.local || rec.order_id);
    toast(t('Yozuv navbatdan olib tashlandi'), 'info');
    refresh();
  }

  return (
    <Modal title={t('Navbat — internet tiklanganda yuboriladi')} onClose={onClose} width={520}>
      <div className="queue-head">
        <span className={`queue-state ${offline ? 'off' : ''}`}>
          {offline ? <WifiOff size={16} /> : <CircleCheck size={16} />}
          {offline ? t('Internet yo‘q') : t('Onlayn')}
        </span>
        <span className="queue-sum">
          {t('{n} buyurtma', { n: queue.orders })} · {fmtSum(queue.total)} · {t('{n} amal navbatda', { n: queue.waiting })}
          {queue.failed > 0 && <b className="queue-bad"> · {t('{n} xato', { n: queue.failed })}</b>}
        </span>
      </div>

      {orders?.length > 0 && (
        <div className="queue-orders">
          {orders.map((o) => (
            <div key={o.id} className="queue-order">
              <span className="queue-order-num">№{o.number}</span>
              <span className="queue-order-meta">
                {t('{n} mahsulot', { n: o.items?.length || 0 })} · {o.status === 'paid' ? t('to‘langan') : o.status === 'cancelled' ? t('bekor') : t('ochiq')}
                {o.pending ? ' · ' + t('serverda hali yo‘q') : ''}
              </span>
              <b>{fmtSum(o.total)}</b>
            </div>
          ))}
        </div>
      )}

      {queue.foreign > 0 && (
        <div className="queue-hint">
          {t('Yana {n} ta yozuv boshqa hisobga tegishli — ular o‘sha akkaunt kirganda yuboriladi.', { n: queue.foreign })}
        </div>
      )}

      {queue.records.length > 0 ? (
        <div className="queue-list">
          {queue.records.map((r) => (
            <div key={r.seq} className={`queue-row ${r.failed ? 'bad' : ''}`}>
              <span className="queue-row-kind"><Clock size={14} /> {t(KIND[r.kind] || r.kind)}</span>
              <span className="queue-row-target">№{String(r.order_id).slice(0, 4).toUpperCase()}</span>
              <span className="queue-row-note">{r.failed ? r.failed : t('kutilmoqda')}</span>
              {r.failed && (
                <button className="btn btn-danger-ghost btn-sm" onClick={() => drop(r)} title={t('Navbatdan olib tashlash')}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="queue-empty">{t('Navbat bo‘sh — hammasi serverga ketgan.')}</div>
      )}

      <div className="row mt-2">
        <button className="btn btn-primary" onClick={push} disabled={busy || offline}>
          <RefreshCw size={16} /> {t('Hoziroq yuborish')}
        </button>
        <button className="btn btn-outline" onClick={onClose}>{t('Yopish')}</button>
      </div>
      {offline && <div className="queue-hint">{t('Internet kelishi bilan navbat o‘zi yuboriladi.')}</div>}
    </Modal>
  );
}

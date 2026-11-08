import { useState } from 'react';
import Modal from './Modal.jsx';
import { useApp } from '../state/AppContext.jsx';
import { payOrder } from '../supabase/queries.js';
import { fmtMoney, fmtSum, PAY_METHODS } from '../lib/format.js';
import { printReceipt } from '../lib/receipt.js';

export default function PaymentModal({ order, onClose, onPaid }) {
  const { settings, toast } = useApp();
  const [method, setMethod] = useState('cash');
  const [received, setReceived] = useState('');
  const [busy, setBusy] = useState(false);

  const total = order.total;
  const receivedNum = parseInt(received || '0', 10) || 0;
  const change = receivedNum - total;
  const canPay = method !== 'cash' || receivedNum >= total;

  const quickAmounts = [total, 50000, 100000, 200000, 500000]
    .filter((v, i, arr) => v >= total && arr.indexOf(v) === i)
    .slice(0, 4);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      const paid = await payOrder(order.id, {
        method,
        received: method === 'cash' ? receivedNum : total,
      });
      toast(`Buyurtma №${paid.number} to'landi`);
      onPaid(paid);
      if (settings.auto_print === '1') {
        try {
          await printReceipt(paid, settings);
        } catch {}
      }
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`To'lov — Buyurtma №${order.number}`}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Bekor qilish</button>
          <button className="btn btn-success btn-lg" disabled={!canPay || busy} onClick={confirm}>
            {busy ? '⏳ To\'lanmoqda...' : '✓ To\'lovni tasdiqlash'}
          </button>
        </>
      }
    >
      <div className="pay-total-box">
        <div className="pay-total-label">TO'LOV SUMMASI</div>
        <div className="pay-total-value">{fmtSum(total)}</div>
      </div>

      <div className="pay-methods">
        {Object.entries(PAY_METHODS).map(([key, m]) => (
          <button
            key={key}
            className={`pay-method ${method === key ? 'active' : ''}`}
            onClick={() => setMethod(key)}
          >
            <span className="pm-emoji">{m.emoji}</span>
            {m.label}
          </button>
        ))}
      </div>

      {method === 'cash' && (
        <>
          <div className="field">
            <label className="label">Mijozdan qabul qilindi (so'm)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="1000"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              placeholder={String(total)}
              autoFocus
            />
          </div>
          <div className="cash-quick">
            {quickAmounts.map((v) => (
              <button key={v} className="btn btn-outline btn-sm" onClick={() => setReceived(String(v))}>
                {v === total ? 'Aniq' : fmtMoney(v)}
              </button>
            ))}
          </div>
          <div className={`change-display ${change < 0 ? 'negative' : ''}`}>
            <span>{change < 0 ? 'Yetishmayapti' : 'Qaytim'}</span>
            <span>{fmtSum(Math.abs(change))}</span>
          </div>
        </>
      )}

      {method !== 'cash' && (
        <p className="muted text-center mt-2">
          {method === 'card' ? 'Terminal orqali to\'lovni amalga oshiring' : 'Click / Payme orqali to\'lovni amalga oshiring'}
        </p>
      )}
    </Modal>
  );
}
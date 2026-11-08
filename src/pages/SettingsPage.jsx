import { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { saveSettings, resetDb, getCategories, getProducts, getTables, getOrders, getMovements, getExpenses } from '../db/store.js';
import { query } from '../db/index.js';
import { todayStr } from '../lib/format.js';
import { ConfirmModal } from '../components/Modal.jsx';

export default function SettingsPage() {
  const { settings, toast, navigate } = useApp();
  const [form, setForm] = useState({
    store_name: settings.store_name || '',
    store_address: settings.store_address || '',
    store_phone: settings.store_phone || '',
    receipt_footer: settings.receipt_footer || '',
    auto_print: settings.auto_print === '1',
  });
  const [confirmReset, setConfirmReset] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    if (!form.store_name.trim()) {
      toast('Do\'kon nomini kiriting', 'error');
      return;
    }
    saveSettings({
      store_name: form.store_name.trim(),
      store_address: form.store_address.trim(),
      store_phone: form.store_phone.trim(),
      receipt_footer: form.receipt_footer.trim(),
      auto_print: form.auto_print ? '1' : '0',
    });
    toast('Sozlamalar saqlandi');
  }

  function exportJson() {
    const orders = getOrders({ limit: 100000 }).map((o) => ({
      ...o,
      items: query('SELECT * FROM order_items WHERE order_id=?', [o.id]),
    }));
    const data = {
      exported_at: new Date().toISOString(),
      settings,
      categories: getCategories(),
      products: getProducts(),
      tables: getTables(),
      orders,
      stock_movements: getMovements({ limit: 100000 }),
      expenses: getExpenses('2000-01-01', todayStr()),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Zaxira nusxa yuklandi');
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">⚙️ Sozlamalar</h1>
          <div className="page-sub">Do'kon ma'lumotlari va tizim</div>
        </div>
      </div>

      <div className="page-body">
        <div className="settings-grid">
          <div className="card card-pad">
            <div className="settings-section-title">🏪 Do'kon ma'lumotlari</div>
            <div className="field">
              <label className="label">Do'kon nomi (chekda chiqadi)</label>
              <input className="input" value={form.store_name} onChange={(e) => set('store_name', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Manzil</label>
              <input className="input" value={form.store_address} onChange={(e) => set('store_address', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Telefon</label>
              <input className="input" value={form.store_phone} onChange={(e) => set('store_phone', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Chek pastki matni</label>
              <input className="input" value={form.receipt_footer} onChange={(e) => set('receipt_footer', e.target.value)} />
            </div>
            <label className="check-row mb-2">
              <input type="checkbox" checked={form.auto_print} onChange={(e) => set('auto_print', e.target.checked)} />
              To'lovdan so'ng chekni avtomatik chop etish
            </label>
            <button className="btn btn-primary" onClick={save}>💾 Saqlash</button>
          </div>

          <div className="col">
            <div className="card card-pad">
              <div className="settings-section-title">🗄️ Ma'lumotlar</div>
              <p className="muted mb-2">
                Barcha ma'lumotlar shu kompyuterda saqlanadi (SQLite). Internet talab qilinmaydi.
              </p>
              <div className="row">
                <button className="btn btn-outline" onClick={exportJson}>📤 Zaxira nusxa (JSON)</button>
              </div>
            </div>

            <div className="card card-pad danger-zone">
              <div className="settings-section-title">⚠️ Xavfli zona</div>
              <p className="muted mb-2">
                Demo ma'lumotlarni tiklash barcha buyurtmalar, savdo tarixi va o'zgarishlarni o'chirib,
                boshlang'ich holatga qaytaradi.
              </p>
              <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
                🔄 Demo ma'lumotlarni tiklash
              </button>
            </div>

            <div className="card card-pad">
              <div className="settings-section-title">ℹ️ Tizim haqida</div>
              <div className="about-row"><span className="muted">Versiya</span><b>1.0.0</b></div>
              <div className="about-row"><span className="muted">Platforma</span><b>{window.api ? 'Electron (desktop)' : 'Brauzer (sinov)'}</b></div>
              <div className="about-row"><span className="muted">Ma'lumotlar bazasi</span><b>SQLite (lokal)</b></div>
              <div className="about-row"><span className="muted">Valyuta</span><b>So'm (UZS)</b></div>
            </div>
          </div>
        </div>
      </div>

      {confirmReset && (
        <ConfirmModal
          title="Demo ma'lumotlarni tiklash"
          message="DIQQAT: Barcha buyurtmalar, savdo tarixi, xarajatlar va ombor o'zgarishlari o'chiriladi. Davom etilsinmi?"
          confirmLabel="Ha, tozalansin"
          danger
          onClose={() => setConfirmReset(false)}
          onConfirm={() => {
            resetDb();
            toast('Baza boshlang\'ich holatga qaytarildi', 'info');
            navigate('pos');
          }}
        />
      )}
    </div>
  );
}
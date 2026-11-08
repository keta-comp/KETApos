import { useState } from 'react';
import { Settings, Store, Save, Database, Download, Upload, Info, Loader2 } from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import { useData } from '../state/useData.js';
import {
  saveSettings, getCategories, getProducts, getTables, getOrders, getMovements, getExpenses,
} from '../supabase/queries.js';
import { getLegacySummary, runLegacyImport } from '../lib/importLegacy.js';
import { todayStr } from '../lib/format.js';
import { ConfirmModal } from '../components/Modal.jsx';

export default function SettingsPage() {
  const { settings, toast } = useApp();
  const [form, setForm] = useState({
    store_name: settings.store_name || '',
    store_address: settings.store_address || '',
    store_phone: settings.store_phone || '',
    receipt_footer: settings.receipt_footer || '',
    auto_print: settings.auto_print === '1',
  });
  const [busy, setBusy] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);

  const { data: legacy } = useData(getLegacySummary, []);
  const { data: firstOrder } = useData(async () => (await getOrders({ limit: 1 }))[0] || null, []);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (busy) return;
    if (!form.store_name.trim()) {
      toast('Do\'kon nomini kiriting', 'error');
      return;
    }
    setBusy(true);
    try {
      await saveSettings({
        store_name: form.store_name.trim(),
        store_address: form.store_address.trim(),
        store_phone: form.store_phone.trim(),
        receipt_footer: form.receipt_footer.trim(),
        auto_print: form.auto_print ? '1' : '0',
      });
      toast('Sozlamalar saqlandi');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function exportJson() {
    if (busy) return;
    setBusy(true);
    try {
      const [categories, products, tables, orders, movements, expenses] = await Promise.all([
        getCategories(),
        getProducts(),
        getTables(),
        getOrders({ limit: 500 }),
        getMovements({ limit: 500 }),
        getExpenses('2000-01-01', todayStr()),
      ]);
      const data = {
        exported_at: new Date().toISOString(),
        settings,
        categories,
        products,
        tables,
        orders,
        stock_movements: movements,
        expenses,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pos-backup-${todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Zaxira nusxa yuklandi');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    if (busy) return;
    setBusy(true);
    setConfirmImport(false);
    try {
      const res = await runLegacyImport();
      toast(`Import tugadi: ${res.products} mahsulot, ${res.orders} buyurtma`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><Settings size={22} /> Sozlamalar</h1>
          <div className="page-sub">Do'kon ma'lumotlari va tizim</div>
        </div>
      </div>

      <div className="page-body">
        <div className="settings-grid">
          <div className="card card-pad">
            <div className="settings-section-title"><Store size={18} /> Do'kon ma'lumotlari</div>
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
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              {busy ? <><Loader2 size={18} className="spin" /> Saqlanmoqda...</> : <><Save size={18} /> Saqlash</>}
            </button>
          </div>

          <div className="col">
            <div className="card card-pad">
              <div className="settings-section-title"><Database size={18} /> Ma'lumotlar</div>
              <p className="muted mb-2">
                Ma'lumotlar serverda (Supabase) saqlanadi: bir do'konga kassa, telefon va boshqa
                qurilmalardan bir vaqtda kirish mumkin. Internet bo'lmasa sahifalar yangilanmaydi.
              </p>
              <div className="row">
                <button className="btn btn-outline" disabled={busy} onClick={exportJson}><Download size={16} /> Zaxira nusxa (JSON)</button>
              </div>
              <p className="muted mt-1">Zaxiraga oxirgi 500 buyurtma va 500 ombor harakati kiradi.</p>
            </div>

            {legacy && !firstOrder && (
              <div className="card card-pad">
                <div className="settings-section-title"><Upload size={18} /> Eski ma'lumotni ichga olish</div>
                <p className="muted mb-2">
                  Kompyuterda saqlangan eski (lokal) bazada {legacy.categories} kategoriya,{' '}
                  {legacy.products} mahsulot, {legacy.tables} stol va {legacy.orders} buyurtma topildi.
                  Import ularni shu do'konga o'tkazadi va tayyor menyu bilan almashtiradi.
                </p>
                <div className="row">
                  <button className="btn btn-outline" disabled={busy} onClick={() => setConfirmImport(true)}>
                    <Upload size={16} /> Eski ma'lumotni import qilish
                  </button>
                </div>
                <p className="muted mt-1">
                  Import bir marta ishlaydi: do'konda buyurtma paydo bo'lgach u yopiladi.
                </p>
              </div>
            )}

            <div className="card card-pad">
              <div className="settings-section-title"><Info size={18} /> Tizim haqida</div>
              <div className="about-row"><span className="muted">Versiya</span><b>1.0.0</b></div>
              <div className="about-row"><span className="muted">Platforma</span><b>{window.api ? 'Electron (desktop)' : 'Brauzer (Chrome/PWA)'}</b></div>
              <div className="about-row"><span className="muted">Ma'lumotlar bazasi</span><b>Supabase (server)</b></div>
              <div className="about-row"><span className="muted">Valyuta</span><b>So'm (UZS)</b></div>
            </div>
          </div>
        </div>
      </div>

      {confirmImport && (
        <ConfirmModal
          title="Eski ma'lumotni import qilish"
          message="DIQQAT: do'konning hozirgi menyusi va stollari o'chirilib, eski (lokal) ma'lumot yoziladi. Davom etilsinmi?"
          confirmLabel="Import qilish"
          danger
          onClose={() => setConfirmImport(false)}
          onConfirm={doImport}
        />
      )}
    </div>
  );
}

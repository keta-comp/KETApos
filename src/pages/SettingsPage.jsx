import { useState } from 'react';
import { Settings, Store, Save, Database, Download, Upload, Info, Loader2 } from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import { useData } from '../state/useData.js';
import {
  saveSettings, getCategories, getProducts, getTables, getOrders, getMovements, getExpenses,
} from '../supabase/queries.js';
import { getLegacySummary, runLegacyImport } from '../lib/importLegacy.js';
import { todayStr } from '../lib/format.js';
import { APP_VERSION } from '../lib/version.js';
import { t } from '../lib/i18n.js';
import { ConfirmModal } from '../components/Modal.jsx';
import PrinterCard from '../components/PrinterCard.jsx';
import LangToggle from '../components/LangToggle.jsx';

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
      toast(t('Do\'kon nomini kiriting'), 'error');
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
      toast(t('Sozlamalar saqlandi'));
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
      toast(t('Zaxira nusxa yuklandi'));
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
      toast(t('Import tugadi: {products} mahsulot, {orders} buyurtma', { products: res.products, orders: res.orders }));
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
          <h1 className="page-title"><Settings size={22} /> {t('Sozlamalar')}</h1>
          <div className="page-sub">{t('Do\'kon ma\'lumotlari va tizim')}</div>
        </div>
      </div>

      <div className="page-body">
        <div className="settings-grid">
          <div className="card card-pad">
            <div className="field">
              <label className="label">{t('Til')}</label>
              <LangToggle />
            </div>
            <div className="settings-section-title"><Store size={18} /> {t('Do\'kon ma\'lumotlari')}</div>
            <div className="field">
              <label className="label">{t('Do\'kon nomi (chekda chiqadi)')}</label>
              <input className="input" value={form.store_name} onChange={(e) => set('store_name', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">{t('Manzil')}</label>
              <input className="input" value={form.store_address} onChange={(e) => set('store_address', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">{t('Telefon')}</label>
              <input className="input" value={form.store_phone} onChange={(e) => set('store_phone', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">{t('Chek pastki matni')}</label>
              <input className="input" value={form.receipt_footer} onChange={(e) => set('receipt_footer', e.target.value)} />
            </div>
            <label className="check-row mb-2">
              <input type="checkbox" checked={form.auto_print} onChange={(e) => set('auto_print', e.target.checked)} />
              {t('To\'lovdan so\'ng chekni avtomatik chop etish')}
            </label>
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              {busy ? <><Loader2 size={18} className="spin" /> {t('Saqlanmoqda...')}</> : <><Save size={18} /> {t('Saqlash')}</>}
            </button>
          </div>

          <div className="col">
            <PrinterCard />

            <div className="card card-pad">
              <div className="settings-section-title"><Database size={18} /> {t('Ma\'lumotlar')}</div>
              <p className="muted mb-2">
                {t('Ma\'lumotlar serverda (Supabase) saqlanadi: bir do\'konga kassa, telefon va boshqa qurilmalardan bir vaqtda kirish mumkin. Internet bo\'lmasa sahifalar yangilanmaydi.')}
              </p>
              <div className="row">
                <button className="btn btn-outline" disabled={busy} onClick={exportJson}><Download size={16} /> {t('Zaxira nusxa (JSON)')}</button>
              </div>
              <p className="muted mt-1">{t('Zaxiraga oxirgi 500 buyurtma va 500 ombor harakati kiradi.')}</p>
            </div>

            {legacy && !firstOrder && (
              <div className="card card-pad">
                <div className="settings-section-title"><Upload size={18} /> {t('Eski ma\'lumotni ichga olish')}</div>
                <p className="muted mb-2">
                  {t('Kompyuterda saqlangan eski (lokal) bazada {categories} kategoriya, {products} mahsulot, {tables} stol va {orders} buyurtma topildi. Import ularni shu do\'konga o\'tkazadi va tayyor menyu bilan almashtiradi.', {
                    categories: legacy.categories,
                    products: legacy.products,
                    tables: legacy.tables,
                    orders: legacy.orders,
                  })}
                </p>
                <div className="row">
                  <button className="btn btn-outline" disabled={busy} onClick={() => setConfirmImport(true)}>
                    <Upload size={16} /> {t('Eski ma\'lumotni import qilish')}
                  </button>
                </div>
                <p className="muted mt-1">
                  {t('Import bir marta ishlaydi: do\'konda buyurtma paydo bo\'lgach u yopiladi.')}
                </p>
              </div>
            )}

            <div className="card card-pad">
              <div className="settings-section-title"><Info size={18} /> {t('Tizim haqida')}</div>
              <div className="about-row"><span className="muted">{t('Versiya')}</span><b>{APP_VERSION}</b></div>
              <div className="about-row"><span className="muted">{t('Platforma')}</span><b>{window.api ? 'Electron (desktop)' : t('Brauzer (Chrome/PWA)')}</b></div>
              <div className="about-row"><span className="muted">{t('Ma\'lumotlar bazasi')}</span><b>Supabase (server)</b></div>
              <div className="about-row"><span className="muted">{t('Valyuta')}</span><b>So'm (UZS)</b></div>
            </div>
          </div>
        </div>
      </div>

      {confirmImport && (
        <ConfirmModal
          title={t('Eski ma\'lumotni import qilish')}
          message={t('DIQQAT: do\'konning hozirgi menyusi va stollari o\'chirilib, eski (lokal) ma\'lumot yoziladi. Davom etilsinmi?')}
          confirmLabel={t('Import qilish')}
          danger
          onClose={() => setConfirmImport(false)}
          onConfirm={doImport}
        />
      )}
    </div>
  );
}

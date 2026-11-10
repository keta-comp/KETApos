import { useEffect, useMemo, useState } from 'react';
import { Printer, Save, Usb, PlugZap, RefreshCw, CircleAlert } from 'lucide-react';
import Spinner from './Spinner.jsx';
import { useApp } from '../state/AppContext.jsx';
import { t } from '../lib/i18n.js';
import { saveSettings } from '../supabase/queries.js';
import {
  CUT_LABELS, TRANSPORT_LABELS, listComPorts, pickSerialPort, pickUsbDevice,
  printThermal, sampleTicketOrder, thermalPreview,
} from '../lib/printer.js';

const KEYS = [
  'print_mode', 'thermal_mm', 'thermal_transport', 'thermal_cut', 'thermal_feed',
  'thermal_drawer', 'thermal_com', 'thermal_baud', 'thermal_usb_vid', 'thermal_usb_pid',
];

function fromSettings(settings) {
  return {
    print_mode: settings.print_mode === 'thermal' ? 'thermal' : 'driver',
    thermal_mm: String(settings.thermal_mm || '80'),
    thermal_transport: settings.thermal_transport || 'usb',
    thermal_cut: settings.thermal_cut || 'partial',
    thermal_feed: String(settings.thermal_feed ?? '5'),
    thermal_drawer: settings.thermal_drawer === '1',
    thermal_com: settings.thermal_com || '',
    thermal_baud: String(settings.thermal_baud || '9600'),
    thermal_usb_vid: settings.thermal_usb_vid || '',
    thermal_usb_pid: settings.thermal_usb_pid || '',
  };
}

function toSettings(form) {
  const out = {};
  for (const key of KEYS) out[key] = String(form[key] === true ? '1' : form[key] === false ? '0' : form[key] ?? '');
  return out;
}

const hex4 = (n) => (n ?? 0).toString(16).padStart(4, '0').toUpperCase();

// Termal printer (ESC/POS) sozlamalari: qog'oz, transport, kesish va sinov chop etish.
export default function PrinterCard() {
  const { settings, toast, refresh } = useApp();
  const [form, setForm] = useState(() => fromSettings(settings));
  const [saved, setSaved] = useState(() => toSettings(settings));
  const [preview, setPreview] = useState(null);
  const [ports, setPorts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const isDesktop = Boolean(window.api?.serialWrite);

  const merged = useMemo(() => ({ ...settings, ...toSettings(form) }), [settings, form]);
  const thermal = form.print_mode === 'thermal';
  const usbLabel = form.thermal_usb_vid
    ? `${form.thermal_usb_vid}:${form.thermal_usb_pid || '0000'}`
    : '';

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Ko'rik — printer chiqaradigan 1-bit tasma, sozlamalar saqlanmasa ham yangilanadi.
  useEffect(() => {
    if (!thermal) {
      setPreview(null);
      return undefined;
    }
    let alive = true;
    thermalPreview(sampleTicketOrder(), merged)
      .then((url) => { if (alive) setPreview(url); })
      .catch((e) => { if (alive) { setPreview(null); setNote(e.message); } });
    return () => { alive = false; };
  }, [thermal, merged]);

  useEffect(() => {
    if (form.print_mode !== 'thermal' || form.thermal_transport !== 'serial') return;
    listComPorts().then(setPorts).catch(() => setPorts([]));
  }, [form.thermal_transport, thermal]);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const patch = toSettings(form);
      await saveSettings(patch);
      setSaved(patch);
      refresh();
      toast(t('Printer sozlamalari saqlandi'));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function chooseUsb() {
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      const device = await pickUsbDevice(merged.thermal_usb_vid ? {
        usbVendorId: Number.parseInt(merged.thermal_usb_vid, 16),
        usbProductId: Number.parseInt(merged.thermal_usb_pid || '0', 16),
      } : {});
      set('thermal_usb_vid', hex4(device.vendorId));
      set('thermal_usb_pid', hex4(device.productId));
      toast(t('Qurilma tanlandi: {name} — „Saqlash“ tugmasini bosing', { name: device.name }));
    } catch (e) {
      setNote(e.message);
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function chooseSerial() {
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      const device = await pickSerialPort();
      toast(t('Port tanlandi: {name} — „Saqlash“ tugmasini bosing', { name: device.name }));
    } catch (e) {
      setNote(e.message);
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function testPrint() {
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      const res = await printThermal(sampleTicketOrder(), merged);
      if (res.cancelled) {
        setNote(t('Fayl saqlash bekor qilindi.'));
      } else {
        toast(t('Sinov cheki yuborildi: {device} ({bytes} bayt)', { device: res.device, bytes: res.bytes }));
      }
    } catch (e) {
      setNote(e.message);
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const changed = JSON.stringify(toSettings(form)) !== JSON.stringify(saved);

  return (
    <div className="card card-pad">
      <div className="settings-section-title"><Printer size={18} /> {t('Termal printer (ESC/POS)')}</div>
      <div className="field">
        <label className="label">{t('Chop etish usuli')}</label>
        <div className="seg">
          <button
            type="button"
            className={`seg-item ${!thermal ? 'active' : ''}`}
            onClick={() => set('print_mode', 'driver')}
          >
            {t('Oddiy drayver')}
          </button>
          <button
            type="button"
            className={`seg-item ${thermal ? 'active' : ''}`}
            onClick={() => set('print_mode', 'thermal')}
          >
            {t('Termal ESC/POS')}
          </button>
        </div>
      </div>

      <p className="muted mb-2">
        {t('Termal rejimda chek rasm (1-bit rastr) ko\'rinishida yuboriladi — o\'zbekcha belgilar (ʼ, ǵ) ham to\'g\'ri chiqadi, printer shriftiga bog\'liq bo\'lmaydi.')}
      </p>

      {thermal && (
        <>
          <div className="field">
            <label className="label">{t('Qog\'oz kengligi')}</label>
            <div className="seg">
              {['58', '80'].map((mm) => (
                <button
                  key={mm}
                  type="button"
                  className={`seg-item ${form.thermal_mm === mm ? 'active' : ''}`}
                  onClick={() => set('thermal_mm', mm)}
                >
                  {mm} mm
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label">{t('Uzash kanali')}</label>
            <select
              className="select"
              value={form.thermal_transport}
              onChange={(e) => set('thermal_transport', e.target.value)}
            >
              {Object.entries(TRANSPORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{t(label)}</option>
              ))}
            </select>
          </div>

          {form.thermal_transport === 'usb' && (
            <div className="field">
              <label className="label">{t('USB printer')}</label>
              <div className="row">
                <button className="btn btn-outline" type="button" disabled={busy} onClick={chooseUsb}>
                  <Usb size={16} /> {t('Qurilmani tanlash')}
                </button>
                {usbLabel && <span className="device-chip">{usbLabel}</span>}
              </div>
              <p className="muted mt-1">
                {t('Chrome/Edge ruxsat so\'raydigan oynani ochadi. Ro\'yxat bo\'sh bo\'lsa Windows\'da printer drayveri WinUSB bo\'lishi kerak yoki COM port / .bin kanaliga o\'ting.')}
              </p>
            </div>
          )}

          {form.thermal_transport === 'serial' && (
            <div className="field">
              <label className="label">{t('COM port')}</label>
              {isDesktop ? (
                <div className="row">
                  <select
                    className="select"
                    value={form.thermal_com}
                    onChange={(e) => set('thermal_com', e.target.value)}
                  >
                    <option value="">{t('— tanlanmagan —')}</option>
                    {ports.map((p) => <option key={p.path} value={p.path}>{p.label || p.path}</option>)}
                  </select>
                  <button
                    className="btn btn-outline"
                    type="button"
                    title={t('Port ro\'yxatini yangilash')}
                    onClick={() => listComPorts({ refresh: true }).then(setPorts).catch(() => setPorts([]))}
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              ) : (
                <button className="btn btn-outline" type="button" disabled={busy} onClick={chooseSerial}>
                  <PlugZap size={16} /> {t('Portni brauzerda tanlash')}
                </button>
              )}
              <div className="field mt-1">
                <label className="label">{t('Tezlik (baud)')}</label>
                <select className="select" value={form.thermal_baud} onChange={(e) => set('thermal_baud', e.target.value)}>
                  {['9600', '19200', '38400', '57600', '115200'].map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
          )}

          {form.thermal_transport === 'file' && (
            <p className="muted mb-2">
              {t('Chek .bin faylga yoziladi (ESC/POS baytlari). Uni termal printerning papkasiga tashish yoki')}{' '}
              <code>copy /b chek.bin \\.\\COM5</code> {t('bilan uzatish mumkin.')}
            </p>
          )}

          <div className="grid-2">
            <div className="field">
              <label className="label">{t('Kesish')}</label>
              <select className="select" value={form.thermal_cut} onChange={(e) => set('thermal_cut', e.target.value)}>
                {Object.entries(CUT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{t(label)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">{t('Kesishdan oldin surish (mm)')}</label>
              <input
                className="input"
                type="number"
                min="0"
                max="40"
                value={form.thermal_feed}
                onChange={(e) => set('thermal_feed', e.target.value)}
              />
            </div>
          </div>

          <label className="check-row mb-2">
            <input
              type="checkbox"
              checked={form.thermal_drawer}
              onChange={(e) => set('thermal_drawer', e.target.checked)}
            />
            {t('Chek bilan birga pul qutisini ochish (ESC p)')}
          </label>

          <div className="field">
            <label className="label">{t('Printer ko\'radigan chek (sinov)')}</label>
            {preview
              ? (
                <div className="printer-preview">
                  <img src={preview} width={form.thermal_mm === '58' ? 384 : 576} alt={t('Termal chek ko\'rinishi')} />
                </div>
              )
              : <div className="thermal-preview-empty"><Spinner size={16} /> {t('Hisoblanmoqda...')}</div>}
          </div>

          <div className="row">
            <button className="btn btn-primary" type="button" disabled={busy || !changed} onClick={save}>
              {busy ? <><Spinner size={16} /> {t('Saqlanmoqda...')}</> : <><Save size={16} /> {t('Saqlash')}</>}
            </button>
            <button className="btn btn-outline" type="button" disabled={busy} onClick={testPrint}>
              <RefreshCw size={16} /> {t('Sinov chop etish')}
            </button>
          </div>
          {changed && <p className="muted mt-1">{t('O\'zgartirilmagan sozlamalar sinovda ham ishlatiladi, lekin saqlansa barcha qurilmalarga yoziladi.')}</p>}
          {note && (
            <p className="mt-1 printer-note"><CircleAlert size={15} /> {note}</p>
          )}
        </>
      )}

      {!thermal && (
        <p className="muted">
          {t('Hozir chek oddiy bosma oynasi orqali chiqadi. Termal printer uchun yuqoridagi rejimni tanlang.')}
        </p>
      )}
    </div>
  );
}

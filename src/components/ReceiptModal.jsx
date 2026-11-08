import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import Modal from './Modal.jsx';
import Spinner from './Spinner.jsx';
import { useApp } from '../state/AppContext.jsx';
import { buildReceiptHtml, printReceipt } from '../lib/receipt.js';
import { isThermalMode, thermalOptions, thermalPreview } from '../lib/printer.js';

export default function ReceiptModal({ order, onClose }) {
  const { settings, toast } = useApp();
  const thermal = isThermalMode(settings);
  const { mm } = thermalOptions(settings);
  const html = useMemo(() => buildReceiptHtml(order, settings), [order, settings]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  // Termal rejimda aynan printer chiqaradigan 1-bit tasma ko'rsatiladi.
  useEffect(() => {
    if (!thermal) {
      setPreview(null);
      return undefined;
    }
    let alive = true;
    thermalPreview(order, settings)
      .then((url) => { if (alive) setPreview(url); })
      .catch(() => { if (alive) setPreview(null); });
    return () => { alive = false; };
  }, [thermal, mm, order, settings]);

  async function doPrint() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await printReceipt(order, settings);
      toast(
        result?.device ? `Chek yuborildi: ${result.device}` : 'Chek chop etilmoqda',
        'success',
      );
    } catch (e) {
      toast('Printer xatoligi: ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Chek №${order.number}`}
      onClose={onClose}
      width={440}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Yopish</button>
          <button className="btn btn-primary" disabled={busy} onClick={doPrint}>
            <Printer size={18} /> Chop etish
          </button>
        </>
      }
    >
      {thermal ? (
        <div className="thermal-preview">
          {preview
            ? <img src={preview} width={mm === 58 ? 384 : 576} alt="Chek rastr ko'rinishi" />
            : <div className="thermal-preview-empty"><Spinner size={18} /> Tayyorlanmoqda...</div>}
          <p className="muted mt-1">
            Bu — termal printerdan chiqadigan haqiqiy ko'rinish ({mm} mm qog'oz).
          </p>
        </div>
      ) : (
        <iframe className="receipt-frame" srcDoc={html} title="Chek ko'rinishi" />
      )}
    </Modal>
  );
}

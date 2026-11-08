import { useMemo } from 'react';
import Modal from './Modal.jsx';
import { useApp } from '../state/AppContext.jsx';
import { buildReceiptHtml, printReceipt } from '../lib/receipt.js';

export default function ReceiptModal({ order, onClose }) {
  const { settings, toast } = useApp();
  const html = useMemo(() => buildReceiptHtml(order, settings), [order, settings]);

  async function doPrint() {
    try {
      const ok = await printReceipt(order, settings);
      toast(ok ? 'Chek chop etilmoqda' : 'Chop etish bekor qilindi', ok ? 'success' : 'info');
    } catch (e) {
      toast('Printer xatoligi: ' + e.message, 'error');
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
          <button className="btn btn-primary" onClick={doPrint}>🖨️ Chop etish</button>
        </>
      }
    >
      <iframe className="receipt-frame" srcDoc={html} title="Chek ko'rinishi" />
    </Modal>
  );
}
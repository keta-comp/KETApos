import { fmtMoney, fmtDateTime, ORDER_TYPES, PAY_METHODS, fmtQty } from './format.js';
import { isThermalMode, printThermal } from './printer.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function buildReceiptHtml(order, settings) {
  const type = ORDER_TYPES[order.type]?.label || order.type;
  const method = PAY_METHODS[order.payment_method]?.label || '';
  const items = order.items
    .map(
      (it) => `
      <div class="item">
        <div class="item-name">${esc(it.name)}</div>
        <div class="item-row">
          <span>${fmtQty(it.qty)} x ${fmtMoney(it.price)}</span>
          <span>${fmtMoney(it.total)}</span>
        </div>
        ${it.note ? `<div class="item-note">${esc(it.note)}</div>` : ''}
      </div>`
    )
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Chek №${order.number}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    width: 72mm; margin: 0 auto; padding: 4mm 2mm;
    font-family: 'Courier New', monospace; font-size: 12px; color: #000;
  }
  .center { text-align: center; }
  .store { font-size: 16px; font-weight: bold; text-transform: uppercase; }
  .small { font-size: 11px; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 4px; }
  .item { margin: 4px 0; }
  .item-name { font-weight: bold; }
  .item-row { display: flex; justify-content: space-between; }
  .item-note { font-size: 11px; font-style: italic; }
  .total { font-size: 15px; font-weight: bold; }
  .footer { margin-top: 8px; text-align: center; font-size: 11px; }
</style></head>
<body>
  <div class="center store">${esc(settings.store_name || 'KetaPOS')}</div>
  ${settings.store_address ? `<div class="center small">${esc(settings.store_address)}</div>` : ''}
  ${settings.store_phone ? `<div class="center small">Tel: ${esc(settings.store_phone)}</div>` : ''}
  <div class="divider"></div>
  <div class="row"><span>Chek №${order.number}</span><span>${esc(type)}</span></div>
  <div class="row small"><span>${fmtDateTime(order.paid_at || order.created_at)}</span>
  ${order.table_name ? `<span>Stol: ${esc(order.table_name)}</span>` : ''}</div>
  <div class="divider"></div>
  ${items}
  <div class="divider"></div>
  <div class="row"><span>Jami:</span><span>${fmtMoney(order.subtotal)}</span></div>
  ${order.discount > 0 ? `<div class="row"><span>Chegirma (${order.discount_percent}%):</span><span>-${fmtMoney(order.discount)}</span></div>` : ''}
  <div class="row total"><span>TO'LOV:</span><span>${fmtMoney(order.total)} so'm</span></div>
  ${method ? `<div class="row"><span>To'lov turi:</span><span>${esc(method)}</span></div>` : ''}
  ${order.payment_method === 'cash' ? `
    <div class="row"><span>Qabul qilindi:</span><span>${fmtMoney(order.received)}</span></div>
    <div class="row"><span>Qaytim:</span><span>${fmtMoney(order.change_amount)}</span></div>` : ''}
  <div class="divider"></div>
  <div class="footer">${esc(settings.receipt_footer || 'Xaridingiz uchun rahmat!')}</div>
</body></html>`;
}

export async function printReceipt(order, settings) {
  // Termal rejimda HTML emas, ESC/POS rastr baytlari yuboriladi.
  if (isThermalMode(settings)) return printThermal(order, settings);
  const html = buildReceiptHtml(order, settings);
  if (window.api?.printReceipt) {
    return window.api.printReceipt(html);
  }
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  await new Promise((r) => setTimeout(r, 300));
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  setTimeout(() => iframe.remove(), 1000);
  return true;
}
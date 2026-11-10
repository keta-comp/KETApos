// Termal printer (ESC/POS) uchun chek: buyurtma -> 1-bit rastr -> printer baytlari.
//
// Nega rastr? Termal printerlarning o'z shriftlarida o'zbek tilidagi ʼ, ǵ kabi
// belgilar yo'q (kod sahifalari boshqa), shuning uchun chekni rasm qilib
// yuborish hamma najotli — printer nima kelgan bo'lsa shuni bosadi.
//
// 203 dpi standart: 1 mm = 8 nuqta. 58 mm qog'oz = 384 nuqta, 80 mm = 576 nuqta.

import { fmtDateTime, fmtMoney, fmtQty, ORDER_TYPES, PAY_METHODS } from './format.js';
import { t } from './i18n.js';

export const PAPER_WIDTHS = { 58: 384, 80: 576 };

const DPI_MM = 8;

export function paperWidthDots(mm) {
  const dots = PAPER_WIDTHS[Number(mm)] || PAPER_WIDTHS[80];
  return Math.floor(dots / 8) * 8;
}

const FONT_STACK = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

// Shrift o'lchamlari nuqtada (203 dpi): asosiy matn ~3 mm balandlikda chiqadi.
const SIZE = { small: 20, base: 24, total: 28, title: 32 };
const MARGIN = 10;

function fontFor(size, bold) {
  return `${bold ? 'bold ' : ''}${size}px ${FONT_STACK}`;
}

function newCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  // 'top': chizgich qatorning yuqori chekkasida bo'ladi — bo'sh joy hisobi aniq.
  ctx.textBaseline = 'top';
  return canvas;
}

// Chizgich: canvas'ni kerak bo'lsa kattalashtiradi. O'lcham o'zgarganda
// canvas tozalanib ketadi, shuning uchun eski chizma yangisiga ko'chiriladi.
function createPainter(width) {
  const canvas = newCanvas(width, 512);
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }), y: 0, width };
}

function reserve(painter, needed) {
  const want = Math.ceil((painter.y + needed + 4) / 256) * 256;
  if (want <= painter.canvas.height) return;
  const next = newCanvas(painter.width, want);
  const ctx = next.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(painter.canvas, 0, 0);
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.textBaseline = 'top';
  painter.canvas = next;
  painter.ctx = ctx;
}

// Matnni printer kengligiga sig'diradi: kerak bo'lsa ikki qatorga bo'ladi.
function wrapText(ctx, text, maxWidth) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const next = `${line} ${word}`;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

// Ikki ustunli qator: chapda nom, o'ngda summa. O'ng tomon har doim yonma-yon.
function drawRow(painter, { left = '', right = '', size = SIZE.base, bold = false, gap = 8 }) {
  const { ctx } = painter;
  reserve(painter, Math.ceil(size * 1.35));
  const width = painter.width - MARGIN * 2;
  ctx.font = fontFor(size, bold);
  const rightWidth = ctx.measureText(right).width;
  const maxLeft = Math.max(24, width - rightWidth - gap);
  const lines = wrapText(ctx, left, maxLeft);
  const step = Math.round(size * 1.35);
  lines.forEach((text, i) => {
    reserve(painter, step);
    ctx.fillText(text, MARGIN, painter.y);
    if (i === lines.length - 1 && right) ctx.fillText(right, painter.width - MARGIN - rightWidth, painter.y);
    painter.y += step;
  });
}

function drawCenter(painter, text, { size = SIZE.base, bold = false, upper = false } = {}) {
  const { ctx } = painter;
  reserve(painter, Math.ceil(size * 1.35));
  ctx.font = fontFor(size, bold);
  const value = upper ? String(text ?? '').toUpperCase() : String(text ?? '');
  const lines = wrapText(ctx, value, painter.width - MARGIN * 2);
  const step = Math.round(size * 1.35);
  for (const line of lines) {
    reserve(painter, step);
    ctx.fillText(line, (painter.width - ctx.measureText(line).width) / 2, painter.y);
    painter.y += step;
  }
}

// Uzluksiz chiziq — chek bo'limlarini ajratadi. Chiziqqa o'z bandi ajratiladi,
// shunda u qatorlar bilan ustma-ust tushmaydi.
function drawDivider(painter, { gap = 7 } = {}) {
  const { ctx } = painter;
  const band = gap * 2 + 2;
  reserve(painter, band);
  const y = painter.y + gap;
  let x = MARGIN;
  const right = painter.width - MARGIN;
  ctx.fillRect(x, y, 2, 2);
  x += 6;
  while (x < right) {
    ctx.fillRect(x, y, 3, 2);
    x += 6;
  }
  painter.y += band;
}

function space(painter, lines) {
  for (let i = 0; i < lines; i += 1) {
    reserve(painter, 4);
    painter.y += 4;
  }
}

// Chek matnini canvas'ga chizadi (printer ko'radigani bilan bir xil).
export function drawReceipt(order, settings, { mm = 80 } = {}) {
  const width = paperWidthDots(mm);
  const painter = createPainter(width);
  const items = order.items || [];
  const type = t(ORDER_TYPES[order.type]?.label) || order.type;
  const method = t(PAY_METHODS[order.payment_method]?.label) || '';

  // --- Sarlavha ---
  painter.y = 4;
  reserve(painter, SIZE.title + 12);
  drawCenter(painter, settings.store_name || 'KetaPOS', { size: SIZE.title, bold: true, upper: true });
  if (settings.store_address) drawCenter(painter, settings.store_address, { size: SIZE.small });
  if (settings.store_phone) drawCenter(painter, `Tel: ${settings.store_phone}`, { size: SIZE.small });
  space(painter, 1);
  drawDivider(painter);

  // --- Chek ma'lumoti ---
  space(painter, 1);
  drawRow(painter, { left: t('Chek №{n}', { n: order.number }), right: type });
  drawRow(painter, {
    left: fmtDateTime(order.paid_at || order.created_at),
    right: order.table_name ? `${t('Stol')}: ${order.table_name}` : '',
    size: SIZE.small,
  });
  if (order.staff_name) drawRow(painter, { left: t('Xodim: {name}', { name: order.staff_name }), size: SIZE.small });
  drawDivider(painter);

  // --- Mahsulotlar ---
  for (const it of items) {
    space(painter, 1);
    drawRow(painter, { left: it.name, bold: true });
    drawRow(painter, { left: `${fmtQty(it.qty)} x ${fmtMoney(it.price)}`, right: fmtMoney(it.total) });
    if (it.note) drawRow(painter, { left: `${t('Izoh')}: ${it.note}`, size: SIZE.small });
  }
  space(painter, 1);
  drawDivider(painter);

  // --- Yakuniy hisob ---
  drawRow(painter, { left: t('Jami:'), right: fmtMoney(order.subtotal) });
  if (Number(order.discount) > 0) {
    drawRow(painter, {
      left: `${t('Chegirma ({pct}%)', { pct: order.discount_percent || 0 })}:`,
      right: `-${fmtMoney(order.discount)}`,
    });
  }
  space(painter, 1);
  drawRow(painter, { left: t("TO'LOV:"), right: `${fmtMoney(order.total)} so'm`, size: SIZE.total, bold: true });
  space(painter, 1);
  if (method) drawRow(painter, { left: t("To'lov turi:"), right: method, size: SIZE.small });
  if (order.payment_method === 'cash') {
    drawRow(painter, { left: t('Qabul qilindi:'), right: fmtMoney(order.received), size: SIZE.small });
    drawRow(painter, { left: t('Qaytim:'), right: fmtMoney(order.change_amount), size: SIZE.small });
  }
  drawDivider(painter);

  // --- Pastki qism ---
  space(painter, 1);
  drawCenter(painter, t(settings.receipt_footer || 'Xaridingiz uchun rahmat!'), { size: SIZE.small });
  painter.y += 12;
  reserve(painter, 24);

  return { canvas: painter.canvas, height: Math.ceil(painter.y) };
}

// Canvas'dagi qora-oq tasmani printer tushunadigan 1-bit qatorlarga o'giradi.
// threshold: kulrangdan past bo'lgan har bir piksel — siyoh (chunki shrift
// antialiasing bilan chiziladi va 50% chegarasi mayda matnni nozik qiladi).
export function canvasToBits(canvas, height) {
  const width = canvas.width;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const rows = Math.max(1, Math.ceil(height));
  const { data } = ctx.getImageData(0, 0, width, rows);
  const bytesPerRow = Math.ceil(width / 8);
  const bits = new Uint8Array(bytesPerRow * rows);
  for (let y = 0; y < rows; y += 1) {
    const rowStart = y * bytesPerRow;
    for (let byte = 0; byte < bytesPerRow; byte += 1) {
      let value = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const x = byte * 8 + bit;
        if (x >= width) break;
        const i = (y * width + x) * 4;
        const alpha = data[i + 3] / 255;
        const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * alpha + 255 * (1 - alpha);
        if (lum < 150) value |= 0x80 >> bit;
      }
      bits[rowStart + byte] = value;
    }
  }
  return { bits, width, height: rows, bytesPerRow };
}

// 1-bit tasmani ESC/POS "GS v 0" buyruqlariga joylaydi.
// Katta tasma kichik bo'laklarga bo'linadi: arzon printerlarning buferi kichkina.
export function rasterCommands({ bits, bytesPerRow, height }, { chunkRows = 32 } = {}) {
  const out = [];
  const per = Math.max(1, Math.min(chunkRows, height));
  for (let top = 0; top < height; top += per) {
    const rows = Math.min(per, height - top);
    const head = new Uint8Array([
      0x1d, 0x76, 0x30, 0x00,
      bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
      rows & 0xff, (rows >> 8) & 0xff,
    ]);
    out.push(head, bits.subarray(top * bytesPerRow, (top + rows) * bytesPerRow));
  }
  return out;
}

const CUTS = {
  none: [],
  partial: [0x1d, 0x56, 0x42, 0x00],
  full: [0x1d, 0x56, 0x41, 0x00],
};

// Chek uchun to'liq buyruq ketma-ketligi: tasma + surish + kesish + pul qutisi.
export function buildTicket(raster, { cut = 'partial', feedMm = 5, drawer = false } = {}) {
  const parts = [new Uint8Array([0x1b, 0x40])]; // ESC @ — printerni holatiga qaytarish
  if (drawer) parts.push(new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa])); // ESC p — pul qutisini ochish
  parts.push(...rasterCommands(raster));
  const lines = Math.max(1, Math.round((feedMm * DPI_MM) / 24)); // ESC d — 1/6 dyuym qatorlar
  parts.push(new Uint8Array([0x1b, 0x64, lines]));
  const tail = CUTS[cut] || CUTS.partial;
  if (tail.length) parts.push(new Uint8Array(tail));
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// Chekni tayyorlaydi: buyurtma -> printer uchun baytlar.
export async function buildReceiptJob(order, settings, { mm = 80, cut = 'partial', feedMm = 5, drawer = false } = {}) {
  const { canvas, height } = drawReceipt(order, settings, { mm });
  const raster = canvasToBits(canvas, height);
  return {
    bytes: buildTicket(raster, { cut, feedMm, drawer }),
    raster,
    widthDots: raster.width,
    heightDots: raster.height,
  };
}

// Ko'rik uchun: printer nima ko'radi — aynan shu rasm sifatida (chek oynasi).
export async function receiptPreviewUrl(order, settings, { mm = 80 } = {}) {
  const { canvas, height } = drawReceipt(order, settings, { mm });
  const { bits, width, bytesPerRow } = canvasToBits(canvas, height);
  const rows = Math.ceil(height);
  const out = newCanvas(width, rows);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, rows);
  const paint = ctx.createImageData(width, rows);
  for (let y = 0; y < rows; y += 1) {
    for (let byte = 0; byte < bytesPerRow; byte += 1) {
      const value = bits[y * bytesPerRow + byte];
      if (!value) continue;
      for (let bit = 0; bit < 8; bit += 1) {
        const x = byte * 8 + bit;
        if (x >= width) break;
        if (value & (0x80 >> bit)) {
          const i = (y * width + x) * 4;
          paint.data[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(paint, 0, 0);
  return out.toDataURL('image/png');
}

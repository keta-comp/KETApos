// Termal printerga baytlarni yetkazish yo'llari.
//
// Uchta transport:
//   usb    — WebUSB (Chrome/Edge va Electron). Qurilmaga bir marta ruxsat beriladi.
//   serial — COM port (Electron: PowerShell; brauzer: Web Serial).
//   file   — .bin faylga yozish (har qanday muhitda ishlaydigan zaxira yo'l).
//
// Baytlar ESC/POS rastr ko'rinishida bo'lgani uchun til/encoding muammosi yo'q:
// printer o'z shriftini ishlatmaydi, kelgan rasmni bosadi.

import { buildReceiptJob, paperWidthDots, receiptPreviewUrl } from './thermal.js';

// USB drayveriga tushishi mushkul bo'lgan eng ko'p uchraydigan termal printerlar.
const USB_FALLBACK_FILTERS = [
  { classCode: 7 },
  { vendorId: 0x04b8 }, // Epson
  { vendorId: 0x0416 }, // Xprinter / Goojprt / POS58 klonlari
  { vendorId: 0x0fe9 }, // DVMMaker
  { vendorId: 0x1504 }, // Bixolon
  { vendorId: 0x0a5f }, // Zebra
  { vendorId: 0x1350 }, // Panasonic
  { vendorId: 0x1a86 }, // QinHeng (USB-COM adapterlari)
];

export const TRANSPORT_LABELS = {
  usb: 'USB (WebUSB)',
  serial: 'COM port',
  file: 'Fayl (.bin)',
};

export const CUT_LABELS = {
  none: 'Kesish yo\'q',
  partial: 'Qisman kesish',
  full: 'To\'liq kesish',
};

const NO_USB = 'WebUSB bu brauzerda yo\'q. Chrome yoki Edge\'da oching, COM port / .bin fayl usuliga o\'ting.';
const NO_SERIAL = 'COM portga chiqish ushbu muhitda mavjud emas (Electron yoki Chrome kerak).';
const NO_DEVICE = 'USB printer topilmadi. Uni "Sinov" tugmasi oldidan "Qurilmani tanlash" orqali ruxsatlang.';

function requireUsb() {
  if (!navigator.usb) throw new Error(NO_USB);
}

// ---------- Sozlamalar ----------

export function isThermalMode(settings) {
  return settings.print_mode === 'thermal';
}

export function thermalOptions(settings) {
  const mm = Number(settings.thermal_mm) === 58 ? 58 : 80;
  return {
    mm,
    widthDots: paperWidthDots(mm),
    cut: settings.thermal_cut || 'partial',
    feedMm: Number(settings.thermal_feed) || 5,
    drawer: settings.thermal_drawer === '1',
    transport: settings.thermal_transport || 'usb',
    comPort: settings.thermal_com || '',
    baud: Number(settings.thermal_baud) || 9600,
    usbVendorId: Number.parseInt(settings.thermal_usb_vid || '', 16) || null,
    usbProductId: Number.parseInt(settings.thermal_usb_pid || '', 16) || null,
  };
}

// ---------- USB (WebUSB) ----------

async function findPrinterEndpoint(device) {
  const candidates = [];
  for (const config of device.configurations) {
    for (const iface of config.interfaces) {
      for (const alt of iface.alternates) {
        for (const ep of alt.endpoints) {
          if (ep.type === 'bulk' && ep.direction === 'out') {
            candidates.push({
              interfaceNumber: iface.interfaceNumber,
              endpointNumber: ep.endpointNumber,
              classCode: alt.interfaceClass,
              configValue: config.configurationValue,
            });
          }
        }
      }
    }
  }
  if (!candidates.length) throw new Error('Printer USB yo\'g\'onasi (bulk OUT) topilmadi.');
  const printerClass = candidates.find((c) => c.classCode === 7);
  return printerClass || candidates[0];
}

let usbSession = null; // { device, endpoint }

async function openUsb(preferred) {
  requireUsb();
  const match = (dev) => !preferred?.usbVendorId
    || (dev.vendorId === preferred.usbVendorId && dev.productId === preferred.usbProductId);
  const known = (await navigator.usb.getDevices()).find(match);
  if (!known) throw new Error(NO_DEVICE);
  const endpoint = await findPrinterEndpoint(known);
  if (known.opened) await known.close();
  await known.open();
  if (!known.configuration) await known.selectConfiguration(endpoint.configValue);
  if (known.driver) {
    try { await known.detachKernelDriver(endpoint.interfaceNumber); } catch { /* Windows'da yo'q */ }
  }
  await known.claimInterface(endpoint.interfaceNumber);
  usbSession = { device: known, endpoint };
  return usbSession;
}

async function usbWrite(bytes, options) {
  let session = usbSession;
  if (!session || !session.device.opened) session = await openUsb(options);
  const { device, endpoint } = session;
  // Katta tasma bo'laklarga bo'linadi: ba'zi printerlar bitta yozuvda cheklangan.
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    const result = await device.transferOut(endpoint.endpointNumber, bytes.subarray(offset, offset + 8192));
    if (result.status === 'error') throw new Error('USB yozuvi xato bilan tugadi.');
  }
  return { transport: 'usb', device: `${device.productName || 'USB'} (${hex(device.vendorId)}:${hex(device.productId)})` };
}

// Qurilmaga ruxsat olish — foydalanuvchi bosqichi talab qilinadi (Chrome dialogi).
export async function pickUsbDevice(options = {}) {
  requireUsb();
  const filters = options.usbVendorId
    ? [{ vendorId: options.usbVendorId, productId: options.usbProductId }]
    : USB_FALLBACK_FILTERS;
  let device;
  try {
    device = await navigator.usb.requestDevice({ filters });
  } catch (e) {
    if (e.name === 'NotFoundError') {
      throw new Error('Ro\'yxatda printer ko\'rinmadi. Drayver WinUSB bo\'lishi kerak (yoki COM port usulini ishlating).');
    }
    if (e.name === 'SecurityError') throw new Error(NO_USB);
    throw e;
  }
  usbSession = null;
  return { vendorId: device.vendorId, productId: device.productId, name: device.productName || 'USB printer' };
}

export async function listUsbDevices() {
  if (!navigator.usb) return [];
  return (await navigator.usb.getDevices()).map((d) => ({
    vendorId: d.vendorId,
    productId: d.productId,
    name: d.productName || `${hex(d.vendorId)}:${hex(d.productId)}`,
  }));
}

// ---------- COM port ----------

export async function listComPorts({ refresh = false } = {}) {
  if (window.api?.serialPorts) {
    return refresh ? window.api.serialRefresh() : window.api.serialPorts();
  }
  if (navigator.serial) {
    return (await navigator.serial.getPorts()).map((p, i) => {
      const info = p.getInfo() || {};
      return {
        path: `port-${i}`,
        label: info.usbVendorId
          ? `USB Serial ${hex(info.usbVendorId)}:${hex(info.usbProductId || 0)}`
          : `COM (${i + 1})`,
      };
    });
  }
  return [];
}

// Web Serial'da port yo'lini (COM5) olishning iloji yo'q — brauzer tanlov oynasidan foydalanamiz.
let webSerialPort = null;

export async function pickSerialPort() {
  if (!navigator.serial) throw new Error(NO_SERIAL);
  const port = await navigator.serial.requestPort();
  const info = port.getInfo() || {};
  webSerialPort = port;
  return {
    vendorId: info.usbVendorId ?? null,
    productId: info.usbProductId ?? null,
    name: info.usbVendorId ? `Serial ${hex(info.usbVendorId)}:${hex(info.usbProductId || 0)}` : 'Serial port',
  };
}

async function serialWriteWeb(bytes, { baud }) {
  if (!navigator.serial) throw new Error(NO_SERIAL);
  let port = webSerialPort;
  if (!port) {
    const granted = await navigator.serial.getPorts();
    port = granted[0];
    if (!port) throw new Error('COM portga ruxsat berilmadi — "Portni tanlash" tugmasini bosing.');
    webSerialPort = port;
  }
  await port.open({ baudRate: baud });
  const writer = port.writable.getWriter();
  for (let offset = 0; offset < bytes.length; offset += 4096) {
    await writer.write(bytes.subarray(offset, offset + 4096));
  }
  writer.releaseLock();
  await port.close();
  return { transport: 'serial', device: `COM (${baud})` };
}

async function serialWriteElectron(bytes, { comPort, baud }) {
  if (!window.api?.serialWrite) throw new Error(NO_SERIAL);
  if (!comPort) throw new Error('COM port tanlanmagan.');
  const res = await window.api.serialWrite({ port: comPort, baudRate: baud, bytes });
  if (!res?.ok) throw new Error(res?.error || `Kompyuter ${comPort} orqali yozib bo'lmadi.`);
  return { transport: 'serial', device: `${comPort} (${baud})` };
}

// ---------- Fayl ----------

function hex(value) {
  return String((value ?? 0).toString(16).padStart(4, '0')).toUpperCase();
}

async function writeFile(bytes, name) {
  if (window.api?.saveFile) {
    const res = await window.api.saveFile({ name, bytes });
    if (!res?.ok) {
      if (res?.cancelled) return { transport: 'file', device: 'Bekor qilindi', cancelled: true };
      throw new Error(res?.error || 'Fayl saqlanmadi.');
    }
    return { transport: 'file', device: res.path };
  }
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { transport: 'file', device: name };
}

// ---------- Umumiy chiqish ----------

export async function sendTicket(bytes, options, fileName = 'chek.bin') {
  if (options.transport === 'file') return writeFile(bytes, fileName);
  if (options.transport === 'serial') {
    return window.api?.serialWrite
      ? serialWriteElectron(bytes, options)
      : serialWriteWeb(bytes, options);
  }
  return usbWrite(bytes, options);
}

// Chekni termal printerga yuboradi: buyurtma -> rastr -> transport.
export async function printThermal(order, settings) {
  const options = thermalOptions(settings);
  const job = await buildReceiptJob(order, settings, options);
  const result = await sendTicket(job.bytes, options, `chek-${order.number || 'sinov'}.bin`);
  return { ...result, bytes: job.bytes.length, heightDots: job.heightDots, widthDots: job.widthDots };
}

// Chek oynasidagi ko'rik: printer aynan shu tasma chiqadi.
export async function thermalPreview(order, settings) {
  const { mm } = thermalOptions(settings);
  return receiptPreviewUrl(order, settings, { mm });
}

// Sozlamalar kartasidagi sinov cheki — haqiqiy buyurtma emas, namuna.
export function sampleTicketOrder() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
  return {
    number: '000',
    type: 'dine_in',
    payment_method: 'cash',
    table_name: 'Stol 3',
    staff_name: 'Sinov',
    created_at: stamp,
    paid_at: stamp,
    items: [
      { name: 'Lavash mol go\'sht', qty: 1, price: 24000, total: 24000, note: 'Achchiq qo\'shilmasin' },
      { name: 'Burger tovuq', qty: 2, price: 16000, total: 32000 },
      { name: "Ko'k choy", qty: 3, price: 8000, total: 24000 },
      { name: 'Somsa', qty: 1.5, price: 12000, total: 18000 },
    ],
    subtotal: 98000,
    discount_percent: 10,
    discount: 9800,
    total: 88200,
    received: 100000,
    change_amount: 11800,
  };
}

export function fmtMoney(n) {
  const v = Math.round(Number(n) || 0);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function fmtSum(n) {
  return `${fmtMoney(n)} so'm`;
}

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return todayStr(d);
}

export function fmtTime(s) {
  if (!s) return '';
  return s.slice(11, 16);
}

export function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export function fmtDateTime(s) {
  if (!s) return '';
  return `${fmtDate(s)} ${fmtTime(s)}`;
}

export function minutesSince(s) {
  if (!s) return 0;
  const then = new Date(s.replace(' ', 'T'));
  return Math.max(0, Math.floor((Date.now() - then.getTime()) / 60000));
}

export function fmtQty(n) {
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}

export const ORDER_TYPES = {
  dine_in: { label: 'Zalda', emoji: '🍽️' },
  takeaway: { label: 'Olib ketish', emoji: '🥡' },
  delivery: { label: 'Yetkazish', emoji: '🛵' },
};

export const PAY_METHODS = {
  cash: { label: 'Naqd', emoji: '💵' },
  card: { label: 'Karta', emoji: '💳' },
  click: { label: 'Click / Payme', emoji: '📱' },
};

export const KITCHEN_STATES = {
  new: { label: 'Yangi', emoji: '🆕' },
  cooking: { label: 'Tayyorlanmoqda', emoji: '👨‍🍳' },
  ready: { label: 'Tayyor', emoji: '✅' },
  served: { label: 'Berildi', emoji: '📦' },
};

export const ORDER_STATUS = {
  open: { label: 'Ochiq', cls: 'badge-yellow' },
  paid: { label: "To'langan", cls: 'badge-green' },
  cancelled: { label: 'Bekor qilingan', cls: 'badge-red' },
};
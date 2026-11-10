// Rollar: qaysi ekran ko'rinadi, qaysi amal ruxsat etilgan va birinchi ochiladigan sahifa.
// PERMS bazadagi guard_role ro'yxatlari bilan bir xil bo'lishi shart
// (supabase/schema_05_team.sql) — UI tugmani yashiradi, baza esa baribir tekshiradi.
// ROLE_META.label'lar o'zbekcha (kalit) qoladi — tarjima render paytida t() orqali.

import { t } from './i18n.js';

export const ROLES = ['owner', 'waiter', 'cashier', 'kitchen'];

export const ROLE_META = {
  owner: { label: 'Egasi', home: 'pos' },
  waiter: { label: 'Ofitsant', home: 'tables' },
  cashier: { label: 'Kassir', home: 'pos' },
  kitchen: { label: 'Oshxona', home: 'kitchen' },
};

export const PERMS = {
  menu: ['owner'],
  tables: ['owner'],
  stock: ['owner'],
  expenses: ['owner'],
  settings: ['owner'],
  staff: ['owner'],
  legacyImport: ['owner'],
  photo: ['owner'],
  orderCreate: ['owner', 'waiter', 'cashier'],
  pay: ['owner', 'cashier'],
  cancel: ['owner', 'cashier'],
  toKitchen: ['owner', 'waiter', 'cashier', 'kitchen'],
  kitchenStatus: ['owner', 'waiter', 'kitchen'],
  reports: ['owner', 'cashier'],
};

export function can(role, perm) {
  const allowed = PERMS[perm];
  return Boolean(role) && Array.isArray(allowed) && allowed.includes(role);
}

// Sidebar tartibi shu ro'yxat bo'yichasiga quriladi.
export const ROLE_PAGES = {
  owner: ['pos', 'tables', 'kitchen', 'menu', 'inventory', 'reports', 'staff', 'settings'],
  waiter: ['tables', 'pos', 'kitchen'],
  cashier: ['pos', 'tables', 'reports'],
  kitchen: ['kitchen'],
};

export function pagesFor(role) {
  return ROLE_PAGES[role] || ROLE_PAGES.owner;
}

export function homeFor(role) {
  return ROLE_META[role]?.home || 'pos';
}

export function roleLabel(role) {
  return t(ROLE_META[role]?.label || 'Xodim');
}

import initSqlJs from 'sql.js';
import { importLegacyDump } from '../supabase/queries.js';

// Eski versiya (Electron/lokal) SQLite bazasini o'qib, Supabase'ga bir marta o'tkazib beradi.
// Bu fayl ma'lumotni o'chirmaydi va ochmaydi: faqat o'qib nusxa oladi.

const TABLES = ['categories', 'products', 'tables', 'orders', 'order_items', 'stock_movements', 'expenses'];

let SQL = null;

async function sqlLib() {
  if (SQL) return SQL;
  let wasmBinary;
  if (window.api?.getWasm) {
    wasmBinary = await window.api.getWasm();
  } else {
    const wasmUrl = (await import('sql.js/dist/sql-wasm.wasm?url')).default;
    wasmBinary = await fetch(wasmUrl).then((r) => r.arrayBuffer());
  }
  SQL = await initSqlJs({ wasmBinary });
  return SQL;
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function legacyBytes() {
  if (window.api?.loadDb) {
    const raw = await window.api.loadDb();
    if (!raw || !raw.length) return null;
    return raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  }
  const saved = localStorage.getItem('pos-db');
  return saved ? fromBase64(saved) : null;
}

function rowsOf(db, table) {
  const stmt = db.prepare(`SELECT * FROM ${table}`);
  try {
    const out = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    return out;
  } catch {
    return [];
  } finally {
    stmt.free();
  }
}

// { categories: [...], ..., settings: { key: value } } yoki ma'lumot bo'lmasa null.
export async function readLegacyDump() {
  const bytes = await legacyBytes();
  if (!bytes) return null;

  const lib = await sqlLib();
  const db = new lib.Database(bytes);
  try {
    const dump = {};
    for (const table of TABLES) dump[table] = rowsOf(db, table);
    if (TABLES.slice(0, 3).every((t) => dump[t].length === 0)) return null;

    dump.settings = {};
    for (const row of rowsOf(db, 'settings')) dump.settings[row.key] = row.value;
    return dump;
  } finally {
    db.close();
  }
}

export async function getLegacySummary() {
  const dump = await readLegacyDump();
  if (!dump) return null;
  return {
    categories: dump.categories.length,
    products: dump.products.length,
    tables: dump.tables.length,
    orders: dump.orders.length,
    expenses: dump.expenses.length,
  };
}

export async function runLegacyImport() {
  const dump = await readLegacyDump();
  if (!dump) throw new Error("Kompyuterda eski (lokal) ma'lumot topilmadi.");
  return importLegacyDump(dump);
}

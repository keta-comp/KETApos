import initSqlJs from 'sql.js';
import { migrate } from './schema.js';

let db = null;
let SQL = null;
const listeners = new Set();

export function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify() {
  for (const cb of listeners) cb();
}

function toBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function initDb() {
  if (db) return db;
  let wasmBinary;
  if (window.api?.getWasm) {
    wasmBinary = await window.api.getWasm();
  } else {
    const wasmUrl = (await import('sql.js/dist/sql-wasm.wasm?url')).default;
    wasmBinary = await fetch(wasmUrl).then((r) => r.arrayBuffer());
  }
  SQL = await initSqlJs({ wasmBinary });

  let bytes = null;
  if (window.api?.loadDb) {
    bytes = await window.api.loadDb();
  } else {
    const saved = localStorage.getItem('pos-db');
    if (saved) bytes = fromBase64(saved);
  }
  db = bytes && bytes.length ? new SQL.Database(bytes) : new SQL.Database();
  migrate(db);
  persist();
  return db;
}

export function persist() {
  const bytes = db.export();
  if (window.api?.saveDb) {
    window.api.saveDb(bytes);
  } else {
    localStorage.setItem('pos-db', toBase64(bytes));
  }
}

export function commit() {
  persist();
  notify();
}

export function query(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

export function run(sql, params = []) {
  db.run(sql, params);
}

export function insert(sql, params = []) {
  db.run(sql, params);
  return query('SELECT last_insert_rowid() AS id')[0].id;
}

export function resetDb() {
  db.close();
  db = new SQL.Database();
  migrate(db);
  commit();
}
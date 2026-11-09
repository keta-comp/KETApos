// Qoraqalpoqcha qamov tekshiruvi.
//   npm run lang:check
// Ikkita narsani solishtiradi:
//   1) t('...') orqali tarjimaga berilgan har bir matn KAA lug'atida bormi;
//   2) site.js ma'lumotlaridagi ko'rinadigan yozuvlar lug'atda bormi.
// Til — kalitni topa olmasa o'zbekchani chiqaradi, shuning uchun "topilmadi"
// degani mijozga tarjimmasiz matn ko'rsatiladi degani.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KAA } from '../src/lib/kaa.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SCAN = ['src/landing', 'src/lib/lang.js'];

// Brend, texnik yozuvlar va qoraqalpoqchada ham bir xil yaziladigan so'zlar.
const PASS = new Set([
  'KetaPOS', 'KETA-COMP', 'POS', 'FAQ', 'QQ', 'UZ', 'Til',
  'Windows', 'Android', 'Brauzer', 'POS kassa', 'Telefon', 'Kafe', 'Restoran', 'Fastfood', '(ixtiyoriy)',
  'https://keta.uz', 'tel:+998777630216', '+998 77 763 02 16', '/app',
  'ketapos.lang', 'ketapos', 'file://', 'utf-8',
]);

function walk(entry) {
  const full = join(ROOT, entry);
  if (!statSync(full).isDirectory()) return [entry];
  return readdirSync(full).map((name) => join(entry, name)).flatMap(walk);
}

const files = SCAN.flatMap(walk).filter((f) => /\.(jsx?|js)$/.test(f));

const missing = [];
const used = new Set();

function check(value, where) {
  const cleaned = value
    .replace(/\\'/g, "'")
    .replace(/\\`/g, '`')
    .replace(/\\\//g, '/');
  if (!cleaned || PASS.has(cleaned)) return;
  used.add(cleaned);
  if (!(cleaned in KAA)) missing.push([where, cleaned]);
}

// 1) t('matn') — birinchi argument literal bo'lsa tekshiriladi.
const CALL = /\bt\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
// 2) site.js — ko'rinadigan yozuvlar.
const DATA = /\b(?:label|title|text|note|tagline|companyNote|q|a)\s*:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1|points\s*:\s*\[([^\]]*)\]/g;
const POINT = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
// 3) demoRequests.js — xatolik matnlari t() orqali emas, yuborilganda tarjima qilinadi.
const MSG = /^\s*[A-Z][A-Z_0-9]+:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1|^\s*(?:export )?const [A-Z][A-Z_0-9]+ = (['"`])((?:\\.|(?!\3)[^\\])*)\3/gm;

for (const rel of files) {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  const where = rel.replace(/\\/g, '/');

  for (const m of src.matchAll(CALL)) check(m[2], `${where} t()`);
  if (where.endsWith('site.js')) {
    for (const m of src.matchAll(DATA)) {
      if (m[2] !== undefined) check(m[2], `${where} data`);
      if (m[3] !== undefined) for (const p of m[3].matchAll(POINT)) check(p[2], `${where} points`);
    }
  }
  if (where.endsWith('demoRequests.js')) {
    for (const m of src.matchAll(MSG)) check(m[2] ?? m[4], `${where} xabar`);
  }
}

// Lug'atda hech qayerda ishlatilmagan kalit — ehtimol matn o'zgargan.
const stale = Object.keys(KAA).filter((k) => !used.has(k));

if (missing.length) {
  console.error(`Qoraqalpoqcha lug'atda topilmadi (${missing.length}):`);
  for (const [where, value] of missing) console.error(`  - [${where}] ${value}`);
}
if (stale.length) {
  console.warn(`\nLug'atda keraksiz qolgan kalit (${stale.length}):`);
  for (const k of stale) console.warn(`  - ${k}`);
}
if (!missing.length) console.log(`Qamov to'liq: ${used.size} ta matn lug'atda bor.`);
process.exit(missing.length ? 1 : 0);

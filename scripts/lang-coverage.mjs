// Qoraqalpoqcha qamov tekshiruvi.
//   npm run lang:check
// Uch narsani tekshiradi:
//   1) t('...') orqali berilgan har bir matn KAA lug'atida bormi;
//   2) lug'at kalitlariga aynan mos kelmaydigan (qo'llanilmay qolgan) yozuvlar;
//   3) umuman t() ga kirmagan, hibda ko'rinadigan o'zbekcha matnlar
//      (JSX atributlari — title/placeholder/aria-label/alt — ham shu qatorga kiradi).
// Til — kalitni topa olmasa o'zbekchani chiqaradi, shuning uchun "topilmadi"
// degani mijozga tarjimmasiz matn ko'rsatiladi degani.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KAA } from '../src/lib/kaa/index.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
// Butun sayt va ilova matnlari tekshiriladi; lug'at fayllari va eski (ishlatilmaydigan)
// src/db qamovga kirmaydi.
const SCAN = ['src'];
const SKIP = /[\\/]kaa[\\/]|[\\/]db[\\/]/;

// Brend, texnik yozuvlar va qoraqalpoqchada ham bir xil yaziladigan so'zlar.
const PASS = new Set([
  'KetaPOS', 'KETA-COMP', 'KetaOne', 'POS', 'FAQ', 'QQ', 'UZ', 'Til',
  'Windows', 'Android', 'Brauzer', 'POS kassa', 'Telefon', 'Kafe', 'Restoran', 'Fastfood', '(ixtiyoriy)',
  'Qaraqalpaqsha', 'Ózbeksha',
  'USB', 'COM', 'ESC/POS', 'Bluetooth', 'PDF', 'CSV', 'PNG', 'JPG', 'WebP', 'SQL', 'JSON', 'HTTP', 'UTF-8',
  'Serial port', 'Electron (desktop)', 'Stol 3', 'Chilonzor 12',
  'https://keta.uz', 'tel:+998777630216', '+998 77 763 02 16', '/app',
  'ketapos.lang', 'ketapos', 'file://', 'utf-8',
]);

function walk(entry) {
  const full = join(ROOT, entry);
  if (!statSync(full).isDirectory()) return [entry];
  return readdirSync(full).map((name) => join(entry, name)).flatMap(walk);
}

const files = SCAN.flatMap(walk).filter((f) => /\.(jsx?|js)$/.test(f) && !SKIP.test(f));
const sources = new Map(files.map((rel) => [rel.replace(/\\/g, '/'), readFileSync(join(ROOT, rel), 'utf8')]));
const blob = [...sources.values()].join('\n').replace(/\\/g, '');

const missing = [];
const used = new Set();

function check(value, where) {
  const cleaned = value.replace(/\\(["'`])/g, '$1');
  if (!cleaned || PASS.has(cleaned)) return;
  used.add(cleaned);
  if (!(cleaned in KAA)) missing.push([where, cleaned]);
}

// 1) t('matn') — birinchi argument literal.
const CALL = /\bt\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
// 2) ma'lumot konstantalari (label/title/text/...).
const DATA = /\b(?:label|title|text|note|tagline|companyNote|q|a|message|hint|desc)\s*:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
// 3) demoRequests.js — xabarlar t() orqali emas, yuborilganda tarjima qilinadi.
const MSG = /^\s*[A-Z][A-Z_0-9]+:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1|^\s*(?:export )?const [A-Z][A-Z_0-9]+ = (['"`])((?:\\.|(?!\3)[^\\])*)\3/gm;
// 4) ehtimol o'ralmagan matnlar — har qanday literal.
const LIT = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
// 5) JSX atributlari — qo'l bilan yozilgan ko'rinadigan matn.
const ATTR = /\b(?:title|placeholder|aria-label|alt)\s*=\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g;

// Matnga o'xshamaydigan literal: faqat kichik harf raqam belgilar (klasslar,
// identifikatorlar), hammasi katta harf, URL, SQL yoki kod parchasi.
const NOT_PROSE = /^[^A-Z\u0400-\u04FF]*$/;
function isProse(s) {
  if (s.length < 5 || !/\S\s\S/.test(s)) return false;
  if (NOT_PROSE.test(s)) return false;
  if (/^[A-Z0-9 .,()/&%+-]+$/.test(s)) return false;
  if (/^(https?:|tel:|data:|file:|\/|\.\.\/|\.\/)/.test(s)) return false;
  if (/\b(select|insert|update|delete|from|where|create|grant|function|table|varchar|timestamp)\b/i.test(s)) return false;
  if (/[{}<>_=;]|%s|\$\w|\\\\/.test(s)) return false;
  if (/sans-serif|Segoe UI|Helvetica/i.test(s)) return false;
  return true;
}

for (const [where, src] of sources) {
  for (const m of src.matchAll(CALL)) check(m[2], `${where} t()`);
  for (const m of src.matchAll(DATA)) check(m[2], `${where} data`);
  if (where.endsWith('demoRequests.js')) {
    for (const m of src.matchAll(MSG)) check(m[2] ?? m[4], `${where} xabar`);
  }

  // 4) t() ga kirmagan matunlarni izlaymiz. Izohlar o'chiriladi — aks holda
  //    izoh ichidagi tirnoqli so'zlar soxta literal bo'lib chiqadi.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/[^\n]*/gm, ' ');
  const wrapped = new Set([...src.matchAll(CALL)].map((m) => m[2]));
  for (const m of code.matchAll(LIT)) {
    const value = m[2].replace(/\\(["'`])/g, '$1');
    if (!isProse(value) || wrapped.has(value) || PASS.has(value) || value in KAA) continue;
    // Obyekt kaliti ('Invalid login credentials': '...') — provider xatolik nomi, tarjima qilinmaydi.
    if (/^\s*:/.test(code.slice(m.index + m[0].length))) continue;
    const line = code.slice(0, m.index).split('\n').pop() || '';
    if (/\bclassName=$|\b(?:href|src|key|value|type|id|to|as|rel|role|sizes|media|purpose|alt|viewBox|d|fill|stroke)=$|\bimport\b|\bfrom\s*$|console\.\w+\(|require\(/.test(line)) continue;
    missing.push([`${where} o'ralmagan?`, value]);
  }

  // 5) Atributdagi ko'rinadigan matn (title/placeholder/aria-label/alt) — qo'l
  //    bilan yozilsa tarjimaga kirmaydi, shuning uchun t() talab qilinadi.
  for (const m of code.matchAll(ATTR)) {
    const value = m[2];
    if (!isProse(value) || PASS.has(value)) continue;
    missing.push([`${where} atribut`, value]);
  }
}

const stale = Object.keys(KAA).filter((k) => !blob.includes(k.replace(/\\/g, '')));

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

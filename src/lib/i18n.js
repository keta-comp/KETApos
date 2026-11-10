import { getLang } from './lang.js';
import { KAA } from './kaa/index.js';

// Matn kaliti — o'zbekcha asl nusxa. Qoraqalpoqcha lug'atda topilmasa,
// o'zbekcha chiqadi: qamov tekshiruv skripti shunday joylarni topadi.
export function t(text, vars) {
  const out = getLang() === 'kaa' ? (KAA[text] || text) : text;
  if (!vars) return out;
  return out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
}

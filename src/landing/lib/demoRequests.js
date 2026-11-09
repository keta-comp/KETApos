const MESSAGES = {
  ISM_KERTILMADI: 'Ismni to‘liq kiriting — kamida 2 belgi.',
  TELEFON_NOTOGRI: 'Telefon raqami noto‘g‘ri. Masalan: +998 77 763 02 16.',
  BIZNES_TURI_NOTOGRI: 'Biznes turini tanlang: kafe, restoran yoki fastfood.',
  KO_P_URILDI: 'Bu raqam bilan juda ko‘p ariza yuborildi — birozdan so‘ng urinib ko‘ring.',
};

export const NOT_READY = 'Ariza qabul qilish hozircha yo‘q — +998 77 763 02 16 raqami bo‘yicha qo‘ng‘iroq qiling.';
export const OFFLINE = 'Internet yo‘q ko‘rinadi — ulanish tiklangach qayta urinib ko‘ring.';
const GENERIC = 'Ariza yuborilmadi — qayta urinib ko‘ring yoki qo‘ng‘iroq qiling.';

// Raqamni +998XXXXXXXXXX ko‘rinishiga keltiramiz. Baza tomonidagi qoida bilan
// bir xil: operator kodi ro'yxatdan, qolgan 9 ta raqam to'liq bo'lishi kerak.
const CODES = ['77', '88', '90', '91', '93', '94', '95', '97', '98', '99', '33', '50', '64', '66', '85', '96'];

export function normalizePhone(input) {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.startsWith('998')) digits = digits.slice(3);
  if (digits.length === 10 && (digits[0] === '0' || digits[0] === '8')) digits = digits.slice(1);
  if (digits.length !== 9) return null;
  if (!CODES.includes(digits.slice(0, 2))) return null;
  return `+998${digits}`;
}

// Terengdagi ko'rinish: +998 77 763 02 16 (2 + 3 + 2 + 2 guruh).
export function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').replace(/^0/, '').replace(/^998/, '').replace(/^8/, '').slice(0, 9);
  const groups = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean);
  return ['+998', ...groups].join(' ');
}

// Supabase klienti faqat ariza yuborilganda yuklanadi: sahifa ochilganda
// tarmoqqa birorta so'rov ketmaydi va eski sessiya yangilanishga urilmaydi.
export async function submitDemoRequest({ name, phone, business, note, trap }) {
  const { isSupabaseConfigured, supabase } = await import('../../supabase/client.js');
  if (!isSupabaseConfigured || !supabase) throw new Error(NOT_READY);

  const { error } = await supabase.rpc('submit_demo_request', {
    p_name: String(name || '').trim(),
    p_phone: String(phone || '').trim(),
    p_business: business,
    p_note: String(note || '').trim() || null,
    p_trap: trap || null,
  });
  if (!error) return true;

  const text = String(error.message || '');
  if (/submit_demo_request|Could not find the function|PGRST202|permission denied/i.test(text)) throw new Error(NOT_READY);
  if (/Failed to fetch|NetworkError|ERR_[A-Z_]+|timed out/i.test(text) || error.name === 'TypeError') throw new Error(OFFLINE);
  throw new Error(MESSAGES[text] || GENERIC);
}

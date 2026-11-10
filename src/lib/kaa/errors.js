// Qoraqalpoqcha lug'at: server/qatlam xabarlar va chek yozuvlari.
// Kalit — o'zbekcha asl nusxa, qiymat — qoraqalpoqcha.
export const ERRORS = {
  // ---------- supabase/queries.js — oflayn xabamları ----------
  'Internet yo‘q va saqlangan ma’lumot topilmadi — onlayn bo‘lgach qayta urinib ko‘ring.':
    'Internet joq hám saqlanǵan maǵlıwmat tabılmadı — onlayn bolǵannan keyin qayta urınıp kóriń.',
  'Bu amalni oflayn bajarsa bo‘lmaydi — internet kerak.':
    'Bul ámeldi oflayn orınlap bolmaydı — internet kerek.',

  // ---------- supabase/queries.js — MESSAGES (RPC qáte xabamları) ----------
  'Sessiya uzilgan — qaytadan kiring.': 'Sessiya úzilgen — qaytadan kiriń.',
  "Savat bo'sh, kamida bitta mahsulot tanlang.": 'Sebet bos, kemde bir ónim tańlań.',
  'Stol tanlang.': 'Stol tańlań.',
  'Bu stol band — unda ochiq buyurtma bor.': 'Bul stol band — onda ashıq buyırmaq bar.',
  'Stol topilmadi (balki o‘chirilgan).': 'Stol tabılmadı (bálki óshirilgen).',
  'Bu stolda ochiq buyurtma bor. Avval uni yoping.':
    'Bul stolda ashıq buyırmaq bar. Aldın onı jabıń.',
  'Buyurtma turi noto‘g‘ri.': 'Buyırmaq túri qáte.',
  'Qoldiq yetarli emas.': 'Qaldıq jetarli emes.',
  'Qoldiq yetarli emas (mavjud miqdordan ko‘p).': 'Qaldıq jetarli emes (bar muǵdardan kóp).',
  'Miqdor 0 dan katta bo‘lishi kerak.': 'Muǵdar 0 den úlken bolıwı kerek.',
  'Summa 0 dan katta bo‘lishi kerak.': 'Summa 0 den úlken bolıwı kerek.',
  'Kiritilgan summa yetarli emas.': 'Kiritilgen summa jetarli emes.',
  'Buyurtma topilmadi yoki sizning do‘koningizga tegishli emas.':
    'Buyırmaq tabılmadı yaki sizdiń dókanıńızǵa tiisli emes.',
  'Faqat ochiq buyurtmani tahrirlash mumkin.': 'Tek ǵana ashıq buyırmaqtı ózgertiw múmkin.',
  'Bu buyurtma allaqachon to‘langan yoki bekor qilingan.':
    'Bul buyırmaq álleqashan tólengen yaki biykar qılınǵan.',
  'Faqat ochiq buyurtmani bekor qilish mumkin.': 'Tek ǵana ashıq buyırmaqtı biykar qılıw múmkin.',
  'Noto‘g‘ri holat.': 'Qáte halat.',
  'To‘lov turi noto‘g‘ri.': 'Tólem túri qáte.',
  'Bu kategoriyada mahsulotlar bor. Avval ularni boshqa kategoriyaga o‘tkazing.':
    'Bul kategoriyada ónimler bar. Aldın olardı basqa kategoriyaga ótkiziń.',
  'Kategoriya topilmadi.': 'Kategoriya tabılmadı.',
  'Mahsulot topilmadi.': 'Ónim tabılmadı.',
  'Rasm papkasi noto‘g‘ri — qaytadan yuklab ko‘ring.':
    'Súwret papkası qáte — qaytadan júklep kóriń.',
  'Nomni kiriting.': 'Atın kiritiń.',
  "Bu do'konda allaqachon buyurtmalar bor — import faqat yangi do'kon uchun.":
    'Bul dókanda álleqashan buyırmaqlar bar — import tek ǵana jańa dókan ushın.',
  'Bu amalni sizning rolingiz bajara olmaydi — do‘kon egasiga ayting.':
    'Bul ámeldi rolıńız atqara almaydı — dókan iyesine aytıń.',
  'Egani roli o‘zgarmaydi va u o‘chirilmaydi.':
    'Iyesiniń rolı ózgermeydi hám ol óshirilmeydi.',
  'Xodim topilmadi yoki sizning do‘koningizga tegishli emas.':
    'Xızmetker tabılmadı yaki sizdiń dókanıńızǵa tiisli emes.',
  'Bu do‘kon platforma tomonidan to‘xtatildi — yozishlar vaqtinchalik yopiq.':
    'Bul dókan platforma tárepinen toqtatıldı — jazıwlar waqtınsha jabıq.',
  'Do‘kon topilmadi — balki o‘chirilgan.': 'Dókan tabılmadı — bálki óshirilgen.',
  'Ariza topilmadi — balki o‘chirilgan.': 'Árza tabılmadı — bálki óshirilgen.',
  'Bu do‘konning egasi allaqachon bor — egalik kodi ishlatilgan.':
    'Bul dókannıń iyesi álleqashan bar — iyelik kodı isletilgen.',
  'Bunday email bilan akkaunt yo‘q — avval xodim ro‘yxatdan o‘tsin.':
    'Bunday e-mail menen akkaunt joq — aldın xızmetker dizimnen ótsin.',
  'Emailni to‘liq yozing.': 'E-maildi tolıq jazıń.',
  'Bu platformaning oxirgi administratori — o‘chirib bo‘lmaydi.':
    'Bul platformanıń aqırǵı administratorı — óshirip bolmaydı.',
  'Administrator topilmadi.': 'Administrator tabılmadı.',
  "Baza tayyor emas — sxemani qo'llash kerak.": 'Baza tayar emes — sxemani qollaw kerek.',

  // ---------- thermal.js — chek (termal printer) yozuvları ----------
  'Jami:': 'Jámi:',
  "TO'LOV:": 'TÓLEM:',
  "To'lov turi:": 'Tólem túri:',
  'Qabul qilindi:': 'Qabıl etildi:',
  'Qaytim:': 'Qaytim:',

  // ---------- SettingsPage.jsx — Tizim haqida ----------
  'Brauzer (Chrome/PWA)': 'Brauzer (Chrome/PWA)',
};

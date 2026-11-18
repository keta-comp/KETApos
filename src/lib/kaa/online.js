// Qoraqalpoqcha lug'at: onlayn zakaz (mijoz beti /o/<slug> + xodim jouyari).
// Kalit — o'zbekcha asl nusxa, qiymat — qoraqalpoqcha.

export const ONLINE = {
  // ---------- xodim ekrani: sarlavha va jouyar ----------
  'Onlayn zakazlar': 'Onlayn buyırmaqlar',
  'Onlayn do‘kon': 'Onlayn dúkan',
  '{n} ta zakaz javob kutmoqda · har 20 soniyada yangilanadi':
    '{n} ta buyırmaq juwap kútiwde · hár 20 sekundda jańalanadı',
  'Javob kutayotgan zakaz yo‘q · har 20 soniyada yangilanadi':
    'Juwap kútip turǵan buyırmaq joq · hár 20 sekundda jańalanadı',
  'Zakazlar yuklanmoqda...': 'Buyırmaqlar júklenbekte...',
  'Yangilash': 'Jańalaw',
  'Bu holatda zakaz yo‘q. Mijozlar/link orqali zakaz yuborganda shu yerda ko‘rinadi.':
    'Bul halatta buyırmaq joq. Mıjanzlar silteme arqalı buyırmaq jibergende usı jerde kórinedi.',
  'Sozlamalar yuklanmoqda...': 'Sazlamalar júklenbekte...',
  'Zakaz qabul qilindi — kassada №{number} ochildi':
    'Buyırmaq qabıl etildi — kassada №{number} ashıldı',
  'Zakaz rad etildi': 'Buyırmaq qaytarıldı',
  'Yangi onlayn zakaz · {sum}': 'Jańa onlayn buyırmaq · {sum}',
  'Kuzatish kodi': 'Kuzatıw kodı',
  'Qabul qilish': 'Qabıllaw',
  'Rad etish': 'Qaytarıw',
  'Qabul qilingan': 'Qabıl etilgen',
  'Rad etilgan': 'Qaytarılǵan',
  'Kassada №{number} · {at}': 'Kassada №{number} · {at}',
  'Rad etilgan: {reason}': 'Qaytarılǵan: {reason}',
  'Zakazni rad etish': 'Buyırmaqtı qaytarıw',
  'Sabab (mijoz sahifasida ko‘rinadi)': 'Sebep (mıjanz betinde kórinedi)',
  'Masalan: mahsulot tugadi': 'Mısalı: ónim tawsıldı',

  // ---------- xodim ekrani: dúkan sazlamaları ----------
  'Bio’ga qo’yiladigan bitta link — mijoz kirib kirmasdan zakaz yuboradi.':
    'Bioǵa qoyılatuǵın bir ǵana silteme — mıjanz kirmesten buyırmaq jiberedi.',
  'Link do‘konni yoqqaningizdan keyin paydo bo‘ladi.':
    'Silteme dúkandi qosqannan keyin payda boladı.',
  'Yoqilgan': 'Qosılǵan',
  'Zakaz qabul qilinadi': 'Buyırmaq qabıl etiledi',
  'Yetkazib berish bor': 'Jetkeriw bar',
  'Minimal zakaz': 'Minimal buyırmaq',
  'To‘lov onlayn olinmaydi. Menyuda faqat faol mahsulotlar ko‘rinadi; qabul qilingan zakaz kassada ochiq buyurtmaga aylanadi.':
    'Tólem onlayn alınbaydı. Menyuda tek ǵana faol ónimler kórinedi; qabıl etilgen buyırmaq kassada ashıq buyırmaǵa aylanadı.',

  // ---------- mijoz beti: menyu ----------
  '{n} ta mahsulot': '{n} ta ónim',
  'Menyu yuklanmoqda...': 'Menyu júklenbekte...',
  'Bu bo‘limda hozircha mahsulot yo‘q.': 'Bul bólimde házirsha ónim joq.',
  'Ko‘paytirish': 'Kóbeytiw',
  'Do‘kon hozir zakaz qabul qilmaydi — keyinroq kirib ko‘ring.':
    'Dúkan házir buyırmaq qabıl etpeydi — keyinirek kirip kóriń.',
  'Zakazni do‘kon tasdiqlagach chaqiradi yoki yetkazadi. To‘lov kassada yoki yetkazuvchiga beriladi.':
    'Dúkan buyırmaqtı tastıyıqlaǵannan keyin qońırawadı yaki jetkeredi. Tólemdi kassada yaki jetkeriwshige beresiz.',
  'Bu menyu ochiq emas — balki do‘kon onlayn zakazni o‘chirgan yoki havola eskirgan.':
    'Bul menyu ashıq emes — dúkan onlayn buyırmaqtı óshirgen yaki silteme eskirgen.',

  // ---------- mijoz beti: satıp alıw betkeshi ----------
  'Zakazingiz yuborildi': 'Buyırmaǵıńız jiberildi',
  'Do‘kon uni ko‘rib chiqadi — holatini shu sahifadan kuzating.':
    'Dúkan onı kórip shıǵadı — halletin usı betten kuzatıń.',
  'Zakazni rasmiylashtirish': 'Buyırmaqtı resmiylestiriw',
  'Minimal zakaz {sum}': 'Minimal buyırmaq {sum}',
  'Minimal zakaz {sum} — yana {gap} qo‘shing': 'Minimal buyırmaq {sum} — taǵı {gap} qosıń',
  'Zakaz turi': 'Buyırmaq túri',
  'Yetkazib berish': 'Jetkeriw',
  'Masalan: Aziza': 'Mısalı: Aziza',
  'Ko‘cha, uy, kvartira': 'Kóshe, úy, kvartira',
  'Masalan: achchiqsiz, 18:00 gacha': 'Mısalı: ashshıqsız, 18:00 ge shekem',
  'Zakazni yuborish': 'Buyırmaqtı jiberiw',
  'To‘lov onlayn olinmaydi — kassada yoki yetkazuvchiga beriladi.':
    'Tólem onlayn alınbaydı — kassada yaki jetkeriwshige beriledi.',
  'Ko‘rib chiqilmoqda': 'Kórip shıǵılmaqta',
  'Rad etildi': 'Qaytarıldı',

  // ---------- xabarlar (api.js we queries.js) ----------
  'Bu havola yopiq ko‘rinadi — sahifani yangilab ko‘ring.':
    'Bul silteme jabıq kórinedi — betti jańalap kóriń.',
  'Do‘kon hozir onlayn zakaz qabul qilmaydi.':
    'Dúkan házir onlayn buyırmaq qabıl etpeydi.',
  'Bu do‘kon hozir onlayn zakaz qabul qilmaydi.':
    'Bul dúkan házir onlayn buyırmaq qabıl etpeydi.',
  'Bu do‘kon yetkazib bermaydi — „Olib ketish“ni tanlang.':
    'Bul dúkan jetkerip bermeydi — „Alıp ketiw“ti tańlań.',
  'Sahifa ma’lumoti buzilgan — sahifani yangilab qayta urinib ko‘ring.':
    'Bet maǵlıwmatı buzılǵan — betti jańalap qaytadan urinip kóriń.',
  'Ismingizni yozing.': 'Atıńızdı jazıń.',
  'Telefon raqami noto‘g‘ri. Masalan: +998 77 763 02 16.':
    'Telefon nomeri qáte. Mısalı: +998 77 763 02 16.',
  'Zakaz turini tanlang.': 'Buyırmaq túrin tańlań.',
  'Yetkazib berish manzilini yozing.': 'Jetkeriw mánzilin jazıń.',
  'Savat bo‘sh — kamida bitta mahsulot tanlang.':
    'Sebet bos — keminde bir ónim tańlań.',
  'Zakazda juda ko‘p mahsulot — kamaytirib qayta urinib ko‘ring.':
    'Buyırmaqta óte kóp ónim bar — azaytırıp qaytadan urinip kóriń.',
  'Mahsulotlardan biri endi sotilmaydi — savatni yangilang.':
    'Ónimlerdiń biri endi satılmaydı — sebetti jańalań.',
  'Biror mahsulot qoldig‘i yetarli emas.': 'Birer ónimniń qaldıǵı jetkilikli emes.',
  'Zakaz summasi minimal miqdordan kam.': 'Buyırmaq summası minimal muǵdardan az.',
  'Zakaz summasi do‘kon belgilagan minimal miqdordan kam.':
    'Buyırmaq summası dúkan belgilegen minimal muǵdardan az.',
  'Juda ko‘p zakaz yuborildi — birozdan so‘ng qayta urinib ko‘ring.':
    'Óte kóp buyırmaq jiberildi — az waqıttan keyin qaytadan urinip kóriń.',
  'Bu zakaz avval rad qilingan.': 'Bul buyırmaq aldın qaytarılǵan.',
  'Internet bilan bog‘lanib bo‘lmadi — ulanishni tekshirib qayta urinib ko‘ring.':
    'Internetke birigip bolmadı — tanıstırıwdı tekserip qaytadan urinip kóriń.',
  'Amal bajarilmadi — qayta urinib ko‘ring.': 'Ámel orınlanbadı — qaytadan urinip kóriń.',
};

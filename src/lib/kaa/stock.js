// Qoraqalpoqcha lug'at: stock.js ekrani (Ombor + Hisobot).
// Kalit — o'zbekcha asl nusxa, qiymat qoraqalpoqcha.
export const STOCK = {
  // ---------- InventoryPage.jsx: sahifa bashi va statistika ----------
  "Mahsulot qoldig'i va harakatlari": 'Ónim qaldıǵı hám hereketleri',
  'Hisobdagi mahsulotlar': 'Anbar esabındaǵı ónimler',
  'Kam qoldiq': 'Kem qaldıq',
  'chegaradan past': 'shegaradan tómen',
  'Qoldiq qiymati': 'Qaldıq bahası',
  "so'm (sotuv narxida)": "so'm (satıw bahasında)",
  'Qidirish...': 'Izlew...',
  'Faqat kam qoldiq': 'Tek ǵana kem qaldıq',

  // ---------- InventoryPage.jsx: jadval boshliqları (th hám data-label) ----------
  'Chegara': 'Shegara',
  'Qiymat': 'Baha',
  'Kam': 'Kem',
  'Yetarli': 'Jeterli',
  'Kirim': 'Kiriw',
  'Chiqim': 'Shıǵıw',
  "So'nggi harakatlar": 'Sońǵı hereketler',
  'Sana': 'Sáne',
  'Miqdor': 'Mıqdár',
  'Tur': 'Túre',
  "Harakatlar tarixi bo'sh": 'Hereketler tariyxı bos',
  // REASONS konstantası (t(REASONS[s].label) arqalı tarjima qilinadı)
  'Savdo': 'Satıw',

  // ---------- InventoryPage.jsx: bo'sh holat ----------
  'Ombor hisobi yoqilgan mahsulotlar yo\'q. Menyu bo\'limida mahsulotga "Ombor hisobini yuritish" belgisini qo\'ying.':
    'Anbar esabı qosılǵan ónimler joq. Menyu bóliminde ónimge "Anbar esabın júritiw" belgisin qosıń.',

  // ---------- InventoryPage.jsx: kirim-chiqim oynası ----------
  "Miqdor 0 dan katta bo'lishi kerak": 'Mıqdár 0 den úlken bolıwı kerek',
  'Kirim saqlandi': 'Kiriw saqlandı',
  'Chiqim saqlandi': 'Shıǵıw saqlandı',
  'Kirim — {name}': 'Kiriw — {name}',
  'Chiqim — {name}': 'Shıǵıw — {name}',
  'Miqdor ({unit})': 'Mıqdár ({unit})',
  'Masalan: Yetkazib beruvchi ABC': 'Mısalı: Jetkeriwshi ABC',
  'Masalan: Yaroqsiz mahsulot': 'Mısalı: Jaramsız ónim',
  'Yangi qoldiq:': 'Jańa qaldıq:',

  // ---------- ReportsPage.jsx: sahifa bashi ----------
  'Hisobot': 'Esap',
  'Yangilanmoqda': 'Jańalanbawde',
  "Xarajat qo'shish": 'Xarajat qosıw',
  // period-bar konstantası (t(label) arqalı tarjima qilinadı)
  'Bugun': 'Búgin',
  '7 kun': '7 kún',
  '30 kun': '30 kún',
  'Hammasi': 'Barlıǵı',
  'Boshqa davr': 'Basqa dawır',

  // ---------- ReportsPage.jsx: statistika kartaları ----------
  'Tushum': 'Túsım',
  "to'langan": 'tólengen',
  "O'rtacha chek": 'Ortasha chek',
  'Xarajatlar': 'Xarajatlar',
  'Sof foyda': 'Taza payda',
  'tushum − xarajat': 'túsım − xarajat',

  // ---------- ReportsPage.jsx: grafikler ----------
  'Kunlik savdo': 'Kúnlik satıw',
  "Bu davrda savdo yo'q": 'Bul dawırde satıw joq',
  '{date}: {sum} ({n} buyurtma)': '{date}: {sum} ({n} buyırmaq)',
  "To'lov turlari": 'Tólem túrleri',
  "Ma'lumot yo'q": 'Maǵlıwmat joq',
  '{n} ta buyurtma': '{n} ta buyırmaq',
  'Top mahsulotlar': 'Top ónimler',

  // ---------- ReportsPage.jsx: xarajatlar ----------
  "Xarajatlar yo'q": 'Xarajatlar joq',
  "Xarajat qo'shildi": 'Xarajat qosıldı',
  "Xarajatni o'chirish": 'Xarajatdı óshiriw',
  '"{title}" ({sum}) o\'chirilsinmi?': '"{title}" ({sum}) óshirilsin ba?',
  "Xarajat o'chirildi": 'Xarajat óshirildi',
  'Xarajat nomini kiriting': 'Xarajat atın kiritiń',
  "Summa 0 dan katta bo'lishi kerak": 'Summa 0 den úlken bolıwı kerek',
  'Yangi xarajat': 'Jańa xarajat',
  'Masalan: Sabzavotlar xaridi': 'Mısalı: Kók ónimler satıp alıwı',
  "Summa (so'm)": "Summa (so'm)",
  // EXPENSE_CATEGORIES — DB category qiymati, o'zbekcha qaladı; render paytida t(c)
  'Masalliqlar': 'Materiallar',
  'Kommunal': 'Kommunal',
  'Ish haqi': 'Xızmet haqı',
  'Ijara': 'Ijara',
  'Transport': 'Transport',
  'Boshqa': 'Basqa',
};

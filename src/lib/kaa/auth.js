// Qoraqalpoqcha lug'at: auth.js ekrani (AuthScreen, App navigatsiyasi,
// AppContext toast'lari, sync/offline/photo/import xabarlari).
// Kalit — o'zbekcha asl nusxa, qiymat — qoraqalpoqcha.
export const AUTH = {
  // ---------- AuthScreen.jsx — brend va bosqichlar ----------
  // ('Qayta urinish', 'Yangi akkaunt', 'Do‘kon ochish', 'Kod bilan qo‘shilish',
  //  'Kassaga kirish' kalitlari boshqa modullarda baribir bor)
  'Fastfood va kichik kafelar uchun': 'Fastfood hám kishkene kafelar ushın',
  'Boshqa akkauntga o‘tish': 'Basqa akkauntqa ótiw',
  'Boshqa akkauntga o‘tish ({email})': 'Basqa akkauntqa ótiw ({email})',
  'Akkaunt': 'Akkaunt',
  'Do‘kon yoki kod': 'Dókán yaki kod',
  'Kirish': 'Kiriw',
  'Akkaunt tayyor — 2-bosqichni tanlang': 'Akkaunt tayar — 2-basqishtı tańlań',

  // ---------- AuthScreen.jsx — 1-bosqich: akkaunt ----------
  'Pochtangizga tasdiqlash havolasi yuborildi. Havolani ochgach, „Kirish“ bo‘limidan kiring.':
    'Pochtańızǵa tastıyıqlaw siltemesi jiberildi. Siltemeni ashqannan keyin, „Kiriw“ bóliminen kiriń.',
  'Avval akkaunt ochasiz — email va parol. Keyingi qadamda do‘kon ochasiz yoki egasi bergan kodni kiritasiz.':
    'Aldın akkaunt ashesız — e-mail hám parol. Keyingi qádemde dókán ashesız yaki iye bergen koddı kiritasız.',
  'Masalan: Dilnoza': 'Mısalı: Dilnoza',
  'Email': 'E-mail',
  'Parol (kamida 6 belgi)': 'Parol (kemde 6 belgi)',
  'Akkaunt ochilmoqda...': 'Akkaunt ashılmaqda...',
  'Akkaunt ochish': 'Akkaunt ashiw',
  'Email va parol bilan kiring. Tizim rolingizni o‘zidan aniqlaydi.':
    'E-mail hám parol menen kiriń. Tizim rolıńızdı ózi anıqlaydı.',
  'Kirilmoqda...': 'Kirilmaqda...',

  // ---------- AuthScreen.jsx — 2-bosqich: do'kon yoki kod ----------
  'Do‘kon turini tanlang — interfeys, menyu va hisobotlar shunga mos sozlanadi.':
    'Dókán túrin tańlań — interfeys, menyu hám esaplar sona layıqlap sozlanadı.',
  ' Siz „{name}“ sifatida egasi bo‘lasiz.': ' Siz „{name}“ sıyaqlı iye bolasıń.',
  'Lavash · burger · pizza — tez xizmat': 'Lavash · burger · pizza — tez xızmet',
  'Stollar bilan o‘tirish · keng menyu': 'Stollar menen otırıw · keń menyu',
  'Masalan: KetaFood': 'Mısalı: KetaFood',
  'Do‘kon ochilmoqda...': 'Dókán ashılmaqda...',
  'Do‘konni ochish': 'Dókandı ashiw',
  'Do‘kon egasi bergan kodni kiriting. Kod rolingizni belgilaydi: ofitsant, kassir yoki oshxona.':
    'Dókán iyesi bergen koddı kiritiń. Kod rolıńızdı belgileydi: ofitsiant, kassir yaki asıqxana.',
  'Taklif kodi': 'Taklif kodı',
  'Ism (stolda shu nom chiqadi)': 'Atı (stolda usı nom shıǵadı)',
  'Masalan: Sardor': 'Mısalı: Sardor',
  'Tekshirilmoqda...': 'Tekserilmaqda...',
  'Do‘konga qo‘shilish': 'Dókanǵa qosılıw',

  // ---------- AuthScreen.jsx — Serverga ulanish (SetupNotice) ----------
  'Serverga ulanish kerak': 'Serverge ulanıw kerek',
  'Supabase kalitlari kiritilmagan.': 'Supabase kalısları kiritilgen.',
  'Loyiha papkasidagi': 'Loyha papkasındaǵı',
  'fayliga ikki qatorni to‘ldiring:': 'faylına eki qatardı toltırıń:',
  'va': 'hám',
  'Keynalarni Supabase → Project Settings → API bo‘limidan olish mumkin.':
    'Kalıslardı Supabase → Project Settings → API bóliminen alıw múmkin.',
  'Saqlagandan so‘ng sahifani yangilang (F5).': 'Saqlaǵannan keyin betti jańalań (F5).',

  // ---------- App.jsx — sidebar va profil ----------
  'Fastfood & Kafe': 'Fastfood hám Kafe',
  'Profil': 'Profil',
  'Siz + {n} kishi onlayn': 'Siz + {n} kisi onlayn',
  'Hozir faqat siz onlaysiz': 'Házir tek ǵana siz onlaysız',
  'Oflaynda qilingan amallar — ochib ko‘ring': 'Oflaynda orınlanǵan áreketler — ashıp kóriń',
  'Oflayn · {n} amal navbatda': 'Oflayn · {n} ámel nawbette',
  '{n} amal yuborilmoqda': '{n} ámel jiberilmaqda',
  'oflayn rejim': 'oflayn rejim',
  'server rejimi': 'server rejimi',
  'Ism yangilandi': 'Atı jańalandı',
  'Mening akkauntim': 'Meniń akkauntım',
  'Do‘kon': 'Dókán',
  'Ekranlar': 'Ekranlar',
  'Ism (buyurtmada va stolda ko‘rinadi)': 'Atı (buyırmaqta hám stolda kórinedi)',
  'Chiqish': 'Shıǵıw',

  // ---------- App.jsx — rejim almashtirgısh, darvaza, óshirilgen dókan ----------
  'Rejim:': 'Rejim:',
  'Faqat ko‘rinish — amal rolingizga qarab cheklanadi': 'Tek ǵana kórinis — áreketler rolıńızǵa qarap sheklenedi',
  'Xatolik yuz berdi': 'Qáte júz berdi',
  'Akkaunt tekshirilmoqda...': 'Akkaunt tekserilmaqda...',
  'POS yuklanmoqda...': 'POS júklenbawde...',
  'Bu do‘kon platforma tomonidan to‘xtatilgan (siz o‘zingiz).':
    'Bul dókán platforma tárepinen toqtatılǵan (siz ózińiz).',
  'Bu do‘kon KetaPOS tomonidan to‘xtatildi — hisobotlarni ko‘rasiz, yangi amal qila olmaysiz.':
    'Bul dókán KetaPOS tárepinen toqtatıldı — esaplardı kóresiz, jańa ámel qıla almasız.',
  'Boshqarish': 'Basqarıw',

  // ---------- AppContext.jsx — toast xabarlari ----------
  'Navbat yuborildi: {synced} amal serverga ketdi': 'Nawbet jiberildi: {synced} ámel serverge ketti',
  '{failed} amal yuborilmadi — „Navbat“ oynasini oching': '{failed} ámel jiberilmedi — „Nawbet“ oynasın ashıń',
  'Yangi buyurtma №{number}': 'Jańa buyırmaq №{number}',

  // ---------- sync.js — navbat xatolıkları ----------
  'Navbatdagi noma’lum amal': 'Nawbetdegis belgisiz ámel',
  'Buyurtma serverga yuborilmagan — avval uni yuborish kerak':
    'Buyırmaq serverge jiberilmegen — aldın onı jiberiw kerek',

  // ---------- importLegacy.js / photo.js ----------
  "Kompyuterda eski (lokal) ma'lumot topilmadi.": 'Kompyuterde eski (lokal) maǵlıwmat tabılmadı.',
  'Rasmni o‘qib bo‘lmadi. JPEG, PNG yoki WebP fayl tanlang.':
    'Súwretti oqıp bolmadı. JPEG, PNG yaki WebP fayl tańlań.',
  'Rasm o‘lchami aniq emas.': 'Súwrettiń ólshemi anıq emes.',
  'Rasmni tayyorlab bo‘lmadi.': 'Súwretti tayarlap bolmadı.',

  // ---------- supabase/auth.js — kiriw qáte xabamları (t(auth.error) arqalı) ----------
  'Avval akkauntga kiring.': 'Aldın akkauntqa kiriń.',
  'Bu akkaunt allaqachon bir do‘konga ulangan.': 'Bul akkaunt álleqashan bir dókanǵa ulanǵan.',
  'Do‘kon turi fastfood yoki cafe bo‘lishi kerak.': 'Dókán túri fastfood yaki cafe bolıwı kerek.',
  'Do‘kon nomini kiriting.': 'Dókán atın kiritiń.',
  'Taklif kodi noto‘g‘ri yoki allaqachon ishlatilgan.': 'Taklif kodı qáte yaki álleqashan isletilgen.',
  'Bu taklif kodining muddati tugagan — egasidan yangi kod so‘rang.':
    'Bul taklif kodınıń múddeti túgen — iyesinen jańa kod sorıń.',
  'Kod juda ko‘p marta noto‘g‘ri kiritildi — 15 daqiqadan so‘ng urinib ko‘ring.':
    'Kod óte kóp márte qáte kiritildi — 15 minuttan keyin urınıp kóriń.',
  'Rol tanlang: ofitsant, kassir yoki oshxona.': 'Rol tańlań: ofitsiant, kassir yaki asıqxana.',
  'Buni faqat do‘kon egasi qilishi mumkin.': 'Bunı tek ǵana dókán iyesi qılıwı múmkin.',
  'Email yoki parol xato.': 'E-mail yaki parol qáte.',
  'Bu email bilan akkaunt mavjud — „Kirish“ bo‘limidan kiring.':
    'Bul e-mail menen akkaunt bar — „Kiriw“ bóliminen kiriń.',
  'Parol kamida 6 belgi bo‘lishi kerak.': 'Parol kemde 6 belgi bolıwı kerek.',
  'Email manzili noto‘g‘ri.': 'E-mail manzili qáte.',
  'Noma’lum xatolik': 'Belgisiz qáte',
  'Internet yo‘q va akkaunt ma’lumoti saqlanmagan — onlayn bo‘lgach qayta urinib ko‘ring.':
    'Internet joq hám akkaunt maǵlıwmatı saqlanbaǵan — onlayn bolǵannan keyin qayta urınıp kóriń.',
};

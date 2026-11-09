import {
  Calculator, Armchair, UtensilsCrossed, Boxes, UsersRound, ChartNoAxesColumn,
  Globe, ShieldCheck, Zap,
} from 'lucide-react';

export const BRAND = {
  product: 'KetaPOS',
  tagline: 'Kassa va restoran boshqaruv tizimi',
  company: 'KETA-COMP',
  companySite: 'https://keta.uz',
  companyNote: 'Biznes uchun zamonaviy raqamli yechimlar.',
  phoneLabel: '+998 77 763 02 16',
  phoneHref: 'tel:+998777630216',
  appHref: '/app',
  // /public dagi asl rasmlar o'zgarishsiz qoladi; landing uchun shu rasmlarning
  // siqilgan nusxasi ishlatiladi (bir xil piksel, 4.2 MB o'rniga 0.3 MB).
  logo: '/landing/logo-160.webp',
  hero: '/landing/hero.webp',
  devices: '/landing/noutbok.webp',
};

export const NAV = [
  { href: '#top', label: 'Bosh sahifa' },
  { href: '#imkoniyatlar', label: 'Imkoniyatlar' },
  { href: '#sohalar', label: 'Sohalar' },
  { href: '#qanday-ishlaydi', label: 'Qanday ishlaydi?' },
  { href: '#faq', label: 'FAQ' },
];

export const FEATURES = [
  { icon: Calculator, title: 'POS kassa', text: 'Tezkor savdo va to‘lov' },
  { icon: Armchair, title: 'Stollar boshqaruvi', text: 'Zal, stol va bron nazorati' },
  { icon: UtensilsCrossed, title: 'Buyurtmalar', text: 'Qabul, tayyorlash va yetkazish' },
  { icon: Boxes, title: 'Ombor', text: 'Mahsulot qoldig‘i va kirim-chiqim' },
  { icon: UsersRound, title: 'Xodimlar', text: 'Rollar, smena va nazorat' },
  { icon: ChartNoAxesColumn, title: 'Hisobotlar', text: 'Savdo, daromad va tahlil' },
];

export const HERO_BADGES = [
  { icon: Zap, text: 'Tez va qulay' },
  { icon: ShieldCheck, text: 'Ishonchli' },
  { icon: Globe, text: 'Barcha qurilmalarda' },
];

export const INDUSTRIES = [
  {
    id: 'cafe',
    image: '/landing/cafe.webp',
    icon: Calculator,
    title: 'Kafelar uchun',
    text: 'Menyu, tezkor kassa va qulay xizmat.',
    points: [
      'Menyu va kategoriya boshqaruvi — narx, rasmi va qoldig‘i bir joyda',
      'Stollar va band holati: qaysi stol kimga tegishli ko‘rinib turadi',
      'Oflayn rejim: internet uzilsa ham savdo to‘xtamaydi',
      'Chek chop etish: 58 va 80 mm termal printerlar',
    ],
  },
  {
    id: 'restaurant',
    image: '/landing/restaurant.webp',
    icon: UtensilsCrossed,
    title: 'Restoranlar uchun',
    text: 'Zal, stollar, ofitsiantlar va oshxona nazorati.',
    points: [
      'Ofitsiant o‘z telefonidan ochadi — kassaga yugurish shart emas',
      'Oshxona ekranida buyurtmalar navbat bilan tayyorlanadi',
      'Xodimlar rollari: egasi, ofitsant, kassir, oshxona',
      'Hisobot: kun, hafta va oy bo‘yicha savdo va daromad',
    ],
  },
  {
    id: 'fastfood',
    image: '/landing/fastfood.webp',
    icon: Boxes,
    title: 'Fastfoodlar uchun',
    text: 'Tez buyurtma, navbat va olib ketish rejimi.',
    points: [
      'Bir necha soniyada buyurtma: kategoriya → mahsulot → to‘lov',
      'Olib ketish va yetkazib berish rejimlari alohida belgilanadi',
      'Ombor: qoldiq avtomatik kamayadi, tugagan mahsulot ko‘rinadi',
      'Kassa almashinuvi va smena hisoboti',
    ],
  },
];

export const PLATFORMS = [
  { id: 'windows', label: 'Windows', note: 'Yuklab olinadigan dastur' },
  { id: 'android', label: 'Android', note: 'Telefonda ilova kabi' },
  { id: 'web', label: 'Brauzer', note: 'O‘rnatishsiz ham ishlaydi' },
];

export const STEPS = [
  { n: '01', title: 'Ariza qoldiring', text: 'Qisqa ma’lumotlarni to‘ldiring.' },
  { n: '02', title: 'Sozlab beramiz', text: 'Soha va biznesingizga mos sozlaymiz.' },
  { n: '03', title: 'Ishlashni boshlang', text: 'Biznesingizni raqamlashtiring.' },
];

export const FAQ = [
  {
    q: 'KetaPOS nima va kimga mo‘ljallangan?',
    a: 'Kassa, buyurtma, stollar, ombor, xodimlar va hisobotlarni bitta platformada yig‘adigan tizim. Kafe, restoran va fastfoodlar uchun qurilgan.',
  },
  {
    q: 'Qanday qurilmalarda ishlaydi?',
    a: 'Windows kompyuterda alohida dastur sifatida, Android telefonda ilova kabi, istalgan brauzerda esa saytdan ochib. iOS versiyasi hozircha yo‘q.',
  },
  {
    q: 'Chek chop etish ishlaydimi?',
    a: 'Ha. 58 va 80 mm termal ESC/POS printerlar USB, COM port yoki fayl orqali ulanadi. Demo paytida printer yonida bo‘lsa, birga sinab ko‘ramiz.',
  },
  {
    q: 'Internet uzilib qolsa nima bo‘ladi?',
    a: 'Kassa ishlashda davom etadi: savdo qurilmada navbatga yoziladi, internet tiklanishi bilan serverga o‘zi ketadi. Hech qanday buyurtma yo‘qolmaydi.',
  },
  {
    q: 'Bir necha xodim bir vaqtda ishlay oladimi?',
    a: 'Ha. Har bir xodim o‘z akkaunti va roli bilan kiradi, ekranlar bir-birini jonli ko‘rib turadi: ofitsant ochgan buyurtma kassa va oshxonada darhol ko‘rinadi.',
  },
  {
    q: 'Ma’lumotlarim qayerda saqlanadi va kim ko‘radi?',
    a: 'Barcha ma’lumot bulutda, sizning do‘koningiz uchun alohida ajratilgan holda saqlanadi. Boshqa do‘konlar sizning savdo va hisobotlaringizni ko‘ra olmaydi.',
  },
  {
    q: 'Narxi qancha?',
    a: 'Narx biznes hajmiga qarab belgilanadi — ariza qoldiring yoki +998 77 763 02 16 raqami orqali qo‘ng‘iroq qiling, shu bilan birga bepul demo ko‘rsatamiz.',
  },
];

export const BUSINESS_KINDS = [
  { id: 'cafe', label: 'Kafe' },
  { id: 'restaurant', label: 'Restoran' },
  { id: 'fastfood', label: 'Fastfood' },
];

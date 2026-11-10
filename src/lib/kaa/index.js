// Qoraqalpoqcha lug'at fayllari: har bir modul o'z ekrani matnlarini ushlaydi.
// Kalit — o'zbekcha asl nusxa; qamov tekshiruvi (npm run lang:check) tushib
// qolgan kalitlarni ko'rsatadi.

import { LANDING } from './landing.js';
import { POS } from './pos.js';
import { MENU } from './menu.js';
import { HALL } from './hall.js';
import { STOCK } from './stock.js';
import { TEAM } from './team.js';
import { SETTINGS } from './settings.js';
import { AUTH } from './auth.js';
import { ERRORS } from './errors.js';

export const KAA = {
  ...ERRORS,
  ...AUTH,
  ...SETTINGS,
  ...TEAM,
  ...STOCK,
  ...HALL,
  ...MENU,
  ...POS,
  ...LANDING,
};

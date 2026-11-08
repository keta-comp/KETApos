// KetaPOS brend logotipidan barcha grafikani yasaydi:
//   * shaffof mark (qush) va to'liq lockup (qush + "KetaPOS" yozuvi),
//   * PWA/favikon ikonalar (oq planchetka ustida qora mark),
//   * Electron uchun 512 px PNG.
//
// Manba: brand/ketapos-logo.png — oq fonda qora logotip. Skript fanni
// shaffofga aylantiradi va qush/yozuvni qator bo'yicha bo'sh joy orqali
// ajratadi, shuning uchun yangi logotip berilsa ham qayta ishlaydi.
//
//   npm run brand

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'brand', 'ketapos-logo.png');

// Fon oqqa yaqin, siyoh deyarli qora: to'liq yopishqanlik chegarasi.
const INK_FULL = 45;
const BG_EMPTY = 250;
const DETECT = 200;

async function main() {
  const { data, info } = await sharp(source).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  const lum = (x, y) => {
    const i = (y * W + x) * C;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  };

  // Oq fon -> shaffof: qoplamani yorqinlikdan hisoblaymiz, rangni esa oq
  // fon ustiga aralashgan holatdan orqaga qaytaramiz (un-premultiply).
  const rgba = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = (y * W + x) * C;
      const L = 0.2126 * data[s] + 0.7152 * data[s + 1] + 0.0722 * data[s + 2];
      const a = Math.min(1, Math.max(0, (BG_EMPTY - L) / (BG_EMPTY - INK_FULL)));
      const t = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) {
        rgba[t + k] = a === 0 ? 0 : Math.round(Math.min(255, Math.max(0, (data[s + k] - 255 * (1 - a)) / a)));
      }
      rgba[t + 3] = Math.round(a * 255);
    }
  }
  const base = sharp(rgba, { raw: { width: W, height: H, channels: 4 } });
  const png = await base.png().toBuffer();

  // Qatorlarda qancha siyoh bor — shu bilan mark va yozuv ajraladi.
  const rowCount = [];
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x += 2) if (lum(x, y) < DETECT) n++;
    rowCount.push(n);
  }
  const bands = [];
  let start = -1;
  for (let y = 0; y <= H; y++) {
    const on = y < H && rowCount[y] > 0;
    if (on && start < 0) start = y;
    if (!on && start >= 0) {
      if (y - start > 6) bands.push([start, y - 1]);
      start = -1;
    }
  }
  if (!bands.length) throw new Error('Logotip topilmadi: rasm butunlay oq.');

  const boxOf = ([y0, y1]) => {
    let x0 = W;
    let x1 = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = 0; x < W; x += 2) {
        if (lum(x, y) < DETECT) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
        }
      }
    }
    return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  };

  const boxes = bands.map(boxOf);
  const markBox = boxes[0];
  const fullBox = boxes.reduce((a, b) => {
    const left = Math.min(a.left, b.left);
    const top = Math.min(a.top, b.top);
    const right = Math.max(a.left + a.width, b.left + b.width);
    const bottom = Math.max(a.top + a.height, b.top + b.height);
    return { left, top, width: right - left, height: bottom - top };
  });

  const mark = await sharp(png).extract(markBox).png().toBuffer();
  const full = await sharp(png).extract(fullBox).png().toBuffer();

  const publicDir = path.join(root, 'public');
  const brandDir = path.join(publicDir, 'brand');
  const iconDir = path.join(publicDir, 'icons');
  const buildDir = path.join(root, 'build');
  for (const dir of [brandDir, iconDir, buildDir]) await mkdir(dir, { recursive: true });

  // UI plitalari uchun atrofida ozgina bo'sh joy qoldiramiz.
  const padded = await addPadding(mark, 0.06);
  await writeFile(path.join(brandDir, 'ketapos-mark.png'), await sharp(padded).resize(320).png().toBuffer());
  await writeFile(path.join(brandDir, 'ketapos-logo.png'), await sharp(full).resize(1024).png().toBuffer());

  const targets = [
    [path.join(iconDir, 'icon-192.png'), 192, 0.62],
    [path.join(iconDir, 'icon-512.png'), 512, 0.62],
    [path.join(iconDir, 'maskable-512.png'), 512, 0.54],
    [path.join(iconDir, 'apple-touch-icon.png'), 180, 0.6],
    [path.join(publicDir, 'app-icon.png'), 512, 0.62],
    [path.join(publicDir, 'favicon-48.png'), 48, 0.8],
    [path.join(publicDir, 'favicon-32.png'), 32, 0.82],
    [path.join(publicDir, 'favicon-16.png'), 16, 0.86],
    [path.join(buildDir, 'icon.png'), 512, 0.62],
  ];
  for (const [file, size, fill] of targets) {
    await writeFile(file, await tile(mark, size, fill));
    console.log(path.relative(root, file), `${size}x${size}`);
  }
  console.log('mark', `${markBox.width}x${markBox.height}`, '| lockup', `${fullBox.width}x${fullBox.height}`, '| qatorlar', bands.length);
}

// Markni oq kvadrat planchetkaga markazlashtiradi.
async function tile(markPng, size, fill) {
  const w = Math.round(size * fill);
  const resized = await sharp(markPng).resize({ width: w, fit: 'inside' }).png().toBuffer();
  const { width, height } = await sharp(resized).metadata();
  return sharp({
    create: { width: size, height: size, channels: 4, background: '#ffffff' },
  })
    .composite([{ input: resized, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function addPadding(png, ratio) {
  const { width, height } = await sharp(png).metadata();
  const pad = Math.round(Math.max(width, height) * ratio);
  const size = Math.max(width, height) + pad * 2;
  return sharp({ create: { width: size, height: size, channels: 4, background: 'rgba(0,0,0,0)' } })
    .composite([{ input: png, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }])
    .png()
    .toBuffer();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const svg = await readFile(path.join(root, 'public', 'app-icon.svg'));
const outDir = path.join(root, 'public', 'icons');
await mkdir(outDir, { recursive: true });

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
];

for (const [name, size] of targets) {
  await sharp(svg, { density: 320 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, name));
  console.log(`${name} ${size}x${size}`);
}

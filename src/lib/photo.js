// Rasmni mos ruxsat va hajmdagi JPEG'ga aylantiradi: markazdan kvadrat kesib,
// tomoni eng ko'pi 512 px. Storage limitidan (2 MB) ancha past qoladi.

const MAX_SIDE = 512;

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // eski brauzerlar yoki format — pastdagi Image orqali urinib ko'ramiz
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Rasmni o‘qib bo‘lmadi. JPEG, PNG yoki WebP fayl tanlang.'));
    img.src = url;
  });
}

export async function toProductPhoto(file) {
  const src = await decode(file);
  const w = src.width || src.naturalWidth;
  const h = src.height || src.naturalHeight;
  if (!w || !h) throw new Error('Rasm o‘lchami aniq emas.');
  const side = Math.max(1, Math.min(w, h, MAX_SIDE));
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  canvas.getContext('2d').drawImage(src, Math.round((w - side) / 2), Math.round((h - side) / 2), side, side, 0, 0, side, side);
  src.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new Error('Rasmni tayyorlab bo‘lmadi.');
  return blob;
}

export function previewUrl(blob) {
  return URL.createObjectURL(blob);
}

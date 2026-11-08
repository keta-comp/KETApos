import { photoPublicUrl } from '../supabase/queries.js';

// Mahsulot rasmi; rasm bo'lmasa emoji ko'rsatiladi.
export default function ProductThumb({ product, className, emojiClass }) {
  const url = photoPublicUrl(product.photo_path);
  if (!url) return <span className={emojiClass}>{product.emoji}</span>;
  return <img className={className} src={url} alt={product.name} loading="lazy" />;
}

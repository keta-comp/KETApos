import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import { useData } from '../state/useData.js';
import {
  getCategories, getProducts, addCategory, updateCategory, deleteCategory,
  addProduct, updateProduct, deleteProduct, uploadProductPhoto, clearProductPhoto, photoPublicUrl,
} from '../supabase/queries.js';
import { fmtMoney, fmtQty } from '../lib/format.js';
import { toProductPhoto } from '../lib/photo.js';
import Modal, { ConfirmModal } from '../components/Modal.jsx';
import DataState from '../components/DataState.jsx';
import ProductThumb from '../components/ProductThumb.jsx';

const EMOJIS = ['🍔','🍕','🌯','🍗','🍟','🥤','🍰','🍦','🍩','☕','🍵','💧','🥛','🍋','🧀','🌶️','🍄','🧅','🥗','🍜','🥪','🌭','🍿','🧃','🥩','🍳','🥐','🍽️'];
const COLORS = ['#f97316','#ef4444','#eab308','#84cc16','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#64748b'];

export default function MenuPage() {
  const { toast } = useApp();
  const [activeCat, setActiveCat] = useState(null);
  const [catForm, setCatForm] = useState(null);
  const [catDelete, setCatDelete] = useState(null);
  const [prodForm, setProdForm] = useState(null);
  const [prodDelete, setProdDelete] = useState(null);

  const { data, loading, error, reload } = useData(async () => {
    const [categories, products] = await Promise.all([getCategories(), getProducts()]);
    return { categories, products };
  });

  const categories = data?.categories || [];
  const products = data?.products || [];
  const filtered = activeCat ? products.filter((p) => p.category_id === activeCat) : products;

  if (!data) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">📋 Menyu</h1>
            <div className="page-sub">Ma'lumot yuklanmoqda</div>
          </div>
        </div>
        <div className="page-body">
          <DataState loading={loading} error={error} onRetry={reload} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">📋 Menyu</h1>
          <div className="page-sub">{categories.length} kategoriya · {products.length} mahsulot</div>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => setProdForm({ category_id: activeCat || categories[0]?.id })}>
            + Mahsulot qo'shish
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="menu-layout">
          <div className="card card-pad">
            <div className="row-between mb-2">
              <span className="bold">Kategoriyalar</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setCatForm({ name: '', emoji: '🍽️', color: COLORS[0] })}>+ Qo'shish</button>
            </div>
            <div className="cat-list">
              <div className={`cat-row ${!activeCat ? 'active' : ''}`} onClick={() => setActiveCat(null)}>
                <span className="cat-emoji">🍽️</span>
                <span className="cat-name">Barchasi</span>
                <span className="cat-count">{products.length}</span>
              </div>
              {categories.map((c) => (
                <div key={c.id} className={`cat-row ${activeCat === c.id ? 'active' : ''}`} onClick={() => setActiveCat(c.id)}>
                  <span className="color-dot" style={{ background: c.color }} />
                  <span className="cat-emoji">{c.emoji}</span>
                  <span className="cat-name">{c.name}</span>
                  <span className="cat-count">{products.filter((p) => p.category_id === c.id).length}</span>
                  <span className="cat-row-actions">
                    <button onClick={(e) => { e.stopPropagation(); setCatForm(c); }}>✏️</button>
                    <button onClick={(e) => { e.stopPropagation(); setCatDelete(c); }}>🗑</button>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mahsulot</th>
                  <th>Kategoriya</th>
                  <th className="text-right">Narx</th>
                  <th className="text-center">Qoldiq</th>
                  <th className="text-center">Holat</th>
                  <th className="text-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} style={!p.active ? { opacity: 0.5 } : {}}>
                    <td>
                      <div className="product-row-name">
                        <ProductThumb product={p} className="row-photo" emojiClass="product-row-emoji" />
                        {p.name}
                      </div>
                    </td>
                    <td className="muted">{p.category_name}</td>
                    <td className="text-right bold nowrap">{fmtMoney(p.price)}</td>
                    <td className="text-center">
                      {p.track_stock ? (
                        <span className={p.stock_qty <= 0 ? 'stock-out' : p.stock_qty <= p.low_stock ? 'stock-low' : 'stock-ok'}>
                          {fmtQty(p.stock_qty)} {p.unit}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="text-center">
                      {p.active ? <span className="badge badge-green">Faol</span> : <span className="badge badge-gray">Nofaol</span>}
                    </td>
                    <td className="text-right nowrap">
                      <button className="btn btn-ghost btn-sm" onClick={() => setProdForm(p)}>✏️</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setProdDelete(p)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state">
                <span className="empty-emoji">📋</span>
                Mahsulotlar yo'q
              </div>
            )}
          </div>
        </div>
      </div>

      {catForm && (
        <CategoryFormModal
          category={catForm}
          onClose={() => setCatForm(null)}
          onSaved={() => { setCatForm(null); toast('Kategoriya saqlandi'); }}
        />
      )}

      {catDelete && (
        <ConfirmModal
          title="Kategoriyani o'chirish"
          message={`"${catDelete.name}" kategoriyasi o'chirilsinmi?`}
          confirmLabel="O'chirish"
          danger
          onClose={() => setCatDelete(null)}
          onConfirm={async () => {
            try {
              await deleteCategory(catDelete.id);
              if (activeCat === catDelete.id) setActiveCat(null);
              toast("Kategoriya o'chirildi", 'info');
            } catch (e) {
              toast(e.message, 'error');
            }
          }}
        />
      )}

      {prodForm && (
        <ProductFormModal
          product={prodForm}
          categories={categories}
          onClose={() => setProdForm(null)}
          onSaved={() => { setProdForm(null); toast('Mahsulot saqlandi'); }}
        />
      )}

      {prodDelete && (
        <ConfirmModal
          title="Mahsulotni o'chirish"
          message={`"${prodDelete.name}" o'chirilsinmi? Sotuv tarixi bo'lsa, mahsulot arxivlanadi (nofaol).`}
          confirmLabel="O'chirish"
          danger
          onClose={() => setProdDelete(null)}
          onConfirm={async () => {
            try {
              const res = await deleteProduct(prodDelete.id);
              toast(res === 'archived' ? 'Sotuv tarixi bo\'lgani uchun nofaol qilindi' : 'Mahsulot o\'chirildi', 'info');
            } catch (e) {
              toast(e.message, 'error');
            }
          }}
        />
      )}
    </div>
  );
}

function CategoryFormModal({ category, onClose, onSaved }) {
  const { toast } = useApp();
  const [name, setName] = useState(category.name || '');
  const [emoji, setEmoji] = useState(category.emoji || '🍽️');
  const [color, setColor] = useState(category.color || COLORS[0]);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast('Kategoriya nomini kiriting', 'error');
      return;
    }
    setBusy(true);
    try {
      if (category.id) await updateCategory(category.id, { name: name.trim(), emoji, color });
      else await addCategory({ name: name.trim(), emoji, color });
      onSaved();
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={category.id ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}
      onClose={onClose}
      width={460}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Bekor qilish</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label">Nomi</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label className="label">Belgi (emoji)</label>
        <div className="emoji-picker">
          {EMOJIS.map((e) => (
            <button key={e} className={`emoji-opt ${emoji === e ? 'active' : ''}`} onClick={() => setEmoji(e)}>{e}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label className="label">Rang</label>
        <div className="color-picker">
          {COLORS.map((c) => (
            <button key={c} className={`color-opt ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
    </Modal>
  );
}

function ProductFormModal({ product, categories, onClose, onSaved }) {
  const { toast } = useApp();
  const { venue } = useAuth();
  const [name, setName] = useState(product.name || '');
  const [categoryId, setCategoryId] = useState(product.category_id || categories[0]?.id);
  const [price, setPrice] = useState(product.price ?? '');
  const [emoji, setEmoji] = useState(product.emoji || '🍽️');
  const [active, setActive] = useState(product.active ?? 1);
  const [trackStock, setTrackStock] = useState(product.track_stock ?? 0);
  const [stockQty, setStockQty] = useState(product.stock_qty ?? 0);
  const [lowStock, setLowStock] = useState(product.low_stock ?? 5);
  const [unit, setUnit] = useState(product.unit || 'dona');
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileRef = useRef(null);
  const urlRef = useRef(null);
  const createdRef = useRef(null);

  useEffect(() => () => URL.revokeObjectURL(urlRef.current), []);

  const preview = photo?.url || (!removePhoto ? photoPublicUrl(product.photo_path) : null);

  function dropPhoto() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPhoto(null);
  }

  function keepExistingPhoto() {
    dropPhoto();
    setRemovePhoto(false);
  }

  async function onPick(file) {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await toProductPhoto(file);
      dropPhoto();
      urlRef.current = URL.createObjectURL(blob);
      setPhoto({ blob, url: urlRef.current });
      setRemovePhoto(false);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!name.trim()) return toast('Mahsulot nomini kiriting', 'error');
    if (!(Number(price) > 0)) return toast("Narx 0 dan katta bo'lishi kerak", 'error');
    if (!categoryId) return toast('Kategoriya tanlang', 'error');
    const payload = {
      category_id: String(categoryId),
      name: name.trim(),
      price: Math.round(Number(price)),
      emoji,
      active: active ? 1 : 0,
      track_stock: trackStock ? 1 : 0,
      low_stock: Number(lowStock) || 0,
      unit: unit || 'dona',
    };
    setBusy(true);
    try {
      let productId = product.id || createdRef.current;
      if (productId) {
        await updateProduct(productId, payload);
      } else {
        productId = await addProduct({ ...payload, stock_qty: trackStock ? Number(stockQty) || 0 : 0 });
        createdRef.current = productId;
      }
      if (photo) {
        await uploadProductPhoto({ venueId: venue.id, productId, blob: photo.blob });
      } else if (removePhoto && product.photo_path) {
        await clearProductPhoto({ productId, path: product.photo_path });
      }
      onSaved();
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={product.id ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Bekor qilish</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label">Nomi</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="form-row">
        <div className="field">
          <label className="label">Kategoriya</label>
          <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">Narx (so'm)</label>
          <input className="input" type="number" min="0" step="500" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label className="label">Belgi (emoji)</label>
        <div className="emoji-picker">
          {EMOJIS.map((e) => (
            <button key={e} className={`emoji-opt ${emoji === e ? 'active' : ''}`} onClick={() => setEmoji(e)}>{e}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label className="label">Rasm (telefon kamerasi yoki galereya)</label>
        <div className="photo-row">
          <div className="photo-box">
            {preview ? <img src={preview} alt="" /> : <span>📷</span>}
          </div>
          <div className="photo-actions">
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => fileRef.current.click()}>
              {preview ? '🔄 Almashtirish' : '📷 Rasm tanlash'}
            </button>
            {preview && (photo ? (
              <button className="btn btn-ghost btn-sm" onClick={keepExistingPhoto}>Bekor qilish</button>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => setRemovePhoto(true)}>✕ Ochirish</button>
            ))}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>
        <p className="muted mt-1">Rasm avtomatik kvadrat qilib kesiladi va siqiladi (telefon uchun yengil).</p>
      </div>
      <div className="col">
        <label className="check-row">
          <input type="checkbox" checked={!!active} onChange={(e) => setActive(e.target.checked ? 1 : 0)} />
          Faol (kassada ko'rinadi)
        </label>
        <label className="check-row">
          <input type="checkbox" checked={!!trackStock} onChange={(e) => setTrackStock(e.target.checked ? 1 : 0)} />
          Ombor hisobini yuritish
        </label>
      </div>
      {!!trackStock && (
        <div className="form-row-3 mt-2">
          {!product.id && (
            <div className="field">
              <label className="label">Boshlang'ich qoldiq</label>
              <input className="input" type="number" min="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label className="label">Kam qoldiq chegarasi</label>
            <input className="input" type="number" min="0" value={lowStock} onChange={(e) => setLowStock(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">O'lchov birligi</label>
            <select className="select" value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="dona">dona</option>
              <option value="kg">kg</option>
              <option value="litr">litr</option>
              <option value="porsiya">porsiya</option>
            </select>
          </div>
        </div>
      )}
      {product.id && !!trackStock && (
        <p className="muted mt-1">Joriy qoldiq: <b>{fmtQty(product.stock_qty)} {product.unit}</b>. Qoldiqni Ombor bo'limida o'zgartiring.</p>
      )}
    </Modal>
  );
}
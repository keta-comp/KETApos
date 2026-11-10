import { useEffect, useRef, useState } from 'react';
import {
  ClipboardList, Plus, LayoutGrid, Pencil, Trash2, Camera, RefreshCw, X,
} from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import { useData } from '../state/useData.js';
import {
  getCategories, getProducts, addCategory, updateCategory, deleteCategory,
  addProduct, updateProduct, deleteProduct, uploadProductPhoto, clearProductPhoto, photoPublicUrl,
} from '../supabase/queries.js';
import { fmtMoney, fmtQty } from '../lib/format.js';
import { toProductPhoto } from '../lib/photo.js';
import { t } from '../lib/i18n.js';
import Modal, { ConfirmModal } from '../components/Modal.jsx';
import PageSkeleton from '../components/PageSkeleton.jsx';
import ProductThumb from '../components/ProductThumb.jsx';
import { Sk, SkRows } from '../components/Skeleton.jsx';

const EMOJIS = ['🍔','🍕','🌯','🍗','🍟','🥤','🍰','🍦','🍩','☕','🍵','💧','🥛','🍋','🧀','🌶️','🍄','🧅','🥗','🍜','🥪','🌭','🍿','🧃','🥩','🍳','🥐','🍽️'];
const COLORS = ['#f97316','#ef4444','#eab308','#84cc16','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#64748b'];

export default function MenuPage() {
  const { toast } = useApp();
  const [activeCat, setActiveCat] = useState(null);
  const [catForm, setCatForm] = useState(null);
  const [catDelete, setCatDelete] = useState(null);
  const [prodForm, setProdForm] = useState(null);
  const [prodDelete, setProdDelete] = useState(null);

  const { data, error, reload } = useData(async () => {
    const [categories, products] = await Promise.all([getCategories(), getProducts()]);
    return { categories, products };
  });

  const categories = data?.categories || [];
  const products = data?.products || [];
  const filtered = activeCat ? products.filter((p) => p.category_id === activeCat) : products;

  if (!data) {
    return (
      <PageSkeleton icon={ClipboardList} title={t('Menyu')} error={error} onRetry={reload}>
        <div className="menu-layout">
          <div className="card card-pad">
            <div className="sk-list">
              <Sk w="44%" h={13} r={6} />
              {Array.from({ length: 6 }, (_, i) => <Sk key={i} h={44} r={14} />)}
            </div>
          </div>
          <div className="card"><SkRows n={8} cells={5} /></div>
        </div>
      </PageSkeleton>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><ClipboardList size={22} /> {t('Menyu')}</h1>
          <div className="page-sub">{t('{n} kategoriya · {m} mahsulot', { n: categories.length, m: products.length })}</div>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => setProdForm({ category_id: activeCat || categories[0]?.id })}>
            <Plus size={18} /> {t("Mahsulot qo'shish")}
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="menu-layout">
          <div className="card card-pad">
            <div className="row-between mb-2">
              <span className="bold">{t('Kategoriyalar')}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setCatForm({ name: '', emoji: '🍽️', color: COLORS[0] })}><Plus size={14} /> {t("Qo'shish")}</button>
            </div>
            <div className="cat-list">
              <div className={`cat-row ${!activeCat ? 'active' : ''}`} onClick={() => setActiveCat(null)}>
                <span className="cat-icon"><LayoutGrid size={18} /></span>
                <span className="cat-name">{t('Barchasi')}</span>
                <span className="cat-count">{products.length}</span>
              </div>
              {categories.map((c) => (
                <div key={c.id} className={`cat-row ${activeCat === c.id ? 'active' : ''}`} onClick={() => setActiveCat(c.id)}>
                  <span className="color-dot" style={{ background: c.color }} />
                  <span className="cat-emoji">{c.emoji}</span>
                  <span className="cat-name">{c.name}</span>
                  <span className="cat-count">{products.filter((p) => p.category_id === c.id).length}</span>
                  <span className="cat-row-actions">
                    <button onClick={(e) => { e.stopPropagation(); setCatForm(c); }}><Pencil size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setCatDelete(c); }}><Trash2 size={14} /></button>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <table className="data-table stack-sm">
              <thead>
                <tr>
                  <th>{t('Mahsulot')}</th>
                  <th>{t('Kategoriya')}</th>
                  <th className="text-right">{t('Narx')}</th>
                  <th className="text-center">{t('Qoldiq')}</th>
                  <th className="text-center hide-sm">{t('Holat')}</th>
                  <th className="text-right">{t('Amallar')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} style={!p.active ? { opacity: 0.5 } : {}}>
                    <td className="cell-main">
                      <div className="product-row-name">
                        <ProductThumb product={p} className="row-photo" emojiClass="product-row-emoji" />
                        {p.name}
                      </div>
                    </td>
                    <td className="muted" data-label={t('Kategoriya')}>{p.category_name}</td>
                    <td className="text-right bold nowrap" data-label={t('Narx')}>{fmtMoney(p.price)}</td>
                    <td className="text-center" data-label={t('Qoldiq')}>
                      {p.track_stock ? (
                        <span className={p.stock_qty <= 0 ? 'stock-out' : p.stock_qty <= p.low_stock ? 'stock-low' : 'stock-ok'}>
                          {fmtQty(p.stock_qty)} {t(p.unit)}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="text-center hide-sm">
                      {p.active ? <span className="badge badge-green">{t('Faol')}</span> : <span className="badge badge-gray">{t('Nofaol')}</span>}
                    </td>
                    <td className="text-right nowrap cell-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setProdForm(p)}><Pencil size={15} /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setProdDelete(p)}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state">
                <span className="empty-icon"><ClipboardList size={22} /></span>
                {t("Mahsulotlar yo'q")}
              </div>
            )}
          </div>
        </div>
      </div>

      {catForm && (
        <CategoryFormModal
          category={catForm}
          onClose={() => setCatForm(null)}
          onSaved={() => { setCatForm(null); toast(t('Kategoriya saqlandi')); }}
        />
      )}

      {catDelete && (
        <ConfirmModal
          title={t("Kategoriyani o'chirish")}
          message={t('"{name}" kategoriyasi o\'chirilsinmi?', { name: catDelete.name })}
          confirmLabel={t("O'chirish")}
          danger
          onClose={() => setCatDelete(null)}
          onConfirm={async () => {
            try {
              await deleteCategory(catDelete.id);
              if (activeCat === catDelete.id) setActiveCat(null);
              toast(t("Kategoriya o'chirildi"), 'info');
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
          onSaved={() => { setProdForm(null); toast(t('Mahsulot saqlandi')); }}
        />
      )}

      {prodDelete && (
        <ConfirmModal
          title={t("Mahsulotni o'chirish")}
          message={t('"{name}" o\'chirilsinmi? Sotuv tarixi bo\'lsa, mahsulot arxivlanadi (nofaol).', { name: prodDelete.name })}
          confirmLabel={t("O'chirish")}
          danger
          onClose={() => setProdDelete(null)}
          onConfirm={async () => {
            try {
              const res = await deleteProduct(prodDelete.id);
              toast(res === 'archived' ? t("Sotuv tarixi bo'lgani uchun nofaol qilindi") : t("Mahsulot o'chirildi"), 'info');
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
      toast(t('Kategoriya nomini kiriting'), 'error');
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
      title={category.id ? t('Kategoriyani tahrirlash') : t('Yangi kategoriya')}
      onClose={onClose}
      width={460}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('Bekor qilish')}</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? t('Saqlanmoqda...') : t('Saqlash')}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label">{t('Nomi')}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label className="label">{t('Belgi (emoji)')}</label>
        <div className="emoji-picker">
          {EMOJIS.map((e) => (
            <button key={e} className={`emoji-opt ${emoji === e ? 'active' : ''}`} onClick={() => setEmoji(e)}>{e}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label className="label">{t('Rang')}</label>
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
    if (!name.trim()) return toast(t('Mahsulot nomini kiriting'), 'error');
    if (!(Number(price) > 0)) return toast(t("Narx 0 dan katta bo'lishi kerak"), 'error');
    if (!categoryId) return toast(t('Kategoriya tanlang'), 'error');
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
      title={product.id ? t('Mahsulotni tahrirlash') : t('Yangi mahsulot')}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('Bekor qilish')}</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? t('Saqlanmoqda...') : t('Saqlash')}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label">{t('Nomi')}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="form-row">
        <div className="field">
          <label className="label">{t('Kategoriya')}</label>
          <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">{t("Narx (so'm)")}</label>
          <input className="input" type="number" min="0" step="500" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label className="label">{t('Belgi (emoji)')}</label>
        <div className="emoji-picker">
          {EMOJIS.map((e) => (
            <button key={e} className={`emoji-opt ${emoji === e ? 'active' : ''}`} onClick={() => setEmoji(e)}>{e}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label className="label">{t('Rasm (telefon kamerasi yoki galereya)')}</label>
        <div className="photo-row">
          <div className="photo-box">
            {preview ? <img src={preview} alt="" /> : <Camera size={26} />}
          </div>
          <div className="photo-actions">
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => fileRef.current.click()}>
              {preview ? <><RefreshCw size={14} /> {t('Almashtirish')}</> : <><Camera size={14} /> {t('Rasm tanlash')}</>}
            </button>
            {preview && (photo ? (
              <button className="btn btn-ghost btn-sm" onClick={keepExistingPhoto}>{t('Bekor qilish')}</button>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => setRemovePhoto(true)}><X size={14} /> {t('Ochirish')}</button>
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
        <p className="muted mt-1">{t('Rasm avtomatik kvadrat qilib kesiladi va siqiladi (telefon uchun yengil).')}</p>
      </div>
      <div className="col">
        <label className="check-row">
          <input type="checkbox" checked={!!active} onChange={(e) => setActive(e.target.checked ? 1 : 0)} />
          {t("Faol (kassada ko'rinadi)")}
        </label>
        <label className="check-row">
          <input type="checkbox" checked={!!trackStock} onChange={(e) => setTrackStock(e.target.checked ? 1 : 0)} />
          {t('Ombor hisobini yuritish')}
        </label>
      </div>
      {!!trackStock && (
        <div className="form-row-3 mt-2">
          {!product.id && (
            <div className="field">
              <label className="label">{t("Boshlang'ich qoldiq")}</label>
              <input className="input" type="number" min="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label className="label">{t('Kam qoldiq chegarasi')}</label>
            <input className="input" type="number" min="0" value={lowStock} onChange={(e) => setLowStock(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">{t("O'lchov birligi")}</label>
            <select className="select" value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="dona">{t('dona')}</option>
              <option value="kg">{t('kg')}</option>
              <option value="litr">{t('litr')}</option>
              <option value="porsiya">{t('porsiya')}</option>
            </select>
          </div>
        </div>
      )}
      {product.id && !!trackStock && (
        <p className="muted mt-1">{t('Joriy qoldiq:')} <b>{fmtQty(product.stock_qty)} {t(product.unit)}</b>. {t("Qoldiqni Ombor bo'limida o'zgartiring.")}</p>
      )}
    </Modal>
  );
}
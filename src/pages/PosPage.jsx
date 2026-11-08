import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { useData } from '../state/useData.js';
import {
  getCategories, getProducts, getOpenOrders, getOrder, getTableStates,
  createOrder, updateOrder, sendToKitchen, cancelOrder,
} from '../supabase/queries.js';
import { fmtMoney, fmtSum, fmtQty, fmtTime, ORDER_TYPES } from '../lib/format.js';
import Modal, { ConfirmModal } from '../components/Modal.jsx';
import DataState from '../components/DataState.jsx';
import PaymentModal from '../components/PaymentModal.jsx';
import ReceiptModal from '../components/ReceiptModal.jsx';
import TablePickerModal from '../components/TablePickerModal.jsx';
import ProductThumb from '../components/ProductThumb.jsx';

export default function PosPage() {
  const { pageParams, toast } = useApp();

  const [cart, setCart] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingNumber, setEditingNumber] = useState(null);
  const [orderType, setOrderType] = useState(pageParams.tableId ? 'dine_in' : 'takeaway');
  const [tableId, setTableId] = useState(pageParams.tableId || null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState(null);
  const [busy, setBusy] = useState(false);

  const [showTables, setShowTables] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const { data, loading, error, reload } = useData(async () => {
    const [categories, products, openOrders, tables] = await Promise.all([
      getCategories(),
      getProducts({ activeOnly: true }),
      getOpenOrders(),
      getTableStates(),
    ]);
    return { categories, products, openOrders, tables };
  });

  const categories = data?.categories || [];
  const products = data?.products || [];
  const openOrders = data?.openOrders || [];
  const tables = data?.tables || [];

  // Stol listidan ochilganda buyurtmani serverdan tortib olinadi.
  const [resumeLoading, setResumeLoading] = useState(false);
  useEffect(() => {
    const orderId = pageParams.resumeOrderId;
    if (!orderId) return undefined;
    let alive = true;
    setResumeLoading(true);
    getOrder(orderId)
      .then((full) => {
        if (!alive || !full) return;
        setCart(full.items.map((it) => ({ product_id: it.product_id, name: it.name, price: it.price, qty: it.qty })));
        setEditingId(full.id);
        setEditingNumber(full.number);
        setOrderType(full.type);
        setTableId(full.table_id);
        setDiscountPercent(Number(full.discount_percent) || 0);
        setNote(full.note || '');
      })
      .catch((e) => alive && toast(e.message, 'error'))
      .finally(() => alive && setResumeLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageParams]);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCat) list = list.filter((p) => p.category_id === activeCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCat, search]);

  const subtotal = cart.reduce((s, it) => s + Math.round(it.price * it.qty), 0);
  const discount = Math.round((subtotal * (Number(discountPercent) || 0)) / 100);
  const total = subtotal - discount;
  const cartCount = cart.reduce((s, it) => s + it.qty, 0);
  const selectedTable = tables.find((t) => t.id === tableId) || null;

  function addToCart(p) {
    setCart((prev) => {
      const idx = prev.findIndex((it) => it.product_id === p.id);
      const currentQty = idx >= 0 ? prev[idx].qty : 0;
      if (p.track_stock && currentQty + 1 > p.stock_qty) {
        toast(`Qoldiq yetarli emas: ${p.name} (${fmtQty(p.stock_qty)} ${p.unit})`, 'error');
        return prev;
      }
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { product_id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  }

  function changeQty(idx, delta) {
    setCart((prev) => {
      const next = [...prev];
      const it = next[idx];
      const newQty = it.qty + delta;
      if (newQty <= 0) {
        next.splice(idx, 1);
        return next;
      }
      if (delta > 0) {
        const p = products.find((x) => x.id === it.product_id);
        if (p?.track_stock && newQty > p.stock_qty) {
          toast(`Qoldiq yetarli emas: ${p.name}`, 'error');
          return prev;
        }
      }
      next[idx] = { ...it, qty: newQty };
      return next;
    });
  }

  function resetCart() {
    setCart([]);
    setEditingId(null);
    setEditingNumber(null);
    setDiscountPercent(0);
    setNote('');
    setTableId(null);
    setOrderType('takeaway');
  }

  function validate() {
    if (!cart.length) {
      toast("Savat bo'sh", 'error');
      return false;
    }
    if (orderType === 'dine_in' && !tableId) {
      toast('Stol tanlang', 'error');
      setShowTables(true);
      return false;
    }
    return true;
  }

  function buildPayload() {
    return {
      type: orderType,
      table_id: orderType === 'dine_in' ? tableId : null,
      items: cart,
      discount_percent: Number(discountPercent) || 0,
      note,
    };
  }

  async function persistOrder(sendKitchen) {
    if (editingId) {
      const o = await updateOrder(editingId, buildPayload());
      if (sendKitchen) return await sendToKitchen(o.id);
      return o;
    }
    return createOrder({ ...buildPayload(), sendToKitchen });
  }

  async function handleSave(sendKitchen) {
    if (busy || !validate()) return;
    setBusy(true);
    try {
      const o = await persistOrder(sendKitchen);
      toast(sendKitchen ? `Buyurtma №${o.number} oshxonaga yuborildi` : `Buyurtma №${o.number} saqlandi`);
      resetCart();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handlePay() {
    if (busy || !validate()) return;
    setBusy(true);
    try {
      const o = await persistOrder(false);
      setEditingId(o.id);
      setEditingNumber(o.number);
      setPayTarget(o);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function resumeOrder(o) {
    try {
      const full = await getOrder(o.id);
      setEditingId(full.id);
      setEditingNumber(full.number);
      setCart(full.items.map((it) => ({ product_id: it.product_id, name: it.name, price: it.price, qty: it.qty })));
      setOrderType(full.type);
      setTableId(full.table_id);
      setDiscountPercent(Number(full.discount_percent) || 0);
      setNote(full.note || '');
      setShowOpen(false);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function payExisting(o) {
    try {
      setPayTarget(await getOrder(o.id));
      setShowOpen(false);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function onPaid(paid) {
    setPayTarget(null);
    resetCart();
    setReceiptOrder(paid);
  }

  if (!data) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">🛒 Kassa</h1>
            <div className="page-sub">Menyu yuklanmoqda</div>
          </div>
        </div>
        <div className="page-body">
          <DataState loading={loading} error={error} onRetry={reload} />
        </div>
      </div>
    );
  }

  if (resumeLoading) {
    return (
      <div className="page">
        <div className="page-body">
          <DataState loading />
        </div>
      </div>
    );
  }

  return (
    <div className="pos-layout">
      <div className="pos-left">
        <div className="pos-toolbar">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="input"
              placeholder="Mahsulot qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-outline" onClick={() => setShowOpen(true)}>
            📂 Ochiq buyurtmalar
            {openOrders.length > 0 && <span className="badge badge-orange">{openOrders.length}</span>}
          </button>
        </div>

        <div className="cat-bar">
          <button className={`chip ${!activeCat ? 'active' : ''}`} onClick={() => setActiveCat(null)}>
            🍽️ Barchasi
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`chip ${activeCat === c.id ? 'active' : ''}`}
              onClick={() => setActiveCat(c.id)}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>

        <div className="product-scroll">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-emoji">🔍</span>
              Mahsulot topilmadi
            </div>
          ) : (
            <div className="product-grid">
              {filtered.map((p) => {
                const inCart = cart.find((it) => it.product_id === p.id);
                const low = p.track_stock && p.stock_qty <= p.low_stock;
                return (
                  <button key={p.id} className={`product-card ${inCart ? 'in-cart' : ''}`} onClick={() => addToCart(p)}>
                    {inCart && <span className="product-count">{fmtQty(inCart.qty)}</span>}
                    <ProductThumb product={p} className="product-card-img" emojiClass="product-emoji" />
                    <span className="product-name">{p.name}</span>
                    <span className="product-price">{fmtMoney(p.price)}</span>
                    {p.track_stock ? (
                      <span className={`product-stock ${low ? 'low' : ''}`}>
                        {p.stock_qty <= 0 ? 'Tugagan' : `Qoldiq: ${fmtQty(p.stock_qty)}`}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="cart-panel">
        <div className="cart-head">
          <div className="cart-title-row">
            <span className="cart-title">🧾 Buyurtma {editingId ? `(tahrir)` : ''}</span>
            <span className="badge badge-gray">{fmtQty(cartCount)} ta</span>
          </div>
          <div className="cart-type-row">
            <div className="seg">
              {Object.entries(ORDER_TYPES).map(([key, t]) => (
                <button
                  key={key}
                  className={`seg-item ${orderType === key ? 'active' : ''}`}
                  onClick={() => {
                    setOrderType(key);
                    if (key !== 'dine_in') setTableId(null);
                  }}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>
          {orderType === 'dine_in' && (
            <TableButton table={selectedTable} onClick={() => setShowTables(true)} />
          )}
        </div>

        {editingId && (
          <div className="editing-banner">
            <span>Buyurtma №{editingNumber} tahrirlanmoqda</span>
            <button onClick={resetCart}>+ Yangi buyurtma</button>
          </div>
        )}

        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="cart-empty">
              <span className="empty-emoji">🛒</span>
              Savat bo'sh.<br />Mahsulot tanlang.
            </div>
          ) : (
            cart.map((it, idx) => (
              <div key={it.product_id || idx} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{it.name}</div>
                  <div className="cart-item-price">{fmtMoney(it.price)} so'm</div>
                </div>
                <div className="qty-ctrl">
                  <button className="qty-btn" onClick={() => changeQty(idx, -1)}>−</button>
                  <span className="qty-val">{fmtQty(it.qty)}</span>
                  <button className="qty-btn" onClick={() => changeQty(idx, 1)}>+</button>
                </div>
                <span className="cart-item-total">{fmtMoney(it.price * it.qty)}</span>
                <button className="cart-item-remove" onClick={() => setCart((prev) => prev.filter((_, i) => i !== idx))}>🗑</button>
              </div>
            ))
          )}
        </div>

        <div className="cart-summary">
          <div className="summary-row">
            <span>Jami</span>
            <span>{fmtSum(subtotal)}</span>
          </div>
          <div className="discount-row">
            <span className="label">Chegirma</span>
            <input
              className="input discount-input"
              type="number"
              min="0"
              max="100"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            />
            <span className="muted">%</span>
            <span className="flex-1 text-right muted">{discount > 0 ? `−${fmtMoney(discount)}` : ''}</span>
          </div>
          <div className="summary-total">
            <span>To'lovga</span>
            <span>{fmtSum(total)}</span>
          </div>
        </div>

        <div className="cart-actions">
          <button className="btn btn-secondary btn-block" disabled={!cart.length || busy} onClick={() => handleSave(true)}>
            {busy ? '⏳ Saqlanmoqda...' : '👨‍🍳 Oshxonaga yuborish'}
          </button>
          <button className="btn btn-primary btn-lg btn-block" disabled={!cart.length || busy} onClick={handlePay}>
            💳 To'lov qilish · {fmtMoney(total)}
          </button>
        </div>
      </div>

      {showTables && (
        <TablePickerModal
          currentId={editingId}
          onClose={() => setShowTables(false)}
          onSelect={(t) => {
            setTableId(t.id);
            setShowTables(false);
          }}
        />
      )}

      {showOpen && (
        <Modal title={`Ochiq buyurtmalar (${openOrders.length})`} onClose={() => setShowOpen(false)} width={620}>
          {openOrders.length === 0 ? (
            <div className="empty-state">
              <span className="empty-emoji">📂</span>
              Ochiq buyurtmalar yo'q
            </div>
          ) : (
            openOrders.map((o) => (
              <div key={o.id} className="open-order-row">
                <div className="open-order-info">
                  <div className="open-order-num">
                    №{o.number}{' '}
                    <span className="badge badge-gray">
                      {ORDER_TYPES[o.type]?.emoji} {o.table_name || ORDER_TYPES[o.type]?.label}
                    </span>
                    {o.kitchen_status !== 'none' && <span className="badge badge-blue"> 👨‍🍳 {o.kitchen_status === 'new' ? 'Yangi' : o.kitchen_status === 'cooking' ? 'Tayyorlanmoqda' : 'Tayyor'}</span>}
                  </div>
                  <div className="open-order-meta">
                    {fmtTime(o.created_at)} · {fmtQty(o.item_count)} mahsulot
                  </div>
                </div>
                <span className="open-order-total">{fmtSum(o.total)}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => resumeOrder(o)}>Ochish</button>
                <button className="btn btn-primary btn-sm" onClick={() => payExisting(o)}>To'lov</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setCancelTarget(o)}>✕</button>
              </div>
            ))
          )}
        </Modal>
      )}

      {payTarget && (
        <PaymentModal order={payTarget} onClose={() => setPayTarget(null)} onPaid={onPaid} />
      )}

      {receiptOrder && <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />}

      {cancelTarget && (
        <ConfirmModal
          title="Buyurtmani bekor qilish"
          message={`№${cancelTarget.number} buyurtma bekor qilinsinmi?`}
          confirmLabel="Bekor qilish"
          danger
          onClose={() => setCancelTarget(null)}
          onConfirm={async () => {
            try {
              await cancelOrder(cancelTarget.id);
              if (editingId === cancelTarget.id) resetCart();
              toast('Buyurtma bekor qilindi', 'info');
            } catch (e) {
              toast(e.message, 'error');
            }
          }}
        />
      )}
    </div>
  );
}

function TableButton({ table, onClick }) {
  return (
    <button className={`table-select-btn ${table ? 'selected' : ''}`} onClick={onClick}>
      {table ? `🪑 ${table.name} (${table.zone})` : '🪑 Stol tanlang...'}
    </button>
  );
}

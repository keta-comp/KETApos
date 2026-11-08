import { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { useData } from '../state/useData.js';
import { getProducts, getMovements, getLowStock, stockIn, stockOut } from '../supabase/queries.js';
import { fmtMoney, fmtQty, fmtDateTime } from '../lib/format.js';
import Modal from '../components/Modal.jsx';
import DataState from '../components/DataState.jsx';

const REASONS = {
  sale: { label: 'Savdo', cls: 'badge-blue' },
  kirim: { label: 'Kirim', cls: 'badge-green' },
  chiqim: { label: 'Chiqim', cls: 'badge-red' },
};

export default function InventoryPage() {
  const { toast } = useApp();
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [stockModal, setStockModal] = useState(null);

  const { data, loading, error, reload } = useData(async () => {
    const [products, movements, lowStock] = await Promise.all([
      getProducts(),
      getMovements({ limit: 60 }),
      getLowStock(),
    ]);
    return {
      tracked: products.filter((p) => p.track_stock),
      movements,
      lowCount: lowStock.length,
    };
  });

  const tracked = data?.tracked || [];
  const movements = data?.movements || [];
  const lowCount = data?.lowCount || 0;

  let filtered = tracked;
  if (onlyLow) filtered = filtered.filter((p) => p.stock_qty <= p.low_stock);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter((p) => p.name.toLowerCase().includes(q));
  }

  const stockValue = tracked.reduce((s, p) => s + p.stock_qty * p.price, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">📦 Ombor</h1>
          <div className="page-sub">Mahsulot qoldig'i va harakatlari</div>
        </div>
      </div>

      <div className="page-body">
        {!data ? (
          <DataState loading={loading} error={error} onRetry={reload} />
        ) : (
          <>
            <div className="stat-cards">
              <div className="stat-card">
                <div className="stat-label">📦 Hisobdagi mahsulotlar</div>
                <div className="stat-value">{tracked.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">⚠️ Kam qoldiq</div>
                <div className={`stat-value ${lowCount ? 'red' : ''}`}>{lowCount}</div>
                <div className="stat-sub">chegaradan past</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">💰 Qoldiq qiymati</div>
                <div className="stat-value orange">{fmtMoney(stockValue)}</div>
                <div className="stat-sub">so'm (sotuv narxida)</div>
              </div>
            </div>

            <div className="card">
              <div className="row-between" style={{ padding: '14px 18px' }}>
                <div className="search-wrap" style={{ maxWidth: 300 }}>
                  <span className="search-icon">🔍</span>
                  <input className="input" placeholder="Qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <button className={`chip ${onlyLow ? 'active' : ''}`} onClick={() => setOnlyLow(!onlyLow)}>
                  ⚠️ Faqat kam qoldiq
                </button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mahsulot</th>
                    <th className="text-center">Qoldiq</th>
                    <th className="text-center">Chegara</th>
                    <th className="text-center">Holat</th>
                    <th className="text-right">Qiymat</th>
                    <th className="text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const state = p.stock_qty <= 0 ? 'out' : p.stock_qty <= p.low_stock ? 'low' : 'ok';
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="product-row-name">
                            <span className="product-row-emoji">{p.emoji}</span>
                            {p.name}
                          </div>
                        </td>
                        <td className="text-center bold">{fmtQty(p.stock_qty)} {p.unit}</td>
                        <td className="text-center muted">{fmtQty(p.low_stock)} {p.unit}</td>
                        <td className="text-center">
                          {state === 'out' && <span className="badge badge-red">Tugagan</span>}
                          {state === 'low' && <span className="badge badge-yellow">Kam</span>}
                          {state === 'ok' && <span className="badge badge-green">Yetarli</span>}
                        </td>
                        <td className="text-right nowrap">{fmtMoney(p.stock_qty * p.price)}</td>
                        <td className="text-right nowrap">
                          <button className="btn btn-success btn-sm" onClick={() => setStockModal({ product: p, mode: 'in' })}>+ Kirim</button>{' '}
                          <button className="btn btn-outline btn-sm" onClick={() => setStockModal({ product: p, mode: 'out' })}>− Chiqim</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="empty-state">
                  <span className="empty-emoji">📦</span>
                  {tracked.length === 0
                    ? "Ombor hisobi yoqilgan mahsulotlar yo'q. Menyu bo'limida mahsulotga \"Ombor hisobini yuritish\" belgisini qo'ying."
                    : 'Mahsulot topilmadi'}
                </div>
              )}
            </div>

            <div className="section-title">🕐 So'nggi harakatlar</div>
            <div className="card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sana</th>
                    <th>Mahsulot</th>
                    <th className="text-center">Miqdor</th>
                    <th className="text-center">Tur</th>
                    <th>Izoh</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="muted nowrap">{fmtDateTime(m.created_at)}</td>
                      <td className="bold">{m.product_name}</td>
                      <td className={`text-center ${m.delta > 0 ? 'delta-plus' : 'delta-minus'}`}>
                        {m.delta > 0 ? '+' : ''}{fmtQty(m.delta)} {m.unit}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${REASONS[m.reason]?.cls || 'badge-gray'}`}>{REASONS[m.reason]?.label || m.reason}</span>
                      </td>
                      <td className="muted">{m.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {movements.length === 0 && (
                <div className="empty-state">
                  <span className="empty-emoji">🕐</span>
                  Harakatlar tarixi bo'sh
                </div>
              )}
            </div>
          </>
        )}
        {error && <DataState error={error} onRetry={reload} />}
      </div>

      {stockModal && (
        <StockModal
          product={stockModal.product}
          mode={stockModal.mode}
          onClose={() => setStockModal(null)}
          onSaved={() => {
            toast(stockModal.mode === 'in' ? 'Kirim saqlandi' : 'Chiqim saqlandi');
            setStockModal(null);
          }}
        />
      )}
    </div>
  );
}

function StockModal({ product, mode, onClose, onSaved }) {
  const { toast } = useApp();
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = Number(qty);
    if (!(n > 0)) {
      toast("Miqdor 0 dan katta bo'lishi kerak", 'error');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'in') await stockIn(product.id, n, note);
      else await stockOut(product.id, n, note);
      onSaved();
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={mode === 'in' ? `📥 Kirim — ${product.name}` : `📤 Chiqim — ${product.name}`}
      onClose={onClose}
      width={440}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Bekor qilish</button>
          <button className={`btn ${mode === 'in' ? 'btn-success' : 'btn-danger'}`} disabled={busy} onClick={save}>
            {busy ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </>
      }
    >
      <p className="muted mb-2">
        Joriy qoldiq: <b>{fmtQty(product.stock_qty)} {product.unit}</b>
      </p>
      <div className="field">
        <label className="label">Miqdor ({product.unit})</label>
        <input className="input" type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label className="label">Izoh</label>
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={mode === 'in' ? 'Masalan: Yetkazib beruvchi ABC' : 'Masalan: Yaroqsiz mahsulot'}
        />
      </div>
      {mode === 'in' && Number(qty) > 0 && (
        <p className="muted">Yangi qoldiq: <b>{fmtQty(product.stock_qty + Number(qty))} {product.unit}</b></p>
      )}
      {mode === 'out' && Number(qty) > 0 && (
        <p className="muted">Yangi qoldiq: <b>{fmtQty(product.stock_qty - Number(qty))} {product.unit}</b></p>
      )}
    </Modal>
  );
}

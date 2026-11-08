import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { getTableStates, getZones, getOrder, addTable, updateTable, deleteTable, cancelOrder } from '../db/store.js';
import { fmtSum, fmtMoney, fmtQty, fmtTime, minutesSince, ORDER_TYPES, KITCHEN_STATES } from '../lib/format.js';
import Modal, { ConfirmModal } from '../components/Modal.jsx';
import PaymentModal from '../components/PaymentModal.jsx';
import ReceiptModal from '../components/ReceiptModal.jsx';

export default function TablesPage() {
  const { version, navigate, toast } = useApp();
  const [editMode, setEditMode] = useState(false);
  const [formTarget, setFormTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [orderTarget, setOrderTarget] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const tables = useMemo(() => getTableStates(), [version]);
  const zones = [...new Set(tables.map((t) => t.zone))];
  const busyCount = tables.filter((t) => t.order_id).length;

  const currentOrder = orderTarget ? getOrder(orderTarget.order_id) : null;

  function onTableClick(t) {
    if (editMode) return;
    if (t.order_id) {
      setOrderTarget(t);
    } else {
      navigate('pos', { tableId: t.id });
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">🪑 Stollar</h1>
          <div className="page-sub">
            {tables.length} ta stol · {busyCount} band · {tables.length - busyCount} bo'sh
          </div>
        </div>
        <div className="head-actions">
          <button className={`btn ${editMode ? 'btn-primary' : 'btn-outline'}`} onClick={() => setEditMode(!editMode)}>
            ✏️ {editMode ? 'Tahrirni yakunlash' : 'Tahrirlash'}
          </button>
          <button className="btn btn-primary" onClick={() => setFormTarget({ name: '', zone: zones[0] || 'Asosiy zal', seats: 4 })}>
            + Stol qo'shish
          </button>
        </div>
      </div>

      <div className="page-body">
        {zones.map((zone) => (
          <div key={zone} className="zone-section">
            <div className="zone-title">{zone}</div>
            <div className="table-grid">
              {tables.filter((t) => t.zone === zone).map((t) => (
                <div
                  key={t.id}
                  className={`table-card ${t.order_id ? 'busy' : 'free'}`}
                  onClick={() => onTableClick(t)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onTableClick(t)}
                >
                  {editMode && (
                    <div className="table-edit-btns">
                      <button onClick={(e) => { e.stopPropagation(); setFormTarget(t); }}>✏️</button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}>🗑</button>
                    </div>
                  )}
                  <span className="table-emoji">{t.order_id ? '🍽️' : '🪑'}</span>
                  <span className="table-name">{t.name}</span>
                  <span className="table-seats">{t.seats} o'rin</span>
                  {t.order_id ? (
                    <>
                      <span className="table-status">№{t.order_number}</span>
                      <span className="table-total">{fmtSum(t.order_total)}</span>
                      <span className="table-time">
                        {fmtTime(t.order_since)} · {minutesSince(t.order_since)} daqiqa · {fmtQty(t.item_count)} ta
                      </span>
                    </>
                  ) : (
                    <span className="table-status">Bo'sh</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {tables.length === 0 && (
          <div className="empty-state">
            <span className="empty-emoji">🪑</span>
            Stollar yo'q. "+ Stol qo'shish" tugmasi bilan qo'shing.
          </div>
        )}
      </div>

      {formTarget && (
        <TableFormModal
          table={formTarget}
          zones={zones}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            toast('Stol saqlandi');
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Stolni o'chirish"
          message={`"${deleteTarget.name}" stoli o'chirilsinmi?`}
          confirmLabel="O'chirish"
          danger
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            try {
              deleteTable(deleteTarget.id);
              toast("Stol o'chirildi", 'info');
            } catch (e) {
              toast(e.message, 'error');
            }
          }}
        />
      )}

      {currentOrder && (
        <Modal
          title={`Stol ${orderTarget.name} — Buyurtma №${currentOrder.number}`}
          onClose={() => setOrderTarget(null)}
          width={520}
          footer={
            <>
              <button className="btn btn-danger" onClick={() => setCancelTarget(currentOrder)}>Bekor qilish</button>
              <button className="btn btn-secondary" onClick={() => navigate('pos', { resumeOrderId: currentOrder.id })}>
                ✏️ Kassada ochish
              </button>
              <button className="btn btn-success" onClick={() => { setPayTarget(currentOrder); setOrderTarget(null); }}>
                💳 To'lov · {fmtSum(currentOrder.total)}
              </button>
            </>
          }
        >
          <div className="row-between mb-2">
            <span className="badge badge-gray">
              {ORDER_TYPES[currentOrder.type]?.emoji} {ORDER_TYPES[currentOrder.type]?.label}
            </span>
            <span className="muted">{fmtTime(currentOrder.created_at)} · {minutesSince(currentOrder.created_at)} daqiqa</span>
            {currentOrder.kitchen_status !== 'none' && (
              <span className="badge badge-blue">
                {KITCHEN_STATES[currentOrder.kitchen_status]?.emoji} {KITCHEN_STATES[currentOrder.kitchen_status]?.label}
              </span>
            )}
          </div>
          <table className="data-table">
            <tbody>
              {currentOrder.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.name}</td>
                  <td className="text-center muted">{fmtQty(it.qty)}</td>
                  <td className="text-right bold">{fmtMoney(it.total)}</td>
                </tr>
              ))}
              {currentOrder.discount > 0 && (
                <tr>
                  <td className="muted">Chegirma ({currentOrder.discount_percent}%)</td>
                  <td></td>
                  <td className="text-right muted">−{fmtMoney(currentOrder.discount)}</td>
                </tr>
              )}
              <tr>
                <td className="bold">Jami</td>
                <td></td>
                <td className="text-right bold" style={{ fontSize: 17 }}>{fmtSum(currentOrder.total)}</td>
              </tr>
            </tbody>
          </table>
          {currentOrder.note && <p className="muted mt-1">📝 {currentOrder.note}</p>}
        </Modal>
      )}

      {payTarget && (
        <PaymentModal
          order={payTarget}
          onClose={() => setPayTarget(null)}
          onPaid={(paid) => {
            setPayTarget(null);
            setReceiptOrder(paid);
          }}
        />
      )}

      {receiptOrder && <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />}

      {cancelTarget && (
        <ConfirmModal
          title="Buyurtmani bekor qilish"
          message={`№${cancelTarget.number} buyurtma bekor qilinsinmi? Stol bo'shatiladi.`}
          confirmLabel="Bekor qilish"
          danger
          onClose={() => setCancelTarget(null)}
          onConfirm={() => {
            try {
              cancelOrder(cancelTarget.id);
              setOrderTarget(null);
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

function TableFormModal({ table, zones, onClose, onSaved }) {
  const { toast } = useApp();
  const [name, setName] = useState(table.name || '');
  const [zone, setZone] = useState(table.zone || zones[0] || 'Asosiy zal');
  const [seats, setSeats] = useState(table.seats || 4);

  function save() {
    if (!name.trim()) {
      toast('Stol nomini kiriting', 'error');
      return;
    }
    try {
      if (table.id) {
        updateTable(table.id, { name: name.trim(), zone: zone.trim() || 'Asosiy zal', seats: Number(seats) || 4 });
      } else {
        addTable({ name: name.trim(), zone: zone.trim() || 'Asosiy zal', seats: Number(seats) || 4 });
      }
      onSaved();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <Modal
      title={table.id ? 'Stolni tahrirlash' : 'Yangi stol'}
      onClose={onClose}
      width={440}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Bekor qilish</button>
          <button className="btn btn-primary" onClick={save}>Saqlash</button>
        </>
      }
    >
      <div className="field">
        <label className="label">Stol nomi</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: 11-stol" autoFocus />
      </div>
      <div className="form-row">
        <div className="field">
          <label className="label">Zona</label>
          <input className="input" list="zones-list" value={zone} onChange={(e) => setZone(e.target.value)} />
          <datalist id="zones-list">
            {zones.map((z) => <option key={z} value={z} />)}
          </datalist>
        </div>
        <div className="field">
          <label className="label">O'rinlar soni</label>
          <input className="input" type="number" min="1" value={seats} onChange={(e) => setSeats(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
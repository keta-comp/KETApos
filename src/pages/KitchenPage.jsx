import { useEffect } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { useData } from '../state/useData.js';
import { getKitchenOrders, setKitchenStatus } from '../supabase/queries.js';
import DataState from '../components/DataState.jsx';
import { fmtQty, fmtTime, minutesSince, ORDER_TYPES } from '../lib/format.js';

const COLUMNS = [
  { key: 'new', title: '🆕 Yangi', cls: 'col-new', action: '👨‍🍳 Boshlash', next: 'cooking', actionCls: 'btn-primary' },
  { key: 'cooking', title: '👨‍🍳 Tayyorlanmoqda', cls: 'col-cooking', action: '✅ Tayyor', next: 'ready', actionCls: 'btn-success' },
  { key: 'ready', title: '✅ Tayyor', cls: 'col-ready', action: '📦 Berildi', next: 'served', actionCls: 'btn-secondary' },
];

export default function KitchenPage() {
  const { refresh, toast } = useApp();
  const { data: orders, loading, error, reload } = useData(getKitchenOrders);

  useEffect(() => {
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function advance(order, next) {
    try {
      await setKitchenStatus(order.id, next);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const list = orders || [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">👨‍🍳 Oshxona ekrani</h1>
          <div className="page-sub">
            {list.length} ta faol buyurtma · har 5 soniyada yangilanadi
          </div>
        </div>
      </div>

      <div className="page-body" style={{ overflow: 'hidden' }}>
        {(loading && !orders) || error
          ? <DataState loading={loading} error={error} onRetry={reload} />
          : (
            <div className="kitchen-cols">
              {COLUMNS.map((col) => {
                const colOrders = list.filter((o) => o.kitchen_status === col.key);
                return (
                  <div key={col.key} className={`kitchen-col ${col.cls}`}>
                    <div className="kitchen-col-head">
                      <span>{col.title}</span>
                      <span className="count">{colOrders.length}</span>
                    </div>
                    <div className="kitchen-col-body">
                      {colOrders.length === 0 && (
                        <div className="empty-state" style={{ padding: '30px 10px' }}>
                          <span className="empty-emoji" style={{ fontSize: 32, opacity: 0.4 }}>🍽️</span>
                          Buyurtmalar yo'q
                        </div>
                      )}
                      {colOrders.map((o) => {
                        const mins = minutesSince(o.created_at);
                        return (
                          <div key={o.id} className="kitchen-card">
                            <div className="kitchen-card-head">
                              <div>
                                <div className="order-num">№{o.number}</div>
                                <div className="order-type-badge">
                                  {ORDER_TYPES[o.type]?.emoji} {o.table_name || ORDER_TYPES[o.type]?.label} · {fmtTime(o.created_at)}
                                </div>
                              </div>
                              <span className={`elapsed ${mins >= 20 ? 'late' : mins >= 10 ? 'warn' : ''}`}>
                                ⏱ {mins} daq
                              </span>
                            </div>
                            <div className="kitchen-items">
                              {o.items.map((it) => (
                                <div key={it.id} className="kitchen-item">
                                  <span className="ki-qty">{fmtQty(it.qty)}×</span>
                                  <span className="ki-name">{it.name}</span>
                                </div>
                              ))}
                            </div>
                            {o.items.some((it) => it.note) && (
                              <div className="kitchen-note">
                                📝 {o.items.filter((it) => it.note).map((it) => it.note).join('; ')}
                              </div>
                            )}
                            {o.note && <div className="kitchen-note">📝 {o.note}</div>}
                            <div className="kitchen-paid">
                              {o.status === 'paid'
                                ? <span className="badge badge-green">To'langan</span>
                                : <span className="badge badge-yellow">To'lanmagan</span>}
                            </div>
                            <div className="kitchen-actions">
                              <button className={`btn ${col.actionCls} btn-block`} onClick={() => advance(o, col.next)}>
                                {col.action}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}

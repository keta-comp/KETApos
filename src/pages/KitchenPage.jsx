import { useEffect } from 'react';
import { ChefHat, CircleCheck, PackageCheck, Play, Info, Timer, UtensilsCrossed, User } from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import { useData } from '../state/useData.js';
import { getKitchenOrders, setKitchenStatus } from '../supabase/queries.js';
import DataState from '../components/DataState.jsx';
import MapIcon from '../components/MapIcon.jsx';
import { Sk } from '../components/Skeleton.jsx';
import { fmtQty, fmtTime, minutesSince, ORDER_TYPES, KITCHEN_STATES } from '../lib/format.js';

const COLUMNS = [
  { key: 'new', cls: 'col-new', action: 'Boshlash', actionIcon: Play, next: 'cooking', actionCls: 'btn-primary' },
  { key: 'cooking', cls: 'col-cooking', action: 'Tayyor', actionIcon: CircleCheck, next: 'ready', actionCls: 'btn-success' },
  { key: 'ready', cls: 'col-ready', action: 'Berildi', actionIcon: PackageCheck, next: 'served', actionCls: 'btn-secondary' },
];

export default function KitchenPage() {
  const { refresh, toast, can } = useApp();
  const mayAdvance = can('kitchenStatus');
  const { data: orders, loading, error, reload } = useData(getKitchenOrders);

  // Asosiy yo'l — realtime; tarmoq uzilsa 30 soniyada bir marta tekshiriladi.
  useEffect(() => {
    const timer = setInterval(refresh, 30000);
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
          <h1 className="page-title"><ChefHat size={22} /> Oshxona ekrani</h1>
          <div className="page-sub">
            {list.length} ta faol buyurtma · boshqa qurilmalardan jonli yangilanadi
          </div>
        </div>
      </div>

      <div className="page-body" style={{ overflow: 'hidden' }}>
        {error
          ? <DataState error={error} onRetry={reload} />
          : loading && !orders
            ? (
              <div className="kitchen-cols">
                {COLUMNS.map((col) => (
                  <div key={col.key} className={`kitchen-col ${col.cls}`}>
                    <div className="kitchen-col-head"><Sk w="54%" h={13} r={6} /><Sk w={22} h={16} r={9} /></div>
                    <div className="kitchen-col-body">
                      {Array.from({ length: 2 }, (_, i) => <Sk key={i} h={i === 0 ? 168 : 116} r={18} />)}
                    </div>
                  </div>
                ))}
              </div>
            )
            : (
            <div className="kitchen-cols">
              {COLUMNS.map((col) => {
                const colOrders = list.filter((o) => o.kitchen_status === col.key);
                return (
                  <div key={col.key} className={`kitchen-col ${col.cls}`}>
                    <div className="kitchen-col-head">
                      <span className="ti"><MapIcon map={KITCHEN_STATES} name={col.key} size={17} /> {KITCHEN_STATES[col.key].label}</span>
                      <span className="count">{colOrders.length}</span>
                    </div>
                    <div className="kitchen-col-body">
                      {colOrders.length === 0 && (
                        <div className="empty-state" style={{ padding: '18px 8px' }}>
                          <span className="empty-icon"><UtensilsCrossed size={22} /></span>
                          Buyurtmalar yo'q
                        </div>
                      )}
                      {colOrders.map((o) => {
                        const mins = minutesSince(o.created_at);
                        const items = o.items || [];
                        return (
                          <div key={o.id} className="kitchen-card">
                            <div className="kitchen-card-head">
                              <div>
                                <div className="order-num">№{o.number}</div>
                                <div className="order-type-badge">
                                  <MapIcon map={ORDER_TYPES} name={o.type} size={14} /> {o.table_name || ORDER_TYPES[o.type]?.label} · {fmtTime(o.created_at)}
                                </div>
                                <div className="order-staff"><User size={13} /> {o.staff_name}</div>
                              </div>
                              <span className={`elapsed ${mins >= 20 ? 'late' : mins >= 10 ? 'warn' : ''}`}>
                                <Timer size={14} /> {mins} daq
                              </span>
                            </div>
                            <div className="kitchen-items">
                              {items.map((it) => (
                                <div key={it.id} className="kitchen-item">
                                  <span className="ki-qty">{fmtQty(it.qty)}×</span>
                                  <span className="ki-name">{it.name}</span>
                                </div>
                              ))}
                            </div>
                            {items.some((it) => it.note) && (
                              <div className="kitchen-note">
                                <Info size={13} /> {items.filter((it) => it.note).map((it) => it.note).join('; ')}
                              </div>
                            )}
                            {o.note && <div className="kitchen-note"><Info size={13} /> {o.note}</div>}
                            <div className="kitchen-paid">
                              {o.status === 'paid'
                                ? <span className="badge badge-green">To'langan</span>
                                : <span className="badge badge-yellow">To'lanmagan</span>}
                            </div>
                            {mayAdvance && (
                              <div className="kitchen-actions">
                                <button className={`btn ${col.actionCls} btn-block`} onClick={() => advance(o, col.next)}>
                                  <col.actionIcon size={16} /> {col.action}
                                </button>
                              </div>
                            )}
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

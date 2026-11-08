import { useMemo } from 'react';
import Modal from './Modal.jsx';
import { useApp } from '../state/AppContext.jsx';
import { getTableStates } from '../db/store.js';
import { fmtSum, minutesSince } from '../lib/format.js';

export default function TablePickerModal({ onSelect, onClose, currentId = null }) {
  const { version } = useApp();
  const tables = useMemo(() => getTableStates(), [version]);
  const zones = [...new Set(tables.map((t) => t.zone))];

  return (
    <Modal title="Stol tanlang" onClose={onClose} width={640}>
      {zones.map((zone) => (
        <div key={zone} className="zone-section">
          <div className="zone-title">{zone}</div>
          <div className="table-grid">
            {tables.filter((t) => t.zone === zone).map((t) => {
              const busy = t.order_id && t.order_id !== currentId;
              return (
                <button
                  key={t.id}
                  className={`table-card ${busy ? 'busy' : 'free'}`}
                  disabled={busy}
                  style={busy ? { opacity: 0.55, cursor: 'not-allowed' } : {}}
                  onClick={() => onSelect(t)}
                >
                  <span className="table-emoji">{busy ? '🍽️' : '🪑'}</span>
                  <span className="table-name">{t.name}</span>
                  <span className="table-seats">{t.seats} o'rin</span>
                  {busy ? (
                    <>
                      <span className="table-status">Band · №{t.order_number}</span>
                      <span className="table-total">{fmtSum(t.order_total)}</span>
                      <span className="table-time">{minutesSince(t.order_since)} daqiqa</span>
                    </>
                  ) : (
                    <span className="table-status">Bo'sh</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Modal>
  );
}
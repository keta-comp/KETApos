import { Armchair, Users } from 'lucide-react';
import Modal from './Modal.jsx';
import DataState from './DataState.jsx';
import { Sk, SkCards } from './Skeleton.jsx';
import { useData } from '../state/useData.js';
import { getTableStates } from '../supabase/queries.js';
import { fmtSum, minutesSince } from '../lib/format.js';
import { t } from '../lib/i18n.js';

export default function TablePickerModal({ onSelect, onClose, currentId = null }) {
  const { data, error, reload } = useData(getTableStates);
  const tables = data || [];
  const zones = [...new Set(tables.map((tb) => tb.zone))];

  return (
    <Modal title={t('Stol tanlang')} onClose={onClose} width={640}>
      {!data ? (
        error ? (
          <DataState error={error} onRetry={reload} />
        ) : (
          <div className="zone-section">
            <div className="zone-title"><Sk w={110} h={13} r={6} /></div>
            <SkCards n={6} h={148} r={22} className="table-grid" />
          </div>
        )
      ) : (
        <>
          {zones.map((zone) => (
        <div key={zone} className="zone-section">
          <div className="zone-title">{zone}</div>
          <div className="table-grid">
            {tables.filter((tb) => tb.zone === zone).map((tb) => {
              const busy = tb.order_id && tb.order_id !== currentId;
              return (
                <button
                  key={tb.id}
                  className={`table-card ${busy ? 'busy' : 'free'}`}
                  disabled={busy}
                  style={busy ? { opacity: 0.55, cursor: 'not-allowed' } : {}}
                  onClick={() => onSelect(tb)}
                >
                  <span className="table-icon">{busy ? <Users size={26} /> : <Armchair size={26} />}</span>
                  <span className="table-name">{tb.name}</span>
                  <span className="table-seats">{t("{n} o'rin", { n: tb.seats })}</span>
                  {busy ? (
                    <>
                      <span className="table-status">{t('Band · №{n}', { n: tb.order_number })}</span>
                      <span className="table-total">{fmtSum(tb.order_total)}</span>
                      <span className="table-time">{t('{n} daqiqa', { n: minutesSince(tb.order_since) })}</span>
                    </>
                  ) : (
                    <span className="table-status">{t("Bo'sh")}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
          ))}
        </>
      )}
    </Modal>
  );
}
import { ClipboardList } from 'lucide-react';
import DataState from './DataState.jsx';
import { t } from '../lib/i18n.js';

// Barcha sahifalar uchun yagona yuklash ramkasi: sarlavha saqlanadi,
// kontent o‘rniga skelet ko‘rinadi, xato bo‘lsa ixcham xato qatori.
export default function PageSkeleton({ icon: Icon, title, children, error, onRetry }) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{Icon ? <Icon size={22} /> : <ClipboardList size={22} />} {title}</h1>
          <div className="page-sub">{t('Yuklanmoqda...')}</div>
        </div>
      </div>
      <div className="page-body">
        {error
          ? <DataState error={error} onRetry={onRetry} />
          : <div className="sk-page">{children}</div>}
      </div>
    </div>
  );
}

// Sahifadagi xato bloki uchun kichik yagona komponent.
import { TriangleAlert, RefreshCw } from 'lucide-react';
import { t } from '../lib/i18n.js';

export default function DataState({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="state-line state-error">
      <TriangleAlert size={18} />
      <span>{error}</span>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          <RefreshCw size={14} /> {t('Qayta urinish')}
        </button>
      )}
    </div>
  );
}

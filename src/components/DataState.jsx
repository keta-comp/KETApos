// Sahifalardagi yuklash / xato bloklari uchun kichik yagona komponent.
import { TriangleAlert, Loader2, RefreshCw } from 'lucide-react';

export default function DataState({ loading, error, onRetry }) {
  if (error) {
    return (
      <div className="empty-state">
        <span className="empty-icon"><TriangleAlert size={40} /></span>
        <div>{error}</div>
        {onRetry && (
          <button className="btn btn-outline btn-sm mt-2" onClick={onRetry}><RefreshCw size={16} /> Qayta urinish</button>
        )}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="empty-state">
        <span className="empty-icon"><Loader2 size={40} className="spin" /></span>
        Yuklanmoqda...
      </div>
    );
  }
  return null;
}

// Sahifalardagi yuklash / xato bloklari uchun kichik yagona komponent.
export default function DataState({ loading, error, onRetry }) {
  if (error) {
    return (
      <div className="empty-state">
        <span className="empty-emoji">⚠️</span>
        <div>{error}</div>
        {onRetry && (
          <button className="btn btn-outline btn-sm mt-2" onClick={onRetry}>🔄 Qayta urinish</button>
        )}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="empty-state">
        <span className="empty-emoji">⏳</span>
        Yuklanmoqda...
      </div>
    );
  }
  return null;
}

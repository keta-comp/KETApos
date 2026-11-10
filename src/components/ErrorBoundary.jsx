import { Component } from 'react';
import { TriangleAlert, RefreshCw, RotateCcw } from 'lucide-react';
import { t } from '../lib/i18n.js';

// Xatolik butun ekranni oq qilib qoldirmasin: chegara uni ushlab, sababini
// ko'rsatadi va qayta urinish imkonini beradi.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Ekran xatoligi:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash-card">
        <span className="crash-icon"><TriangleAlert size={24} /></span>
        <div className="crash-title">{t('Bu ekronda xatolik yuz berdi')}</div>
        <div className="crash-note">{String(error?.message || error)}</div>
        <div className="crash-actions">
          <button className="btn btn-secondary" onClick={() => this.setState({ error: null })}>
            <RefreshCw size={16} /> {t('Qayta urinish')}
          </button>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            <RotateCcw size={16} /> {t('Ilovani yangilash')}
          </button>
        </div>
      </div>
    );
  }
}

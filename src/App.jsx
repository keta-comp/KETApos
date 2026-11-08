import { useMemo } from 'react';
import { AuthProvider, useAuth } from './state/AuthContext.jsx';
import { AppProvider, useApp } from './state/AppContext.jsx';
import AuthScreen from './auth/AuthScreen.jsx';
import { getOpenOrders, getKitchenOrders, getLowStock } from './db/store.js';
import PosPage from './pages/PosPage.jsx';
import TablesPage from './pages/TablesPage.jsx';
import KitchenPage from './pages/KitchenPage.jsx';
import MenuPage from './pages/MenuPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

const APP_VERSION = '1.0.0';

const KIND_LABELS = { fastfood: 'Fastfood', cafe: 'Kafe' };

const NAV = [
  { id: 'pos', label: 'Kassa', emoji: '🛒' },
  { id: 'tables', label: 'Stollar', emoji: '🪑' },
  { id: 'kitchen', label: 'Oshxona', emoji: '👨‍🍳' },
  { id: 'menu', label: 'Menyu', emoji: '📋' },
  { id: 'inventory', label: 'Ombor', emoji: '📦' },
  { id: 'reports', label: 'Hisobot', emoji: '📊' },
  { id: 'settings', label: 'Sozlamalar', emoji: '⚙️' },
];

function Sidebar() {
  const { page, navigate, version } = useApp();
  const { venue, roleLabel, handleSignOut } = useAuth();

  const badges = useMemo(() => {
    void version;
    const kitchenNew = getKitchenOrders().filter((o) => o.kitchen_status === 'new').length;
    return {
      pos: getOpenOrders().length,
      kitchen: kitchenNew,
      inventory: getLowStock().length,
    };
  }, [version]);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-emoji">🍔</span>
        <div>
          <div className="logo-title">POS Kassa</div>
          <div className="logo-sub">Fastfood &amp; Kafe</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? 'active' : ''}`}
            onClick={() => navigate(item.id)}
          >
            <span className="nav-emoji">{item.emoji}</span>
            <span className="nav-label">{item.label}</span>
            {badges[item.id] > 0 && <span className="nav-badge">{badges[item.id]}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="account-chip">
          <div className="account-avatar">{(venue?.name || '?').slice(0, 1).toUpperCase()}</div>
          <div className="account-info">
            <div className="account-name">{venue?.name}</div>
            <div className="account-role">{roleLabel} · {KIND_LABELS[venue?.kind] || '—'}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut} title="Chiqish">⏻</button>
        </div>
        <div className="store-sub">v{APP_VERSION} · server rejimi</div>
      </div>
    </aside>
  );
}

function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' ? '✅' : t.type === 'error' ? '⚠️' : 'ℹ️'} {t.message}
        </div>
      ))}
    </div>
  );
}

function Boot({ label, error }) {
  return (
    <div className="boot-screen">
      <div className={`boot-emoji ${error ? '' : 'spin'}`}>{error ? '⚠️' : '🍔'}</div>
      <div className="boot-title">{error ? 'Xatolik yuz berdi' : label}</div>
      {error && <div className="boot-note">{error}</div>}
    </div>
  );
}

function Gate() {
  const { status, error: authError } = useAuth();
  const { ready, error } = useApp();

  if (status === 'booting') return <Boot label="Akkaunt tekshirilmoqda..." />;
  if (status !== 'ready') return <AuthScreen />;
  if (authError) return <Boot error={authError} />;
  if (error) return <Boot error={error} />;
  if (!ready) return <Boot label="POS yuklanmoqda..." />;
  return <Shell />;
}

function Shell() {
  const { page } = useApp();

  const pages = {
    pos: <PosPage />,
    tables: <TablesPage />,
    kitchen: <KitchenPage />,
    menu: <MenuPage />,
    inventory: <InventoryPage />,
    reports: <ReportsPage />,
    settings: <SettingsPage />,
  };

  return (
    <div className="app">
      <Sidebar />
      <main className="main">{pages[page] || <PosPage />}</main>
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Gate />
      </AppProvider>
    </AuthProvider>
  );
}
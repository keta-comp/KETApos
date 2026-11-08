import {
  ShoppingCart, Users, ChefHat, ClipboardList, Package, ChartNoAxesCombined, Settings,
  Store, CircleCheck, CircleAlert, Info, Loader2, LogOut, RefreshCw, TriangleAlert,
} from 'lucide-react';
import { AuthProvider, useAuth } from './state/AuthContext.jsx';
import { AppProvider, useApp } from './state/AppContext.jsx';
import { useData } from './state/useData.js';
import AuthScreen from './auth/AuthScreen.jsx';
import { getOpenOrders, getKitchenOrders, getLowStock } from './supabase/queries.js';
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
  { id: 'pos', label: 'Kassa', icon: ShoppingCart },
  { id: 'tables', label: 'Stollar', icon: Users },
  { id: 'kitchen', label: 'Oshxona', icon: ChefHat },
  { id: 'menu', label: 'Menyu', icon: ClipboardList },
  { id: 'inventory', label: 'Ombor', icon: Package },
  { id: 'reports', label: 'Hisobot', icon: ChartNoAxesCombined },
  { id: 'settings', label: 'Sozlamalar', icon: Settings },
];

function Sidebar() {
  const { page, navigate } = useApp();
  const { venue, roleLabel, handleSignOut } = useAuth();

  const { data: counts } = useData(async () => {
    const [open, kitchen, low] = await Promise.all([getOpenOrders(), getKitchenOrders(), getLowStock()]);
    return {
      pos: open.length,
      kitchen: kitchen.filter((o) => o.kitchen_status === 'new').length,
      inventory: low.length,
    };
  }, []);
  const badges = counts || { pos: 0, kitchen: 0, inventory: 0 };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-mark"><Store size={24} /></span>
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
            <item.icon />
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
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut} title="Chiqish" aria-label="Chiqish"><LogOut size={16} /></button>
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
          {t.type === 'success' ? <CircleCheck size={18} /> : t.type === 'error' ? <CircleAlert size={18} /> : <Info size={18} />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function Boot({ label, error, onRetry }) {
  return (
    <div className="boot-screen">
      <div className={`boot-icon ${error ? '' : 'spin'}`}>
        {error ? <TriangleAlert size={52} /> : <Loader2 size={52} />}
      </div>
      <div className="boot-title">{error ? 'Xatolik yuz berdi' : label}</div>
      {error && <div className="boot-note">{error}</div>}
      {error && onRetry && (
        <button className="btn btn-primary mt-3" onClick={onRetry}><RefreshCw size={18} /> Qayta urinish</button>
      )}
    </div>
  );
}

function Gate() {
  const { status, error: authError } = useAuth();
  const { ready, error, retry } = useApp();

  if (status === 'booting') return <Boot label="Akkaunt tekshirilmoqda..." />;
  if (status !== 'ready') return <AuthScreen />;
  if (authError) return <Boot error={authError} />;
  if (error) return <Boot error={error} onRetry={retry} />;
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
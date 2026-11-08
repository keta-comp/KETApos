import { useState } from 'react';
import {
  ShoppingCart, Users, ChefHat, ClipboardList, Package, ChartNoAxesCombined, Settings,
  Store, CircleCheck, CircleAlert, Info, LogOut, RefreshCw, TriangleAlert, UserCog, Eye,
  CircleUser, Save, WifiOff,
} from 'lucide-react';
import Spinner from './components/Spinner.jsx';
import Modal from './components/Modal.jsx';
import QueueModal from './components/QueueModal.jsx';
import { AuthProvider, useAuth } from './state/AuthContext.jsx';
import { AppProvider, useApp } from './state/AppContext.jsx';
import { useData } from './state/useData.js';
import AuthScreen from './auth/AuthScreen.jsx';
import { getOpenOrders, getKitchenOrders, getLowStock, setMyName } from './supabase/queries.js';
import { ROLES, ROLE_META, ROLE_PAGES } from './lib/roles.js';
import { APP_VERSION } from './lib/version.js';
import PosPage from './pages/PosPage.jsx';
import TablesPage from './pages/TablesPage.jsx';
import KitchenPage from './pages/KitchenPage.jsx';
import MenuPage from './pages/MenuPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import StaffPage from './pages/StaffPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

const KIND_LABELS = { fastfood: 'Fastfood', cafe: 'Kafe' };

const NAV = [
  { id: 'pos', label: 'Kassa', icon: ShoppingCart },
  { id: 'tables', label: 'Stollar', icon: Users },
  { id: 'kitchen', label: 'Oshxona', icon: ChefHat },
  { id: 'menu', label: 'Menyu', icon: ClipboardList },
  { id: 'inventory', label: 'Ombor', icon: Package },
  { id: 'reports', label: 'Hisobot', icon: ChartNoAxesCombined },
  { id: 'staff', label: 'Xodimlar', icon: UserCog },
  { id: 'settings', label: 'Sozlamalar', icon: Settings },
];

function Sidebar({ onProfile, onQueue }) {
  const { page, navigate, allowedPages, peers, offline, queue } = useApp();
  const { venue, roleLabel, displayName } = useAuth();

  const { data: counts } = useData(async () => {
    const [open, kitchen] = await Promise.all([getOpenOrders(), getKitchenOrders()]);
    const low = allowedPages.includes('inventory') ? await getLowStock() : [];
    return {
      pos: open.length,
      kitchen: kitchen.filter((o) => o.kitchen_status === 'new').length,
      inventory: low.length,
    };
  }, [allowedPages]);
  const badges = counts || { pos: 0, kitchen: 0, inventory: 0 };

  const items = NAV.filter((item) => allowedPages.includes(item.id));
  const who = displayName || venue?.name || '?';
  const peerNames = peers.map((p) => `${p.name || '?'} (${ROLE_META[p.role]?.label || p.role})`).join(', ');

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-mark"><img src="/brand/ketapos-mark.png" alt="KetaPOS" /></span>
        <div>
          <div className="logo-title">KetaPOS</div>
          <div className="logo-sub">Fastfood &amp; Kafe</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {items.map((item) => (
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
        <button className="nav-item" onClick={onProfile}>
          <CircleUser />
          <span className="nav-label">Profil</span>
          <span className="nav-label role-tag">{roleLabel}</span>
        </button>
      </nav>
      <div className="sidebar-footer">
        <div className="account-chip">
          <div className="account-avatar">{who.slice(0, 1).toUpperCase()}</div>
          <div className="account-info">
            <div className="account-name">{who}</div>
            <div className="account-role">{roleLabel} · {KIND_LABELS[venue?.kind] || '—'}</div>
          </div>
        </div>
        <div className="live-bar" title={peerNames}>
          <span className="live-dot" />
          {peers.length > 0 ? `Siz + ${peers.length} kishi onlayn` : 'Hozir faqat siz onlaysiz'}
        </div>
        {(offline || queue.waiting > 0 || queue.failed > 0) && (
          <button
            className={`net-bar ${offline ? 'off' : ''} ${queue.failed > 0 ? 'bad' : ''}`}
            onClick={onQueue}
            title="Oflaynda qilingan amallar — ochib ko‘ring"
          >
            {offline ? <WifiOff size={14} /> : <RefreshCw size={14} />}
            {offline
              ? `Oflayn · ${queue.waiting} amal navbatda`
              : `${queue.waiting} amal yuborilmoqda`}
          </button>
        )}
        <div className="store-sub">v{APP_VERSION} · {offline ? 'oflayn rejim' : 'server rejimi'}</div>
      </div>
    </aside>
  );
}

// Har bir xodim o'z akkauntini shu oynada ko'radi va ismini o'zgartira oladi.
function ProfileModal({ onClose }) {
  const { toast, refresh } = useApp();
  const { user, role, roleLabel, displayName, venue, handleSignOut, retry } = useAuth();
  const [name, setName] = useState(displayName || '');
  const [busy, setBusy] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await setMyName(trimmed);
      toast('Ism yangilandi');
      onClose();
      retry();
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Mening akkauntim" onClose={onClose} width={420}>
      <div className="profile-head">
        <span className="account-avatar big">{(displayName || venue?.name || '?').slice(0, 1).toUpperCase()}</span>
        <div>
          <div className="profile-name">{displayName || user?.email}</div>
          <div className="profile-mail">{user?.email}</div>
        </div>
        <span className={`role-chip role-${role}`}>{roleLabel}</span>
      </div>
      <div className="about-row"><span className="muted">Do‘kon</span><b>{venue?.name || '—'}</b></div>
      <div className="about-row"><span className="muted">Tur</span><b>{KIND_LABELS[venue?.kind] || '—'}</b></div>
      <div className="about-row"><span className="muted">Ekranlar</span><b>{allowedNames(role)}</b></div>

      <div className="field mt-2">
        <label className="label">Ism (buyurtmada va stolda ko'rinadi)</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="row mt-1">
        <button className="btn btn-primary" disabled={busy || !name.trim() || name.trim() === displayName} onClick={save}>
          {busy ? <Spinner size={16} /> : <Save size={16} />} Saqlash
        </button>
        <button className="btn btn-danger" onClick={() => { onClose(); handleSignOut(); }}>
          <LogOut size={16} /> Chiqish
        </button>
      </div>
    </Modal>
  );
}

function allowedNames(role) {
  return (ROLE_PAGES[role] || []).map((p) => NAV.find((n) => n.id === p)?.label).filter(Boolean).join(', ');
}

// Egasi uchun: bir qurilmada ofitsant/kassir/oshxona ekranini ko'rib chiqish.
function RoleSwitcher() {
  const { role, viewRole, setPreviewRole } = useApp();
  if (role !== 'owner') return null;

  return (
    <div className={`role-switcher ${viewRole !== role ? 'previewing' : ''}`}>
      <span className="rs-label">{viewRole === role ? <Store size={15} /> : <Eye size={15} />} Rejim:</span>
      <div className="rs-options">
        {ROLES.map((r) => (
          <button
            key={r}
            className={`rs-chip ${viewRole === r ? 'active' : ''}`}
            onClick={() => setPreviewRole(r === 'owner' ? null : r)}
          >
            {ROLE_META[r].label}
          </button>
        ))}
      </div>
      {viewRole !== role && (
        <span className="rs-note">Faqat ko‘rinish — amal rolingizga qarab cheklanadi</span>
      )}
    </div>
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
      {error ? <TriangleAlert size={22} /> : <Spinner size={22} />}
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  const pages = {
    pos: <PosPage />,
    tables: <TablesPage />,
    kitchen: <KitchenPage />,
    menu: <MenuPage />,
    inventory: <InventoryPage />,
    reports: <ReportsPage />,
    staff: <StaffPage />,
    settings: <SettingsPage />,
  };

  return (
    <div className="app">
      <Sidebar onProfile={() => setProfileOpen(true)} onQueue={() => setQueueOpen(true)} />
      <main className="main">
        <RoleSwitcher />
        {pages[page] || <PosPage />}
      </main>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
      {queueOpen && <QueueModal onClose={() => setQueueOpen(false)} />}
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

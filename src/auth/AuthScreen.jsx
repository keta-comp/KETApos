import { useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';

const KINDS = [
  { id: 'fastfood', emoji: '🍔', label: 'Fastfood', hint: 'Lavash · burger · pizza — tez xizmat' },
  { id: 'cafe', emoji: '☕', label: 'Kafe', hint: 'Stollar bilan o‘tirish · keng menyu' },
];

const TABS = {
  login: 'Kirish',
  venue: 'Do‘kon ochish',
  join: 'Kod bilan qo‘shilish',
};

export default function AuthScreen() {
  const auth = useAuth();
  const signedIn = Boolean(auth.user);
  const tabs = signedIn ? ['venue', 'join'] : ['login', 'venue', 'join'];
  const [tab, setTab] = useState(tabs[0]);
  const activeTab = tabs.includes(tab) ? tab : tabs[0];

  if (auth.status === 'unconfigured') return <SetupNotice />;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">🍔</span>
          <div>
            <div className="auth-brand-title">POS Kassa</div>
            <div className="auth-brand-sub">Fastfood va kichik kafelar uchun</div>
          </div>
        </div>

        <div className="auth-tabs">
          {tabs.map((key) => (
            <button
              key={key}
              className={`auth-tab ${activeTab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
            >
              {TABS[key]}
            </button>
          ))}
        </div>

        {auth.error && (
          <div className="auth-error">
            ⚠️ {auth.error}
            {auth.status === 'error' && (
              <button className="auth-switch" onClick={auth.retry}>Qayta urinish</button>
            )}
          </div>
        )}

        {activeTab === 'login' && <LoginForm />}
        {activeTab === 'venue' && <VenueForm signedIn={signedIn} />}
        {activeTab === 'join' && <JoinForm signedIn={signedIn} />}

        {signedIn && (
          <button className="auth-switch" onClick={auth.handleSignOut}>
            Bu akkauntdan chiqish
          </button>
        )}
      </div>
    </div>
  );
}

function LoginForm() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    await auth.handleSignIn(email, password);
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <p className="auth-sub mb-2">Email va parol bilan kiring. Tizim rolingizni o‘zidan aniqlaydi.</p>
      <EmailField value={email} onChange={setEmail} />
      <PasswordField value={password} onChange={setPassword} />
      <button className="btn btn-primary btn-lg btn-block" disabled={busy || !email || !password}>
        {busy ? 'Kirilmoqda...' : '→ Kassaga kirish'}
      </button>
    </form>
  );
}

function VenueForm({ signedIn }) {
  const auth = useAuth();
  const [kind, setKind] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setNote('');
    const result = await auth.handleCreateVenue({ email, password, name, kind, phone, address });
    if (result?.needsConfirmation) {
      setNote('Emailni tasdiqlash so‘ralmoqda. Pochtangizdagi havolani ochib, qayta kiring.');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <p className="auth-sub mb-2">Do‘kon turini tanlang — interfeys va hisobotlar shunga mos sozlanadi.</p>
      <div className="kind-grid mb-2">
        {KINDS.map((k) => (
          <button
            type="button"
            key={k.id}
            className={`kind-card ${kind === k.id ? 'active' : ''}`}
            onClick={() => setKind(k.id)}
          >
            <span className="kind-emoji">{k.emoji}</span>
            {k.label}
            <span className="kind-hint">{k.hint}</span>
          </button>
        ))}
      </div>

      <div className="field">
        <label className="label">Do‘kon nomi</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: KetaFood" />
      </div>

      {!signedIn && (
        <>
          <EmailField value={email} onChange={setEmail} />
          <PasswordField value={password} onChange={setPassword} label="Parol (kamida 6 belgi)" />
        </>
      )}

      <div className="form-row">
        <div className="field">
          <label className="label">Telefon</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" />
        </div>
        <div className="field">
          <label className="label">Manzil</label>
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Chilonzor 12" />
        </div>
      </div>

      {note && <div className="auth-note mb-2">{note}</div>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy || !kind || !name.trim() || (!signedIn && (!email || password.length < 6))}>
        {busy ? 'Yaratilmoqda...' : 'Do‘konni ochish'}
      </button>
    </form>
  );
}

function JoinForm({ signedIn }) {
  const auth = useAuth();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setNote('');
    const result = await auth.handleJoin({ email, password, code: code.trim().toUpperCase() });
    if (result?.needsConfirmation) {
      setNote('Emailni tasdiqlash so‘ralmoqda. Pochtangizdagi havolani ochib, qayta kiring.');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <p className="auth-sub mb-2">
        Do‘kon egasi bergan 6 belgili kodni kiriting. Kod rolingizni belgilaydi: ofitsant, kassir yoki oshxona.
      </p>
      <div className="field">
        <label className="label">Taklif kodi</label>
        <input
          className="input code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))}
          placeholder="ABC123"
          inputMode="text"
          autoComplete="off"
        />
      </div>

      {!signedIn && (
        <>
          <EmailField value={email} onChange={setEmail} />
          <PasswordField value={password} onChange={setPassword} label="Parol (kamida 6 belgi)" />
        </>
      )}

      {note && <div className="auth-note mb-2">{note}</div>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy || code.trim().length !== 6 || (!signedIn && (!email || password.length < 6))}>
        {busy ? 'Tekshirilmoqda...' : 'Do‘konga qo‘shilish'}
      </button>
    </form>
  );
}

function EmailField({ value, onChange }) {
  return (
    <div className="field">
      <label className="label">Email</label>
      <input
        className="input"
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ish@doikon.uz"
        autoComplete="email"
      />
    </div>
  );
}

function PasswordField({ value, onChange, label = 'Parol' }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <input
        className="input"
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••"
        autoComplete="current-password"
      />
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">🍔</span>
          <div>
            <div className="auth-brand-title">POS Kassa</div>
            <div className="auth-brand-sub">Serverga ulanish kerak</div>
          </div>
        </div>
        <div className="auth-note">
          <b>Supabase kalitlari kiritilmagan.</b><br />
          Loyiha papkasidagi <code>.env</code> fayliga ikki qatorni to‘ldiring:<br />
          <code>VITE_SUPABASE_URL</code> va <code>VITE_SUPABASE_ANON_KEY</code>.<br />
          Keynalarni Supabase → Project Settings → API bo‘limidan olish mumkin.
        </div>
        <p className="auth-sub">Saqlagandan so‘ng sahifani yangilang (F5).</p>
      </div>
    </div>
  );
}

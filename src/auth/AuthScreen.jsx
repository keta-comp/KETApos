import { useState } from 'react';
import {
  Sandwich, Coffee, Store, TriangleAlert, ArrowRight, UserPlus, LogIn, LogOut, KeyRound,
  CircleCheck, Mail, User,
} from 'lucide-react';
import { useAuth } from '../state/AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';

const KINDS = [
  { id: 'fastfood', icon: Sandwich, label: 'Fastfood', hint: 'Lavash · burger · pizza — tez xizmat' },
  { id: 'cafe', icon: Coffee, label: 'Kafe', hint: 'Stollar bilan o‘tirish · keng menyu' },
];

export default function AuthScreen() {
  const auth = useAuth();
  if (auth.status === 'unconfigured') return <SetupNotice />;

  const signedIn = Boolean(auth.user);
  const email = auth.user?.email || '';

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo"><img src="./brand/ketapos-mark.png" alt="KetaPOS" /></span>
          <div>
            <div className="auth-brand-title">KetaPOS</div>
            <div className="auth-brand-sub">Fastfood va kichik kafelar uchun</div>
          </div>
        </div>

        <Steps signedIn={signedIn} />

        {auth.error && (
          <div className="auth-error">
            <TriangleAlert size={18} />
            <span>{auth.error}</span>
            {auth.status === 'error' && (
              <button className="auth-switch" onClick={auth.retry}>Qayta urinish</button>
            )}
          </div>
        )}

        {signedIn ? <MembershipStep email={email} /> : <AccountStep />}

        {signedIn && (
          <button className="auth-switch" onClick={auth.handleSignOut}>
            <LogOut size={14} /> {email ? `Boshqa akkauntga o‘tish (${email})` : 'Boshqa akkauntga o‘tish'}
          </button>
        )}
      </div>
    </div>
  );
}

function Steps({ signedIn }) {
  return (
    <div className="wizard-steps">
      <div className={`wizard-step ${signedIn ? 'done' : 'active'}`}>
        <span className="wizard-dot">{signedIn ? <CircleCheck size={14} /> : '1'}</span>
        Akkaunt
      </div>
      <div className={`wizard-step ${signedIn ? 'active' : ''}`}>
        <span className="wizard-dot">2</span>
        Do‘kon yoki kod
      </div>
    </div>
  );
}

// 1-bosqich: login/parol bilan akkaunt. Do'kon keyin ochiladi.
function AccountStep() {
  const [tab, setTab] = useState('signup');

  return (
    <>
      <div className="auth-tabs">
        <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => setTab('signup')}>
          <UserPlus size={15} /> Yangi akkaunt
        </button>
        <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
          <LogIn size={15} /> Kirish
        </button>
      </div>
      {tab === 'signup' ? <SignUpForm /> : <LoginForm />}
    </>
  );
}

// 2-bosqich: akkaunt bor — endi do'kon ochiladi yoki taklif kodiga qo'shilinadi.
function MembershipStep({ email }) {
  const [tab, setTab] = useState('venue');

  return (
    <>
      <div className="auth-account-chip">
        <span className="account-avatar">{(email || '?').slice(0, 1).toUpperCase()}</span>
        <div>
          <div className="auth-account-mail">{email}</div>
          <div className="auth-account-hint">Akkaunt tayyor — 2-bosqichni tanlang</div>
        </div>
      </div>
      <div className="auth-tabs">
        <button className={`auth-tab ${tab === 'venue' ? 'active' : ''}`} onClick={() => setTab('venue')}>
          <Store size={15} /> Do‘kon ochish
        </button>
        <button className={`auth-tab ${tab === 'join' ? 'active' : ''}`} onClick={() => setTab('join')}>
          <KeyRound size={15} /> Kod bilan qo‘shilish
        </button>
      </div>
      {tab === 'venue' ? <VenueForm /> : <JoinForm />}
    </>
  );
}

function SignUpForm() {
  const auth = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setNote('');
    const result = await auth.handleSignUp({ name: name.trim(), email, password });
    if (result?.needsConfirmation) {
      setNote('Pochtangizga tasdiqlash havolasi yuborildi. Havolani ochgach, „Kirish“ bo‘limidan kiring.');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <p className="auth-sub mb-2">
        Avval akkaunt ochasiz — email va parol. Keyingi qadamda do‘kon ochasiz yoki egasi bergan kodni kiritasiz.
      </p>
      <div className="field">
        <label className="label">Ism</label>
        <div className="input-icon">
          <span className="input-icon-mark"><User size={16} /></span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Dilnoza" />
        </div>
      </div>
      <div className="field">
        <label className="label">Email</label>
        <div className="input-icon">
          <span className="input-icon-mark"><Mail size={16} /></span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ish@doikon.uz" autoComplete="email" />
        </div>
      </div>
      <PasswordField value={password} onChange={setPassword} />
      {note && <div className="auth-note mb-2">{note}</div>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy || !name.trim() || !email || password.length < 6}>
        {busy ? <Spinner size={18} label="Akkaunt ochilmoqda..." /> : <><ArrowRight size={18} /> Akkaunt ochish</>}
      </button>
    </form>
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
      <div className="field">
        <label className="label">Email</label>
        <div className="input-icon">
          <span className="input-icon-mark"><Mail size={16} /></span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ish@doikon.uz" autoComplete="email" />
        </div>
      </div>
      <PasswordField value={password} onChange={setPassword} />
      <button className="btn btn-primary btn-lg btn-block" disabled={busy || !email || !password}>
        {busy ? <Spinner size={18} label="Kirilmoqda..." /> : <><ArrowRight size={18} /> Kassaga kirish</>}
      </button>
    </form>
  );
}

function VenueForm() {
  const auth = useAuth();
  const [kind, setKind] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    await auth.handleCreateVenue({ name: name.trim(), kind, phone, address });
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <p className="auth-sub mb-2">
        Do‘kon turini tanlang — interfeys, menyu va hisobotlar shunga mos sozlanadi.
        {auth.profileName ? ` Siz „${auth.profileName}“ sifatida egasi bo‘lasiz.` : ''}
      </p>
      <div className="kind-grid mb-2">
        {KINDS.map((k) => (
          <button
            type="button"
            key={k.id}
            className={`kind-card ${kind === k.id ? 'active' : ''}`}
            onClick={() => setKind(k.id)}
          >
            <span className="kind-icon"><k.icon size={26} /></span>
            {k.label}
            <span className="kind-hint">{k.hint}</span>
          </button>
        ))}
      </div>

      <div className="field">
        <label className="label">Do‘kon nomi</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: KetaFood" />
      </div>

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

      <button className="btn btn-primary btn-lg btn-block" disabled={busy || !kind || !name.trim()}>
        {busy ? <Spinner size={18} label="Do‘kon ochilmoqda..." /> : <><Store size={18} /> Do‘konni ochish</>}
      </button>
    </form>
  );
}

function JoinForm() {
  const auth = useAuth();
  const [code, setCode] = useState('');
  const [name, setName] = useState(auth.profileName || '');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    await auth.handleJoin({ code: code.trim().toUpperCase(), name: name.trim() });
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <p className="auth-sub mb-2">
        Do‘kon egasi bergan kodni kiriting. Kod rolingizni belgilaydi: ofitsant, kassir yoki oshxona.
      </p>
      <div className="field">
        <label className="label">Taklif kodi</label>
        <input
          className="input code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12))}
          placeholder="A1B2C3D4E5F6"
          inputMode="text"
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label className="label">Ism (stolda shu nom chiqadi)</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Sardor" />
      </div>
      <button className="btn btn-primary btn-lg btn-block" disabled={busy || code.trim().length < 6}>
        {busy ? <Spinner size={18} label="Tekshirilmoqda..." /> : <><KeyRound size={18} /> Do‘konga qo‘shilish</>}
      </button>
    </form>
  );
}

function PasswordField({ value, onChange }) {
  return (
    <div className="field">
      <label className="label">Parol (kamida 6 belgi)</label>
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
          <span className="auth-logo"><img src="./brand/ketapos-mark.png" alt="KetaPOS" /></span>
          <div>
            <div className="auth-brand-title">KetaPOS</div>
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

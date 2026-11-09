import { useEffect, useState } from 'react';
import {
  ShieldCheck, Store, Users, KeyRound, Search, Pause, Play, Pencil, Plus, Copy, Trash2,
  Mail, BadgeCheck, Ban, Info, ReceiptText, Phone, CalendarDays, Wallet, CircleCheck,
  Building2, Eye, X, Check, Loader, Ticket,
} from 'lucide-react';
import Modal, { ConfirmModal } from '../components/Modal.jsx';
import DataState from '../components/DataState.jsx';
import Spinner from '../components/Spinner.jsx';
import { Sk, SkRows, SkStats } from '../components/Skeleton.jsx';
import { useApp } from '../state/AppContext.jsx';
import { useData } from '../state/useData.js';
import { fmtSum, fmtDate, PAY_METHODS } from '../lib/format.js';
import { ROLE_META } from '../lib/roles.js';
import {
  addPlatformAdmin, createPlatformVenue, deleteDemoRequest, getDemoRequests, getPlatformAdmins,
  getPlatformStats, getPlatformVenue, getPlatformVenues, removePlatformAdmin, reissueOwnerCode,
  setDemoHandled, setPlatformVenueStatus, updatePlatformVenue,
} from '../supabase/queries.js';

const KIND_LABELS = { fastfood: 'Fastfood', cafe: 'Kafe' };
const BIZ_LABELS = { fastfood: 'Fastfood', cafe: 'Kafe', restaurant: 'Restoran' };
// Bir necha ariza "restoran" deb yozadi — bazada bunday tur yo'q, kafe sifatiga ochamiz.
const BIZ_TO_KIND = { fastfood: 'fastfood', cafe: 'cafe', restaurant: 'cafe' };

function compact(n) {
  const v = Number(n || 0);
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)} mlrd`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} mln`;
  if (v >= 1e3) return `${Math.round(v / 1e3)} ming`;
  return String(v);
}

export default function AdminPage() {
  const { toast, isPlatformAdmin, offline } = useApp();
  const [tab, setTab] = useState('venues');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [detail, setDetail] = useState(null);
  const [edit, setEdit] = useState(null);
  const [confirmStop, setConfirmStop] = useState(null);
  const [confirmAdmin, setConfirmAdmin] = useState(null);
  const [create, setCreate] = useState(null);
  const [claim, setClaim] = useState(null);
  const [copied, setCopied] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: stats, loading, error, reload } = useData(async () => {
    const [s, venues, demos, admins] = await Promise.all([
      getPlatformStats(),
      getPlatformVenues({ query: q, status: statusFilter }),
      getDemoRequests(),
      getPlatformAdmins(),
    ]);
    return { s, venues, demos, admins };
  }, [q, statusFilter]);

  if (!isPlatformAdmin) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title"><ShieldCheck size={22} /> Platforma</h1>
            <div className="page-sub">Bu ekran faqat KetaPOS platforma administratori uchun</div>
          </div>
        </div>
        <div className="page-body">
          <div className="empty-state">
            <span className="empty-icon"><Ban size={22} /></span>
            Sizda platforma ruxsati yo‘q. Do‘kon boshqaruvi uchun „Sozlamalar“ va „Xodimlar“ ekranlaridan foydalaning.
          </div>
        </div>
      </div>
    );
  }

  async function run(key, fn, done) {
    setBusy(key);
    try {
      const out = await fn();
      toast(done, 'success');
      reload();
      return out;
    } catch (e) {
      toast(e.message, 'error');
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function newCode(row) {
    const out = await run('code', () => reissueOwnerCode(row.id), 'Eski kod yopildi, yangisi tayyor');
    if (out) setClaim({ ...out, expired: false });
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      toast('Nusxalab bo‘lmadi — qo‘lda yozib oling', 'error');
    }
  }

  async function toggleStatus(row) {
    const next = row.status === 'suspended' ? 'active' : 'suspended';
    await run(`st-${row.id}`, () => setPlatformVenueStatus(row.id, next),
      next === 'suspended' ? `${row.name} to‘xtatildi` : `${row.name} qayta yoqildi`);
  }

  async function saveEdit(fields) {
    const out = await run('edit', () => updatePlatformVenue(edit.id, fields), 'Do‘kon ma’lumoti saqlandi');
    if (out !== null) setEdit(null);
  }

  async function makeVenue(form) {
    const out = await run('new', () => createPlatformVenue(form), 'Do‘kon ochildi — kodni egasiga bering');
    if (out) {
      setCreate(null);
      setClaim(out);
    }
  }

  async function handleDemo(row) {
    await run(`dm-${row.id}`, () => setDemoHandled(row.id, !row.handled),
      row.handled ? 'Ariza yana faol ro‘yxatga qaytdi' : 'Ariza bajarilgan deb belgilandi');
  }

  async function dropDemo(row) {
    await run(`dl-${row.id}`, () => deleteDemoRequest(row.id), 'Ariza o‘chirildi');
  }

  async function addAdmin(email) {
    const out = await run('adm', () => addPlatformAdmin(email), 'Administrator qo‘shildi');
    return out !== null;
  }

  async function removeAdmin(row) {
    setConfirmAdmin(null);
    await run(`rm-${row.user_id}`, () => removePlatformAdmin(row.user_id), 'Administrator olib tashlandi');
  }

  const s = stats?.s;
  const venues = stats?.venues || [];
  const demos = stats?.demos || [];
  const admins = stats?.admins || [];
  const newDemos = demos.filter((d) => !d.handled);
  const maxDay = Math.max(1, ...(s?.daily || []).map((d) => d.revenue));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><ShieldCheck size={22} /> Platforma</h1>
          <div className="page-sub">
            {loading && !stats
              ? 'Butun KetaPOS bo‘yicha ma’lumot yuklanmoqda...'
              : `${s?.venues ?? 0} ta do‘kon · ${s?.users ?? 0} ta akkaunt · ${newDemos.length} ta yangi ariza`}
          </div>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => setCreate({ name: '', kind: 'fastfood', phone: '', address: '', notes: '' })}>
            <Plus size={16} /> Yangi do‘kon
          </button>
        </div>
      </div>

      <div className="page-body">
        {error ? (
          <DataState error={error} onRetry={reload} />
        ) : !stats ? (
          <>
            <SkStats n={5} />
            <div className="section-title"><Sk w={200} h={15} r={7} /></div>
            <div className="card card-pad"><SkRows n={5} cells={3} /></div>
          </>
        ) : (
          <>
            <div className="stat-cards">
              <Stat icon={Building2} label="Do‘konlar" value={`${s.venues} ta`} sub={`${s.venuesActive} faol · ${s.venuesSuspended} to‘xtatilgan`} tone={s.venuesSuspended ? 'warn' : 'ok'} />
              <Stat icon={Wallet} label="Bugun tushum" value={fmtSum(s.revenueToday)} sub={`${s.ordersToday} ta buyurtma`} />
              <Stat icon={ReceiptText} label="Oy tushumi" value={fmtSum(s.revenueMonth)} sub={`${compact(s.revenue)} so‘m jami`} />
              <Stat icon={Users} label="Akkauntlar" value={`${s.users} ta`} sub={`${s.owners} ta egasi · ${s.staff} xodim`} />
              <Stat icon={KeyRound} label="Demo arizalar" value={`${s.demoNew} ta`} sub={`${s.demoTotal} ta jami`} tone={s.demoNew ? 'warn' : 'ok'} />
            </div>

            <div className="card card-pad">
              <div className="row-between mb-1">
                <b>Oxirgi 14 kun</b>
                <span className="muted">tushum, so‘m</span>
              </div>
              <div className="bar-chart">
                {s.daily.map((d) => (
                  <div key={d.day} className="bar-col" title={`${fmtDate(d.day)}: ${fmtSum(d.revenue)} (${d.orders} buyurtma)`}>
                    <span className="bar-value">{d.revenue ? compact(d.revenue) : ''}</span>
                    <div className="bar" style={{ height: `${Math.max(2, (d.revenue / maxDay) * 100)}%` }} />
                    <span className="bar-label">{d.day.slice(8, 10)}.{d.day.slice(5, 7)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="seg admin-tabs mb-1">
              <button className={`seg-item ${tab === 'venues' ? 'active' : ''}`} onClick={() => setTab('venues')}>
                <Store size={15} /> Do‘konlar
              </button>
              <button className={`seg-item ${tab === 'demo' ? 'active' : ''}`} onClick={() => setTab('demo')}>
                <Mail size={15} /> Arizalar
                {newDemos.length > 0 && <span className="nav-badge">{newDemos.length}</span>}
              </button>
              <button className={`seg-item ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>
                <ShieldCheck size={15} /> Administratorlar
              </button>
            </div>

            {tab === 'venues' && (
              <>
                <div className="card">
                  <div className="row-between admin-filter">
                    <div className="search-wrap admin-search">
                      <span className="search-icon"><Search size={16} /></span>
                      <input className="input" placeholder="Do‘kon, telefon yoki email..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <div className="row gap-sm">
                      <button className={`chip ${statusFilter === null ? 'active' : ''}`} onClick={() => setStatusFilter(null)}>Barchasi</button>
                      <button className={`chip ${statusFilter === 'active' ? 'active' : ''}`} onClick={() => setStatusFilter('active')}>Faol</button>
                      <button className={`chip ${statusFilter === 'suspended' ? 'active' : ''}`} onClick={() => setStatusFilter('suspended')}>To‘xtatilgan</button>
                    </div>
                  </div>
                </div>

                <div className="card staff-list">
                  {venues.length === 0 && (
                    <div className="empty-state">
                      <span className="empty-icon"><Store size={22} /></span>
                      {q || statusFilter ? 'Mos do‘kon topilmadi.' : 'Hali birorta do‘kon ochilmagan.'}
                    </div>
                  )}
                  {venues.map((v) => (
                    <div key={v.id} className={`staff-row venue-row ${v.status === 'suspended' ? 'dim-row' : ''}`}>
                      <span className={`role-avatar venue-${v.kind}`}><Store size={17} /></span>
                      <div className="staff-meta">
                        <div className="staff-title">
                          {v.name}
                          <span className={`status-chip ${v.status}`}>{v.status === 'suspended' ? 'to‘xtatilgan' : 'faol'}</span>
                          {v.orders_open > 0 && <span className="pending-chip">{v.orders_open} ochiq</span>}
                        </div>
                        <div className="staff-sub">
                          {v.owner_name}{v.owner_email ? ` · ${v.owner_email}` : ''}
                        </div>
                        <div className="staff-sub">
                          {KIND_LABELS[v.kind] || v.kind}
                          {v.phone ? ` · ${v.phone}` : ''}
                          {v.address ? ` · ${v.address}` : ''}
                          {` · ${v.staff_count} xodim · ${v.orders} buyurtma · ${fmtSum(v.revenue)}`}
                        </div>
                        <div className="staff-sub muted">
                          {v.last_order ? `Oxirgi amal: ${v.last_order}` : `Ochilgan: ${v.created_at} · hali buyurtma bo‘lmagan`}
                        </div>
                      </div>
                      <div className="row gap-sm">
                        <button className="btn btn-ghost btn-sm" onClick={() => setDetail(v.id)} title="Tafsilot"><Eye size={15} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEdit(v)} title="Tahrirlash"><Pencil size={15} /></button>
                        {v.owner_code && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setClaim({ venue_id: v.id, name: v.name, code: v.owner_code, expired: v.code_expired })}
                            title={v.code_expired ? 'Kod muddati o‘tgan — yangisini oling' : "Egasiga berilmagan kod"}
                          >
                            <Ticket size={15} />
                            {v.code_expired ? 'Kod tugagan' : 'Kod'}
                          </button>
                        )}
                        <button
                          className={`btn btn-sm ${v.status === 'suspended' ? 'btn-success' : 'btn-secondary'}`}
                          onClick={() => (v.status === 'suspended' ? toggleStatus(v) : setConfirmStop(v))}
                          disabled={Boolean(busy) || offline}
                        >
                          {busy === `st-${v.id}`
                            ? <Spinner size={15} />
                            : v.status === 'suspended' ? <Play size={15} /> : <Pause size={15} />}
                          {v.status === 'suspended' ? 'Yoqish' : "To‘xtatish"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="how-card">
                  <div className="how-head"><Info size={16} /> Xaridor qanday qo'shiladi</div>
                  <ol className="how-list">
                    <li><b>Yangi do‘kon</b> tugmasi bilan biznesni oching — tayyor menyu, stollar va sozlamalar bilan birga ochiladi.</li>
                    <li>Chiqqan <b>12 belgili egalik kodini</b> xaridorga bering (bir marta, 7 kun amal qiladi).</li>
                    <li>Xodim telefonida <b>Yangi akkaunt</b> ochib, <b>Kod bilan qo‘shilish</b> bo‘limiga kodni kiritadi — hammasi shu.</li>
                  </ol>
                  <div className="how-note">To‘xtatilgan do‘konda xodimlar eski hisobotlarni ko‘radi, lekin yangi buyurtma, to‘lov va xarajat qila olmaydi.</div>
                </div>
              </>
            )}

            {tab === 'demo' && (
              <>
                <div className="card staff-list">
                  {demos.length === 0 && (
                    <div className="empty-state">
                      <span className="empty-icon"><Mail size={22} /></span>
                      Hali demo ariza kelilmagan — ular ketapos.uz sahifasidagi formadan tushadi.
                    </div>
                  )}
                  {demos.map((d) => (
                    <div key={d.id} className={`staff-row ${d.handled ? 'used' : ''}`}>
                      <span className={`role-avatar ${d.handled ? 'role-owner' : 'role-cashier'}`}>
                        {d.handled ? <CircleCheck size={17} /> : <Mail size={17} />}
                      </span>
                      <div className="staff-meta">
                        <div className="staff-title">
                          {d.name}
                          <span className="status-chip info">{BIZ_LABELS[d.business] || d.business}</span>
                        </div>
                        <div className="staff-sub">
                          <a className="link" href={`tel:${d.phone}`}><Phone size={12} /> {d.phone}</a>
                          {' · '}{d.created_at}
                        </div>
                        {d.note && <div className="staff-sub note-line">{d.note}</div>}
                      </div>
                      <div className="row gap-sm">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setCreate({
                            name: d.name,
                            kind: BIZ_TO_KIND[d.business] || 'fastfood',
                            phone: d.phone,
                            address: '',
                            notes: d.note || `Ariza ${d.created_at}`,
                          })}
                          title="Shu ma’lumot bilan do‘kon ochish"
                        >
                          <Plus size={15} /> Do‘kon ochish
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDemo(d)} disabled={busy === `dm-${d.id}`}>
                          {busy === `dm-${d.id}` ? <Spinner size={15} /> : d.handled ? <X size={15} /> : <Check size={15} />}
                          {d.handled ? 'Qaytarish' : 'Bajarildi'}
                        </button>
                        <button className="btn btn-ghost btn-sm btn-danger-ghost" onClick={() => dropDemo(d)} disabled={busy === `dl-${d.id}`} title="Arizani o‘chirish">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="how-card">
                  <div className="how-head"><Info size={16} /> Ariza ishlanadigan tartib</div>
                  <ol className="how-list">
                    <li>Telefon qiling yoki <b>KetaOne</b> orqali yozishib murojaat qiling.</li>
                    <li>Yo‘nalishni tanlab <b>Do‘kon ochish</b> tugmasini bosing — ma’lumot formaga o‘zi tushadi.</li>
                    <li>Egalik kodini bering, so‘ng arizani <b>Bajarildi</b> deb belgilang.</li>
                  </ol>
                </div>
              </>
            )}

            {tab === 'team' && (
              <>
                <div className="section-title"><ShieldCheck size={16} /> Ruxsat berish</div>
                <div className="card card-pad">
                  <AddAdminForm busy={busy === 'adm'} onAdd={addAdmin} onToast={toast} />
                  <div className="how-note mt-1">
                    Email bilan akkaunt avval ochilgan bo‘lishi kerak — avval xodim ilovada ro‘yxatdan o‘tsin, keyin shu yerga qo‘shing.
                  </div>
                </div>

                <div className="section-title"><Users size={16} /> Administratorlar</div>
                <div className="card staff-list">
                  {admins.map((a) => (
                    <div key={a.user_id} className="staff-row">
                      <span className="role-avatar role-owner"><ShieldCheck size={17} /></span>
                      <div className="staff-meta">
                        <div className="staff-title">
                          {a.email}
                          {a.is_self && <span className="me-chip">siz</span>}
                        </div>
                        <div className="staff-sub">
                          {a.created_at} · {a.in_team ? 'biror do‘konda ham ishlaydi' : 'faqat platforma administratori'}
                        </div>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm btn-danger-ghost"
                        onClick={() => setConfirmAdmin(a)}
                        disabled={busy === `rm-${a.user_id}`}
                        title="Ruxsatni olib tashlash"
                      >
                        {busy === `rm-${a.user_id}` ? <Spinner size={15} /> : <Ban size={15} />}
                        Olib tashlash
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {detail && <VenueDetail id={detail} onClose={() => setDetail(null)} />}
        {edit && <EditVenueModal row={edit} onClose={() => setEdit(null)} onSave={saveEdit} busy={busy === 'edit'} />}
        {create && (
          <NewVenueModal
            initial={create}
            busy={busy === 'new'}
            offline={offline}
            onClose={() => setCreate(null)}
            onCreate={makeVenue}
          />
        )}
        {claim && (
          <ClaimModal
            result={claim}
            busy={busy === 'code'}
            onClose={() => setClaim(null)}
            onCopy={copy}
            onNewCode={() => newCode({ id: claim.venue_id })}
            copied={copied === claim.code}
          />
        )}
        {confirmStop && (
          <ConfirmModal
            title="Do‘konni to‘xtatish"
            message={`${confirmStop.name} to‘xtatilsinmi? Xodimlar eski ma’lumotni ko‘radi, lekin yangi buyurtma, to‘lov va xarajat qila olmaydi.`}
            confirmLabel="To‘xtatish"
            danger
            onConfirm={async () => { const row = confirmStop; setConfirmStop(null); await toggleStatus(row); }}
            onClose={() => setConfirmStop(null)}
          />
        )}
        {confirmAdmin && (
          <ConfirmModal
            title="Administratorni olib tashlash"
            message={`${confirmAdmin.email} platforma boshqaruvidan olib tashlansinmi? U endi „Platforma“ ekranini ko‘ra olmaydi.`}
            confirmLabel="Olib tashlash"
            danger
            onConfirm={() => removeAdmin(confirmAdmin)}
            onClose={() => setConfirmAdmin(null)}
          />
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="stat-card">
      <div className="stat-label"><Icon size={14} /> {label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className={`stat-sub ${tone === 'warn' ? 'delta-minus' : tone === 'ok' ? 'delta-plus' : ''}`}>{sub}</div>}
    </div>
  );
}

function AddAdminForm({ busy, onAdd, onToast }) {
  const [email, setEmail] = useState('');
  const [ok, setOk] = useState(false);

  async function submit() {
    const value = email.trim().toLowerCase();
    if (!value || !value.includes('@')) {
      onToast('Emailni to‘liq yozing', 'error');
      return;
    }
    if (await onAdd(value)) {
      setEmail('');
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    }
  }

  return (
    <div className="row gap-sm">
      <div className="field" style={{ margin: 0, flex: 1 }}>
        <input
          className="input"
          placeholder="xodim@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      <button className="btn btn-primary" onClick={submit} disabled={busy || !email.trim()}>
        {busy ? <Spinner size={16} /> : ok ? <BadgeCheck size={16} /> : <Plus size={16} />}
        Qo‘shish
      </button>
    </div>
  );
}

function EditVenueModal({ row, onClose, onSave, busy }) {
  const [form, setForm] = useState({
    name: row.name || '',
    kind: row.kind || 'fastfood',
    phone: row.phone || '',
    address: row.address || '',
    notes: row.notes || '',
  });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const dirty = Object.entries(form).some(([key, value]) => String(value || '') !== String(row[key] || ''));

  return (
    <Modal
      title={`Do‘kon: ${row.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Bekor qilish</button>
          <button
            className="btn btn-primary"
            disabled={!form.name.trim() || !dirty || busy}
            onClick={() => onSave({ ...form, name: form.name.trim(), phone: form.phone.trim() || null, address: form.address.trim() || null, notes: form.notes.trim() || null })}
          >
            {busy ? <Spinner size={16} /> : <Check size={16} />} Saqlash
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label">Nomi</label>
        <input className="input" value={form.name} onChange={set('name')} />
      </div>
      <div className="field">
        <label className="label">Turi</label>
        <div className="role-picker">
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`role-chip-btn ${form.kind === value ? 'active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, kind: value }))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label className="label">Telefon</label>
          <input className="input" value={form.phone} onChange={set('phone')} placeholder="+998..." />
        </div>
        <div className="field">
          <label className="label">Manzil</label>
          <input className="input" value={form.address} onChange={set('address')} />
        </div>
      </div>
      <div className="field">
        <label className="label">Platforma izohi</label>
        <textarea className="textarea" rows={3} value={form.notes} onChange={set('notes')} placeholder="Tarif, kelishuv, to‘lov holati..." />
      </div>
      <div className="auth-note">Izoh faqat platforma administratorlari ko‘radi — xodimlar ekranida chiqmaydi.</div>
    </Modal>
  );
}

function NewVenueModal({ initial, onClose, onCreate, busy, offline }) {
  const [form, setForm] = useState(initial);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Modal
      title="Yangi do‘kon ochish"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Bekor qilish</button>
          <button
            className="btn btn-primary"
            disabled={!form.name.trim() || busy || offline}
            onClick={() => onCreate({
              ...form,
              name: form.name.trim(),
              phone: form.phone?.trim() || null,
              address: form.address?.trim() || null,
              notes: form.notes?.trim() || null,
            })}
          >
            {busy ? <Spinner size={16} /> : <Store size={16} />} Ochish va kod olish
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label">Do‘kon nomi</label>
        <input className="input" value={form.name} onChange={set('name')} placeholder="Masalan: Patir Nice" />
      </div>
      <div className="field">
        <label className="label">Turi</label>
        <div className="role-picker">
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`role-chip-btn ${form.kind === value ? 'active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, kind: value }))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="kind-hint">Bazada fastfood va kafe turlari bor — restoran tanlansa kafe sifatida ochiladi.</div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label className="label">Telefon</label>
          <input className="input" value={form.phone || ''} onChange={set('phone')} placeholder="+998 77 763 02 16" />
        </div>
        <div className="field">
          <label className="label">Manzil</label>
          <input className="input" value={form.address || ''} onChange={set('address')} />
        </div>
      </div>
      <div className="field">
        <label className="label">Platforma izohi</label>
        <input className="input" value={form.notes || ''} onChange={set('notes')} placeholder="Xaridor, kelishilgan narx..." />
      </div>
      <div className="auth-note">
        Do‘kon tayyor menyu (7 kategoriya, ~29 mahsulot) va stollar bilan ochiladi. Kodni egasi bir marta ishlatadi.
      </div>
    </Modal>
  );
}

function ClaimModal({ result, busy, onClose, onCopy, onNewCode, copied }) {
  return (
    <Modal
      title={result.expired ? 'Egalik kodi' : 'Do‘kon ochildi'}
      onClose={onClose}
      width={460}
      footer={
        <>
          {result.expired && (
            <button className="btn btn-secondary" onClick={onNewCode} disabled={busy}>
              {busy ? <Spinner size={16} /> : <Ticket size={16} />} Yangi kod olish
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>Tayyor</button>
        </>
      }
    >
      <div className="summary-row">
        <span className="muted">Nomi</span>
        <b>{result.name}</b>
      </div>
      <div className="field mt-2">
        <label className="label">Egalik kodi — xaridorga bering</label>
        <div className="row gap-sm">
          <div className={`staff-code flex-1 ${result.expired ? 'dim' : ''}`}>{result.code}</div>
          <button className="btn btn-secondary" onClick={() => onCopy(result.code)} disabled={result.expired}>
            {copied ? <BadgeCheck size={16} /> : <Copy size={16} />}
            {copied ? 'Nusxalandi' : 'Nusxalash'}
          </button>
        </div>
        {result.expired && (
          <div className="field-error mt-1">Bu kodning muddati o‘tgan — xaridor kira olmaydi. „Yangi kod olish“ tugmasini bosing.</div>
        )}
      </div>
      <ol className="how-list">
        <li>Xodim telefonida KetaPOS’ni ochib <b>Yangi akkaunt</b> bo‘limida email va parol yozadi.</li>
        <li><b>Kod bilan qo‘shilish</b> bo‘limiga shu kodni kiritadi.</li>
        <li>Kiritgandan keyin u do‘kon egasi bo‘ladi va xodimlarini o‘zi qo‘shadi.</li>
      </ol>
      <div className="how-note">Kod 7 kun amal qiladi va bir marta ishlatiladi. Muddati o‘tsa yoki kod adashib ketse — „Yangi kod olish“ eski kodni yopib, yangisini chiqaradi.</div>
    </Modal>
  );
}

function VenueDetail({ id, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    getPlatformVenue(id)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [id]);

  return (
    <Modal title="Do‘kon tafsiloti" onClose={onClose} width={720}>
      {error ? (
        <div className="field-error">{error}</div>
      ) : !data ? (
        <div className="row"><Loader size={16} className="spin" /> Yuklanmoqda...</div>
      ) : (
        <>
          <div className="profile-head">
            <span className={`role-avatar big venue-${data.kind}`}><Store size={19} /></span>
            <div>
              <div className="profile-name">{data.name}</div>
              <div className="profile-mail">
                {KIND_LABELS[data.kind] || data.kind}{data.phone ? ` · ${data.phone}` : ''}{data.address ? ` · ${data.address}` : ''}
              </div>
            </div>
            <span className={`status-chip ${data.status}`}>{data.status === 'suspended' ? 'to‘xtatilgan' : 'faol'}</span>
          </div>

          <div className="stat-cards">
            <Stat icon={ReceiptText} label="Buyurtmalar" value={`${data.totals.orders} ta`} sub={`${data.totals.paid} to‘langan · ${data.totals.open} ochiq`} />
            <Stat icon={Wallet} label="Tushum" value={fmtSum(data.totals.revenue)} sub={data.totals.last_order ? `oxirgi: ${data.totals.last_order}` : 'hali sotilmagan'} />
            <Stat icon={Users} label="Xodimlar" value={`${data.staff.length} kishi`} sub={`${data.totals.products} mahsulot · ${data.totals.tables} stol`} />
            <Stat icon={CalendarDays} label="Ochilgan" value={data.created_at} sub={data.notes ? 'izoh bor' : 'izoh yo‘q'} />
          </div>

          {data.notes && <div className="queue-hint mb-1"><b>Izoh:</b> {data.notes}</div>}

          <div className="section-title"><Users size={16} /> Jamoa</div>
          <div className="card staff-list">
            {data.staff.map((u) => (
              <div key={u.id} className="staff-row">
                <span className={`role-avatar role-${u.role}`}>
                  {u.role === 'owner' ? <Store size={16} /> : u.role === 'kitchen' ? <ShieldCheck size={16} /> : <Users size={16} />}
                </span>
                <div className="staff-meta">
                  <div className="staff-title">{u.name}</div>
                  <div className="staff-sub">{u.email} · {u.created_at}</div>
                </div>
                <span className={`role-chip role-${u.role}`}>{ROLE_META[u.role]?.label || u.role}</span>
                <span className="staff-sub nowrap">{u.orders} buyurtma</span>
              </div>
            ))}
          </div>

          <div className="section-title"><ReceiptText size={16} /> Oxirgi buyurtmalar</div>
          {data.orders.length === 0 ? (
            <div className="empty-state"><span className="empty-icon"><ReceiptText size={22} /></span>Bu do‘konda hali buyurtma yo‘q.</div>
          ) : (
            <div className="card staff-list">
              {data.orders.map((o) => (
                <div key={o.id} className="staff-row">
                  <div className="staff-meta">
                    <div className="staff-title">№{o.number} · {fmtSum(o.total)}</div>
                    <div className="staff-sub">{o.created_at} · {o.staff} · {PAY_METHODS[o.method]?.label || o.method || '—'}</div>
                  </div>
                  <span className={`badge ${o.status === 'paid' ? 'badge-green' : o.status === 'open' ? 'badge-orange' : 'badge-red'}`}>
                    {o.status === 'paid' ? 'to‘langan' : o.status === 'open' ? 'ochiq' : 'bekor'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="how-note mt-1">
            To‘lov va hisob-kitob egasining o‘z telefonida qoladi — bu yerda faqat tekshirish uchun ko‘rinadi.
          </div>
        </>
      )}
    </Modal>
  );
}

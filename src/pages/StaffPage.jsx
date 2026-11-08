import { useState } from 'react';
import {
  UserCog, Users, KeyRound, Copy, Trash2, Pencil, Mail, ChefHat, ShoppingCart, User,
  Store, Plus, Ban, BadgeCheck, Info, Radio,
} from 'lucide-react';
import Modal, { ConfirmModal } from '../components/Modal.jsx';
import DataState from '../components/DataState.jsx';
import Spinner from '../components/Spinner.jsx';
import { Sk, SkRows, SkStats } from '../components/Skeleton.jsx';
import { useApp } from '../state/AppContext.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import { useData } from '../state/useData.js';
import { fmtSum } from '../lib/format.js';
import { ROLE_META, ROLES } from '../lib/roles.js';
import {
  getStaff, getInvites, issueInvite, revokeInvite, updateStaff, removeStaff,
} from '../supabase/queries.js';

const ROLE_ICONS = { owner: Store, waiter: User, cashier: ShoppingCart, kitchen: ChefHat };
const STAFF_ROLES = ROLES.filter((r) => r !== 'owner');

export default function StaffPage() {
  const { toast, refresh, peers } = useApp();
  const { role } = useAuth();
  const online = new Set(peers.map((p) => p.id));
  const { data, loading, error, reload } = useData(async () => {
    const [staff, invites] = await Promise.all([getStaff(), getInvites()]);
    return { staff, invites };
  }, []);
  const [inviteBusy, setInviteBusy] = useState(null);
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [copied, setCopied] = useState('');

  if (role !== 'owner') {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title"><UserCog size={22} /> Xodimlar</h1>
            <div className="page-sub">Bu sahifani faqat do‘kon egasi ochadi</div>
          </div>
        </div>
        <div className="page-body">
          <div className="empty-state">
            <span className="empty-icon"><BadgeCheck size={22} /></span>
            Xodim qo‘shish uchun egasidan taklif kod so‘rang.
          </div>
        </div>
      </div>
    );
  }

  async function makeInvite(staffRole) {
    setInviteBusy(staffRole);
    try {
      const code = await issueInvite(staffRole);
      toast(`Kod tayyor: ${code}`, 'success');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setInviteBusy(null);
    }
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      toast('Kodni nusxalab bo‘lmadi — qo‘lda yozib oling', 'error');
    }
  }

  async function saveEdit(fields) {
    try {
      await updateStaff(edit.id, fields);
      toast('Xodim yangilandi');
      setEdit(null);
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function drop(row) {
    try {
      await removeStaff(row.id);
      toast(`${row.display_name} ishdan chiqarildi`);
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const staff = data?.staff || [];
  const invites = data?.invites || [];
  const active = invites.filter((i) => !i.used_by);
  const used = invites.filter((i) => i.used_by);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><UserCog size={22} /> Xodimlar</h1>
          <div className="page-sub">
            {loading && !data
              ? 'Jamoani yuklayapmiz...'
              : `${staff.length} kishi · ${active.length} ta faol kod · ro'yxat jonli yangilanadi`}
          </div>
        </div>
      </div>

      <div className="page-body">
        {error ? (
          <DataState error={error} onRetry={reload} />
        ) : !data ? (
          <>
            <SkStats n={4} />
            <div className="section-title"><Sk w={180} h={15} r={7} /></div>
            <div className="card card-pad"><SkRows n={4} cells={3} /></div>
            <div className="section-title"><Sk w={160} h={15} r={7} /></div>
            <div className="card card-pad"><Sk h={46} r={14} /></div>
          </>
        ) : (
          <>
            <div className="stat-cards">
              <StatCard icon={Users} label="Jamoa" value={`${staff.length} kishi`} />
              <StatCard icon={Radio} label="Onlayn" value={`${online.size + 1} kishi`} />
              <StatCard icon={KeyRound} label="Faol kodlar" value={`${active.length} ta`} />
              <StatCard icon={BadgeCheck} label="Ishlatilgan" value={`${used.length} ta`} />
            </div>

            <div className="section-title"><Users size={16} /> Jamoa tarkibi</div>
            <div className="card staff-list">
              {staff.map((s) => {
                const Icon = ROLE_ICONS[s.role] || User;
                return (
                  <div key={s.id} className="staff-row">
                    <span
                      className={online.has(s.user_id) || s.is_self ? 'online-dot' : 'online-dot off'}
                      title={online.has(s.user_id) || s.is_self ? 'Hozir qurilmaga ulangan' : 'Hozir qurilmaga ulanmagan'}
                    />
                    <span className={`role-avatar role-${s.role}`}>
                      <Icon size={17} />
                    </span>
                    <div className="staff-meta">
                      <div className="staff-title">
                        {s.display_name}
                        {s.is_self && <span className="me-chip">siz</span>}
                      </div>
                      <div className="staff-sub">
                        {s.email || 'email ko‘rsatilmagan'}
                        {s.orders_today > 0 && ` · bugun ${s.orders_today} buyurtma · ${fmtSum(s.total_today)} so‘m`}
                      </div>
                    </div>
                    <span className={`role-chip role-${s.role}`}>{ROLE_META[s.role].label}</span>
                    {s.role !== 'owner' && (
                      <div className="row gap-sm">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEdit(s)} title="Ism yoki rol"><Pencil size={15} /></button>
                        <button
                          className="btn btn-ghost btn-sm btn-danger-ghost"
                          onClick={() => setConfirm(s)}
                          title="Ishdan chiqarish"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="section-title"><KeyRound size={16} /> Xodimni qo'shish</div>
            <div className="card invite-create">
              {STAFF_ROLES.map((r) => (
                <button
                  key={r}
                  className="btn btn-secondary"
                  onClick={() => makeInvite(r)}
                  disabled={Boolean(inviteBusy)}
                >
                  {inviteBusy === r ? <Spinner size={16} /> : <Plus size={16} />}
                  {ROLE_META[r].label} uchun kod
                </button>
              ))}
            </div>

            <div className="how-card">
              <div className="how-head"><Info size={16} /> Xodim qanday qo'shiladi</div>
              <ol className="how-list">
                <li>Yuqoridagi tugma bilan rolga mos <b>6 belgili kod</b> oling va xodimga bering.</li>
                <li>Xodim o'z telefonida ilovani ochib, <b>Yangi akkaunt</b> bo'limida email va parol yozadi.</li>
                <li>So'ng <b>Kod bilan qo'shilish</b> bo'limiga kodni kiritadi — roli va ismi avtomatik tanlanadi.</li>
              </ol>
              <div className="how-note">Kod bir marta ishlatiladi. Eski kodni bekor qilib, yangisini olishingiz mumkin.</div>
            </div>

            {active.length > 0 && (
              <>
                <div className="section-title">Faol kodlar</div>
                <div className="card staff-list">
                  {active.map((i) => (
                    <div key={i.id} className="staff-row">
                      <span className="staff-code">{i.code}</span>
                      <div className="staff-meta">
                        <div className="staff-title">{ROLE_META[i.role].label}</div>
                        <div className="staff-sub">{i.created_at} · hali ishlatilmagan</div>
                      </div>
                      <div className="row gap-sm">
                        <button className="btn btn-ghost btn-sm" onClick={() => copyCode(i.code)}>
                          {copied === i.code ? <BadgeCheck size={15} /> : <Copy size={15} />}
                          {copied === i.code ? 'Nusxalandi' : 'Nusxalash'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm btn-danger-ghost"
                          onClick={async () => {
                            try {
                              await revokeInvite(i.id);
                              toast('Kod bekor qilindi');
                              refresh();
                            } catch (e) {
                              toast(e.message, 'error');
                            }
                          }}
                        >
                          <Ban size={15} /> Bekor qilish
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {used.length > 0 && (
              <>
                <div className="section-title">Ishlatilgan kodlar</div>
                <div className="card staff-list">
                  {used.map((i) => (
                    <div key={i.id} className="staff-row used">
                      <span className="staff-code dim">{i.code}</span>
                      <div className="staff-meta">
                        <div className="staff-title">{ROLE_META[i.role].label}</div>
                        <div className="staff-sub">
                          <Mail size={12} /> {i.used_by} · {i.used_at}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {edit && <EditModal row={edit} onClose={() => setEdit(null)} onSave={saveEdit} />}
        {confirm && (
          <ConfirmModal
            title="Ishdan chiqarish"
            message={`${confirm.display_name} do‘kondan chiqarilsinmi? Akkaunti o‘chmaydi, lekin endi kirolmaydi.`}
            confirmLabel="Chiqarish"
            danger
            onConfirm={() => drop(confirm)}
            onClose={() => setConfirm(null)}
          />
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-label"><Icon size={14} /> {label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function EditModal({ row, onClose, onSave }) {
  const [name, setName] = useState(row.display_name);
  const [role, setRole] = useState(row.role);

  return (
    <Modal
      title={`Xodim: ${row.display_name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Bekor qilish</button>
          <button
            className="btn btn-primary"
            disabled={!name.trim() || (name === row.display_name && role === row.role)}
            onClick={() => onSave({ display_name: name.trim(), role })}
          >
            Saqlash
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label">Ism (buyurtmada ko‘rinadi)</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label className="label">Rol</label>
        <div className="role-picker">
          {STAFF_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              className={`role-chip-btn ${role === r ? 'active' : ''}`}
              onClick={() => setRole(r)}
            >
              {ROLE_META[r].label}
            </button>
          ))}
        </div>
      </div>
      <div className="auth-note">Rol o‘zgarsa, xodim keyingi qayta kirishda yangi ekranlarni ko‘radi.</div>
    </Modal>
  );
}

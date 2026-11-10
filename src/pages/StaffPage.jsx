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
import { t } from '../lib/i18n.js';
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
            <h1 className="page-title"><UserCog size={22} /> {t('Xodimlar')}</h1>
            <div className="page-sub">{t('Bu sahifani faqat do‘kon egasi ochadi')}</div>
          </div>
        </div>
        <div className="page-body">
          <div className="empty-state">
            <span className="empty-icon"><BadgeCheck size={22} /></span>
            {t('Xodim qo‘shish uchun egasidan taklif kod so‘rang.')}
          </div>
        </div>
      </div>
    );
  }

  async function makeInvite(staffRole) {
    setInviteBusy(staffRole);
    try {
      const code = await issueInvite(staffRole);
      toast(t('Kod tayyor: {code}', { code }), 'success');
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
      toast(t('Kodni nusxalab bo‘lmadi — qo‘lda yozib oling'), 'error');
    }
  }

  async function saveEdit(fields) {
    try {
      await updateStaff(edit.id, fields);
      toast(t('Xodim yangilandi'));
      setEdit(null);
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function drop(row) {
    try {
      await removeStaff(row.id);
      toast(t('{name} ishdan chiqarildi', { name: row.display_name }));
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const staff = data?.staff || [];
  const invites = data?.invites || [];
  const active = invites.filter((i) => !i.used_by && !i.expired);
  const used = invites.filter((i) => i.used_by);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><UserCog size={22} /> {t('Xodimlar')}</h1>
          <div className="page-sub">
            {loading && !data
              ? t('Jamoani yuklayapmiz...')
              : t("{n} kishi · {a} ta faol kod · ro'yxat jonli yangilanadi", { n: staff.length, a: active.length })}
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
              <StatCard icon={Users} label={t('Jamoa')} value={t('{n} kishi', { n: staff.length })} />
              <StatCard icon={Radio} label={t('Onlayn')} value={t('{n} kishi', { n: online.size + 1 })} />
              <StatCard icon={KeyRound} label={t('Faol kodlar')} value={t('{n} ta', { n: active.length })} />
              <StatCard icon={BadgeCheck} label={t('Ishlatilgan')} value={t('{n} ta', { n: used.length })} />
            </div>

            <div className="section-title"><Users size={16} /> {t('Jamoa tarkibi')}</div>
            <div className="card staff-list">
              {staff.map((s) => {
                const Icon = ROLE_ICONS[s.role] || User;
                return (
                  <div key={s.id} className="staff-row">
                    <span
                      className={online.has(s.user_id) || s.is_self ? 'online-dot' : 'online-dot off'}
                      title={online.has(s.user_id) || s.is_self ? t('Hozir qurilmaga ulangan') : t('Hozir qurilmaga ulanmagan')}
                    />
                    <span className={`role-avatar role-${s.role}`}>
                      <Icon size={17} />
                    </span>
                    <div className="staff-meta">
                      <div className="staff-title">
                        {s.display_name}
                        {s.is_self && <span className="me-chip">{t('siz')}</span>}
                      </div>
                      <div className="staff-sub">
                        {s.email || t('email ko‘rsatilmagan')}
                        {s.orders_today > 0 && t(' · bugun {n} buyurtma · {sum}', { n: s.orders_today, sum: fmtSum(s.total_today) })}
                      </div>
                    </div>
                    <span className={`role-chip role-${s.role}`}>{t(ROLE_META[s.role]?.label || s.role)}</span>
                    {s.role !== 'owner' && (
                      <div className="row gap-sm">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEdit(s)} title={t('Ism yoki rol')}><Pencil size={15} /></button>
                        <button
                          className="btn btn-ghost btn-sm btn-danger-ghost"
                          onClick={() => setConfirm(s)}
                          title={t('Ishdan chiqarish')}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="section-title"><KeyRound size={16} /> {t("Xodimni qo'shish")}</div>
            <div className="card invite-create">
              {STAFF_ROLES.map((r) => (
                <button
                  key={r}
                  className="btn btn-secondary"
                  onClick={() => makeInvite(r)}
                  disabled={Boolean(inviteBusy)}
                >
                  {inviteBusy === r ? <Spinner size={16} /> : <Plus size={16} />}
                  {t('{role} uchun kod', { role: t(ROLE_META[r].label) })}
                </button>
              ))}
            </div>

            <div className="how-card">
              <div className="how-head"><Info size={16} /> {t("Xodim qanday qo'shiladi")}</div>
              <ol className="how-list">
                <li>{t('Yuqoridagi tugma bilan rolga mos')} <b>{t('12 belgili kod')}</b> {t('oling va xodimga bering.')}</li>
                <li>{t("Xodim o'z telefonida ilovani ochib,")} <b>{t('Yangi akkaunt')}</b> {t("bo'limida email va parol yozadi.")}</li>
                <li>{t("So'ng")} <b>{t("Kod bilan qo'shilish")}</b> {t("bo'limiga kodni kiritadi — roli va ismi avtomatik tanlanadi.")}</li>
              </ol>
              <div className="how-note">{t('Kod bir marta ishlatiladi va 7 kundan keyin o‘z-o‘zidan yopiladi. Eski kodni bekor qilib, yangisini olishingiz mumkin.')}</div>
            </div>

            {active.length > 0 && (
              <>
                <div className="section-title">{t('Faol kodlar')}</div>
                <div className="card staff-list">
                  {active.map((i) => (
                    <div key={i.id} className="staff-row">
                      <span className="staff-code">{i.code}</span>
                      <div className="staff-meta">
                        <div className="staff-title">{t(ROLE_META[i.role]?.label || i.role)}</div>
                        <div className="staff-sub">{t('{created} · ishlatilmagan · muddati {expires}', { created: i.created_at, expires: i.expires_at || t('cheksiz') })}</div>
                      </div>
                      <div className="row gap-sm">
                        <button className="btn btn-ghost btn-sm" onClick={() => copyCode(i.code)}>
                          {copied === i.code ? <BadgeCheck size={15} /> : <Copy size={15} />}
                          {copied === i.code ? t('Nusxalandi') : t('Nusxalash')}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm btn-danger-ghost"
                          onClick={async () => {
                            try {
                              await revokeInvite(i.id);
                              toast(t('Kod bekor qilindi'));
                              refresh();
                            } catch (e) {
                              toast(e.message, 'error');
                            }
                          }}
                        >
                          <Ban size={15} /> {t('Bekor qilish')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {used.length > 0 && (
              <>
                <div className="section-title">{t('Ishlatilgan kodlar')}</div>
                <div className="card staff-list">
                  {used.map((i) => (
                    <div key={i.id} className="staff-row used">
                      <span className="staff-code dim">{i.code}</span>
                      <div className="staff-meta">
                        <div className="staff-title">{t(ROLE_META[i.role]?.label || i.role)}</div>
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
            title={t('Ishdan chiqarish')}
            message={t("{name} do‘kondan chiqarilsinmi? Akkaunti o‘chmaydi, lekin endi kirolmaydi.", { name: confirm.display_name })}
            confirmLabel={t('Chiqarish')}
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
      title={t('Xodim: {name}', { name: row.display_name })}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('Bekor qilish')}</button>
          <button
            className="btn btn-primary"
            disabled={!name.trim() || (name === row.display_name && role === row.role)}
            onClick={() => onSave({ display_name: name.trim(), role })}
          >
            {t('Saqlash')}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label">{t('Ism (buyurtmada ko‘rinadi)')}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label className="label">{t('Rol')}</label>
        <div className="role-picker">
          {STAFF_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              className={`role-chip-btn ${role === r ? 'active' : ''}`}
              onClick={() => setRole(r)}
            >
              {t(ROLE_META[r].label)}
            </button>
          ))}
        </div>
      </div>
      <div className="auth-note">{t('Rol o‘zgarsa, xodim keyingi qayta kirishda yangi ekranlarni ko‘radi.')}</div>
    </Modal>
  );
}

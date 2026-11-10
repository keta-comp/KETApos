import { useMemo, useState } from 'react';
import {
  ChartNoAxesCombined, Wallet, ReceiptText, ChartColumnIncreasing, CreditCard, TrendingUp,
  CalendarDays, Trophy, Trash2, Plus,
} from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import { useData } from '../state/useData.js';
import { getReport, addExpense, deleteExpense } from '../supabase/queries.js';
import { fmtMoney, fmtSum, fmtQty, fmtDate, todayStr, addDays, PAY_METHODS } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import Modal, { ConfirmModal } from '../components/Modal.jsx';
import MapIcon from '../components/MapIcon.jsx';
import PageSkeleton from '../components/PageSkeleton.jsx';
import Spinner from '../components/Spinner.jsx';
import { Sk, SkStats } from '../components/Skeleton.jsx';

const EXPENSE_CATEGORIES = ['Masalliqlar', 'Kommunal', 'Ish haqi', 'Ijara', 'Transport', 'Boshqa']; // DB category qiymati — o'zbekcha qaladi, render paytida t(c)

const EMPTY_REPORT = {
  order_count: 0, revenue: 0, discount_total: 0, avg_check: 0,
  byDay: [], byMethod: [], topProducts: [], expenses: [], expenseTotal: 0, profit: 0,
};

function compact(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}

export default function ReportsPage() {
  const { toast, can } = useApp();
  const mayExpense = can('expenses');
  const [period, setPeriod] = useState('today');
  const [customFrom, setCustomFrom] = useState(addDays(todayStr(), -7));
  const [customTo, setCustomTo] = useState(todayStr());
  const [expenseForm, setExpenseForm] = useState(false);
  const [expenseDelete, setExpenseDelete] = useState(null);

  const [from, to] = useMemo(() => {
    const today = todayStr();
    switch (period) {
      case 'today': return [today, today];
      case '7': return [addDays(today, -6), today];
      case '30': return [addDays(today, -29), today];
      case 'all': return ['2000-01-01', today];
      default: return [customFrom, customTo];
    }
  }, [period, customFrom, customTo]);

  const { data: reportData, loading, error, reload } = useData(() => getReport(from, to), [from, to]);
  const report = reportData || EMPTY_REPORT;
  const maxDay = Math.max(1, ...report.byDay.map((d) => d.revenue));

  if (!reportData) {
    return (
      <PageSkeleton icon={ChartNoAxesCombined} title={t('Hisobot')} error={error} onRetry={reload}>
        <SkStats n={5} />
        <div className="report-grid">
          <div className="card card-pad">
            <Sk w={140} h={14} r={7} className="mb-2" />
            <div className="sk-bars">
              {Array.from({ length: 9 }, (_, i) => <Sk key={i} w="100%" h={26 + ((i * 37) % 70)} r={7} />)}
            </div>
          </div>
          <div className="card card-pad">
            <Sk w={150} h={14} r={7} className="mb-2" />
            <div className="sk-list">
              {Array.from({ length: 3 }, (_, i) => <Sk key={i} h={44} r={14} />)}
            </div>
          </div>
        </div>
      </PageSkeleton>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><ChartNoAxesCombined size={22} /> {t('Hisobot')}</h1>
          <div className="page-sub">{fmtDate(from)} — {fmtDate(to)}</div>
        </div>
        <div className="head-actions">
          {loading && <Spinner size={18} label={t('Yangilanmoqda')} />}
          {mayExpense && (
            <button className="btn btn-primary" onClick={() => setExpenseForm(true)}><Plus size={16} /> {t("Xarajat qo'shish")}</button>
          )}
        </div>
      </div>

      <div className="page-body">
        <div className="period-bar">
          {[
            ['today', 'Bugun'],
            ['7', '7 kun'],
            ['30', '30 kun'],
            ['all', 'Hammasi'],
            ['custom', 'Boshqa davr'],
          ].map(([key, label]) => (
            <button key={key} className={`chip ${period === key ? 'active' : ''}`} onClick={() => setPeriod(key)}>
              {t(label)}
            </button>
          ))}
          {period === 'custom' && (
            <>
              <input className="input" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <span className="muted">—</span>
              <input className="input" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </>
          )}
        </div>

        <div className="stat-cards">
          <div className="stat-card">
            <div className="stat-label"><Wallet size={14} /> {t('Tushum')}</div>
            <div className="stat-value green">{fmtMoney(report.revenue)}</div>
            <div className="stat-sub">so'm</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><ReceiptText size={14} /> {t('Buyurtmalar')}</div>
            <div className="stat-value">{report.order_count}</div>
            <div className="stat-sub">{t("to'langan")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><ChartColumnIncreasing size={14} /> {t("O'rtacha chek")}</div>
            <div className="stat-value blue">{fmtMoney(report.avg_check)}</div>
            <div className="stat-sub">so'm</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><CreditCard size={14} /> {t('Xarajatlar')}</div>
            <div className="stat-value red">{fmtMoney(report.expenseTotal)}</div>
            <div className="stat-sub">so'm</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><TrendingUp size={14} /> {t('Sof foyda')}</div>
            <div className={`stat-value ${report.profit >= 0 ? 'green' : 'red'}`}>{fmtMoney(report.profit)}</div>
            <div className="stat-sub">{t('tushum − xarajat')}</div>
          </div>
        </div>

        <div className="report-grid">
          <div className="card card-pad">
            <div className="bold mb-2 ti"><ChartNoAxesCombined size={16} /> {t('Kunlik savdo')}</div>
            {report.byDay.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon"><CalendarDays size={22} /></span>
                {t("Bu davrda savdo yo'q")}
              </div>
            ) : (
              <div className="bar-chart">
                {report.byDay.map((d) => (
                  <div key={d.day} className="bar-col" title={t('{date}: {sum} ({n} buyurtma)', { date: fmtDate(d.day), sum: fmtSum(d.revenue), n: d.order_count })}>
                    <span className="bar-value">{compact(d.revenue)}</span>
                    <div className="bar" style={{ height: `${Math.max(2, (d.revenue / maxDay) * 100)}%` }} />
                    <span className="bar-label">{d.day.slice(8, 10)}.{d.day.slice(5, 7)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card card-pad">
            <div className="bold mb-2 ti"><CreditCard size={16} /> {t("To'lov turlari")}</div>
            {report.byMethod.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon"><CreditCard size={22} /></span>
                {t("Ma'lumot yo'q")}
              </div>
            ) : (
              report.byMethod.map((m) => (
                <div key={m.payment_method} className="method-row">
                  <span className="method-icon"><MapIcon map={PAY_METHODS} name={m.payment_method} size={20} fallback={Wallet} /></span>
                  <div className="method-info">
                    <div className="method-name">{PAY_METHODS[m.payment_method] ? t(PAY_METHODS[m.payment_method].label) : m.payment_method}</div>
                    <div className="method-count">{t('{n} ta buyurtma', { n: m.order_count })}</div>
                  </div>
                  <span className="method-sum">{fmtMoney(m.revenue)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="report-grid mt-3">
          <div className="card card-pad">
            <div className="bold mb-2 ti"><Trophy size={16} /> {t('Top mahsulotlar')}</div>
            {report.topProducts.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon"><Trophy size={22} /></span>
                {t("Ma'lumot yo'q")}
              </div>
            ) : (
              report.topProducts.map((p, i) => (
                <div key={p.name} className="top-row">
                  <span className={`rank ${i < 3 ? `r${i + 1}` : ''}`}>{i + 1}</span>
                  <span className="top-name">{p.name}</span>
                  <span className="top-qty">{fmtQty(p.qty)} {t('dona')}</span>
                  <span className="top-sum">{fmtMoney(p.revenue)}</span>
                </div>
              ))
            )}
          </div>

          <div className="card card-pad">
            <div className="row-between mb-2">
              <span className="bold ti"><CreditCard size={16} /> {t('Xarajatlar')}</span>
              {mayExpense && (
                <button className="btn btn-secondary btn-sm" onClick={() => setExpenseForm(true)}><Plus size={14} /> {t("Qo'shish")}</button>
              )}
            </div>
            {report.expenses.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon"><CreditCard size={22} /></span>
                {t("Xarajatlar yo'q")}
              </div>
            ) : (
              report.expenses.map((e) => (
                <div key={e.id} className="method-row">
                  <div className="method-info">
                    <div className="method-name">{e.title}</div>
                    <div className="method-count">{fmtDate(e.created_at)} · {t(e.category)}</div>
                  </div>
                  <span className="method-sum" style={{ color: 'var(--red)' }}>{fmtMoney(e.amount)}</span>
                  {mayExpense && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setExpenseDelete(e)}><Trash2 size={15} /></button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {expenseForm && (
        <ExpenseModal
          onClose={() => setExpenseForm(false)}
          onSaved={() => { setExpenseForm(false); toast(t("Xarajat qo'shildi")); }}
        />
      )}

      {expenseDelete && (
        <ConfirmModal
          title={t("Xarajatni o'chirish")}
          message={t('"{title}" ({sum}) o\'chirilsinmi?', { title: expenseDelete.title, sum: fmtSum(expenseDelete.amount) })}
          confirmLabel={t("O'chirish")}
          danger
          onClose={() => setExpenseDelete(null)}
          onConfirm={async () => {
            try {
              await deleteExpense(expenseDelete.id);
              toast(t("Xarajat o'chirildi"), 'info');
            } catch (e) {
              toast(e.message, 'error');
            }
          }}
        />
      )}
    </div>
  );
}

function ExpenseModal({ onClose, onSaved }) {
  const { toast } = useApp();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);

  async function save() {
    if (!title.trim()) return toast(t('Xarajat nomini kiriting'), 'error');
    if (!(Number(amount) > 0)) return toast(t("Summa 0 dan katta bo'lishi kerak"), 'error');
    try {
      await addExpense({ title: title.trim(), amount: Math.round(Number(amount)), category });
      onSaved();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <Modal
      title={t('Yangi xarajat')}
      onClose={onClose}
      width={440}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('Bekor qilish')}</button>
          <button className="btn btn-primary" onClick={save}>{t('Saqlash')}</button>
        </>
      }
    >
      <div className="field">
        <label className="label">{t('Nomi')}</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Masalan: Sabzavotlar xaridi')} autoFocus />
      </div>
      <div className="form-row">
        <div className="field">
          <label className="label">{t("Summa (so'm)")}</label>
          <input className="input" type="number" min="0" step="1000" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">{t('Kategoriya')}</label>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}
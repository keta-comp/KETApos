import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { getReport, addExpense, deleteExpense } from '../db/store.js';
import { fmtMoney, fmtSum, fmtQty, fmtDate, todayStr, addDays, PAY_METHODS } from '../lib/format.js';
import Modal, { ConfirmModal } from '../components/Modal.jsx';

const EXPENSE_CATEGORIES = ['Masalliqlar', 'Kommunal', 'Ish haqi', 'Ijara', 'Transport', 'Boshqa'];

function compact(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}

export default function ReportsPage() {
  const { version, toast } = useApp();
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

  const report = useMemo(() => getReport(from, to), [from, to, version]);
  const maxDay = Math.max(1, ...report.byDay.map((d) => d.revenue));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">📊 Hisobot</h1>
          <div className="page-sub">{fmtDate(from)} — {fmtDate(to)}</div>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => setExpenseForm(true)}>+ Xarajat qo'shish</button>
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
              {label}
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
            <div className="stat-label">💰 Tushum</div>
            <div className="stat-value green">{fmtMoney(report.revenue)}</div>
            <div className="stat-sub">so'm</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">🧾 Buyurtmalar</div>
            <div className="stat-value">{report.order_count}</div>
            <div className="stat-sub">to'langan</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">📈 O'rtacha chek</div>
            <div className="stat-value blue">{fmtMoney(report.avg_check)}</div>
            <div className="stat-sub">so'm</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">💸 Xarajatlar</div>
            <div className="stat-value red">{fmtMoney(report.expenseTotal)}</div>
            <div className="stat-sub">so'm</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">🏆 Sof foyda</div>
            <div className={`stat-value ${report.profit >= 0 ? 'green' : 'red'}`}>{fmtMoney(report.profit)}</div>
            <div className="stat-sub">tushum − xarajat</div>
          </div>
        </div>

        <div className="report-grid">
          <div className="card card-pad">
            <div className="bold mb-2">📅 Kunlik savdo</div>
            {report.byDay.length === 0 ? (
              <div className="empty-state">
                <span className="empty-emoji">📅</span>
                Bu davrda savdo yo'q
              </div>
            ) : (
              <div className="bar-chart">
                {report.byDay.map((d) => (
                  <div key={d.day} className="bar-col" title={`${fmtDate(d.day)}: ${fmtSum(d.revenue)} (${d.order_count} buyurtma)`}>
                    <span className="bar-value">{compact(d.revenue)}</span>
                    <div className="bar" style={{ height: `${Math.max(2, (d.revenue / maxDay) * 100)}%` }} />
                    <span className="bar-label">{d.day.slice(8, 10)}.{d.day.slice(5, 7)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card card-pad">
            <div className="bold mb-2">💳 To'lov turlari</div>
            {report.byMethod.length === 0 ? (
              <div className="empty-state">
                <span className="empty-emoji">💳</span>
                Ma'lumot yo'q
              </div>
            ) : (
              report.byMethod.map((m) => (
                <div key={m.payment_method} className="method-row">
                  <span className="method-emoji">{PAY_METHODS[m.payment_method]?.emoji || '💰'}</span>
                  <div className="method-info">
                    <div className="method-name">{PAY_METHODS[m.payment_method]?.label || m.payment_method}</div>
                    <div className="method-count">{m.order_count} ta buyurtma</div>
                  </div>
                  <span className="method-sum">{fmtMoney(m.revenue)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="report-grid mt-3">
          <div className="card card-pad">
            <div className="bold mb-2">🏅 Top mahsulotlar</div>
            {report.topProducts.length === 0 ? (
              <div className="empty-state">
                <span className="empty-emoji">🏅</span>
                Ma'lumot yo'q
              </div>
            ) : (
              report.topProducts.map((p, i) => (
                <div key={p.name} className="top-row">
                  <span className={`rank ${i < 3 ? `r${i + 1}` : ''}`}>{i + 1}</span>
                  <span className="top-name">{p.name}</span>
                  <span className="top-qty">{fmtQty(p.qty)} dona</span>
                  <span className="top-sum">{fmtMoney(p.revenue)}</span>
                </div>
              ))
            )}
          </div>

          <div className="card card-pad">
            <div className="row-between mb-2">
              <span className="bold">💸 Xarajatlar</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setExpenseForm(true)}>+ Qo'shish</button>
            </div>
            {report.expenses.length === 0 ? (
              <div className="empty-state">
                <span className="empty-emoji">💸</span>
                Xarajatlar yo'q
              </div>
            ) : (
              report.expenses.map((e) => (
                <div key={e.id} className="method-row">
                  <div className="method-info">
                    <div className="method-name">{e.title}</div>
                    <div className="method-count">{fmtDate(e.created_at)} · {e.category}</div>
                  </div>
                  <span className="method-sum" style={{ color: 'var(--red)' }}>{fmtMoney(e.amount)}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setExpenseDelete(e)}>🗑</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {expenseForm && (
        <ExpenseModal
          onClose={() => setExpenseForm(false)}
          onSaved={() => { setExpenseForm(false); toast("Xarajat qo'shildi"); }}
        />
      )}

      {expenseDelete && (
        <ConfirmModal
          title="Xarajatni o'chirish"
          message={`"${expenseDelete.title}" (${fmtSum(expenseDelete.amount)}) o'chirilsinmi?`}
          confirmLabel="O'chirish"
          danger
          onClose={() => setExpenseDelete(null)}
          onConfirm={() => {
            deleteExpense(expenseDelete.id);
            toast("Xarajat o'chirildi", 'info');
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

  function save() {
    if (!title.trim()) return toast('Xarajat nomini kiriting', 'error');
    if (!(Number(amount) > 0)) return toast("Summa 0 dan katta bo'lishi kerak", 'error');
    try {
      addExpense({ title: title.trim(), amount: Math.round(Number(amount)), category });
      onSaved();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <Modal
      title="Yangi xarajat"
      onClose={onClose}
      width={440}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Bekor qilish</button>
          <button className="btn btn-primary" onClick={save}>Saqlash</button>
        </>
      }
    >
      <div className="field">
        <label className="label">Nomi</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Masalan: Sabzavotlar xaridi" autoFocus />
      </div>
      <div className="form-row">
        <div className="field">
          <label className="label">Summa (so'm)</label>
          <input className="input" type="number" min="0" step="1000" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Kategoriya</label>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}
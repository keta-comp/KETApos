import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight, CircleCheck, CircleX, Clock, Copy, MapPin, Minus, Phone, Plus,
  Send, ShoppingBag, Store, X,
} from 'lucide-react';
import './online.css';
import {
  ERRORS, clientId, fetchMenu, fetchStatus, photoUrl, rotateClientId, savedTokens, submitOrder,
} from './api.js';
import { t } from '../lib/i18n.js';
import { LANGS, setLang, useLang } from '../lib/lang.js';
import { fmtDateTime, fmtQty, fmtSum } from '../lib/format.js';
import { formatPhone, normalizePhone } from '../landing/lib/demoRequests.js';
import Spinner from '../components/Spinner.jsx';

// Mijoz sahifasi: /o/<slug>. Instagram yoki Telegram bio'siga shu bitta link
// qo'yiladi — odam kirib kirmasdan menyu ko'radi va zakaz yuboradi. To'lov
// onlayn olinmaydi: kassada yoki yetkazuvchiga to'lanadi.

const KINDS = { fastfood: 'Fastfood', cafe: 'Kafe', restaurant: 'Restoran' };

const STATUS = {
  new: { label: 'Ko‘rib chiqilmoqda', cls: 'wait', icon: Clock },
  accepted: { label: 'Qabul qilindi', cls: 'ok', icon: CircleCheck },
  rejected: { label: 'Rad etildi', cls: 'bad', icon: CircleX },
};

const NOT_FOUND = 'Bu menyu ochiq emas — balki do‘kon onlayn zakazni o‘chirgan yoki havola eskirgan.';

export default function OnlineShop({ slug }) {
  const { lang } = useLang();
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [cart, setCart] = useState({});
  const [catIndex, setCatIndex] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', type: 'pickup', address: '', note: '' });
  const [placed, setPlaced] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [mine, setMine] = useState([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setTokens(savedTokens(slug));
    fetchMenu(slug)
      .then((data) => {
        if (!alive) return;
        if (data) {
          setMenu(data);
          setPageError('');
        } else {
          setPageError(NOT_FOUND);
        }
      })
      .catch((e) => { if (alive) setPageError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  // Zakaz holatini do'kon qabul qilgach ko'rish uchun 30 soniyada bir so'raymiz.
  const loadMine = useCallback(() => {
    if (!tokens.length) {
      setMine([]);
      return undefined;
    }
    return Promise.all(
      tokens.map((token) => fetchStatus(token)
        .then((data) => (data ? { token, ...data } : null))
        .catch(() => null)),
    ).then((rows) => setMine(rows.filter(Boolean)));
  }, [tokens]);

  useEffect(() => {
    loadMine();
    const timer = setInterval(loadMine, 30000);
    return () => clearInterval(timer);
  }, [loadMine]);

  useEffect(() => {
    // Sakich yoki Electron oynasi sarlavhasi do'kon nomiga o'zgaradi.
    document.title = menu?.name ? `${menu.name} — KetaPOS` : document.title;
  }, [menu, lang]);

  const products = useMemo(() => menu?.categories?.[catIndex]?.products || [], [menu, catIndex]);
  const catalog = useMemo(() => {
    const map = new Map();
    for (const c of menu?.categories || []) for (const p of c.products || []) map.set(p.id, p);
    return map;
  }, [menu]);

  const lines = useMemo(
    () => Object.entries(cart)
      .map(([id, qty]) => {
        const p = catalog.get(id);
        return p ? { id, name: p.name, price: Number(p.price) || 0, emoji: p.emoji, qty } : null;
      })
      .filter(Boolean),
    [cart, catalog],
  );
  const total = lines.reduce((sum, l) => sum + Math.round(l.price * l.qty), 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  const minimum = Number(menu?.min_total) || 0;
  const belowMin = total < minimum;

  function setQty(id, qty) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(99, Math.round(qty));
      return next;
    });
  }

  function patchForm(fields) {
    setFormError('');
    setForm((f) => ({ ...f, ...fields }));
  }

  async function send() {
    const name = form.name.trim();
    const phone = normalizePhone(form.phone);
    if (name.length < 2) { setFormError(ERRORS.NOM_KERTILMADI); return; }
    if (!phone) { setFormError(ERRORS.TELEF_NOTOGRI); return; }
    if (form.type === 'delivery' && form.address.trim().length < 5) { setFormError(ERRORS.MANZIL_KERTILMADI); return; }
    if (!lines.length) { setFormError(ERRORS.BUYURTMA_BOSH); return; }

    setSending(true);
    setFormError('');
    try {
      const res = await submitOrder({
        slug,
        client_id: clientId(),
        name,
        phone,
        type: form.type,
        address: form.type === 'delivery' ? form.address.trim() : null,
        note: form.note.trim() || null,
        items: lines.map((l) => ({ product_id: l.id, qty: l.qty })),
      });
      rotateClientId();
      setPlaced(res);
      setCart({});
      setForm((f) => ({ ...f, address: '', note: '' }));
      setSheetOpen(false);
      setTokens(savedTokens(slug));
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSending(false);
    }
  }

  const head = (
    <header className="os-head">
      <div className="os-row">
        <span className="os-mark"><Store size={18} /></span>
        <div className="os-titles">
          <div className="os-name">{menu?.name || 'KetaPOS'}</div>
          <div className="os-sub">
            {menu ? `${KINDS[menu.kind] || menu.kind} · ${t('{n} ta mahsulot', { n: catalog.size })}` : t('Onlayn do‘kon')}
          </div>
        </div>
        <div className="os-lang" role="group" aria-label={t('Til')}>
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`os-lang-btn ${l.id === lang ? 'on' : ''}`}
              aria-pressed={l.id === lang}
              onClick={() => setLang(l.id)}
            >
              {l.short}
            </button>
          ))}
        </div>
      </div>
      {menu && (menu.phone || menu.address) && (
        <div className="os-meta">
          {menu.phone && (
            <a className="os-chip" href={`tel:${String(menu.phone).replace(/[^+0-9]/g, '')}`}>
              <Phone size={13} /> {formatPhone(menu.phone)}
            </a>
          )}
          {menu.address && <span className="os-chip"><MapPin size={13} /> {menu.address}</span>}
        </div>
      )}
      {mine.length > 0 && (
        <div className="os-mine">
          {mine.slice(0, 2).map((row) => <StatusLine key={row.token} row={row} />)}
        </div>
      )}
    </header>
  );

  if (!menu) {
    return (
      <div className="os">
        {head}
        <div className="os-boot">
          {loading
            ? (
              <><Spinner size={20} /> <span>{t('Menyu yuklanmoqda...')}</span></>
            )
            : (
              <>
                <span className="os-boot-ico"><CircleX size={24} /></span>
                <p>{t(pageError || NOT_FOUND)}</p>
              </>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="os">
      {head}
      {!menu.accepting && (
        <div className="os-warn">
          <Clock size={15} /> {t('Do‘kon hozir zakaz qabul qilmaydi — keyinroq kirib ko‘ring.')}
        </div>
      )}
      {placed && (
        <PlacedCard
          placed={placed}
          row={mine.find((m) => m.token === placed.token)}
          onDone={() => setPlaced(null)}
        />
      )}
      <nav className="os-cats">
        {menu.categories.map((c, i) => (
          <button
            key={`${c.name}-${i}`}
            type="button"
            className={`os-cat ${i === catIndex ? 'on' : ''}`}
            style={i === catIndex ? { background: c.color, borderColor: c.color } : undefined}
            onClick={() => setCatIndex(i)}
          >
            {c.emoji && <span className="os-cat-emoji">{c.emoji}</span>}
            {c.name}
          </button>
        ))}
      </nav>
      <main className="os-list">
        {products.length === 0 && <div className="os-empty">{t('Bu bo‘limda hozircha mahsulot yo‘q.')}</div>}
        {products.map((p) => {
          const qty = cart[p.id] || 0;
          return (
            <article key={p.id} className={`os-item ${p.available ? '' : 'off'}`}>
              <div className="os-thumb">
                {p.photo_path
                  ? <img src={photoUrl(p.photo_path)} alt="" loading="lazy" />
                  : <span>{p.emoji}</span>}
              </div>
              <div className="os-item-main">
                <div className="os-item-name">{p.name}</div>
                <div className="os-item-price">{fmtSum(p.price)}</div>
                {!p.available && <div className="os-item-out">{t('Tugagan')}</div>}
              </div>
              <div className="os-item-act">
                {qty > 0 ? (
                  <div className="os-stepper">
                    <button type="button" onClick={() => setQty(p.id, qty - 1)} aria-label={t('Kamaytirish')}>
                      <Minus size={15} />
                    </button>
                    <b>{fmtQty(qty)}</b>
                    <button type="button" onClick={() => setQty(p.id, qty + 1)} aria-label={t('Ko‘paytirish')}>
                      <Plus size={15} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="os-add"
                    disabled={!p.available || !menu.accepting}
                    onClick={() => setQty(p.id, 1)}
                  >
                    <Plus size={15} /> {t('Qo‘shish')}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </main>
      <footer className="os-foot">
        {t('Zakazni do‘kon tasdiqlagach chaqiradi yoki yetkazadi. To‘lov kassada yoki yetkazuvchiga beriladi.')}
      </footer>
      {count > 0 && (
        <button type="button" className="os-bar" onClick={() => setSheetOpen(true)}>
          <span className="os-bar-ico"><ShoppingBag size={17} /></span>
          <span className="os-bar-n">{t('{n} ta mahsulot', { n: count })}</span>
          <span className="os-bar-sum">{fmtSum(total)} <ChevronRight size={17} /></span>
        </button>
      )}
      {sheetOpen && (
        <CheckoutSheet
          menu={menu}
          lines={lines}
          total={total}
          minimum={minimum}
          belowMin={belowMin}
          form={form}
          formError={formError}
          sending={sending}
          patchForm={patchForm}
          onCancel={() => setSheetOpen(false)}
          onSend={send}
        />
      )}
    </div>
  );
}

function StatusLine({ row }) {
  const st = STATUS[row.status] || STATUS.new;
  const Icon = st.icon;
  return (
    <div className={`os-status ${st.cls}`}>
      <span className="os-status-ico"><Icon size={14} /></span>
      <span className="os-status-txt">
        {t(st.label)}
        {row.status === 'accepted' && row.number ? ` №${row.number}` : ''}
        {row.status === 'rejected' && row.reason ? ` — ${row.reason}` : ''}
      </span>
      <span className="os-status-sum">{fmtSum(row.total)}</span>
    </div>
  );
}

function PlacedCard({ placed, row, onDone }) {
  const [copied, setCopied] = useState(false);
  const st = STATUS[(row && row.status) || placed.status] || STATUS.new;
  const Icon = st.icon;

  async function copy() {
    try {
      await navigator.clipboard.writeText(placed.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard ruxsat bermasa kod ekranda ko'rinib turadi
    }
  }

  return (
    <section className="os-placed">
      <div className="os-placed-head">
        <span className="os-placed-ico"><CircleCheck size={18} /></span>
        <div className="os-placed-titles">
          <div className="os-placed-title">{t('Zakazingiz yuborildi')}</div>
          <div className="os-placed-sub">{t('Do‘kon uni ko‘rib chiqadi — holatini shu sahifadan kuzating.')}</div>
        </div>
        <button type="button" className="os-x" onClick={onDone} aria-label={t('Yopish')}><X size={16} /></button>
      </div>
      <div className="os-placed-row">
        <div>
          <div className="os-k-label">{t('Kuzatish kodi')}</div>
          <div className="os-k-code">{placed.token}</div>
        </div>
        <button type="button" className="os-copy" onClick={copy}>
          {copied ? <CircleCheck size={14} /> : <Copy size={14} />} {copied ? t('Nusxalandi') : t('Nusxalash')}
        </button>
      </div>
      <div className={`os-status wide ${st.cls}`}>
        <span className="os-status-ico"><Icon size={14} /></span>
        <span className="os-status-txt">
          {t(st.label)}
          {row && row.status === 'accepted' && row.number ? ` №${row.number}` : ''}
          {row && row.status === 'rejected' && row.reason ? ` — ${row.reason}` : ''}
        </span>
        <span className="os-status-sum">{fmtSum(placed.total)}</span>
      </div>
    </section>
  );
}

function CheckoutSheet({
  menu, lines, total, minimum, belowMin, form, formError, sending, patchForm, onCancel, onSend,
}) {
  return (
    <div className="os-veil" role="dialog" aria-modal="true" aria-label={t('Zakazni rasmiylashtirish')} onClick={onCancel}>
      <div className="os-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="os-sheet-head">
          <b>{t('Zakazni rasmiylashtirish')}</b>
          <button type="button" className="os-x" onClick={onCancel} aria-label={t('Yopish')}><X size={16} /></button>
        </div>

        <div className="os-lines">
          {lines.map((l) => (
            <div key={l.id} className="os-line">
              <span className="os-line-name">{l.name} <i>×{fmtQty(l.qty)}</i></span>
              <span className="os-line-sum">{fmtSum(l.price * l.qty)}</span>
            </div>
          ))}
        </div>
        <div className="os-total">
          <span>{t('Jami')}</span>
          <b>{fmtSum(total)}</b>
        </div>

        {minimum > 0 && (
          <div className={`os-min ${belowMin ? 'bad' : ''}`}>
            {belowMin
              ? t('Minimal zakaz {sum} — yana {gap} qo‘shing', { sum: fmtSum(minimum), gap: fmtSum(minimum - total) })
              : t('Minimal zakaz {sum}', { sum: fmtSum(minimum) })}
          </div>
        )}

        {menu.delivery && (
          <div className="os-seg" role="group" aria-label={t('Zakaz turi')}>
            <button type="button" className={form.type === 'pickup' ? 'on' : ''} onClick={() => patchForm({ type: 'pickup' })}>
              {t('Olib ketish')}
            </button>
            <button type="button" className={form.type === 'delivery' ? 'on' : ''} onClick={() => patchForm({ type: 'delivery' })}>
              {t('Yetkazib berish')}
            </button>
          </div>
        )}

        <label className="os-field">
          <span>{t('Ism')}</span>
          <input
            className="os-input"
            value={form.name}
            maxLength={60}
            placeholder={t('Masalan: Aziza')}
            onChange={(e) => patchForm({ name: e.target.value })}
          />
        </label>
        <label className="os-field">
          <span>{t('Telefon')}</span>
          <input
            className="os-input"
            value={form.phone}
            inputMode="tel"
            maxLength={20}
            placeholder="+998 77 763 02 16"
            onChange={(e) => patchForm({ phone: e.target.value })}
          />
        </label>
        {form.type === 'delivery' && (
          <label className="os-field">
            <span>{t('Manzil')}</span>
            <textarea
              className="os-input os-area"
              value={form.address}
              maxLength={200}
              placeholder={t('Ko‘cha, uy, kvartira')}
              onChange={(e) => patchForm({ address: e.target.value })}
            />
          </label>
        )}
        <label className="os-field">
          <span>{t('Izoh')} <i>{t('(ixtiyoriy)')}</i></span>
          <textarea
            className="os-input os-area"
            value={form.note}
            maxLength={300}
            placeholder={t('Masalan: achchiqsiz, 18:00 gacha')}
            onChange={(e) => patchForm({ note: e.target.value })}
          />
        </label>

        {formError && <div className="os-form-error">{t(formError)}</div>}

        <button type="button" className="os-send" disabled={sending || belowMin} onClick={onSend}>
          {sending ? <Spinner size={16} /> : <Send size={16} />} {t('Zakazni yuborish')}
        </button>
        <div className="os-sheet-note">{t('To‘lov onlayn olinmaydi — kassada yoki yetkazuvchiga beriladi.')}</div>
      </div>
    </div>
  );
}

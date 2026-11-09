import { useEffect, useRef, useState } from 'react';
import { CircleCheck, Loader2, TriangleAlert, X } from 'lucide-react';
import { BRAND, BUSINESS_KINDS } from './lib/site.js';
import { t } from '../lib/i18n.js';
import { formatPhone, normalizePhone, submitDemoRequest } from './lib/demoRequests.js';

const EMPTY = { name: '', phone: '', business: 'cafe', note: '', trap: '' };

export default function DemoModal({ onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (state === 'error') setState('idle');
  }

  async function send(e) {
    e.preventDefault();
    if (state === 'sending') return;
    if (form.name.trim().length < 2) {
      setState('error');
      setError(t('Ismni to‘liq kiriting — kamida 2 belgi.'));
      return;
    }
    if (!normalizePhone(form.phone)) {
      setState('error');
      setError(t('Telefon raqami noto‘g‘ri. Masalan: +998 77 763 02 16.'));
      return;
    }
    setState('sending');
    setError('');
    try {
      await submitDemoRequest(form);
      setState('sent');
    } catch (err) {
      setState('error');
      // demoRequests matnlari o'zbekcha qaytadi — ko'rsatilganda tarjima qilinadi.
      setError(t(err.message));
    }
  }

  return (
    <div className="lp-modal-bg" onClick={onClose} role="presentation">
      <div className="lp-modal" role="dialog" aria-modal="true" aria-label={t('Demo arizasi')} onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-head">
          <h3>{t('Demo so‘rash')}</h3>
          <button className="lp-icon-btn" onClick={onClose} aria-label={t('Yopish')}><X size={18} /></button>
        </div>

        {state === 'sent' ? (
          <div className="lp-done">
            <span className="lp-done-icon"><CircleCheck size={30} /></span>
            <h4>{t('Arizangiz qabul qilindi')}</h4>
            <p>{t('Tez orada {phone} raqami bo‘yicha siz bilan bog‘lanamiz.', { phone: form.phone ? formatPhone(form.phone) : BRAND.phoneLabel })}</p>
            <button className="lp-btn lp-btn-primary" onClick={onClose}>{t('Yopish')}</button>
          </div>
        ) : (
          <form className="lp-form" onSubmit={send} noValidate>
            <p className="lp-modal-sub">{t('{brand} biznesingizga mos kelishini birga tekshirib ko‘ramiz.', { brand: BRAND.product })}</p>

            <label className="lp-field">
              <span>{t('Ism')}</span>
              <input
                ref={firstField}
                className="lp-input"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder={t('Ismingiz')}
                autoComplete="name"
                maxLength={80}
                required
              />
            </label>

            <label className="lp-field">
              <span>{t('Telefon')}</span>
              <input
                className="lp-input"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => set('phone', formatPhone(e.target.value))}
                placeholder="+998 77 123 45 67"
                autoComplete="tel"
                required
              />
            </label>

            <label className="lp-field">
              <span>{t('Biznes turi')}</span>
              <select className="lp-input" value={form.business} onChange={(e) => set('business', e.target.value)}>
                {BUSINESS_KINDS.map((k) => <option key={k.id} value={k.id}>{t(k.label)}</option>)}
              </select>
            </label>

            <label className="lp-field">
              <span>{t('Izoh')} <i>{t('(ixtiyoriy)')}</i></span>
              <textarea
                className="lp-input lp-textarea"
                value={form.note}
                onChange={(e) => set('note', e.target.value)}
                placeholder={t('Necha stol, nechta kassa, qanday printer…')}
                rows="3"
                maxLength={500}
              />
            </label>

            {/* Spamlar uchun yashil maydon — odam ko‘rmaydi, bot to‘ldiradi. */}
            <label className="lp-trap" aria-hidden="true">
              <span>{t('Blank maydon')}</span>
              <input
                className="lp-input"
                tabIndex={-1}
                autoComplete="off"
                value={form.trap}
                onChange={(e) => set('trap', e.target.value)}
              />
            </label>

            {state === 'error' && error && (
              <div className="lp-error" role="alert">
                <TriangleAlert size={16} /> <span>{error}</span>
              </div>
            )}

            <button className="lp-btn lp-btn-primary lp-btn-lg lp-send" type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? <><Loader2 size={18} className="lp-spin" /> {t('Yuborilmoqda…')}</> : t('Ariza yuborish')}
            </button>
            <p className="lp-privacy">{t('Raqamingiz faqat siz bilan bog‘lanish uchun ishlatiladi.')}</p>
          </form>
        )}
      </div>
    </div>
  );
}

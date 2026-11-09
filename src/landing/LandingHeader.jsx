import { useEffect, useState } from 'react';
import { Menu, X, CalendarPlus } from 'lucide-react';
import { BRAND, NAV } from './lib/site.js';
import { t } from '../lib/i18n.js';
import { LANGS, setLang, useLang } from '../lib/lang.js';

export default function LandingHeader({ onDemo }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { lang } = useLang();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`lp-head ${scrolled || open ? 'glass' : ''}`}>
      <div className="lp-wrap lp-head-row">
        <a className="lp-brand" href="#top" aria-label={t('KetaPOS — bosh sahifa')}>
          <img className="lp-brand-logo" src={BRAND.logo} alt="KetaPOS" width="160" height="107" />
          <span className="lp-brand-text">
            <b>{BRAND.product}</b>
            <i>{t(BRAND.tagline)}</i>
          </span>
        </a>

        <nav className="lp-nav" aria-label={t('Sahifa bo‘limlari')}>
          {NAV.map((item) => (
            <a key={item.href} className="lp-nav-link" href={item.href}>{t(item.label)}</a>
          ))}
        </nav>

        <div className="lp-head-actions">
          <div className="lp-lang" role="group" aria-label={t('Til')}>
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`lp-lang-btn ${l.id === lang ? 'on' : ''}`}
                aria-pressed={l.id === lang}
                title={l.label}
                onClick={() => setLang(l.id)}
              >
                {l.short}
              </button>
            ))}
          </div>
          <button className="lp-btn lp-btn-primary" onClick={onDemo}>
            <CalendarPlus size={17} /> {t('Demo so‘rash')}
          </button>
          <button
            className="lp-burger"
            aria-label={open ? t('Menyuni yopish') : t('Menyu')}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="lp-nav-mobile" aria-label={t('Mobil menyu')}>
          {NAV.map((item) => (
            <a key={item.href} className="lp-nav-link" href={item.href} onClick={() => setOpen(false)}>{t(item.label)}</a>
          ))}
          <a className="lp-nav-link lp-nav-app" href={BRAND.appHref}>{t('Kassaga kirish')}</a>
        </nav>
      )}
    </header>
  );
}

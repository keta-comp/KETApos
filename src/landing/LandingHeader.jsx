import { useEffect, useState } from 'react';
import { Menu, X, CalendarPlus } from 'lucide-react';
import { BRAND, NAV } from './lib/site.js';

export default function LandingHeader({ onDemo }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
        <a className="lp-brand" href="#top" aria-label="KetaPOS — bosh sahifa">
          <img className="lp-brand-logo" src={BRAND.logo} alt="KetaPOS" width="160" height="107" />
          <span className="lp-brand-text">
            <b>{BRAND.product}</b>
            <i>{BRAND.tagline}</i>
          </span>
        </a>

        <nav className="lp-nav" aria-label="Sahifa bo‘limlari">
          {NAV.map((item) => (
            <a key={item.href} className="lp-nav-link" href={item.href}>{item.label}</a>
          ))}
        </nav>

        <div className="lp-head-actions">
          <button className="lp-btn lp-btn-primary" onClick={onDemo}>
            <CalendarPlus size={17} /> Demo so‘rash
          </button>
          <button
            className="lp-burger"
            aria-label={open ? 'Menyuni yopish' : 'Menyu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="lp-nav-mobile" aria-label="Mobil menyu">
          {NAV.map((item) => (
            <a key={item.href} className="lp-nav-link" href={item.href} onClick={() => setOpen(false)}>{item.label}</a>
          ))}
          <a className="lp-nav-link lp-nav-app" href={BRAND.appHref}>Kassaga kirish</a>
        </nav>
      )}
    </header>
  );
}

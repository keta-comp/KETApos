import { Phone, Globe } from 'lucide-react';
import { BRAND, NAV } from './lib/site.js';

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <img className="lp-brand-logo" src={BRAND.logo} alt="KetaPOS" width="160" height="107" />
            <div>
              <b>{BRAND.product}</b>
              <p>{BRAND.tagline}</p>
            </div>
          </div>
          <nav className="lp-footer-nav" aria-label="Sahifa bo‘limlari">
            {NAV.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </nav>
          <div className="lp-footer-contacts">
            <a href={BRAND.phoneHref}><Phone size={15} /> {BRAND.phoneLabel}</a>
            <a href={BRAND.companySite} target="_blank" rel="noopener noreferrer"><Globe size={15} /> {BRAND.companySite.replace('https://', '')}</a>
            <a href={BRAND.appHref}>Kassaga kirish</a>
          </div>
        </div>
        <p className="lp-footer-made">{BRAND.product} — {BRAND.company} mahsuloti.</p>
        <div className="lp-footer-line" />
        <div className="lp-footer-bottom">
          <span>© {year} {BRAND.company}. Barcha huquqlar himoyalangan.</span>
          <span>{BRAND.companyNote}</span>
        </div>
      </div>
    </footer>
  );
}

import { CalendarPlus, Phone, Globe } from 'lucide-react';
import { BRAND } from './lib/site.js';
import { t } from '../lib/i18n.js';

export default function ContactSection({ onDemo }) {
  return (
    <section className="lp-section lp-light" id="aloqa">
      <div className="lp-wrap lp-contact">
        <div className="lp-contact-copy lp-reveal">
          <span className="lp-eyebrow">{t('Aloqa')}</span>
          <h2 className="lp-h2">{t('Bog‘laning')}</h2>
          <p className="lp-lead lp-lead-sm">
            {t('Savolingiz bormi yoki demo kerakmi — qo‘ng‘iroq qiling, birga ko‘rib chiqamiz.')}
          </p>
        </div>
        <div className="lp-contact-cards lp-reveal">
          <a className="lp-contact-card" href={BRAND.phoneHref}>
            <span className="lp-contact-icon"><Phone size={20} /></span>
            <span>
              <b>{t('Telefon')}</b>
              <i>{BRAND.phoneLabel}</i>
            </span>
          </a>
          <a className="lp-contact-card" href={BRAND.companySite} target="_blank" rel="noopener noreferrer">
            <span className="lp-contact-icon"><Globe size={20} /></span>
            <span>
              <b>{BRAND.company}</b>
              <i>keta.uz</i>
            </span>
          </a>
          <div className="lp-contact-card lp-contact-static">
            <span className="lp-contact-icon"><CalendarPlus size={20} /></span>
            <span>
              <b>Demo</b>
              <i>{t('Biznesingizga mos sozlab ko‘rsatamiz')}</i>
            </span>
          </div>
          <button className="lp-btn lp-btn-primary lp-btn-lg lp-contact-btn" onClick={onDemo}>
            <CalendarPlus size={18} /> {t('Ariza qoldirish')}
          </button>
        </div>
      </div>
    </section>
  );
}

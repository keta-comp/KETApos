import { useRef } from 'react';
import { CalendarPlus, Phone } from 'lucide-react';
import { BRAND } from './lib/site.js';
import { t } from '../lib/i18n.js';
import { usePauseWhenHidden } from './lib/motion.js';

export default function DemoBanner({ onDemo }) {
  const banner = useRef(null);
  usePauseWhenHidden(banner);

  return (
    <section className="lp-section lp-light lp-banner-sec">
      <div className="lp-wrap">
        <div className="lp-banner lp-reveal" ref={banner}>
          <div>
            <h2 className="lp-h2">{t('Ko‘rib chiqishdan boshlang')}</h2>
            <p className="lp-lead lp-lead-sm">
              {t('Ariza qoldiring — biznesingizga mos sozlab, birga sinab ko‘ramiz. Bu sizga hech narsani majbur qilmaydi.')}
            </p>
          </div>
          <div className="lp-banner-cta">
            <button className="lp-btn lp-btn-light lp-btn-lg" onClick={onDemo}>
              <CalendarPlus size={18} /> {t('Bepul demo so‘rash')}
            </button>
            <a className="lp-btn lp-btn-ghost lp-btn-lg" href={BRAND.phoneHref}>
              <Phone size={18} /> {BRAND.phoneLabel}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

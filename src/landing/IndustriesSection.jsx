import { useState } from 'react';
import { ArrowRight, X, CircleCheck } from 'lucide-react';
import { INDUSTRIES } from './lib/site.js';
import { t } from '../lib/i18n.js';
import { useReveal } from './lib/useReveal.js';
import { useCardTilt } from './lib/motion.js';

// Kartadagi tugma shu soha uchun muhim bo'lgan funksiyalarni ochib beradi.
export default function IndustriesSection() {
  useReveal();
  useCardTilt('.lp-industry', { max: 3, lift: 6 });
  const [active, setActive] = useState(null);

  return (
    <section className="lp-section lp-grey" id="sohalar">
      <div className="lp-wrap">
        <h2 className="lp-h2 lp-centered">{t('Sohalarga mos yechim')}</h2>
        <ul className="lp-industries">
          {INDUSTRIES.map((item, i) => (
            <li key={item.id} className="lp-industry-cell lp-reveal" style={{ '--lp-delay': `${i * 90}ms` }}>
              <article className="lp-industry">
                <img className="lp-industry-img" src={item.image} alt="" width="1200" height="800" loading="lazy" decoding="async" />
                <div className="lp-industry-shade" aria-hidden="true" />
                <div className="lp-industry-body">
                  <h3><item.icon size={20} /> {t(item.title)}</h3>
                  <p>{t(item.text)}</p>
                  <button
                    className="lp-industry-arrow"
                    onClick={() => setActive(item)}
                    aria-label={t('{title} — batafsil', { title: t(item.title) })}
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>

      {active && <IndustryModal item={active} onClose={() => setActive(null)} />}
    </section>
  );
}

function IndustryModal({ item, onClose }) {
  return (
    <div className="lp-modal-bg" onClick={onClose} role="presentation">
      <div className="lp-modal lp-modal-plain" role="dialog" aria-modal="true" aria-label={t(item.title)} onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-head">
          <h3>{t(item.title)}</h3>
          <button className="lp-icon-btn" onClick={onClose} aria-label={t('Yopish')}><X size={18} /></button>
        </div>
        <p className="lp-modal-sub">{t(item.text)}</p>
        <ul className="lp-points">
          {item.points.map((p) => (
            <li key={p}><CircleCheck size={17} /> <span>{t(p)}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

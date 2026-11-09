import { FEATURES } from './lib/site.js';
import { t } from '../lib/i18n.js';
import { useReveal } from './lib/useReveal.js';
import { useCardTilt } from './lib/motion.js';

export default function FeaturesSection() {
  useReveal();
  useCardTilt('.lp-clay', { max: 5, lift: 6 });

  return (
    <section className="lp-section lp-light" id="imkoniyatlar">
      <div className="lp-wrap">
        <h2 className="lp-h2 lp-centered">{t('Asosiy imkoniyatlar')}</h2>
        <ul className="lp-features">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="lp-card3d lp-reveal" style={{ '--lp-delay': `${i * 70}ms` }}>
              <article className="lp-clay">
                <span className="lp-clay-icon"><Icon size={26} /></span>
                <h3>{t(title)}</h3>
                <p>{t(text)}</p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

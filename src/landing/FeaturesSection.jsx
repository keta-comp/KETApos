import { FEATURES } from './lib/site.js';
import { useReveal } from './lib/useReveal.js';

export default function FeaturesSection() {
  useReveal();
  return (
    <section className="lp-section lp-light" id="imkoniyatlar">
      <div className="lp-wrap">
        <h2 className="lp-h2 lp-centered">Asosiy imkoniyatlar</h2>
        <ul className="lp-features">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="lp-clay lp-reveal" style={{ '--lp-delay': `${i * 60}ms` }}>
              <span className="lp-clay-icon"><Icon size={26} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

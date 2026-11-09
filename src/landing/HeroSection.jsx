import { useRef } from 'react';
import { CalendarPlus, Coffee, Play } from 'lucide-react';
import { BRAND, HERO_BADGES } from './lib/site.js';
import { usePauseWhenHidden, useStageMotion } from './lib/motion.js';

export default function HeroSection({ onDemo }) {
  const root = useRef(null);
  const stage = useRef(null);
  useStageMotion(stage, { tilt: 4, parallax: 28 });
  usePauseWhenHidden(root);

  return (
    <section className="lp-hero" id="hero" ref={root}>
      <div className="lp-waves" aria-hidden="true">
        <span className="lp-wave" style={{ top: '8%' }} />
        <span className="lp-wave" />
        <span className="lp-wave" />
      </div>
      <div className="lp-hero-glow" aria-hidden="true" />
      <div className="lp-wrap lp-hero-row">
        <div className="lp-hero-copy lp-stagger">
          <span className="lp-badge"><Coffee size={15} /> Kafe • Restoran • Fastfood uchun</span>
          <h1 className="lp-h1">
            Kafe va restoraningizni zamonaviy <span className="lp-pos-chip">POS</span> tizim bilan boshqaring
          </h1>
          <p className="lp-lead">
            Savdo, buyurtma, stol, ombor, xodimlar va hisobotlar — barchasi bitta platformada.
          </p>

          <div className="lp-hero-cta">
            <button className="lp-btn lp-btn-light lp-btn-lg" onClick={onDemo}>
              <CalendarPlus size={18} /> Bepul demo so‘rash
            </button>
            <a className="lp-btn lp-btn-ghost lp-btn-lg" href={BRAND.appHref}>
              <Play size={18} /> Tizimni ko‘rish
            </a>
          </div>

          <ul className="lp-hero-badges">
            {HERO_BADGES.map(({ icon: Icon, text }) => (
              <li key={text}><Icon size={15} /> {text}</li>
            ))}
          </ul>
        </div>

        <div className="lp-hero-art">
          <div className="lp-hero-stage" ref={stage}>
            <div className="lp-float">
              <img
                className="lp-hero-img"
                src={BRAND.hero}
                alt="KetaPOS ish stoli: sensorli monitor va chek printeri"
                width="1448"
                height="1086"
                fetchPriority="high"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

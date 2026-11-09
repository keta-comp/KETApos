import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQ } from './lib/site.js';
import { t } from '../lib/i18n.js';
import { useReveal } from './lib/useReveal.js';

export default function FaqSection() {
  useReveal();
  const [open, setOpen] = useState(0);

  return (
    <section className="lp-section lp-grey" id="faq">
      <div className="lp-wrap lp-narrow">
        <h2 className="lp-h2 lp-centered">{t('Ko‘p so‘raladigan savollar')}</h2>
        <ul className="lp-faq lp-reveal">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={item.q} className={`lp-faq-item ${isOpen ? 'open' : ''}`}>
                <button
                  className="lp-faq-q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span>{t(item.q)}</span>
                  <ChevronDown size={18} className="lp-faq-chev" />
                </button>
                <div className="lp-faq-a" hidden={!isOpen}>
                  <p>{t(item.a)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

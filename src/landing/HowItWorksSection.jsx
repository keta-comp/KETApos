import { ArrowRight } from 'lucide-react';
import { STEPS } from './lib/site.js';
import { useReveal } from './lib/useReveal.js';

export default function HowItWorksSection() {
  useReveal();
  return (
    <section className="lp-section lp-grey" id="qanday-ishlaydi">
      <div className="lp-wrap">
        <div className="lp-steps lp-reveal">
          <div className="lp-steps-head">
            <h2 className="lp-h2">Qanday ishlaydi?</h2>
            <p className="lp-lead lp-lead-sm lp-steps-note">Uch qadam — va tizim sizning biznesingizda ishlaydi.</p>
          </div>
          <ol className="lp-steps-list">
            {STEPS.map((step, i) => (
              <li key={step.n} className="lp-step">
                <span className="lp-step-num">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
            {STEPS.slice(1).map((step) => (
              <span key={step.n} className="lp-step-arrow" aria-hidden="true"><ArrowRight size={20} /></span>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

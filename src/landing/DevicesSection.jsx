import { MonitorSmartphone } from 'lucide-react';
import { BRAND, PLATFORMS } from './lib/site.js';

// Lucide'da brend ikonkalari yo'q — Windows/Android belgilarini o'zimiz chizamiz.
const ICONS = {
  windows: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M3 5.4 11 4.3v7.2H3zM12.4 4.1 21 3v8.5h-8.6zM3 12.5h8v7.2L3 18.6zM12.4 12.5H21V21l-8.6-1.1z" />
    </svg>
  ),
  android: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M6 9h12a1 1 0 0 1 1 1v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a1 1 0 0 1 1-1zm-.6-3.9a1 1 0 0 0-.3 1.4l1.2 1.9A9 9 0 0 1 12 7.4c1.6 0 3.1.4 4.4 1l1.2-1.9a1 1 0 1 0-1.7-1l-1.1 1.7a8 8 0 0 0-1.6-.5l.6-2.2a1 1 0 1 0-1.9-.5l-.7 2.2h-.3l-.7-2.2a1 1 0 0 0-1.9.5l.6 2.2c-.6.1-1.1.3-1.6.5L5.6 6.5a1 1 0 0 0-1.4-.3zm3.1 6.4a1 1 0 0 1 2 0 1 1 0 0 1-2 0zm5 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0z" />
    </svg>
  ),
  web: <MonitorSmartphone size={18} />,
};

export default function DevicesSection() {
  return (
    <section className="lp-section lp-light" id="qurilmalar">
      <div className="lp-wrap lp-devices-row">
        <div className="lp-devices-art lp-reveal">
          <img
            className="lp-devices-img"
            src={BRAND.devices}
            alt="Noutbukda ochilgan KetaPOS kassa ekrani"
            width="1774"
            height="887"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="lp-devices-copy lp-reveal">
          <span className="lp-eyebrow">Qurilmalar</span>
          <h2 className="lp-h2">Bir tizim — har qanday ekran</h2>
          <p className="lp-lead lp-lead-sm">
            Kassa joyida kompyuter, ofitsiant qo'lida telefon yoki oddiy brauzer —
            hammasi bitta akkaunt va bitta ma'lumot bilan ishlaydi.
          </p>
          <ul className="lp-platforms">
            {PLATFORMS.map((p) => (
              <li key={p.id} className="lp-platform">
                <span className="lp-platform-icon">{ICONS[p.id]}</span>
                <span>
                  <b>{p.label}</b>
                  <i>{p.note}</i>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

import { LANGS, setLang, useLang } from '../lib/lang.js';
import { t } from '../lib/i18n.js';

// Ilova va kirish ekranidagi til almashtirgichi (QQ/UZ).
export default function LangToggle({ className = '' }) {
  const { lang } = useLang();
  return (
    <div className={`seg ${className}`} role="group" aria-label={t('Til')}>
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          className={`seg-item ${l.id === lang ? 'active' : ''}`}
          aria-pressed={l.id === lang}
          onClick={() => setLang(l.id)}
        >
          {t(l.label)}
        </button>
      ))}
    </div>
  );
}

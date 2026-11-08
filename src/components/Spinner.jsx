import { Loader2 } from 'lucide-react';

// Yuklash indikatori: kichik spinner + ixtiyoriy qisqa matn.
// Barcha sahifalarda bitta uslub ishlatiladi.
export default function Spinner({ size = 20, label = '', center = false, className = '' }) {
  const node = (
    <span className={`loader ${className}`}>
      <Loader2 size={size} className="spin" />
      {label && <span className="loader-text">{label}</span>}
    </span>
  );
  return center ? <div className="loader-center">{node}</div> : node;
}

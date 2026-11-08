// Skelet bloklar — kontent joylashuviga mos, yumshoq shimmer animatsiyasi.
// SkCards / SkStats sahifaning haqiqiy layout klassini qabul qiladi,
// shuning uchun yuklash paytida joylashuv umuman o‘zgarmaydi.

export function Sk({ w = '100%', h = 12, r = 8, className = '' }) {
  return <span className={`sk ${className}`} style={{ width: w, height: h, borderRadius: r }} />;
}

// Karta to'ri (mahsulotlar, stollar)
export function SkCards({ n = 8, h = 120, r = 20, className = 'sk-grid' }) {
  return (
    <div className={className}>
      {Array.from({ length: n }, (_, i) => <Sk key={i} h={h} r={r} />)}
    </div>
  );
}

// Jadval satrlari
export function SkRows({ n = 6, cells = 4, className = '' }) {
  return (
    <div className={`sk-rows ${className}`}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="sk-row">
          {Array.from({ length: cells }, (_, j) => (
            <Sk key={j} h={11} w={j === 0 ? '34%' : `${14 + ((i + j) % 3) * 5}%`} r={6} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Statistika kartalari qatori
export function SkStats({ n = 4, className = 'stat-cards' }) {
  return (
    <div className={className}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="sk-stat">
          <Sk w="48%" h={10} r={5} />
          <Sk w="64%" h={22} r={7} />
        </div>
      ))}
    </div>
  );
}

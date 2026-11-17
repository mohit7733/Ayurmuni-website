/** Visual price fields + optional range slider. Parent keeps the filter state. */

const toNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const pct = (value, boundMin, boundMax) => {
  const span = boundMax - boundMin;
  if (!span) return 0;
  return Math.max(0, Math.min(100, ((value - boundMin) / span) * 100));
};

export default function FilterPriceControls({
  min,
  max,
  onChange,
  boundMin = 0,
  boundMax = 10000,
  headingId = 'st-filter-price-title',
  className = '',
}) {
  const lo = toNum(min);
  const hi = toNum(max);
  const fillLeft = pct(Math.min(lo, hi), boundMin, boundMax);
  const fillRight = 100 - pct(Math.max(lo, hi), boundMin, boundMax);

  const setMin = (value) => onChange([toNum(value), hi]);
  const setMax = (value) => onChange([lo, toNum(value)]);
  const slideMin = (value) => onChange([Math.min(toNum(value), hi), hi]);
  const slideMax = (value) => onChange([lo, Math.max(toNum(value), lo)]);

  return (
    <section className={`st-filter-section ${className}`.trim()} aria-labelledby={headingId}>
      <div className="st-filter-section__heading">
        <h3 id={headingId}>Price range</h3>
        <span>{`₹${lo} – ₹${hi}`}</span>
      </div>
      <div className="st-filter-price">
        <label className="st-filter-field">
          <span className="st-vh">Minimum price</span>
          <span className="st-filter-field__box">
            <span className="st-filter-field__prefix" aria-hidden="true">
              ₹
            </span>
            <input type="number" value={min} min={boundMin} onChange={(event) => setMin(event.target.value)} />
          </span>
        </label>
        <span className="st-filter-price__separator" aria-hidden="true">
          to
        </span>
        <label className="st-filter-field">
          <span className="st-vh">Maximum price</span>
          <span className="st-filter-field__box">
            <span className="st-filter-field__prefix" aria-hidden="true">
              ₹
            </span>
            <input type="number" value={max} min={boundMin} onChange={(event) => setMax(event.target.value)} />
          </span>
        </label>
      </div>
      <div className="st-filter-slider">
        <div className="st-filter-slider__track" aria-hidden="true">
          <span className="st-filter-slider__fill" style={{ left: `${fillLeft}%`, right: `${fillRight}%` }} />
        </div>
        <input
          type="range"
          min={boundMin}
          max={boundMax}
          step="50"
          value={Math.max(boundMin, Math.min(lo, boundMax))}
          onChange={(event) => slideMin(event.target.value)}
          aria-label="Minimum price"
        />
        <input
          type="range"
          min={boundMin}
          max={boundMax}
          step="50"
          value={Math.max(boundMin, Math.min(hi, boundMax))}
          onChange={(event) => slideMax(event.target.value)}
          aria-label="Maximum price"
        />
      </div>
    </section>
  );
}

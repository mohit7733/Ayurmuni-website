import { formatRupee } from '../home/catalog';

const CTA = {
  package: 'Buy plans',
  lab: 'Book',
  therapy: 'Book',
};

export default function DummyOfferCard({ item, kind = 'lab', onClick, cta }) {
  const off =
    item.mrp && item.mrp > item.price
      ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
      : 0;
  const badge = item.badge || item.tag;
  const extra =
    Array.isArray(item.includes) && item.includes.length > 1
      ? ` · +${item.includes.length - 1}`
      : '';
  const meta =
    kind === 'package'
      ? `${item.includes?.[0] || ''}${extra}`
      : kind === 'therapy'
        ? item.description
        : item.tests;
  const group = kind === 'therapy' ? item.duration : item.group;

  return (
    <article className={`do-card do-card--${kind}`}>
      <button type="button" className="do-card__hit" onClick={onClick} aria-label={item.name}>
        <div className="do-card__img">
          {item.image ? <img src={item.image} alt="" loading="lazy" decoding="async" /> : null}
          {badge ? <span className="do-card__badge">{badge}</span> : null}
          {off > 0 ? <span className="do-card__off">{off}% OFF</span> : null}
        </div>
        {group ? <p className="do-card__group">{group}</p> : null}
        <h3>{item.name}</h3>
        {meta ? <p className="do-card__meta">{meta}</p> : null}
        <p className="do-card__price">
          <strong>{formatRupee(item.price)}</strong>
          {item.mrp && item.mrp > item.price ? <s>{formatRupee(item.mrp)}</s> : null}
        </p>
      </button>
      <button type="button" className="do-card__book" onClick={onClick}>
        {cta || CTA[kind] || 'Book'}
      </button>
    </article>
  );
}

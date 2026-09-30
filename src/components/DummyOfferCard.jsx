import { formatRupee } from '../home/catalog';

export default function DummyOfferCard({ item, kind = 'lab', onClick }) {
  const off =
    item.mrp && item.mrp > item.price
      ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
      : 0;
  const badge = item.badge || item.tag;
  const extra = Array.isArray(item.includes) && item.includes.length > 1
    ? ` · +${item.includes.length - 1}`
    : '';
  const meta = kind === 'package'
    ? `${item.includes?.[0] || ''}${extra}`
    : item.tests;

  return (
    <article className="do-card">
      <button type="button" className="do-card__hit" onClick={onClick} aria-label={item.name}>
        <div className="do-card__img">
          {item.image ? <img src={item.image} alt="" loading="lazy" decoding="async" /> : null}
          {badge ? <span className="do-card__badge">{badge}</span> : null}
          {off > 0 ? <span className="do-card__off">{off}% OFF</span> : null}
        </div>
        {item.group ? <p className="do-card__group">{item.group}</p> : null}
        <h3>{item.name}</h3>
        {meta ? <p className="do-card__meta">{meta}</p> : null}
        <p className="do-card__price">
          <strong>{formatRupee(item.price)}</strong>
          {item.mrp && item.mrp > item.price ? <s>{formatRupee(item.mrp)}</s> : null}
        </p>
      </button>
      <button type="button" className="do-card__book" onClick={onClick}>
        Book
      </button>
    </article>
  );
}

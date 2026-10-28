import { CalendarDays, Flame, Leaf, Star } from 'lucide-react';
import Badge from './ui/Badge';

const STATUS = {
  active: { label: 'Active', cta: 'Continue plan', tone: 'success' },
  paused: { label: 'Paused', cta: 'Resume plan', tone: 'warning' },
  completed: { label: 'Completed', cta: 'View plan', tone: 'info' },
  stopped: { label: 'Stopped', cta: 'View plan', tone: 'neutral' },
  none: { label: '', cta: 'View plan', tone: 'neutral' },
};

/** Diet plan card - built on the ProductCard shell (am-product-card) so it sits beside product cards. */
export default function DietListCard({ title, image, status = 'none', prakriti, duration, calories, price, rating, onOpen }) {
  const meta = STATUS[status] || STATUS.none;
  const free = price === 'Free';
  const kcal = calories && /^\d+$/.test(String(calories)) ? `${calories} kcal` : calories;
  const facts = [
    prakriti ? { key: 'p', icon: Leaf, text: prakriti } : null,
    duration ? { key: 'd', icon: CalendarDays, text: duration } : null,
    kcal ? { key: 'k', icon: Flame, text: kcal } : null,
  ].filter(Boolean);

  return (
    <article className={`am-product-card dt-pcard is-${status in STATUS ? status : 'none'}`}>
      <div className="am-product-card__media">
        {image ? (
          <img src={image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="am-product-card__placeholder" aria-hidden>
            <Leaf size={32} />
          </span>
        )}
        {meta.label || free ? (
          <div className="am-product-card__badges">
            {meta.label ? <Badge tone={meta.tone}>{meta.label}</Badge> : null}
            {free ? <Badge tone="accent">Free</Badge> : null}
          </div>
        ) : null}
      </div>

      <div className="am-product-card__body">
        <h3 className="am-product-card__name">
          <button type="button" className="am-stretched" onClick={onOpen}>
            {title}
          </button>
        </h3>
        {facts.length ? (
          <ul className="dt-pcard__facts" aria-label="Plan details">
            {facts.map(({ key, icon: Icon, text }) => (
              <li key={key}>
                <Icon size={12} aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="am-product-card__price">
          <strong>{free ? 'Free' : price || '\u00a0'}</strong>
          {rating ? (
            <span className="dt-pcard__rate">
              <Star size={11} aria-hidden />
              {rating}
            </span>
          ) : null}
        </p>
      </div>

      <div className="am-product-card__action">
        <button type="button" className="am-product-card__add" onClick={onOpen} tabIndex={-1} aria-hidden>
          {meta.cta}
        </button>
      </div>
    </article>
  );
}
import { useState } from 'react';
import { ArrowRight, CalendarDays, Leaf, Salad } from 'lucide-react';

const STATUS = {
  active: { label: 'Active', cta: 'Continue' },
  paused: { label: 'Paused', cta: 'Resume' },
  completed: { label: 'Completed', cta: 'View plan' },
  stopped: { label: 'Stopped', cta: 'View plan' },
  none: { label: 'Not started', cta: 'Start plan' },
};

/** Premium diet plan card for the /diet listing (data and navigation come from Diet.jsx). */
export default function DietListCard({ title, image, status = 'none', prakriti, duration, price, rating, onOpen }) {
  const [portrait, setPortrait] = useState(false);
  const checkShape = (node) => {
    const { naturalWidth: w, naturalHeight: h } = node;
    if (w && h && h > w * 1.05 && !portrait) setPortrait(true);
  };
  const meta = STATUS[status] || STATUS.none;
  const free = price === 'Free';

  return (
    <article className={`dlp-card is-${status in STATUS ? status : 'none'}`}>
      <div className={`dlp-card__media${portrait ? ' is-contain' : ''}`}>
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            ref={(node) => {
              if (node?.complete) checkShape(node);
            }}
            onLoad={(e) => checkShape(e.currentTarget)}
          />
        ) : (
          <Salad size={30} aria-hidden />
        )}
        <span className="dlp-card__badge">
          {status === 'active' ? <i className="dlp-card__pulse" aria-hidden /> : null}
          {meta.label}
        </span>
      </div>
      <div className="dlp-card__body">
        <h3 className="dlp-card__title">
          <button type="button" className="am-stretched" onClick={onOpen}>
            {title}
          </button>
        </h3>
        <ul className="dlp-card__chips">
          {prakriti ? (
            <li>
              <Leaf size={12} aria-hidden />
              {prakriti}
            </li>
          ) : null}
          {duration ? (
            <li>
              <CalendarDays size={12} aria-hidden />
              {duration}
            </li>
          ) : null}
          {rating ? <li>★ {rating}</li> : null}
        </ul>
        <div className="dlp-card__foot">
          {price ? <span className={`dlp-card__price${free ? ' is-free' : ''}`}>{price}</span> : <span />}
          <span className="dlp-card__cta" aria-hidden>
            {meta.cta}
            <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </article>
  );
}

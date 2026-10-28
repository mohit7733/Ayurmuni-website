import { useState } from 'react';
import { Star } from 'lucide-react';
import { formatRupee } from '../home/catalog';
import PlanMark from '../packages/PlanMark';
import { getPlanTheme, isCarePlan, planCta, planDiscount, planDuration, themeStyle } from '../packages/planTheme';

const CTA = {
  package: 'Buy plan',
  lab: 'Book',
  therapy: 'Book',
};

export default function DummyOfferCard({ item, kind = 'lab', onClick, cta }) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = String(item.image || '').trim();
  const showImage = Boolean(image) && !imageFailed;
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
  const flags = (
    <>
      {badge ? <span className="do-card__badge">{badge}</span> : null}
      {off > 0 ? <span className="do-card__off">{off}% OFF</span> : null}
    </>
  );

  if (kind === 'package') {
    const theme = getPlanTheme(item);
    const care = isCarePlan(item);
    const discount = planDiscount(item);
    const owned = Boolean(item.purchased);
    return (
      <button
        type="button"
        className="am-plan-rail"
        style={themeStyle(theme)}
        onClick={onClick}
        aria-label={item.name}
      >
        <span className="am-plan-rail__fill">
          <span className="am-plan-rail__orb am-plan-rail__orb--lg" />
          <span className="am-plan-rail__orb am-plan-rail__orb--sm" />
          <span className="am-plan-rail__top">
            <span className="am-plan-rail__icon">
              {showImage ? <img src={image} alt="" onError={() => setImageFailed(true)} /> : <PlanMark name={theme.icon} size={14} color="#fff" />}
            </span>
            <span className="am-plan-rail__cat">{item.group || 'Plan'}</span>
            {care ? (
              <span className="am-plan-rail__badge"><Star size={9} aria-hidden /> CARE PLAN</span>
            ) : discount > 0 ? (
              <span className="am-plan-rail__off">{discount}% OFF</span>
            ) : null}
          </span>
          <span className="am-plan-rail__copy">
            <span className="am-plan-rail__name">{item.name}</span>
            <span className="am-plan-rail__dur">{planDuration(item)}</span>
          </span>
          <span className="am-plan-rail__bottom">
            <span className="am-plan-rail__price">
              <strong>{formatRupee(item.price)}</strong>
              {item.mrp && item.mrp > item.price ? <s>{formatRupee(item.mrp)}</s> : null}
            </span>
            <span className="am-plan-rail__cta">{cta || planCta(item, { owned, rail: true })}</span>
          </span>
          <span className="am-plan-rail__line" />
        </span>
      </button>
    );
  }

  return (
    <article className={`do-card do-card--${kind}${showImage ? '' : ' do-card--no-media'}`}>
      <button type="button" className="do-card__hit" onClick={onClick} aria-label={item.name}>
        {showImage ? (
          <div className="do-card__img">
            <img
              src={image}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
            {flags}
          </div>
        ) : badge || off > 0 ? (
          <div className="do-card__flags">{flags}</div>
        ) : (
          <span className="do-card__rule" aria-hidden />
        )}
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


import { Clock, Flower2, ListOrdered, Play } from 'lucide-react';
import yogaPosterImg from '/images/login/8.webp';
import Skeleton from '../skeletons/Block';
import { yogaView } from '../../yoga/present';
import { YOGA_COPY as Y } from '../../content/yoga';
import '../../design/pages/diet-list.css';
import '../../design/pages/yoga.css';

/**
 * Yoga session card - a sibling of the /diet listing card (same dlp-card shell,
 * media ratio, chips and footer CTA). Only shows chips for fields the API provides.
 */
export default function YogaCard({ item, onOpen, headingLevel = 3 }) {
  const v = yogaView(item);
  if (!v) return null;
  const H = `h${headingLevel}`;
  return (
    <article className="dlp-card yc">
      <div className="dlp-card__media">
        <img src={v.image || yogaPosterImg} alt="" loading="lazy" decoding="async" />
        {v.level ? <span className="dlp-card__badge">{v.level}</span> : null}
      </div>
      <div className="dlp-card__body">
        <H className="dlp-card__title">
          <button type="button" className="am-stretched" onClick={() => onOpen?.(item)}>
            {v.title}
          </button>
        </H>
        <ul className="dlp-card__chips" aria-label="Session details">
          {v.duration ? (
            <li>
              <Clock size={12} aria-hidden />
              {v.duration}
            </li>
          ) : null}
          {v.poses ? (
            <li>
              <ListOrdered size={12} aria-hidden />
              {v.poses} {v.poses === 1 ? 'pose' : 'poses'}
            </li>
          ) : null}
          {v.focus.slice(0, 1).map((f) => (
            <li key={f}>
              <Flower2 size={12} aria-hidden />
              {f}
            </li>
          ))}
        </ul>
        <div className="dlp-card__foot">
          <span className="yc__kind">{v.video ? Y.guided : Y.selfPaced}</span>
          <span className="dlp-card__cta" aria-hidden>
            <Play size={12} fill="currentColor" />
            {Y.start}
          </span>
        </div>
      </div>
    </article>
  );
}

export function YogaCardSkeleton() {
  return (
    <article className="dlp-card yc" aria-hidden>
      <div className="dlp-card__media">
        <Skeleton variant="rect" className="am-skel-fill" />
      </div>
      <div className="dlp-card__body">
        <Skeleton width="80%" height={16} />
        <span className="dlp-card__chips">
          <Skeleton width={56} height={20} />
          <Skeleton width={64} height={20} />
        </span>
        <div className="dlp-card__foot">
          <Skeleton width={60} height={14} />
          <Skeleton width={96} height={32} />
        </div>
      </div>
    </article>
  );
}

export function YogaGridSkeleton({ count = 8, label = 'Loading yoga sessions' }) {
  return (
    <ul className="svc-meal-grid dlp-grid" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <YogaCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

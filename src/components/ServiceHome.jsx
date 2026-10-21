import { ArrowRight, Flower2, Play, Salad } from 'lucide-react';
import { Button } from './ui';
import { HOME_COPY as T } from '../content/home';
import '../design/pages/service-home.css';

export function ViewAll({ onClick, label }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="hm-doctor-head__link"
      onClick={onClick}
      trailingIcon={<ArrowRight size={16} aria-hidden />}
    >
      {T.viewAll}
      <span className="am-sr-only"> {label}</span>
    </Button>
  );
}

export function SectionHead({ id, eyebrow, title, description, action }) {
  return (
    <div className="hm-doctor-head">
      {eyebrow ? <p className="am-eyebrow">{eyebrow}</p> : null}
      <div className="hm-doctor-head__row">
        <h2 id={id} className="hm-doctor-head__title">
          {title}
        </h2>
        {action}
      </div>
      {description ? <p className="hm-doctor-head__desc">{description}</p> : null}
    </div>
  );
}

function shortLabel(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 28) return '';
  return text;
}

export function YogaSessionCard({ item, onClick }) {
  const level = shortLabel(item.difficulty);
  const duration = shortLabel(item.duration);

  return (
    <article className="hm-pose">
      <div className="hm-pose__media">
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" loading="lazy" decoding="async" />
        ) : (
          <Flower2 size={28} aria-hidden />
        )}
        <span className="hm-pose__play" aria-hidden>
          <Play size={16} fill="currentColor" />
        </span>
        {level ? <span className="hm-pose__level">{level}</span> : null}
      </div>
      <div className="hm-pose__copy">
        <h3>
          <button type="button" className="am-stretched" onClick={onClick}>
            {item.title}
          </button>
        </h3>
        {duration ? <p>{duration}</p> : null}
      </div>
    </article>
  );
}

export function DietPlanCard({ item, onClick }) {
  const season = shortLabel(item.season) || shortLabel(item.short_description);
  const prakriti = shortLabel(item.prakriti);

  return (
    <article className="hm-meal">
      <div className="hm-meal__media">
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" loading="lazy" decoding="async" />
        ) : (
          <Salad size={28} aria-hidden />
        )}
      </div>
      <div className="hm-meal__copy">
        {season ? <p className="hm-meal__season">{season}</p> : null}
        <h3>
          <button type="button" className="am-stretched" onClick={onClick}>
            {item.title}
          </button>
        </h3>
        {prakriti ? <p>{prakriti}</p> : null}
      </div>
    </article>
  );
}

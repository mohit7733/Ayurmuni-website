import { openComingSoonModal } from '../launch/comingSoonMode';

/** Home / rail placeholder when a feature flag is on. */
export default function ComingSoonSection({ title, description }) {
  return (
    <button type="button" className="hm-soon hm-soon--block" onClick={openComingSoonModal}>
      <span className="hm-soon__eyebrow">Coming soon</span>
      <strong className="hm-soon__title">{title}</strong>
      {description ? <p className="hm-soon__text">{description}</p> : null}
    </button>
  );
}

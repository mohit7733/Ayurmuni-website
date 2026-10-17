import { ArrowRight, FlaskConical } from 'lucide-react';

export default function LabHomeBanner({ onClick, title, subtitle }) {
  return (
    <button type="button" className="ol-home-banner" onClick={onClick}>
      <span className="ol-home-banner__icon" aria-hidden>
        <FlaskConical size={20} />
      </span>
      <span className="ol-home-banner__copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <ArrowRight size={18} aria-hidden />
    </button>
  );
}

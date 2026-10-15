import { ArrowRight, BadgeCheck, Flower2, Heart, Leaf, ShieldCheck, ShoppingBag, Sparkles, Stethoscope } from 'lucide-react';

function LeafArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" aria-hidden focusable="false">
      <g stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 190 C70 140 110 100 180 30" />
        <path d="M70 142 C52 120 52 98 64 84 C80 98 84 122 70 142Z" />
        <path d="M70 142 C92 134 110 138 120 150 C102 160 84 156 70 142Z" />
        <path d="M104 106 C88 84 90 62 104 50 C118 66 118 88 104 106Z" />
        <path d="M104 106 C126 100 144 106 152 118 C134 126 116 122 104 106Z" />
        <path d="M140 68 C130 52 132 38 142 30 C152 42 150 56 140 68Z" />
        <path d="M140 68 C156 64 168 70 174 80 C160 86 148 82 140 68Z" />
      </g>
    </svg>
  );
}

function PromoSlide({ variant, eyebrow, title, accent, points, cta, onCta, interactive }) {
  return (
    <div className={`am-promo am-promo--${variant}`}>
      <span className="am-promo__grain" aria-hidden />
      <span className="am-promo__glow" aria-hidden />
      <LeafArt className="am-promo__art" />
      <div className="am-promo__body">
        <p className="am-promo__eyebrow">
          <span className="am-promo__rule" aria-hidden />
          {eyebrow}
        </p>
        <h3 className="am-promo__title">
          {title} <em>{accent}</em>
        </h3>
        <ul className="am-promo__points">
          {points.map(({ icon: Icon, label }) => (
            <li key={label}>
              <span className="am-promo__icon" aria-hidden>
                <Icon size={16} strokeWidth={1.5} />
              </span>
              {label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="am-promo__cta"
          onClick={(event) => {
            if (!interactive) return;
            event.stopPropagation();
            onCta?.();
          }}
          tabIndex={interactive ? 0 : -1}
        >
          {cta}
          <ArrowRight className="am-promo__arrow" size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}

const WHY_POINTS = [
  { icon: Leaf, label: '100% Natural' },
  { icon: BadgeCheck, label: 'Trusted Brands' },
  { icon: Heart, label: 'Better Health' },
  { icon: ShoppingBag, label: 'Easy Shopping' },
];

const CARE_POINTS = [
  { icon: Flower2, label: 'Holistic Care' },
  { icon: Stethoscope, label: 'Ayurvedic Experts' },
  { icon: ShieldCheck, label: 'Quality Guaranteed' },
  { icon: Sparkles, label: 'Live Healthier' },
];

export function PromoWhySlide({ onCta, interactive }) {
  return (
    <PromoSlide
      variant="light"
      eyebrow="Why AyurMuni"
      title="Pure Ayurveda,"
      accent="delivered"
      points={WHY_POINTS}
      cta="Shop medicines"
      onCta={onCta}
      interactive={interactive}
    />
  );
}

export function PromoCareSlide({ onCta, interactive }) {
  return (
    <PromoSlide
      variant="dark"
      eyebrow="Holistic Care"
      title="Care that sees the"
      accent="whole you"
      points={CARE_POINTS}
      cta="Consult a doctor"
      onCta={onCta}
      interactive={interactive}
    />
  );
}
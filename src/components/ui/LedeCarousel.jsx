import { useEffect, useState } from 'react';

/**
 * Rotating one-line lede for section headers (auto-advances, fade swap).
 */
export default function LedeCarousel({
  items = [],
  interval = 4200,
  className = '',
  'aria-label': ariaLabel = 'Highlights',
}) {
  const slides = (Array.isArray(items) ? items : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [slides.join('\0')]);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, Math.max(2400, Number(interval) || 4200));
    return () => window.clearInterval(timer);
  }, [interval, slides.length]);

  if (!slides.length) return null;

  const active = slides[Math.min(index, slides.length - 1)];

  return (
    <div
      className={`am-lede-carousel ${className}`.trim()}
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <p key={active} className="am-lede-carousel__line">
        {active}
      </p>
      {slides.length > 1 ? (
        <div className="am-lede-carousel__dots" aria-hidden>
          {slides.map((slide, i) => (
            <span key={slide} className={i === index ? 'on' : undefined} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cx } from './ui/cx';

const DEFAULT_COPY = {
  label: 'Offers',
  open: 'Offer',
  of: 'of',
  show: 'Show offer',
  pause: 'Pause offers',
  play: 'Play offers',
};

export default function BannerCarousel({ items, onSelect, loading = false, interval = 5000, copy, className }) {
  const T = { ...DEFAULT_COPY, ...copy };
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = items?.length || 0;

  useEffect(() => {
    if (!count) {
      setIndex(0);
      return undefined;
    }
    setIndex((prev) => (prev >= count ? 0 : prev));
    if (count < 2 || paused) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % count), interval);
    return () => clearInterval(timer);
  }, [count, paused, interval]);

  if (!count) {
    return loading ? <div className={cx('am-banner am-skeleton am-skeleton--rect', className)} aria-hidden /> : null;
  }

  const current = items[Math.min(index, count - 1)];

  return (
    <section
      className={cx('am-banner', className)}
      aria-roledescription="carousel"
      aria-label={T.label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <button
        type="button"
        className="am-banner__slide"
        onClick={() => onSelect?.(current)}
        aria-label={`${T.open} ${index + 1} ${T.of} ${count}${current.title ? `: ${current.title}` : ''}`}
      >
        <img key={current.image} src={current.image} alt="" />
      </button>
      {count > 1 ? (
        <div className="am-banner__controls">
          <button
            type="button"
            className="am-banner__pause"
            onClick={() => setPaused((prev) => !prev)}
            aria-label={paused ? T.play : T.pause}
          >
            {paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
          </button>
          {items.map((item, i) => (
            <button
              key={item.id || item.image}
              type="button"
              className={cx('am-banner__dot', i === index && 'is-on')}
              onClick={() => setIndex(i)}
              aria-label={`${T.show} ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
            >
              <span />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

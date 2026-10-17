import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { cx } from './ui/cx';

const DEFAULT_COPY = {
  label: 'Offers',
  open: 'Offer',
  of: 'of',
  show: 'Show offer',
  pause: 'Pause offers',
  play: 'Play offers',
  prev: 'Previous offer',
  next: 'Next offer',
};

const SWIPE_MIN = 40;
const HOVER_INTENT_MS = 180;
const TRANSITION_MS = 600;

const canHoverPointer = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/**
 * Items: image banners `{ id, image, title }` or coded slides
 * `{ id, title, render: ({ active }) => node }`. Coded slides ignore onSelect.
 */
export default function BannerCarousel({
  items,
  onSelect,
  loading = false,
  interval = 6000,
  initialIndex = 0,
  copy,
  className,
}) {
  const T = { ...DEFAULT_COPY, ...copy };
  const [index, setIndex] = useState(initialIndex);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [ratio, setRatio] = useState(null);
  const [reduced] = useState(prefersReducedMotion);
  const [hoverPointer] = useState(canHoverPointer);
  const touchX = useRef(null);
  const ratios = useRef({});
  const hoverTimer = useRef(null);
  const movingUntil = useRef(0);
  const pointerX = useRef(0);
  const hoverAnchorX = useRef(null);
  const remaining = useRef(interval);
  const startedAt = useRef(0);
  const shownIndex = useRef(index);
  const count = items?.length || 0;
  const active = count ? Math.min(index, count - 1) : 0;
  const paused = hoverPaused || userPaused;
  const auto = count > 1 && !reduced;

  useEffect(() => {
    if (count && index >= count) setIndex(0);
  }, [count, index]);

  // Mark a slide change as in progress so hover-intent can't fire mid-transition.
  useEffect(() => {
    movingUntil.current = Date.now() + (reduced ? 0 : TRANSITION_MS);
  }, [active, reduced]);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // Autoplay: one timeout per slide; pausing banks the elapsed time and
  // resuming waits only for the remainder, matching the CSS progress bar.
  useEffect(() => {
    if (shownIndex.current !== active) {
      shownIndex.current = active;
      remaining.current = interval;
    }
    if (!auto || paused) return undefined;
    startedAt.current = Date.now();
    const timer = setTimeout(() => {
      remaining.current = interval;
      setIndex((prev) => (prev + 1) % count);
    }, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [active, auto, paused, count, interval]);

  if (!count) {
    return loading ? (
      <div className={cx('am-banner am-banner--loading', className)} aria-hidden>
        <div className="am-banner__stage">
          {[-1, 1, 0].map((d) => (
            <span
              key={d}
              className={cx('am-banner__slide am-banner__skeleton', d === 0 ? 'is-on' : d < 0 ? 'is-prev' : 'is-next')}
              style={{ '--am-banner-offset': d }}
            >
              <span className="am-banner__shimmer" />
            </span>
          ))}
        </div>
      </div>
    ) : null;
  }

  const go = (step) => setIndex((prev) => (Math.min(prev, count - 1) + step + count) % count);

  const offsetOf = (i) => {
    let d = (i - active + count) % count;
    if (d > count / 2) d -= count;
    return d;
  };

  // One card ratio for every slide: the median of all loaded banner ratios (images then cover it),
  // so mixed-ratio banners never letterbox and the carousel height never jumps between slides.
  const onImageLoad = (event) => {
    const img = event.currentTarget;
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) return;
    ratios.current[img.currentSrc || img.src] = w / h;
    const list = Object.values(ratios.current).sort((a, b) => a - b);
    const mid = list.length >> 1;
    const median = list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
    const next = Math.round(median * 100) / 100;
    if (next !== ratio) setRatio(next);
  };

  const cancelHoverIntent = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };
  const startHoverIntent = (i) => {
    if (!hoverPointer || hoverAnchorX.current != null) return;
    cancelHoverIntent();
    const wait = Math.max(HOVER_INTENT_MS, movingUntil.current - Date.now());
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = null;
      // Require real pointer travel before another hover can activate, so the
      // peek that slides under a resting cursor doesn't chain-advance.
      hoverAnchorX.current = pointerX.current;
      setIndex(i);
    }, wait);
  };

  const onKeyDown = (event) => {
    if (count < 2) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    }
  };

  const onTouchStart = (event) => {
    touchX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event) => {
    if (touchX.current == null || count < 2) return;
    const dx = (event.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) >= SWIPE_MIN) go(dx < 0 ? 1 : -1);
  };

  return (
    <section
      className={cx('am-banner', count > 1 && 'am-banner--multi', paused && 'is-paused', !auto && 'is-static', className)}
      style={{ '--am-banner-interval': `${interval}ms`, ...(ratio ? { '--am-banner-ratio': ratio } : null) }}
      aria-roledescription="carousel"
      aria-label={T.label}
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => {
        setHoverPaused(false);
        cancelHoverIntent();
        hoverAnchorX.current = null;
      }}
      onMouseMove={(event) => {
        pointerX.current = event.clientX;
        if (hoverAnchorX.current != null && Math.abs(event.clientX - hoverAnchorX.current) > 80) {
          hoverAnchorX.current = null;
        }
      }}
      onFocus={() => setHoverPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHoverPaused(false);
      }}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="am-banner__stage" aria-live={auto && !paused ? 'off' : 'polite'}>
        {items.map((item, i) => {
          const d = offsetOf(i);
          const on = d === 0;
          const pos = on ? 'is-on' : d === -1 ? 'is-prev' : d === 1 ? 'is-next' : 'is-off';
          const label = `${T.open} ${i + 1} ${T.of} ${count}${item.title ? `: ${item.title}` : ''}`;
          const coded = typeof item.render === 'function';
          return (
            <div
              key={item.id || item.image || i}
              className={cx('am-banner__slide', coded && 'am-banner__slide--coded', pos)}
              style={{ '--am-banner-offset': Math.max(-2, Math.min(2, d)) }}
              role="group"
              aria-roledescription="slide"
              aria-label={label}
              aria-hidden={on ? undefined : true}
              onClick={on ? undefined : () => {
                cancelHoverIntent();
                setIndex(i);
              }}
              onMouseEnter={on ? undefined : () => startHoverIntent(i)}
              onMouseLeave={on ? undefined : cancelHoverIntent}
            >
              {coded ? (
                item.render({ active: on })
              ) : (
                <button
                  type="button"
                  className="am-banner__hit"
                  onClick={on ? () => onSelect?.(item) : undefined}
                  aria-label={label}
                  tabIndex={on ? 0 : -1}
                >
                  <img
                    src={item.image}
                    alt=""
                    decoding="async"
                    loading="eager"
                    fetchPriority={on ? 'high' : 'auto'}
                    onLoad={onImageLoad}
                  />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {count > 1 ? (
        <>
          <button type="button" className="am-banner__nav am-banner__nav--prev" onClick={() => go(-1)} aria-label={T.prev}>
            <ChevronLeft size={20} aria-hidden />
          </button>
          <button type="button" className="am-banner__nav am-banner__nav--next" onClick={() => go(1)} aria-label={T.next}>
            <ChevronRight size={20} aria-hidden />
          </button>
          <div className="am-banner__controls">
            {auto ? (
              <button
                type="button"
                className="am-banner__pause"
                onClick={() => setUserPaused((prev) => !prev)}
                aria-label={userPaused ? T.play : T.pause}
              >
                {userPaused ? <Play size={12} aria-hidden /> : <Pause size={12} aria-hidden />}
              </button>
            ) : null}
            {items.map((item, i) => (
              <button
                key={item.id || item.image || i}
                type="button"
                className={cx('am-banner__dot', i === active && 'is-on')}
                onClick={() => setIndex(i)}
                aria-label={`${T.show} ${i + 1}`}
                aria-current={i === active ? 'true' : undefined}
              >
                <span key={i === active ? `on-${active}` : 'off'} />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

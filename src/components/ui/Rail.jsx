import { Children, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SectionHold from './SectionHold';
import { cx } from './cx';

function cardStep(el) {
  const card = el.querySelector(':scope > .am-rail__item');
  if (!card) return 0;
  const styles = getComputedStyle(el);
  const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
  return card.getBoundingClientRect().width + gap;
}

export default function Rail({ label, className, children, auto = false, interval = 3200, motionOverride = false, controls = false }) {
  const ref = useRef(null);
  const hold = useRef({ hover: false, drag: false });
  const [edges, setEdges] = useState({ left: false, right: false });
  const count = Children.count(children);

  useEffect(() => {
    if (!controls) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const sync = () => {
      const max = el.scrollWidth - el.clientWidth;
      setEdges({
        left: el.scrollLeft > 4,
        right: max > 8 && el.scrollLeft < max - 4,
      });
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', sync);
      observer?.disconnect();
    };
  }, [controls, count]);

  const nudge = (direction) => {
    const el = ref.current;
    if (!el) return;
    const distance = cardStep(el);
    if (!distance) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = Math.max(0, Math.min(el.scrollLeft + direction * distance, max));
    el.scrollTo({ left: next, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!auto) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const reduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    // Opt-in (Home yoga): keep autoplay under reduced motion, but slower and without smooth animation.
    if (reduced && !motionOverride) return undefined;
    const every = reduced ? Math.max(interval * 1.6, 5000) : interval;

    let timer = 0;
    let visible = false;

    const step = () => {
      if (hold.current.hover || hold.current.drag || !visible || document.hidden) return;
      const distance = cardStep(el);
      if (!distance) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 8) return;
      // At the end, loop to start; otherwise advance one card, clamped to the end so a short
      // overflow (less than one card) still scrolls instead of bouncing back to 0 forever.
      const atEnd = el.scrollLeft >= max - 4;
      el.scrollTo({ left: atEnd ? 0 : Math.min(el.scrollLeft + distance, max), behavior: reduced ? 'auto' : 'smooth' });
    };

    const start = () => {
      if (timer) return;
      timer = window.setInterval(step, every);
    };
    const stop = () => {
      window.clearInterval(timer);
      timer = 0;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) start();
      else stop();
    }, { threshold: 0.05 });
    observer.observe(el);

    const onHide = () => {
      if (document.hidden) stop();
      else if (visible) start();
    };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [auto, interval, motionOverride]);

  const track = (
    <ul
      ref={ref}
      className={cx('am-rail', className)}
      aria-label={label}
      aria-roledescription={auto || controls ? 'carousel' : undefined}
      onMouseEnter={() => {
        hold.current.hover = true;
      }}
      onMouseLeave={() => {
        hold.current.hover = false;
      }}
      onFocus={(event) => {
        // Pause only for keyboard focus; a mouse/touch click must not freeze autoplay.
        if (event.target?.matches?.(':focus-visible')) hold.current.hover = true;
      }}
      onBlur={() => {
        hold.current.hover = false;
      }}
      onPointerDown={() => {
        hold.current.drag = true;
      }}
      onPointerUp={() => {
        hold.current.drag = false;
      }}
      onTouchEnd={() => {
        // Touch fires a synthetic mouseenter with no mouseleave; release it.
        hold.current.hover = false;
        hold.current.drag = false;
      }}
      onPointerCancel={() => {
        hold.current.drag = false;
      }}
    >
      {children}
    </ul>
  );

  if (!controls) return track;

  return (
    <div className="am-rail-scroller">
      <button
        type="button"
        className="am-rail-scroller__btn am-rail-scroller__btn--prev"
        aria-label={`Previous ${label}`}
        disabled={!edges.left}
        onClick={() => nudge(-1)}
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
      {track}
      <button
        type="button"
        className="am-rail-scroller__btn am-rail-scroller__btn--next"
        aria-label={`Next ${label}`}
        disabled={!edges.right}
        onClick={() => nudge(1)}
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}

export function RailItem({ size, className, children }) {
  return <li className={cx('am-rail__item', size && `am-rail__item--${size}`, className)}>{children}</li>;
}

export function RailSkeleton({ label = 'Loading' }) {
  return <SectionHold label={label} minHeight={200} />;
}

import { useEffect, useRef } from 'react';
import LogoSpinner from './LogoSpinner';
import { SkeletonCard } from './Skeleton';
import { cx } from './cx';

export default function Rail({ label, className, children, auto = false, interval = 3200, motionOverride = false }) {
  const ref = useRef(null);
  const hold = useRef({ hover: false, drag: false });

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
      const card = el.querySelector(':scope > .am-rail__item');
      if (!card) return;
      const styles = getComputedStyle(el);
      const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
      const distance = card.getBoundingClientRect().width + gap;
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
    }, { threshold: 0.35 });
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

  return (
    <ul
      ref={ref}
      className={cx('am-rail', className)}
      aria-label={label}
      aria-roledescription={auto ? 'carousel' : undefined}
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
}

export function RailItem({ size, className, children }) {
  return <li className={cx('am-rail__item', size && `am-rail__item--${size}`, className)}>{children}</li>;
}

export function RailSkeleton({ count = 4, variant = 'product', size, label = 'Loading' }) {
  return (
    <div className="am-rail-wrap" role="status">
      <LogoSpinner scale="compact" label={label} />
      <div className="am-rail" aria-hidden>
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className={cx('am-rail__item', size && `am-rail__item--${size}`)}>
            <SkeletonCard variant={variant} />
          </div>
        ))}
      </div>
    </div>
  );
}

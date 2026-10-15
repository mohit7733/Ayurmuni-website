import { useEffect, useRef } from 'react';
import { SkeletonCard } from './Skeleton';
import { cx } from './cx';

export default function Rail({ label, className, children, auto = false, interval = 3200 }) {
  const ref = useRef(null);
  const hold = useRef({ hover: false, drag: false });

  useEffect(() => {
    if (!auto) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

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
      const atEnd = el.scrollLeft + distance >= max - 4;
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + distance, behavior: 'smooth' });
    };

    const start = () => {
      if (timer) return;
      timer = window.setInterval(step, interval);
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
  }, [auto, interval]);

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
      onFocus={() => {
        hold.current.hover = true;
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
    <div className="am-rail" role="status">
      <span className="am-sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cx('am-rail__item', size && `am-rail__item--${size}`)} aria-hidden>
          <SkeletonCard variant={variant} />
        </div>
      ))}
    </div>
  );
}

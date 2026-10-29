import { Children, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function AutoScrollRail({
  label,
  children,
  className,
  trackClassName,
  itemClassName,
}) {
  const railRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const count = Children.count(children);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || count < 2) return undefined;
    const sync = () => setOverflows(rail.scrollWidth > rail.clientWidth + 8);
    sync();
    const frame = window.requestAnimationFrame(sync);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    observer?.observe(rail);
    Array.from(rail.children).forEach((child) => observer?.observe(child));
    window.addEventListener('resize', sync);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [count]);

  const wantsRail = count > 1;
  const shouldScroll = wantsRail && overflows;

  const moveRail = useCallback((direction, wrap = false) => {
    const rail = railRef.current;
    if (!rail) return;

    const items = Array.from(rail.children);
    if (items.length < 2 || rail.scrollWidth <= rail.clientWidth + 1) return;

    const gap = Number.parseFloat(window.getComputedStyle(rail).columnGap) || 0;
    const distance = items[0].getBoundingClientRect().width + gap;
    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const atEnd = rail.scrollLeft >= maxScroll - 8;
    const atStart = rail.scrollLeft <= 8;
    let target = rail.scrollLeft + direction * distance;
    if (wrap && direction > 0 && atEnd) target = 0;
    else if (wrap && direction < 0 && atStart) target = maxScroll;
    else target = Math.max(0, Math.min(target, maxScroll));

    rail.scrollTo({ left: target, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!shouldScroll || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const timer = window.setInterval(() => moveRail(1, true), 3000);
    return () => window.clearInterval(timer);
  }, [moveRail, paused, shouldScroll]);

  const items = Children.map(children, (child) => (
    <li className={itemClassName}>{child}</li>
  ));
  const track = (
    <ul
      ref={railRef}
      className={`${trackClassName}${wantsRail ? '' : ' is-static'}`}
      aria-label={label}
      tabIndex={shouldScroll ? 0 : undefined}
    >
      {items}
    </ul>
  );

  if (!wantsRail) {
    return <div className={`${className} is-static`}>{track}</div>;
  }

  return (
    <div
      className={className}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <button
        type="button"
        className={`${className}__control`}
        aria-label={`Scroll ${label} left`}
        disabled={!shouldScroll}
        onClick={() => moveRail(-1)}
      >
        <ChevronLeft size={20} aria-hidden />
      </button>
      {track}
      <button
        type="button"
        className={`${className}__control`}
        aria-label={`Scroll ${label} right`}
        disabled={!shouldScroll}
        onClick={() => moveRail(1)}
      >
        <ChevronRight size={20} aria-hidden />
      </button>
      {shouldScroll ? <span className={`${className}__bar${paused ? ' is-paused' : ''}`} aria-hidden /> : null}
    </div>
  );
}

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
  const shouldScroll = Children.count(children) > 4;

  const moveRail = useCallback((direction, wrap = false) => {
    const rail = railRef.current;
    if (!rail) return;

    const items = Array.from(rail.children);
    if (items.length < 2 || rail.scrollWidth <= rail.clientWidth + 1) return;

    const gap = Number.parseFloat(window.getComputedStyle(rail).columnGap) || 0;
    const distance = items[0].getBoundingClientRect().width + gap;
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    const nextScroll = rail.scrollLeft + direction * distance;
    const target = wrap && nextScroll > maxScroll ? 0 : Math.max(0, Math.min(nextScroll, maxScroll));

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
      className={`${trackClassName}${shouldScroll ? '' : ' is-static'}`}
      aria-label={label}
      tabIndex={shouldScroll ? 0 : undefined}
    >
      {items}
    </ul>
  );

  if (!shouldScroll) {
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
        onClick={() => moveRail(-1)}
      >
        <ChevronLeft size={20} aria-hidden />
      </button>
      {track}
      <button
        type="button"
        className={`${className}__control`}
        aria-label={`Scroll ${label} right`}
        onClick={() => moveRail(1)}
      >
        <ChevronRight size={20} aria-hidden />
      </button>
    </div>
  );
}

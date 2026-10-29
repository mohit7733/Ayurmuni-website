import { Children, cloneElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from './cx';

const INTERVAL = 4200;

export default function ConcernCarousel({ label = 'Health concerns', className, children, marquee = false, speed = 40 }) {
  const items = Children.toArray(children).filter(Boolean);
  const count = items.length;
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [perView, setPerView] = useState(1);
  const [reduced, setReduced] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const first = track?.querySelector(':scope > li');
    if (!viewport || !first) return;
    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap) || 0;
    const width = first.getBoundingClientRect().width;
    const nextStep = width + gap;
    if (!nextStep) return;
    const visible = Math.max(1, Math.ceil((viewport.clientWidth + gap) / nextStep));
    setStep(nextStep);
    setViewportWidth(viewport.clientWidth);
    setPerView(Math.min(count, visible));
  }, [count]);

  useEffect(() => {
    measure();
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [measure]);

  // Marquee: continuous loop at every width, even when every item already fits.
  const loopWidth = count * step;
  const marqueeOn = marquee && !reduced && count > 0 && step > 0;
  const copies = marqueeOn ? Math.max(2, Math.ceil(viewportWidth / loopWidth) + 1) : 1;

  const canSlide = !marquee && count > perView && step > 0;
  const held = reduced || !canSlide;

  useEffect(() => {
    if (held) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => current + 1);
    }, INTERVAL);
    return () => window.clearInterval(timer);
  }, [held]);

  useEffect(() => {
    if (!jumping) return undefined;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setJumping(false));
    });
    return () => cancelAnimationFrame(frame);
  }, [jumping, index]);

  const settle = (event) => {
    if (event.target !== trackRef.current || event.propertyName !== 'transform') return;
    if (index < count) return;
    setJumping(true);
    setIndex(index % count);
  };

  const slides = useMemo(() => {
    if (marqueeOn) {
      const out = [...items];
      for (let c = 1; c < copies; c += 1) {
        items.forEach((child) => out.push(cloneElement(child, { loopCopy: true, key: `${child.key}-m${c}` })));
      }
      return out;
    }
    if (!canSlide) return items;
    const clones = items.slice(0, perView).map((child) =>
      cloneElement(child, { loopCopy: true, key: `${child.key}-loop` }),
    );
    return [...items, ...clones];
  }, [items, canSlide, perView, marqueeOn, copies]);

  return (
    <div
      className={cx('am-concerns', marqueeOn && 'am-concerns--marquee', className)}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
    >
      <div className="am-concerns__viewport" ref={viewportRef}>
        <ul
          ref={trackRef}
          className={cx('am-concerns__track', jumping && 'is-instant')}
          style={
            marqueeOn
              ? { '--am-loop': `-${loopWidth}px`, '--am-loop-dur': `${Math.max(12, loopWidth / speed)}s` }
              : canSlide
                ? { transform: `translate3d(${-index * step}px, 0, 0)` }
                : undefined
          }
          onTransitionEnd={settle}
        >
          {slides}
        </ul>
      </div>
    </div>
  );
}

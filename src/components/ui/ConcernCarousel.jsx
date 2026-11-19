import { Children, cloneElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from './cx';

const INTERVAL = 4200;

export default function ConcernCarousel({ label = 'Health concerns', className, children, marquee = false, speed = 40 }) {
  const items = Children.toArray(children).filter(Boolean);
  const count = items.length;
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const pauseRef = useRef({ paused: false, resumeId: 0 });
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [perView, setPerView] = useState(1);
  const [reduced, setReduced] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const phone = window.matchMedia('(max-width: 639px)');
    const sync = () => {
      setReduced(motion.matches);
      setNarrow(phone.matches);
    };
    sync();
    motion.addEventListener('change', sync);
    phone.addEventListener('change', sync);
    return () => {
      motion.removeEventListener('change', sync);
      phone.removeEventListener('change', sync);
    };
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

  // Desktop marquee: continuous loop. Phones use a swipe rail + auto-advance below.
  const loopWidth = count * step;
  const marqueeOn = marquee && !reduced && !narrow && count > 0 && step > 0;
  const copies = marqueeOn ? Math.max(2, Math.ceil(viewportWidth / loopWidth) + 1) : 1;

  const canSlide = !marquee && !narrow && count > perView && step > 0;
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

  // Phones: native horizontal scroll autoplay (marquee/transform are disabled in CSS).
  useEffect(() => {
    if (!narrow || reduced || count < 2) return undefined;
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    let timer = 0;
    let visible = false;
    let ignoreScroll = 0;

    const clearResume = () => {
      window.clearTimeout(pauseRef.current.resumeId);
      pauseRef.current.resumeId = 0;
    };

    const pause = () => {
      pauseRef.current.paused = true;
      clearResume();
      pauseRef.current.resumeId = window.setTimeout(() => {
        pauseRef.current.paused = false;
      }, 2800);
    };

    const stepOnce = () => {
      if (pauseRef.current.paused || document.hidden || !visible) return;
      const first = trackRef.current?.querySelector(':scope > li');
      if (!first) return;
      const styles = getComputedStyle(trackRef.current);
      const gap = parseFloat(styles.columnGap || styles.gap) || 0;
      const distance = first.getBoundingClientRect().width + gap;
      if (!distance) return;
      const max = viewport.scrollWidth - viewport.clientWidth;
      if (max <= 8) return;
      const atEnd = viewport.scrollLeft >= max - 4;
      ignoreScroll += 1;
      viewport.scrollTo({
        left: atEnd ? 0 : Math.min(viewport.scrollLeft + distance, max),
        behavior: 'smooth',
      });
      window.setTimeout(() => {
        ignoreScroll = Math.max(0, ignoreScroll - 1);
      }, 700);
    };

    const start = () => {
      if (timer) return;
      timer = window.setInterval(stepOnce, INTERVAL);
    };
    const stop = () => {
      window.clearInterval(timer);
      timer = 0;
    };

    const onScroll = () => {
      if (ignoreScroll) return;
      pause();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible) start();
        else stop();
      },
      { threshold: 0.05 },
    );
    io.observe(viewport);

    viewport.addEventListener('pointerdown', pause);
    viewport.addEventListener('touchstart', pause, { passive: true });
    viewport.addEventListener('scroll', onScroll, { passive: true });
    start();

    return () => {
      stop();
      clearResume();
      io.disconnect();
      viewport.removeEventListener('pointerdown', pause);
      viewport.removeEventListener('touchstart', pause);
      viewport.removeEventListener('scroll', onScroll);
    };
  }, [narrow, reduced, count, step]);

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
      <div className={cx('am-concerns__viewport', narrow && 'is-swipe')} ref={viewportRef}>
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

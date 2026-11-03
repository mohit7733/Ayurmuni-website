import { useCallback, useEffect, useRef, useState } from 'react';

/** Run `cb` when the browser is idle (or after `timeout` ms at the latest). Returns a cancel fn. */
export const runWhenIdle = (cb, timeout = 2000) => {
  if (typeof window === 'undefined') return () => {};
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(cb, { timeout });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(cb, Math.min(timeout, 300));
  return () => window.clearTimeout(id);
};

/** True once the page has painted / gone idle; for non-critical background work. */
export function useIdleReady(enabled = true, timeout = 2500) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled || ready) return undefined;
    let cancelIdle = () => {};
    const start = () => {
      cancelIdle = runWhenIdle(() => setReady(true), timeout);
    };
    if (document.readyState === 'complete') {
      start();
      return () => cancelIdle();
    }
    window.addEventListener('load', start, { once: true });
    return () => {
      window.removeEventListener('load', start);
      cancelIdle();
    };
  }, [enabled, ready, timeout]);
  return ready;
}

/** True once the user has scrolled the page (false until the first scroll event). */
export function useHasScrolled(enabled = true) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!enabled || scrolled) return undefined;
    const onScroll = () => setScrolled(true);
    window.addEventListener('scroll', onScroll, { passive: true, once: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enabled, scrolled]);
  return scrolled;
}

/** One-shot viewport check: `inView` flips to true (and stays) once the element nears the viewport.
 *  With `requireScroll`, observing starts only after the user's first scroll, so sections that
 *  are already near the viewport at page load do not count. */
export function useInView({ rootMargin = '400px 0px', enabled = true, requireScroll = false } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const scrolled = useHasScrolled(enabled && requireScroll);
  const active = enabled && (!requireScroll || scrolled);
  useEffect(() => {
    if (!active || inView) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [active, inView, rootMargin]);
  return [ref, inView];
}

/** useInView + fire `onEnter` once when the section first nears the viewport. */
export function useLazySection(onEnter, options) {
  const [ref, inView] = useInView(options);
  const fired = useRef(false);
  const cb = useRef(onEnter);
  cb.current = onEnter;
  useEffect(() => {
    if (!inView || fired.current) return;
    fired.current = true;
    cb.current?.();
  }, [inView]);
  return [ref, inView];
}
/**
 * Ordered load queue: steps start one after another in `order`. A step starts when the
 * previous one calls markDone(key) or after `timeout` ms (a slow/failed step never blocks
 * the rest). bump(key) starts a step immediately (e.g. the user scrolled to it).
 * `order` must be a stable (module-level) array.
 */
export function useSectionQueue(order, { timeout = 3000 } = {}) {
  const [cursor, setCursor] = useState(0);
  const [bumped, setBumped] = useState(() => new Set());
  const doneRef = useRef(new Set());

  const advance = useCallback(
    (from) => {
      let i = from;
      while (i < order.length && doneRef.current.has(order[i])) i += 1;
      return i;
    },
    [order],
  );

  const markDone = useCallback(
    (key) => {
      if (doneRef.current.has(key)) return;
      doneRef.current.add(key);
      setCursor((c) => (order[c] === key ? advance(c + 1) : c));
    },
    [order, advance],
  );

  const bump = useCallback((key) => {
    setBumped((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);

  // Safeguard: move on if the current step takes longer than `timeout`.
  useEffect(() => {
    if (cursor >= order.length) return undefined;
    const id = window.setTimeout(() => setCursor((c) => (c === cursor ? advance(c + 1) : c)), timeout);
    return () => window.clearTimeout(id);
  }, [cursor, order, timeout, advance]);

  const isStarted = useCallback(
    (key) => {
      const index = order.indexOf(key);
      return (index >= 0 && index <= cursor) || bumped.has(key);
    },
    [order, cursor, bumped],
  );

  return { isStarted, markDone, bump, finished: cursor >= order.length };
}
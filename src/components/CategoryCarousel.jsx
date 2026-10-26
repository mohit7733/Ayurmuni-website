import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Leaf } from "lucide-react";
import "../design/category-carousel.css";

const SPEED = 26; // px per second, continuous glide
const RESUME_MS = 1600;
const MIN_GAP = 8;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Category row that becomes an infinite auto-carousel only when the real
 * categories overflow. Clones stay fully interactive (no `inert`): they are
 * aria-hidden and out of the tab order, but hover and click like originals.
 */
export default function CategoryCarousel({ items = [], onSelect, label }) {
  const viewportRef = useRef(null);
  const setRef = useRef(null);
  const [overflow, setOverflow] = useState(false);
  const pos = useRef(0);
  const paused = useRef(false);
  const resumeTimer = useRef(0);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const stepping = useRef(0);

  // Measure a single set against the viewport.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const set = setRef.current;
    if (!viewport || !set) return undefined;
    // Measure with the minimum (carousel) gap so the static row's wider gap
    // can never flip the mode back and forth.
    const measure = () => {
      const tiles = [...set.children];
      const need =
        tiles.reduce((sum, li) => sum + li.getBoundingClientRect().width, 0) +
        Math.max(0, tiles.length - 1) * MIN_GAP;
      setOverflow(need > viewport.clientWidth + 4);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
    ro.observe(set);
    return () => ro.disconnect();
  }, [items, overflow]);

  const setWidth = useCallback(() => {
    const set = setRef.current;
    if (!set) return 0;
    const gap = parseFloat(getComputedStyle(set.parentElement).columnGap) || 0;
    return set.scrollWidth + gap;
  }, []);

  const wrap = useCallback(() => {
    const viewport = viewportRef.current;
    const w = setWidth();
    if (!viewport || !w) return;
    if (viewport.scrollLeft >= w) viewport.scrollLeft -= w;
    else if (viewport.scrollLeft <= 0) viewport.scrollLeft += w;
    pos.current = viewport.scrollLeft;
  }, [setWidth]);

  // Continuous autoplay (rAF), off for reduced motion.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!overflow || !viewport) return undefined;
    viewport.scrollLeft = 0;
    pos.current = 0;
    if (prefersReducedMotion()) return undefined;
    let raf = 0;
    let last = 0;
    let visible = true;
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
          })
        : null;
    io?.observe(viewport);
    const tick = (t) => {
      const dt = last ? Math.min(64, t - last) : 0;
      last = t;
      if (!paused.current && visible && !document.hidden && !drag.current) {
        pos.current += (SPEED * dt) / 1000;
        const w = setWidth();
        if (w && pos.current >= w) pos.current -= w;
        viewport.scrollLeft = pos.current;
      } else {
        pos.current = viewport.scrollLeft;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [overflow, setWidth]);

  useEffect(() => () => window.clearTimeout(resumeTimer.current), []);

  const pause = () => {
    window.clearTimeout(resumeTimer.current);
    paused.current = true;
  };
  const resumeLater = (ms = RESUME_MS) => {
    window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      paused.current = false;
    }, ms);
  };

  const step = (dir) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    pause();
    const tile = setRef.current?.firstElementChild;
    const amount = Math.max(tile?.offsetWidth || 120, viewport.clientWidth * 0.6);
    const w = setWidth();
    // wrap before moving so the smooth scroll never crosses a seam
    if (w) {
      if (dir < 0 && viewport.scrollLeft - amount <= 0) viewport.scrollLeft += w;
      if (dir > 0 && viewport.scrollLeft + amount >= 2 * w - viewport.clientWidth) viewport.scrollLeft -= w;
    }
    window.clearTimeout(stepping.current);
    stepping.current = window.setTimeout(() => {
      stepping.current = 0;
    }, 700);
    viewport.scrollBy({ left: dir * amount, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    resumeLater(2600);
  };

  // Mouse drag (touch/pen use native scrolling).
  const onPointerDown = (e) => {
    if (!overflow || e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = { x: e.clientX, left: viewportRef.current.scrollLeft, moved: false };
    pause();
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 5) d.moved = true;
    if (d.moved) {
      viewportRef.current.scrollLeft = d.left - dx;
      wrap();
      d.left = viewportRef.current.scrollLeft + dx;
    }
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    suppressClick.current = d.moved;
    drag.current = null;
    resumeLater();
  };

  const renderSet = (clone) =>
    items.map((item) => (
      <li key={`${clone ? "c" : "o"}-${item.id}`} aria-hidden={clone || undefined}>
        <button
          type="button"
          className="am-catc__item"
          tabIndex={clone ? -1 : undefined}
          onClick={(e) => {
            if (suppressClick.current) {
              e.preventDefault();
              suppressClick.current = false;
              return;
            }
            onSelect?.(item);
          }}
        >
          <span className="am-catc__img" aria-hidden="true">
            {item.image ? (
              <img src={item.image} alt="" loading="lazy" decoding="async" draggable="false" />
            ) : (
              <Leaf size={26} />
            )}
          </span>
          <span className="am-catc__label">{item.name}</span>
        </button>
      </li>
    ));

  return (
    <div
      className={`am-catc${overflow ? " is-carousel" : ""}`}
      role="region"
      aria-roledescription={overflow ? "carousel" : undefined}
      aria-label={label}
      onMouseEnter={pause}
      onMouseLeave={() => resumeLater(400)}
      onFocus={pause}
      onBlur={() => resumeLater()}
      onTouchStart={pause}
      onTouchEnd={() => resumeLater()}
    >
      {overflow ? (
        <button
          type="button"
          className="am-catc__arrow am-catc__arrow--prev"
          aria-label="Previous categories"
          onClick={() => step(-1)}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
      ) : null}
      <div
        className="am-catc__viewport"
        ref={viewportRef}
        onScroll={overflow ? () => !stepping.current && !drag.current && wrap() : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        <div className="am-catc__track">
          <ul className="am-catc__set" ref={setRef}>
            {renderSet(false)}
          </ul>
          {overflow ? <ul className="am-catc__set" aria-hidden="true">{renderSet(true)}</ul> : null}
        </div>
      </div>
      {overflow ? (
        <button
          type="button"
          className="am-catc__arrow am-catc__arrow--next"
          aria-label="Next categories"
          onClick={() => step(1)}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './image-magnifier.css';

const CAN_HOVER_QUERY = '(hover: hover) and (pointer: fine) and (min-width: 1024px)';

const useCanMagnify = () => {
  const get = () => typeof window !== 'undefined' && window.matchMedia?.(CAN_HOVER_QUERY).matches;
  const [can, setCan] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(CAN_HOVER_QUERY);
    if (!mq) return undefined;
    const onChange = () => setCan(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return can;
};

/** Rendered image box (object-fit aware), relative to the viewport. */
const contentRect = (img) => {
  const r = img.getBoundingClientRect();
  const nw = img.naturalWidth || r.width;
  const nh = img.naturalHeight || r.height;
  const style = window.getComputedStyle(img);
  const fit = style.objectFit;
  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) || 0;
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) || 0;
  const boxW = r.width - padX;
  const boxH = r.height - padY;
  const left0 = r.left + (parseFloat(style.paddingLeft) || 0);
  const top0 = r.top + (parseFloat(style.paddingTop) || 0);
  let w = boxW;
  let h = boxH;
  if (fit === 'contain' || fit === 'scale-down' || fit === 'cover') {
    const scale = fit === 'cover' ? Math.max(boxW / nw, boxH / nh) : Math.min(boxW / nw, boxH / nh);
    w = nw * scale;
    h = nh * scale;
  }
  return { left: left0 + (boxW - w) / 2, top: top0 + (boxH - h) / 2, width: w, height: h, box: r };
};

/**
 * Blinkit-style hover magnifier. Wrap the <img>; on hover-capable desktops a lens follows the
 * cursor and a zoom pane opens to the right of `anchorRef` (or the wrapper). Touch: no-op.
 * Pointer moves are applied with requestAnimationFrame straight to the DOM (no re-renders).
 */
export default function ImageMagnifier({ src, zoom = 2.5, anchorRef, gap = 16, children }) {
  const canMagnify = useCanMagnify();
  const wrapRef = useRef(null);
  const lensRef = useRef(null);
  const paneRef = useRef(null);
  const frame = useRef(0);
  const pointer = useRef(null);
  const [active, setActive] = useState(false);

  const update = useCallback(() => {
    frame.current = 0;
    const wrap = wrapRef.current;
    const lens = lensRef.current;
    const pane = paneRef.current;
    const img = wrap?.querySelector('img');
    if (!wrap || !lens || !pane || !img || !pointer.current) return;
    const anchor = (anchorRef?.current || wrap).getBoundingClientRect();
    const left = anchor.right + gap;
    const width = Math.min(anchor.width * 1.15, window.innerWidth - left - gap);
    const height = Math.min(anchor.height, window.innerHeight - Math.max(anchor.top, 8) - 8);
    if (width < 220 || height < 160) {
      lens.style.opacity = '0';
      pane.style.opacity = '0';
      return;
    }
    const c = contentRect(img);
    const wr = wrap.getBoundingClientRect();
    // visible part of the image (cover can overflow the box)
    // (also clipped by the anchor, e.g. an overflow:hidden gallery frame)
    const vx0 = Math.max(c.left, c.box.left, anchor.left);
    const vy0 = Math.max(c.top, c.box.top, anchor.top);
    const vx1 = Math.min(c.left + c.width, c.box.right, anchor.right);
    const vy1 = Math.min(c.top + c.height, c.box.bottom, anchor.bottom);
    const lw = Math.min(width / zoom, vx1 - vx0);
    const lh = Math.min(height / zoom, vy1 - vy0);
    const cx = Math.min(Math.max(pointer.current.x, vx0 + lw / 2), vx1 - lw / 2);
    const cy = Math.min(Math.max(pointer.current.y, vy0 + lh / 2), vy1 - lh / 2);
    const lx = cx - lw / 2;
    const ly = cy - lh / 2;
    lens.style.cssText = `opacity:1;width:${lw}px;height:${lh}px;transform:translate3d(${lx - wr.left}px,${ly - wr.top}px,0)`;
    const top = Math.max(anchor.top, 8);
    pane.style.cssText = [
      'opacity:1',
      `left:${left}px`,
      `top:${top}px`,
      `width:${width}px`,
      `height:${height}px`,
      `background-image:url("${String(src).replace(/"/g, '%22')}")`,
      `background-size:${c.width * zoom}px ${c.height * zoom}px`,
      `background-position:${-(lx - c.left) * zoom}px ${-(ly - c.top) * zoom}px`,
    ].join(';');
  }, [anchorRef, gap, src, zoom]);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = window.requestAnimationFrame(update);
  }, [update]);

  useEffect(() => () => window.cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    if (active) schedule();
  }, [active, src, schedule]);
  useEffect(() => {
    if (!active) return undefined;
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [active, schedule]);

  if (!canMagnify || !src) return children;

  return (
    <span
      ref={wrapRef}
      className={`am-magnifier${active ? ' is-active' : ''}`}
      onMouseEnter={(e) => {
        pointer.current = { x: e.clientX, y: e.clientY };
        setActive(true);
      }}
      onMouseMove={(e) => {
        pointer.current = { x: e.clientX, y: e.clientY };
        schedule();
      }}
      onMouseLeave={() => {
        pointer.current = null;
        setActive(false);
      }}
    >
      {children}
      {active ? <span ref={lensRef} className="am-magnifier__lens" aria-hidden /> : null}
      {active
        ? createPortal(<div ref={paneRef} className="am-magnifier__pane" aria-hidden />, document.body)
        : null}
    </span>
  );
}
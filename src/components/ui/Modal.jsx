import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { COPY } from '../../content/copy';
import { cx } from './cx';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;

function lockScroll() {
  openCount += 1;
  if (openCount === 1) document.body.classList.add('am-scroll-locked');
}

function unlockScroll() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) document.body.classList.remove('am-scroll-locked');
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  hideClose = false,
  initialFocusRef,
  className,
}) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    lockScroll();

    const panel = panelRef.current;
    const target =
      initialFocusRef?.current || panel?.querySelector('[data-autofocus]') || panel?.querySelector(FOCUSABLE) || panel;
    target?.focus({ preventScroll: true });

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const nodes = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (!nodes.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      unlockScroll();
      if (previous && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, [open, dismissible, initialFocusRef]);

  if (!open) return null;

  return createPortal(
    <div className="am-modal" onMouseDown={(e) => e.target === e.currentTarget && dismissible && onClose?.()}>
      <div
        ref={panelRef}
        className={cx('am-modal__panel', `am-modal__panel--${size}`, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        {title || (!hideClose && dismissible) ? (
          <header className="am-modal__header">
            <div className="am-modal__titles">
              {title ? (
                <h2 id={titleId} className="am-modal__title">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descId} className="am-modal__desc">
                  {description}
                </p>
              ) : null}
            </div>
            {!hideClose && dismissible ? (
              <button type="button" className="am-modal__close" onClick={onClose} aria-label={COPY.close}>
                <X size={20} aria-hidden />
              </button>
            ) : null}
          </header>
        ) : null}
        <div className="am-modal__body">{children}</div>
        {footer ? <footer className="am-modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

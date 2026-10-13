import { useEffect, useRef } from 'react';
import { ArrowRight, Clock3, X } from 'lucide-react';

export default function PrakritiNoteModal({ visible, onClose, onBegin }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!visible) return undefined;
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll('button:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [onClose, visible]);

  if (!visible) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="note-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prakriti-note-title"
        tabIndex={-1}
      >
        <div className="note-head">
          <span>BEFORE YOU BEGIN</span>
          <h3 id="prakriti-note-title">A note on your answers</h3>
          <button type="button" className="note-close" onClick={onClose} aria-label="Close">
            <X size={19} aria-hidden />
          </button>
        </div>
        <div className="note-body">
          <p>
            <strong>Please note: </strong>
            Answer each question based on your natural body, mind, and habits{' '}
            <strong>between the age of 18-21</strong> (or before any major illness,
            long-term stress, or significant lifestyle changes).
          </p>
          <div className="tip-box">
            A gentle tip — if you're older than 21, think back to how you
            naturally were in your younger years. This reveals your true{' '}
            <strong>Prakriti (natural constitution)</strong> rather than a
            temporary imbalance, for a more accurate reading.
          </div>
          <div className="time-pill">
            <span className="note-time-icon"><Clock3 size={16} aria-hidden /></span>
            This journey takes about 3–5 minutes
          </div>
          <button className="cta" type="button" onClick={onBegin}>
            Begin the journey <ArrowRight size={17} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

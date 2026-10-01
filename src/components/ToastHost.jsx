import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { COPY } from '../content/copy';
import PrescriptionRequiredModalHost from './PrescriptionRequiredModalHost';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertCircle,
};

const DURATION = { error: 6000, warning: 5000 };

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    const onToast = (event) => {
      const message = event.detail?.message || '';
      if (!message) return;
      const id = Date.now() + Math.random();
      const type = event.detail?.type || 'success';
      setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
      pending.set(
        id,
        setTimeout(() => dismiss(id), DURATION[type] || 4000),
      );
    };
    window.addEventListener('ayurmuni-toast', onToast);
    return () => {
      window.removeEventListener('ayurmuni-toast', onToast);
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, [dismiss]);

  return (
    <>
    <PrescriptionRequiredModalHost />
    <div className="am-toast-host" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div
            key={t.id}
            className={`am-toast am-toast--${t.type}`}
            role={t.type === 'error' ? 'alert' : 'status'}
          >
            <Icon className="am-toast__icon" size={20} aria-hidden />
            <p className="am-toast__msg">{t.message}</p>
            <button type="button" className="am-toast__close" onClick={() => dismiss(t.id)} aria-label={COPY.dismiss}>
              <X size={16} aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
    </>
  );
}

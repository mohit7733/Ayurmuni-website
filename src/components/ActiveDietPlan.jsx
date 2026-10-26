import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Salad, X } from 'lucide-react';

const TOAST_KEY = 'am_active_diet_toast_seen';
const AUTO_HIDE_MS = 8000;

function DayProgress({ plan }) {
  if (!plan.totalDays || !plan.currentDay) return null;
  const pct =
    plan.progressPercent != null
      ? plan.progressPercent
      : Math.round((plan.currentDay / plan.totalDays) * 100);
  return (
    <div className="am-diet-active__progress">
      <div className="am-diet-active__progress-row">
        <span>
          Day <strong>{plan.currentDay}</strong> of {plan.totalDays}
        </span>
        {plan.progressPercent != null ? <span>{plan.progressPercent}% done</span> : null}
      </div>
      <div
        className="am-diet-active__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Diet plan progress"
      >
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Homepage card for the user's active diet plan (renders nothing without one). */
export function ActiveDietCard({ plan }) {
  if (!plan) return null;
  const href = `/diet/${encodeURIComponent(plan.planId)}`;
  return (
    <section className="am-diet-active" aria-label="Your active diet plan">
      <div className="am-diet-active__media" aria-hidden>
        {plan.thumbnailUrl ? <img src={plan.thumbnailUrl} alt="" loading="lazy" /> : <Salad size={30} />}
      </div>
      <div className="am-diet-active__body">
        <p className="am-diet-active__eyebrow">
          <span className="am-diet-active__dot" aria-hidden />
          Your active diet plan
        </p>
        <h2 className="am-diet-active__title">{plan.title || 'Diet plan'}</h2>
        {plan.subtitle ? <p className="am-diet-active__sub">{plan.subtitle}</p> : null}
      </div>
      <DayProgress plan={plan} />
      {plan.nextMeal?.title ? (
        <div className="am-diet-active__next">
          <span className="am-diet-active__next-label">
            Next{plan.nextMeal.type ? ` · ${plan.nextMeal.type.toLowerCase()}` : ''}
            {plan.nextMeal.time ? ` · ${plan.nextMeal.time}` : ''}
          </span>
          <span className="am-diet-active__next-meal">{plan.nextMeal.title}</span>
        </div>
      ) : null}
      <Link to={href} className="am-diet-active__cta">
        View plan <ArrowRight size={16} aria-hidden />
      </Link>
    </section>
  );
}

/** One-time-per-session popup announcing the active plan. */
export function ActiveDietToast({ plan }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef(0);
  const sessionKey = plan ? `${TOAST_KEY}:${plan.assignmentId || plan.planId}` : '';

  useEffect(() => {
    if (!plan) return undefined;
    let seen = false;
    try {
      seen = sessionStorage.getItem(sessionKey) === '1';
    } catch {
      seen = false;
    }
    if (seen) return undefined;
    const show = window.setTimeout(() => {
      setOpen(true);
      try {
        sessionStorage.setItem(sessionKey, '1');
      } catch {
        /* storage unavailable: still show once for this page view */
      }
    }, 900);
    return () => window.clearTimeout(show);
  }, [plan, sessionKey]);

  const close = () => {
    window.clearTimeout(timerRef.current);
    setLeaving(true);
    window.setTimeout(() => {
      setOpen(false);
      setLeaving(false);
    }, 220);
  };

  const arm = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(close, AUTO_HIDE_MS);
  };

  useEffect(() => {
    if (!open) return undefined;
    arm();
    return () => window.clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!plan || !open) return null;
  const href = `/diet/${encodeURIComponent(plan.planId)}`;
  return (
    <div
      className={`am-diet-toast${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      onMouseEnter={() => window.clearTimeout(timerRef.current)}
      onMouseLeave={arm}
      onFocusCapture={() => window.clearTimeout(timerRef.current)}
    >
      <div className="am-diet-toast__icon" aria-hidden>
        <Salad size={20} />
      </div>
      <div className="am-diet-toast__body">
        <p className="am-diet-toast__eyebrow">Your diet plan is active</p>
        <p className="am-diet-toast__title">{plan.title || 'Diet plan'}</p>
        {plan.currentDay && plan.totalDays ? (
          <p className="am-diet-toast__meta">
            Day {plan.currentDay} of {plan.totalDays}
            {plan.nextMeal?.title ? ` · Next: ${plan.nextMeal.title}` : ''}
          </p>
        ) : null}
        <Link to={href} className="am-diet-toast__cta" onClick={close}>
          View plan <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
      <button type="button" className="am-diet-toast__close" onClick={close} aria-label="Dismiss">
        <X size={16} />
      </button>
      <span className="am-diet-toast__timer" aria-hidden />
    </div>
  );
}

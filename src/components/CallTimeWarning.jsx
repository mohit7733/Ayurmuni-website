import { memo, useEffect, useState } from 'react';
import { Timer, X } from 'lucide-react';
import { getAppointmentDetail } from '../services/consultService';
import {
  formatAppointmentTimeLabel,
  getAppointmentSlotMs,
  getCallTimeStage,
  resolveAppointmentSlot,
} from '../consult/appointmentUtils';
import '../design/components/call-time-warning.css';

const TICK_MS = 15_000;

const readDetailSlot = (data) => {
  const row = Array.isArray(data) ? data[0] : Array.isArray(data?.results) ? data.results[0] : data;
  return resolveAppointmentSlot(row);
};



/** "Only X min remaining" strip shown during the last minutes of the appointment slot. */
function CallTimeWarning({
  appointmentId,
  consultationId,
  appointmentDate,
  startTime,
  endTime,
  warnMinutes = 10,
}) {
  const [fetched, setFetched] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const [dismissedStage, setDismissedStage] = useState(null);

  const hasSlot = Boolean(appointmentDate && endTime);
  const lookupId = consultationId || appointmentId;

  useEffect(() => {
    if (hasSlot || !lookupId) return undefined;
    let cancelled = false;
    getAppointmentDetail(lookupId)
      .then((res) => {
        if (cancelled || !res?.success) return;
        setFetched(readDetailSlot(res.data));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hasSlot, lookupId]);

  const slot = {
    date: appointmentDate || fetched.date,
    startTime: startTime || fetched.startTime,
    endTime: endTime || fetched.endTime,
  };
  const { endMs } = getAppointmentSlotMs(slot.date, slot.startTime, slot.endTime);

  useEffect(() => {
    if (endMs == null) return undefined;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [endMs]);

  const state = getCallTimeStage(endMs, now, warnMinutes);
  if (!state || dismissedStage === state.stage) return null;

  const { minutesLeft, stage, isOver } = state;
  const endLabel = formatAppointmentTimeLabel(slot.endTime);
  const title = isOver ? 'Appointment time is over' : `You have only ${minutesLeft} min remaining`;
  const subtitle = isOver
    ? 'Please wrap up the consultation with the doctor.'
    : `Please complete your consultation${endLabel ? ` by ${endLabel}` : ''}.`;

  return (
    <div className={`ctw${isOver ? ' is-over' : ''}`} role="status" aria-live="polite">
      <span className="ctw__icon" aria-hidden>
        <Timer size={16} />
      </span>
      <div className="ctw__text">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>
      <button type="button" className="ctw__close" aria-label="Dismiss" onClick={() => setDismissedStage(stage)}>
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}

export default memo(CallTimeWarning);
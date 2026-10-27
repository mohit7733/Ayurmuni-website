import { useEffect, useState } from 'react';
import { getMsUntilJoinWindowChange, isAppointmentJoinable } from '../consult/appointmentUtils';

/** Only watch slots that open / close within this horizon. */
const WATCH_HORIZON_MS = 6 * 60 * 60 * 1000;
/** Re-check in chunks so a long wait never drifts (timers also pause in background tabs). */
const MAX_TIMER_MS = 55 * 1000;

/**
 * Live "can join" flag for one appointment.
 * Re-renders exactly when the 5-min join window opens / closes and when the tab becomes visible again.
 */
export function useJoinWindow(appointment, windowMinutes = 5) {
  const [, setTick] = useState(0);
  const joinable = isAppointmentJoinable(appointment, windowMinutes);
  const msUntilChange = getMsUntilJoinWindowChange(appointment, windowMinutes);

  useEffect(() => {
    if (msUntilChange == null || msUntilChange > WATCH_HORIZON_MS) return undefined;
    const timer = setTimeout(
      () => setTick((t) => t + 1),
      Math.min(msUntilChange + 500, MAX_TIMER_MS),
    );
    return () => clearTimeout(timer);
  }, [msUntilChange, joinable]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return joinable;
}
/**
 * Re-renders the caller at the next join-window change (opens 5 min before start / closes at end)
 * among a list of appointments, so a list can gate "Join call" with `isAppointmentJoinable`.
 */
export function useJoinWindowTick(items, windowMinutes = 5) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const waits = (items || [])
      .map((item) => getMsUntilJoinWindowChange(item, windowMinutes))
      .filter((ms) => ms != null && ms > 0 && ms <= WATCH_HORIZON_MS);
    if (!waits.length) return undefined;
    const timer = setTimeout(
      () => setTick((t) => t + 1),
      Math.min(Math.min(...waits) + 300, MAX_TIMER_MS),
    );
    return () => clearTimeout(timer);
  }, [items, windowMinutes, tick]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return tick;
}
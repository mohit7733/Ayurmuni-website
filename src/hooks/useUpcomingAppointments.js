import { useCallback, useEffect, useState } from 'react';
import { getConsultHistory } from '../services/consultService';
import { isAuthenticated } from '../services/guestAuth';
import { mapAppointment } from '../profile/map';
import {
  isActiveAppointmentStatus,
  isAppointmentInPast,
  sortAppointmentsByDateTime,
} from '../consult/appointmentUtils';

/**
 * Same list Home uses for the join banner / "+N more" count.
 * Uses API `timeframe=upcoming` (optional `status`) per consultation-history docs.
 */
export async function fetchUpcomingAppointmentList(pageSize = 50, { status } = {}) {
  const statusFilter = String(status || '').trim().toLowerCase();
  const res = await getConsultHistory({
    page: 1,
    page_size: pageSize,
    timeframe: 'today',
    ...(statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {}),
  }).catch(() => null);

  const results = res?.data?.results || res?.results || [];
  const list = Array.isArray(results) ? results : [];
  const seen = new Set();
  const active = list.filter((item) => {
    const key = String(item?.appointment_id || item?.consultation_id || '');
    if (key && seen.has(key)) return false;
    if (key) seen.add(key);
    const callLive =
      String(item?.call_status || item?.appointment?.call_status || '').toLowerCase() ===
      'in_progress';
    if (!callLive && isAppointmentInPast(item)) return false;
    const rowStatus = String(item?.status || item?.appointment_status || '').toLowerCase();
    if (rowStatus === 'completed') return true;
    return callLive || isActiveAppointmentStatus(rowStatus);
  });
  return sortAppointmentsByDateTime(active.map(mapAppointment));
}

export default function useUpcomingAppointments(pageSize = 50, enabled = true) {
  const [loading, setLoading] = useState(enabled);
  const [appointments, setAppointments] = useState([]);

  const fetchPreview = useCallback(
    async (options = {}) => {
      try {
        if (!(await isAuthenticated())) {
          setAppointments([]);
          return;
        }
        if (!options.silent) setLoading(true);
        setAppointments(await fetchUpcomingAppointmentList(pageSize));
      } catch {
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    fetchPreview();
    // App refreshPreview on focus: re-sync silently when the tab becomes visible again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchPreview({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled, fetchPreview]);

  return {
    loading,
    appointments,
    refreshPreview: () => fetchPreview({ silent: true }),
  };
}

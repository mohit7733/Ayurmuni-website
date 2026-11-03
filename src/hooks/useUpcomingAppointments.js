import { useCallback, useEffect, useState } from 'react';
import { getConsultHistory } from '../services/consultService';
import { isAuthenticated } from '../services/guestAuth';
import { mapAppointment } from '../profile/map';
import {
  isActiveAppointmentStatus,
  isAppointmentInPast,
  sortAppointmentsByDateTime,
} from '../consult/appointmentUtils';

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
        // App useUpcomingAppointmentsPreview: confirmed + upcoming + still-running completed calls, de-duplicated.
        const [confirmedRes, upcomingRes, completedRes] = await Promise.all(
          ['confirmed', 'upcoming', 'completed'].map((appointment_status) =>
            getConsultHistory({ page: 1, page_size: pageSize, appointment_status }).catch(() => null),
          ),
        );
        const listOf = (res) => {
          const results = res?.data?.results || res?.results || [];
          return Array.isArray(results) ? results : [];
        };
        const seen = new Set();
        const active = [...listOf(confirmedRes), ...listOf(upcomingRes), ...listOf(completedRes)].filter((item) => {
          const key = String(item?.appointment_id || item?.consultation_id || '');
          if (key && seen.has(key)) return false;
          if (key) seen.add(key);
          const status = String(item?.status || item?.appointment_status || '').toLowerCase();
          if (status === 'completed') return !isAppointmentInPast(item);
          return (
            isActiveAppointmentStatus(status) ||
            String(item?.call_status || item?.appointment?.call_status || '').toLowerCase() === 'in_progress'
          );
        });
        setAppointments(sortAppointmentsByDateTime(active.map(mapAppointment)));
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

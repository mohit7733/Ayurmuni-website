import { useCallback, useEffect, useState } from 'react';
import { getConsultHistory } from '../services/consultService';
import { isAuthenticated } from '../services/guestAuth';
import { mapAppointment } from '../profile/map';
import { sortAppointmentsByDateTime } from '../consult/appointmentUtils';

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
        const res = await getConsultHistory({
          page: 1,
          page_size: pageSize,
          appointment_status: 'confirmed',
        });
        const results = res?.data?.results || res?.results || [];
        // App useUpcomingAppointmentsPreview: confirmed only, sorted by date/time.
        setAppointments(
          sortAppointmentsByDateTime(
            (Array.isArray(results) ? results : [])
              .map(mapAppointment)
              .filter((item) => String(item.status || '').trim().toLowerCase() === 'confirmed'),
          ),
        );
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

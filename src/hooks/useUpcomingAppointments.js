import { useCallback, useEffect, useState } from 'react';
import { getConsultHistory } from '../services/consultService';
import { isAuthenticated } from '../services/guestAuth';
import { mapAppointment } from '../profile/map';

export default function useUpcomingAppointments(pageSize = 50) {
  const [loading, setLoading] = useState(true);
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
        setAppointments(
          (Array.isArray(results) ? results : [])
            .map(mapAppointment)
            .filter((item) => String(item.status || '').toLowerCase() === 'confirmed'),
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
    fetchPreview();
  }, [fetchPreview]);

  return {
    loading,
    appointments,
    refreshPreview: () => fetchPreview({ silent: true }),
  };
}

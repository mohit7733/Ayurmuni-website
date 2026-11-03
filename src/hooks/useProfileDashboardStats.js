import { useCallback, useEffect, useRef, useState } from 'react';
import { getConsultHistory } from '../services/consultService';
import { getOrders } from '../services/orderService';
import { getMedicalRecords } from '../services/patientService';
import { PROFILE_STAT_DEFAULTS, buildProfileStats } from '../profile/dashboardStats';

/** Consults / Orders / Reports counts for the profile header (app useProfileDashboardStats). */
export default function useProfileDashboardStats(enabled = true) {
  const [stats, setStats] = useState(PROFILE_STAT_DEFAULTS);
  const [loading, setLoading] = useState(Boolean(enabled));
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        getConsultHistory({ page: 1 }),
        getOrders({ page: 1, page_size: 1 }),
        getMedicalRecords(),
      ]);
      if (aliveRef.current) setStats(buildProfileStats(results));
    } catch {
      if (aliveRef.current) setStats(PROFILE_STAT_DEFAULTS);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    if (enabled) refresh();
    return () => {
      aliveRef.current = false;
    };
  }, [enabled, refresh]);

  return { stats, loading, refresh };
}

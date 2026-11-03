import { useEffect, useState } from 'react';
import { getDoctors } from '../services/consultService';
import { getDoctorId, normalizeDoctorList } from '../consult/doctors';

/** General (not concern-scoped) approved doctors: GET customers/doctors/?page=1&page_size=N. */
export default function useOurDoctors(limit = 12) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getDoctors({ page: 1, page_size: limit });
        if (!alive) return;
        if (!res || res.success === false) {
          setDoctors([]);
          return;
        }
        setDoctors(
          normalizeDoctorList(res, { approvedOnly: true })
            .filter((doctor) => getDoctorId(doctor))
            .slice(0, limit),
        );
      } catch {
        if (alive) setDoctors([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [limit]);

  return { doctors, loading };
}
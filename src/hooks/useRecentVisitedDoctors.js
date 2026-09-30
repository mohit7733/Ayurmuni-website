import { useCallback, useEffect, useState } from 'react';
import { getRecentVisitedDoctors } from '../services/consultService';
import { isAuthenticated } from '../services/guestAuth';
import { doctorDisplayName, doctorImage, getDoctorId } from '../consult/doctors';

export function mapRecentDoctor(item) {
  const doctorId = getDoctorId(item) || String(item?.doctor_id || item?.id || '').trim();
  if (!doctorId) return null;
  return {
    ...item,
    id: doctorId,
    doctor_id: doctorId,
    doctor_name: doctorDisplayName(item) || item.doctor_name || 'Doctor',
    doctor_image: doctorImage(item) || item.doctor_image,
  };
}

export default function useRecentVisitedDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!(await isAuthenticated())) {
      setDoctors([]);
      return;
    }
    setLoading(true);
    try {
      const response = await getRecentVisitedDoctors();
      const results = Array.isArray(response?.data?.results)
        ? response.data.results
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : [];
      setDoctors(results.map(mapRecentDoctor).filter(Boolean));
    } catch {
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { doctors, loading, refresh };
}

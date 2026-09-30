import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import {
  ConsultationTimeline,
  StitchedRegimenList,
  prescriptionPath,
  prescriptionState,
} from '../components/consult/ConsultationTimeline';
import { requireAuth } from '../services/guestAuth';
import { getDoctorSlip } from '../services/consultService';
import { getDoctorLocationLine } from '../utils/doctorSlipUtils';

export default function DoctorConsultationHistory() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const routeName = location.state?.doctorName || '';
  const [loading, setLoading] = useState(true);
  const [slipData, setSlipData] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await requireAuth('Please login to view consultation history'))) return;
      if (!doctorId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await getDoctorSlip(doctorId);
      if (!alive) return;
      setSlipData(res?.success === false ? null : res?.data ?? res ?? null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [doctorId]);

  const consultations = useMemo(
    () => (Array.isArray(slipData?.consultations) ? slipData.consultations : []),
    [slipData],
  );
  const doctor = slipData?.doctor;
  const regimen = useMemo(
    () => consultations.flatMap((item) => item?.prescription?.items || []),
    [consultations],
  );
  const title = routeName || doctor?.doctor_name || 'Consultation History';
  const cityLine = getDoctorLocationLine(doctor);

  const openPrescription = (item, doc) => {
    const path = prescriptionPath(item);
    if (!path) return;
    navigate(path, { state: prescriptionState(item, doc) });
  };

  return (
    <AppShell tab="consult">
      <section className="catalog-page doc-history-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>{title}</h1>
            <p>{cityLine || 'All visits with this doctor'}</p>
          </div>
        </header>

        {loading ? (
          <p className="muted">Loading consultation history…</p>
        ) : (
          <>
            <h3 className="yoga-section">All consultations</h3>
            {consultations.length > 0 ? (
              <ConsultationTimeline
                consultations={consultations}
                doctor={doctor}
                onPrescription={openPrescription}
              />
            ) : (
              <div className="empty-copy">
                <strong>No consultations found for this doctor.</strong>
              </div>
            )}
            {regimen.length > 0 ? (
              <>
                <h3 className="yoga-section">Medicines from visits</h3>
                <StitchedRegimenList items={regimen} />
              </>
            ) : null}
          </>
        )}
      </section>
    </AppShell>
  );
}

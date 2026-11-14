import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  ConsultationTimeline,
  StitchedRegimenList,
  prescriptionPath,
  prescriptionState,
} from '../components/consult/ConsultationTimeline';
import {
  DetailEmpty,
  DetailPage,
  DetailSkeleton,
  DetailTop,
} from '../components/detail/Detail';
import { requireAuth } from '../services/guestAuth';
import { getDoctorSlip } from '../services/consultService';
import { formatDoctorDisplayName } from '../consult/appointmentUtils';
import { doctorDisplayName, formatDoctorSpecialization } from '../consult/doctors';
import { getConsultationKey, getDoctorLocationLine } from '../utils/doctorSlipUtils';
import '../design/pages/doctor-slip.css';

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
  const doctorName = formatDoctorDisplayName(
    routeName || doctorDisplayName(doctor) || doctor?.doctor_name || 'Doctor',
  );
  const specialization = formatDoctorSpecialization(doctor);
  const cityLine = getDoctorLocationLine(doctor);

  const openConsultation = (item) => {
    const key = getConsultationKey(item);
    if (!doctorId || !key) return;
    navigate(`/consult/doctors/${doctorId}/slip?visit=${encodeURIComponent(key)}`);
  };

  const openPrescription = (item, doc) => {
    const path = prescriptionPath(item);
    if (!path) return;
    navigate(path, { state: prescriptionState(item, doc) });
  };

  return (
    <AppShell tab="consult">
      <DetailPage className="am-slip am-slip--history">
        <DetailTop
          onBack={() => navigate(doctorId ? `/consult/doctors/${doctorId}/slip` : -1)}
          backLabel="Back to slips"
        />

        <header className="am-slip-history-head">
          <p className="dx-eyebrow">Consultation register</p>
          <h1>{doctorName}</h1>
          <p>
            {[specialization, cityLine].filter(Boolean).join(' · ') ||
              'All official visits with this physician'}
          </p>
        </header>

        {loading ? <DetailSkeleton label="Loading consultation history" /> : null}

        {!loading && consultations.length === 0 ? (
          <DetailEmpty
            icon={ClipboardList}
            title="No consultations found"
            text="Completed visits with this doctor will appear in this register."
          />
        ) : null}

        {!loading && consultations.length > 0 ? (
          <>
            <section className="am-slip-panel" aria-labelledby="history-register-heading">
              <div className="am-slip-panel__head">
                <h2 id="history-register-heading">All consultations</h2>
                <span className="am-slip-panel__badge">{consultations.length}</span>
              </div>
              <p className="am-slip-panel__note">
                Open any visit to view the consultation slip, download, print, or share.
              </p>
              <ConsultationTimeline
                consultations={consultations}
                doctor={doctor}
                onOpen={openConsultation}
                onPrescription={openPrescription}
              />
            </section>

            {regimen.length > 0 ? (
              <section className="am-slip-panel" aria-labelledby="history-meds-heading">
                <div className="am-slip-panel__head">
                  <h2 id="history-meds-heading">Medicines across visits</h2>
                </div>
                <StitchedRegimenList items={regimen} />
              </section>
            ) : null}
          </>
        ) : null}
      </DetailPage>
    </AppShell>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShareButton from '../components/ShareButton';
import {
  ConsultationTimeline,
  MedicineRow,
  StitchedRegimenList,
  prescriptionPath,
  prescriptionState,
} from '../components/consult/ConsultationTimeline';
import { formatRupee } from '../home/catalog';
import { requireAuth } from '../services/guestAuth';
import { getDoctorSlip } from '../services/consultService';
import {
  formatSlipDate,
  formatSlipTimeRange,
  getDoctorLocationLine,
  getPatientMeta,
  hasPrescribedData,
} from '../utils/doctorSlipUtils';

const PREVIEW_LIMIT = 3;

const NoteBlock = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="slip-note">
      <small>{label}</small>
      <p>{value}</p>
    </div>
  );
};

const PatientCard = ({ data, doctor }) => {
  const location = getDoctorLocationLine(doctor);
  const patientMeta = getPatientMeta(data?.patient);
  const timeRange = formatSlipTimeRange(data?.start_time, data?.end_time);
  return (
    <div className="checkout-card">
      <div className="receipt-price">
        <span>
          <small>Physician</small>
          <strong>{doctor?.doctor_name || '—'}</strong>
          <small>
            {[
              doctor?.qualification,
              doctor?.experience_display ? `${doctor.experience_display} yrs exp` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </small>
        </span>
        <span>
          <small>Date</small>
          <strong>{formatSlipDate(data?.appointment_date || data?.date)}</strong>
          {timeRange !== '—' ? <small>{timeRange}</small> : null}
        </span>
      </div>
      <div className="receipt-price">
        <span>
          <small>Patient</small>
          <strong>{data?.patient?.patient_name || '—'}</strong>
          {patientMeta ? <small>{patientMeta}</small> : null}
        </span>
        <span>
          <small>Ref no.</small>
          <strong>
            {doctor?.registration_number || String(data?.consultation_id || '').slice(0, 8) || '—'}
          </strong>
        </span>
      </div>
      {location ? (
        <p>
          <small>City / location</small>
          <br />
          {location}
        </p>
      ) : null}
      {data?.concern ? (
        <p>
          <small>Concern</small>
          <br />
          {data.concern}
        </p>
      ) : null}
    </div>
  );
};

export default function DoctorSlip() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [slipData, setSlipData] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await requireAuth('Please login to view the doctor slip'))) return;
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
  const active = consultations[0];
  const medicines = active?.prescription?.items || [];
  const prescription = active?.prescription;
  const fee = active?.payment?.consultation_fee ?? active?.payment?.amount;
  const multi = consultations.length > 1;
  const visibleVisits = consultations.slice(0, PREVIEW_LIMIT);
  const regimen = consultations.flatMap((item) => item?.prescription?.items || []);
  const completedPct = Math.min(
    100,
    Math.round(
      (consultations.filter((item) => item.appointment_status === 'completed').length /
        Math.max(consultations.length, 1)) *
        100,
    ),
  );

  const openPrescription = (item, doc) => {
    const path = prescriptionPath(item);
    if (!path) return;
    navigate(path, { state: prescriptionState(item, doc) });
  };

  const hasNotes =
    prescription?.clinical_notes ||
    prescription?.diagnosis_advice ||
    prescription?.symptom_description ||
    prescription?.allergies ||
    prescription?.history_of_past_illness ||
    prescription?.family_history ||
    prescription?.follow_up?.date;

  return (
    <AppShell tab="consult">
      <section className="catalog-page slip-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>Doctor Slip</h1>
            <p>{doctor?.doctor_name || (multi ? 'Consultation history' : 'Your consultation summary')}</p>
          </div>
          {consultations.length > 0 ? (
            <div className="history-actions">
              <ShareButton
                title={`Doctor slip — ${doctor?.doctor_name || 'Doctor'}`}
                text={`Consultation summary with ${doctor?.doctor_name || 'your doctor'} on Ayurmuni.`}
                url={`${window.location.origin}/consult/doctors/${doctorId}/slip`}
                variant="soft"
                size="sm"
              />
              <button type="button" className="ghost" onClick={() => window.print()}>
                Print
              </button>
            </div>
          ) : null}
        </header>

        {loading ? (
          <p className="muted">Loading doctor slip…</p>
        ) : consultations.length === 0 ? (
          <div className="empty-copy">
            <strong>No consultations found</strong>
            <p>Visits with this doctor will appear here.</p>
          </div>
        ) : multi ? (
          <>
            <PatientCard data={consultations[0]} doctor={doctor} />
            <div className="checkout-card">
              <small>Your visits</small>
              <p>
                {consultations.length} consultation{consultations.length > 1 ? 's' : ''} with this doctor
              </p>
              <div className="slip-progress">
                <i style={{ width: `${completedPct}%` }} />
              </div>
            </div>
            <div className="home-section-head">
              <h2>Recent consultations</h2>
              {consultations.length > PREVIEW_LIMIT ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/consult/doctors/${doctorId}/history`, {
                      state: { doctorName: doctor?.doctor_name },
                    })
                  }
                >
                  View all
                </button>
              ) : null}
            </div>
            <ConsultationTimeline
              consultations={visibleVisits}
              doctor={doctor}
              onPrescription={openPrescription}
            />
            {regimen.length > 0 ? (
              <>
                <h3 className="yoga-section">Medicines from visits</h3>
                <StitchedRegimenList items={regimen} />
              </>
            ) : null}
          </>
        ) : (
          <>
            <PatientCard data={active} doctor={doctor} />
            {hasNotes ? (
              <div className="checkout-card">
                <h3>Doctor’s Notes</h3>
                <NoteBlock label="Symptoms" value={prescription?.symptom_description} />
                <NoteBlock label="Past illness" value={prescription?.history_of_past_illness} />
                <NoteBlock label="Allergies" value={prescription?.allergies} />
                <NoteBlock label="Family history" value={prescription?.family_history} />
                <NoteBlock label="Clinical notes" value={prescription?.clinical_notes} />
                <NoteBlock label="Diagnosis & advice" value={prescription?.diagnosis_advice} />
                {prescription?.follow_up?.date ? (
                  <NoteBlock
                    label="Follow-up"
                    value={`${formatSlipDate(prescription.follow_up.date)}${
                      prescription.follow_up.reason ? ` · ${prescription.follow_up.reason}` : ''
                    }`}
                  />
                ) : null}
                <p className="muted">Digitally signed by {doctor?.doctor_name || 'Doctor'}</p>
              </div>
            ) : null}

            {medicines.length > 0 ? (
              <>
                <h3 className="yoga-section">Current Regimen</h3>
                <div className="checkout-card">
                  {medicines.map((item, index) => (
                    <MedicineRow key={item.id || `${item.medicine_name}-${index}`} item={item} />
                  ))}
                </div>
              </>
            ) : null}

            {fee != null || active?.appointment_notes ? (
              <div className="checkout-card">
                {fee != null ? (
                  <div className="receipt-price">
                    <span>Consultation fee</span>
                    <strong>{formatRupee(fee)}</strong>
                  </div>
                ) : null}
                {active?.appointment_notes ? <p className="muted">{active.appointment_notes}</p> : null}
              </div>
            ) : null}

            <div className="slip-footer">
              <strong>{doctor?.doctor_name || 'Doctor'}</strong>
              {doctor?.qualification ? <small>{doctor.qualification}</small> : null}
              {getDoctorLocationLine(doctor) ? <small>{getDoctorLocationLine(doctor)}</small> : null}
            </div>

            {hasPrescribedData(active) ? (
              <button type="button" className="cta" onClick={() => openPrescription(active, doctor)}>
                View Prescription
              </button>
            ) : null}
          </>
        )}
      </section>
    </AppShell>
  );
}

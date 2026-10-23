import { ConsultationTimeline, StitchedRegimenList } from './ConsultationTimeline';

const PREVIEW_LIMIT = 3;

/**
 * Port of the app's screens/consult/MultipleDoctorSlip.tsx. DoctorSlip renders it when the
 * slip has more than one consultation: patient card from the latest visit, visit count with
 * completed-visit progress, the first 3 visits (View all → consultation history) and the
 * medicines stitched from every visit's prescription.
 */
export default function MultipleDoctorSlip({ consultations = [], doctor, patient, onViewAll, onPrescription }) {
  const previewList = consultations.slice(0, PREVIEW_LIMIT);
  const showViewAll = consultations.length > PREVIEW_LIMIT;
  const regimen = consultations.flatMap((item) => item?.prescription?.items || []);
  const completedPct = Math.min(
    100,
    Math.round(
      (consultations.filter((item) => item.appointment_status === 'completed').length /
        Math.max(consultations.length, 1)) *
        100,
    ),
  );

  return (
    <>
      {patient}
      <div className="checkout-card">
        <small>Your visits</small>
        <p>
          {consultations.length} consultation{consultations.length > 1 ? 's' : ''} with this doctor
        </p>
        <div className="slip-progress" role="progressbar" aria-valuenow={completedPct} aria-valuemin={0} aria-valuemax={100} aria-label="Completed visits">
          <i style={{ width: `${completedPct}%` }} />
        </div>
      </div>
      <div className="home-section-head">
        <h2>Recent consultations</h2>
        {showViewAll ? (
          <button type="button" onClick={onViewAll}>
            View all
          </button>
        ) : null}
      </div>
      <ConsultationTimeline consultations={previewList} doctor={doctor} onPrescription={onPrescription} />
      {regimen.length > 0 ? (
        <>
          <h3 className="yoga-section">Medicines from visits</h3>
          <StitchedRegimenList items={regimen} />
        </>
      ) : null}
    </>
  );
}

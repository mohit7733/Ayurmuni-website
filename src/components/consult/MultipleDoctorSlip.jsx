import { ConsultationTimeline, StitchedRegimenList } from './ConsultationTimeline';

const PREVIEW_LIMIT = 6;

/**
 * Multi-visit doctor slip: compact record summary + consultation register.
 */
export default function MultipleDoctorSlip({
  consultations = [],
  doctor,
  patient,
  onViewAll,
  onOpen,
  onPrescription,
  onOpenLatest,
}) {
  const previewList = consultations.slice(0, PREVIEW_LIMIT);
  const showViewAll = consultations.length > PREVIEW_LIMIT;
  const regimen = consultations.flatMap((item) => item?.prescription?.items || []);
  const uniqueMedCount = new Set(
    regimen.map((item) =>
      String(
        item?.id ??
          item?.medicine_id ??
          item?.product_id ??
          item?.variant_id ??
          item?.medicine_name ??
          item?.product_name ??
          '',
      )
        .trim()
        .toLowerCase(),
    ),
  ).size;
  const statusOf = (item) =>
    String(item.appointment_status_label || item.appointment_status || item.status || '').toLowerCase();
  const completedCount = consultations.filter((item) =>
    /complet|success|done|ended/.test(statusOf(item)),
  ).length;
  const cancelledCount = consultations.filter((item) => /cancel/.test(statusOf(item))).length;
  const missedCount = consultations.filter((item) => /miss|no.?show/.test(statusOf(item))).length;

  return (
    <div className="am-slip-multi">
      {patient}

      <section className="am-slip-summary" aria-label="Visit summary">
        <div className="am-slip-summary__main">
          <p className="am-slip-panel__eyebrow">Consultation register</p>
          <h2>
            {consultations.length} visit{consultations.length === 1 ? '' : 's'} on file
          </h2>
          <p>Tap a visit to open the official slip. Cancelled and missed visits stay on record.</p>
        </div>
        <ul className="am-slip-summary__chips">
          <li className="is-success">
            <strong>{completedCount}</strong>
            <span>Completed</span>
          </li>
          {missedCount ? (
            <li className="is-danger">
              <strong>{missedCount}</strong>
              <span>Missed</span>
            </li>
          ) : null}
          {cancelledCount ? (
            <li className="is-warn">
              <strong>{cancelledCount}</strong>
              <span>Cancelled</span>
            </li>
          ) : null}
        </ul>
        {onOpenLatest ? (
          <button type="button" className="am-slip-summary__cta" onClick={onOpenLatest}>
            Open latest slip
          </button>
        ) : null}
      </section>

      <section className="am-slip-panel am-slip-panel--register" aria-labelledby="slip-recent-heading">
        <div className="am-slip-panel__head">
          <h2 id="slip-recent-heading">All listed visits</h2>
          {showViewAll ? (
            <button type="button" className="am-slip-panel__link" onClick={onViewAll}>
              View all {consultations.length}
            </button>
          ) : (
            <span className="am-slip-panel__badge">{previewList.length}</span>
          )}
        </div>
        <ConsultationTimeline
          consultations={previewList}
          doctor={doctor}
          onOpen={onOpen}
          onPrescription={onPrescription}
        />
      </section>

      {regimen.length > 0 ? (
        <section className="am-slip-panel am-slip-panel--meds" aria-labelledby="slip-meds-heading">
          <div className="am-slip-panel__head">
            <h2 id="slip-meds-heading">Medicines across visits</h2>
            <span className="am-slip-panel__badge">{uniqueMedCount}</span>
          </div>
          <StitchedRegimenList items={regimen} />
        </section>
      ) : null}
    </div>
  );
}

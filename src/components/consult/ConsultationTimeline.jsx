import { formatRupee } from '../../home/catalog';
import {
  formatSlipDate,
  formatSlipTimeRange,
  getConsultationTitle,
  getPatientMeta,
  hasPrescribedData,
} from '../../utils/doctorSlipUtils';
import {
  getMedicinePrice,
  getMedicineScheduleChips,
} from '../../utils/prescriptionDetailUtils';

export const prescriptionPath = (item) => {
  const lookupId = item?.appointment_id || item?.consultation_id || item?.id;
  return lookupId ? `/profile/prescriptions/${lookupId}` : '';
};

export const prescriptionState = (item, doctor) => ({
  appointment_id: item?.appointment_id,
  consultation_id: item?.consultation_id,
  PrisData: item,
  doctorData: doctor,
});

export function MedicineRow({ item }) {
  const price = getMedicinePrice(item);
  const chips = getMedicineScheduleChips(item);
  return (
    <div className="checkout-item">
      <span>{String(item?.medicine_name || item?.product_name || 'M').charAt(0)}</span>
      <p>
        {item?.medicine_name || item?.product_name || 'Medicine'}
        {item?.instruction ? <small>{item.instruction}</small> : null}
        {chips.length ? (
          <small>{chips.map((chip) => `${chip.caption}: ${chip.label}`).join(' · ')}</small>
        ) : null}
      </p>
      {price != null ? <strong>{formatRupee(price)}</strong> : null}
    </div>
  );
}

export function VisitCard({ item, doctor, onPrescription }) {
  const canView = hasPrescribedData(item);
  const patientMeta = getPatientMeta(item?.patient);
  const timeRange = formatSlipTimeRange(item?.start_time, item?.end_time);
  const fee = item?.payment?.consultation_fee ?? item?.payment?.amount ?? null;
  const summary = String(item?.concern || item?.prescription?.symptom_description || '').trim();
  return (
    <article className="history-card">
      <div className="history-meta">
        <span>{formatSlipDate(item?.appointment_date || item?.date)}</span>
        {item?.consultation_type ? <span>{item.consultation_type}</span> : null}
      </div>
      <strong>{getConsultationTitle(item)}</strong>
      <p className="muted">
        {[timeRange !== '—' ? timeRange : '', item?.duration_minutes ? `${item.duration_minutes} min` : '']
          .filter(Boolean)
          .join(' · ')}
      </p>
      {item?.patient?.patient_name ? (
        <p>
          {item.patient.patient_name}
          {patientMeta ? <small> · {patientMeta}</small> : null}
          {fee != null ? <small> · {formatRupee(fee)}</small> : null}
        </p>
      ) : null}
      {summary ? <p className="muted">{summary}</p> : null}
      {canView ? (
        <button type="button" className="cta" onClick={() => onPrescription(item, doctor)}>
          View Prescription
        </button>
      ) : (
        <p className="muted">Prescription not available for this visit</p>
      )}
    </article>
  );
}

export function ConsultationTimeline({ consultations, doctor, onPrescription }) {
  return (
    <>
      {(consultations || []).map((item, index) => (
        <VisitCard
          key={item.consultation_id || item.appointment_id || index}
          item={item}
          doctor={doctor}
          onPrescription={onPrescription}
        />
      ))}
    </>
  );
}

export function StitchedRegimenList({ items }) {
  if (!items?.length) return null;
  return (
    <div className="checkout-card">
      {items.map((item, index) => (
        <MedicineRow key={item.id || `${item.medicine_name}-${index}`} item={item} />
      ))}
    </div>
  );
}

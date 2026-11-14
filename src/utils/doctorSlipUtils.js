import { formatSlotTime } from '../consult/doctors';
import {
  formatIssuedLabel,
  getDoctorLocationLine,
  hasPrescribedData,
} from './prescriptionDetailUtils';

export { getDoctorLocationLine, hasPrescribedData };

export const formatSlipDate = (dateStr) => formatIssuedLabel(dateStr);

export const formatSlipTimeRange = (start, end) => {
  const startLabel = formatSlotTime(start) || '';
  const endLabel = formatSlotTime(end) || '';
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
  return startLabel || endLabel || '—';
};

export const getPatientMeta = (patient) => {
  if (!patient) return '';
  return [
    patient.relation ? String(patient.relation) : '',
    patient.age != null ? `${patient.age} yrs` : '',
    patient.gender ? String(patient.gender) : '',
  ]
    .filter(Boolean)
    .join(' · ');
};

const text = (value) => String(value ?? '').trim();

/** Prefer diagnosis / concern / symptoms from slip or consultation-history payloads. */
export const getConsultationTitle = (consultation) => {
  const notes = consultation?.notes || {};
  const rx = consultation?.prescription || {};
  const advice = text(rx.diagnosis_advice || notes.diagnosis_advice);
  if (advice) return advice;
  const concern = text(
    consultation?.concern ||
      consultation?.consultation_concern ||
      consultation?.consultation_title,
  );
  if (concern) return concern;
  const symptom = text(rx.symptom_description || notes.symptom_description);
  if (symptom) return symptom;
  return 'Consultation visit';
};

/** Fee from payment summary (history API often sends amount: 0 with real fee in summary). */
export const getSlipFee = (consultation) => {
  const payment = consultation?.payment;
  if (!payment || typeof payment !== 'object') return null;
  const summary = payment.summary && typeof payment.summary === 'object' ? payment.summary : {};
  const candidates = [
    summary.total_payable_amount,
    summary.consultation_fee,
    payment.consultation_fee,
    payment.amount,
  ];
  for (const value of candidates) {
    if (value == null || value === '') continue;
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
};

export const getSlipStatus = (consultation) =>
  text(
    consultation?.appointment_status_label ||
      consultation?.appointment_status ||
      consultation?.status ||
      consultation?.consultation_status,
  );

/** Human label for slip / register (keeps Cancelled, Missed, etc. visible). */
export const formatSlipStatusLabel = (consultationOrStatus) => {
  const raw =
    typeof consultationOrStatus === 'string' || consultationOrStatus == null
      ? text(consultationOrStatus)
      : getSlipStatus(consultationOrStatus);
  if (!raw) return '';
  return raw
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

/** Cancelled / missed / no-show — show as closed negative outcomes on the slip. */
export const isClosedNegativeStatus = (consultationOrStatus) => {
  const value = String(
    typeof consultationOrStatus === 'string' || consultationOrStatus == null
      ? consultationOrStatus || ''
      : getSlipStatus(consultationOrStatus),
  ).toLowerCase();
  return /cancel|miss|no.?show|fail|reject|declin|expire|refused/.test(value);
};

/** Stable id for selecting a visit on the slip / history list. */
export const getConsultationKey = (consultation) =>
  text(consultation?.consultation_id || consultation?.appointment_id || consultation?.id);

/** Plain-text fallback used when browser PDF print is blocked. */
export const buildDoctorSlipDownloadText = ({ doctor, consultation, visitCount = 1 }) => {
  const notes = consultation?.notes || {};
  const rx = consultation?.prescription || {};
  const medicines = Array.isArray(rx.items) ? rx.items : [];
  const fee = getSlipFee(consultation);
  const lines = [
    'AYURMUNI',
    'Official Consultation Slip',
    '----------------------------------------',
    `Doctor: ${text(doctor?.doctor_name) || '-'}`,
    `Patient: ${text(consultation?.patient?.patient_name) || '-'}`,
    `Date: ${formatSlipDate(consultation?.appointment_date || consultation?.date)}`,
    `Time: ${formatSlipTimeRange(consultation?.start_time, consultation?.end_time)}`,
    `Status: ${formatSlipStatusLabel(consultation) || '-'}`,
    visitCount > 1 ? `Visits on file: ${visitCount}` : '',
    fee != null ? `Fee: ${fee}` : '',
    '----------------------------------------',
    text(consultation?.concern || consultation?.consultation_concern)
      ? `Concern: ${consultation.concern || consultation.consultation_concern}`
      : '',
    text(rx.symptom_description || notes.symptom_description)
      ? `Symptoms: ${rx.symptom_description || notes.symptom_description}`
      : '',
    text(rx.clinical_notes || notes.clinical_notes)
      ? `Clinical notes: ${rx.clinical_notes || notes.clinical_notes}`
      : '',
    text(rx.diagnosis_advice || notes.diagnosis_advice)
      ? `Diagnosis: ${rx.diagnosis_advice || notes.diagnosis_advice}`
      : '',
  ].filter(Boolean);
  if (medicines.length) {
    lines.push('', 'Medicines');
    medicines.forEach((item, index) => {
      const name = text(item?.medicine_name || item?.product_name) || 'Medicine';
      const instruction = text(item?.instruction);
      lines.push(`  ${index + 1}. ${name}${instruction ? ` — ${instruction}` : ''}`);
    });
  }
  lines.push(
    '----------------------------------------',
    'Computer-generated confidential medical record. No wet signature required.',
  );
  return lines.join('\n');
};

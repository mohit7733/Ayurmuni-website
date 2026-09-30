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

export const getConsultationTitle = (consultation) => {
  const advice = String(consultation?.prescription?.diagnosis_advice || '').trim();
  if (advice) return advice;
  const concern = String(consultation?.concern || '').trim();
  if (concern) return concern;
  const symptom = String(consultation?.prescription?.symptom_description || '').trim();
  if (symptom) return symptom;
  return 'Consultation visit';
};

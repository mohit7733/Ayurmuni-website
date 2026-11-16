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

const asRecord = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null;

const textOf = (value) => {
  if (value == null || value === '') return '';
  if (typeof value === 'object') {
    return textOf(value.name || value.package_name || value.title || value.label || value.plan_name);
  }
  return String(value).trim();
};

const firstId = (nodes, keys) => {
  for (const node of nodes) {
    for (const key of keys) {
      const raw = node?.[key];
      if (raw == null || raw === '' || typeof raw === 'object') continue;
      const text = String(raw).trim();
      if (text && text !== '0' && text.toLowerCase() !== 'null') return text;
    }
  }
  return '';
};

const isTrue = (value) => value === true || String(value || '').toLowerCase() === 'true';

const shortRef = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= 18) return text;
  return text.slice(0, 8).toUpperCase();
};

/**
 * How this visit was paid: a purchased package, or a normal consultation payment.
 * Reads the flags the booking and slip APIs already send.
 */
export const getConsultationPaymentSource = (consultation) => {
  const payment = asRecord(consultation?.payment) || asRecord(consultation?.payment_details) || {};
  const summary = asRecord(payment.summary) || asRecord(consultation?.summary) || {};
  const nodes = [
    consultation,
    payment,
    summary,
    asRecord(consultation?.booking),
    asRecord(payment.package),
    asRecord(consultation?.package),
    asRecord(summary.package),
  ].filter(Boolean);

  const packageId = firstId(nodes, [
    'package_purchase_id',
    'package_id',
    'user_package_id',
    'plan_purchase_id',
  ]);
  const packageName =
    nodes
      .map((node) =>
        textOf(
          node.package_name ||
            node.plan_name ||
            node.package_title ||
            (typeof node.package === 'object' ? node.package : null),
        ),
      )
      .find(Boolean) || '';
  const sourceText = firstId(nodes, [
    'payment_source',
    'funding_source',
    'booking_source',
    'paid_via',
    'payment_via',
    'fee_source',
  ]);
  const typeText = firstId(nodes, ['payment_type', 'payment_method', 'method']);
  const funded =
    nodes.some(
      (node) =>
        isTrue(node.funded_by_package) ||
        isTrue(node.is_package) ||
        isTrue(node.package_funded) ||
        isTrue(node.covered_by_package) ||
        Object.entries(node).some(([key, value]) => {
          if (!/package|plan_purchase|funded_by/i.test(key)) return false;
          if (value == null || value === false || value === '' || value === 0 || value === '0') return false;
          return true;
        }),
    ) ||
    Boolean(packageId || packageName) ||
    /package|plan/i.test(`${sourceText} ${typeText}`);

  const reference = shortRef(
    firstId(nodes, [
      'payment_reference',
      'gateway_payment_id',
      'cf_payment_id',
      'razorpay_payment_id',
      'transaction_id',
      'payment_id',
      'gateway_order_id',
      'order_id',
    ]),
  );

  if (funded) {
    const detail = packageName || (packageId ? shortRef(packageId) : '');
    return {
      kind: 'package',
      label: 'Paid through package',
      detail,
      reference,
      line: ['Paid through package', detail].filter(Boolean).join(' · '),
    };
  }

  const hasPayment = Boolean(reference || typeText || sourceText || payment.amount != null || summary.consultation_fee != null);
  if (!hasPayment) {
    return { kind: '', label: '', detail: '', reference: '', line: '' };
  }

  const method = typeText && !/package|plan/i.test(typeText) ? typeText.replace(/_/g, ' ') : '';
  return {
    kind: 'normal',
    label: 'Normal consultation',
    detail: method,
    reference,
    line: ['Normal consultation', method, reference ? `Ref ${reference}` : ''].filter(Boolean).join(' · '),
  };
};

const amountOrNull = (value) => {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const firstPositive = (values) => {
  for (const value of values) {
    const num = amountOrNull(value);
    if (num != null && num > 0) return num;
  }
  return null;
};

const firstAmount = (values) => {
  for (const value of values) {
    const num = amountOrNull(value);
    if (num != null) return num;
  }
  return null;
};

/** Listed consultation fee. A payable of 0 does not hide a real fee stored beside it. */
export const getSlipFee = (consultation) => {
  const payment = asRecord(consultation?.payment) || {};
  const summary = asRecord(payment.summary) || asRecord(consultation?.summary) || {};
  const listed = firstPositive([
    summary.consultation_fee,
    summary.consultation_fees,
    payment.consultation_fee,
    payment.consultation_fees,
    summary.listed_amount,
    payment.listed_amount,
    consultation?.consultation_fee,
    consultation?.consultation_fees,
  ]);
  if (listed != null) return listed;
  return firstAmount([
    summary.total_payable_amount,
    payment.paid_amount,
    payment.total_amount,
    payment.amount,
    consultation?.amount,
  ]);
};

/**
 * What to print next to the visit.
 * A package booking often stores amount 0 — show that payment is done, not ₹0.
 */
export const consultationChargeLabel = (consultation) => {
  const source = getConsultationPaymentSource(consultation);
  const fee = getSlipFee(consultation);
  const payment = asRecord(consultation?.payment) || {};
  const summary = asRecord(payment.summary) || asRecord(consultation?.summary) || {};
  const payable = firstAmount([
    summary.total_payable_amount,
    payment.total_payable_amount,
    payment.paid_amount,
    payment.amount,
    consultation?.amount,
  ]);
  const settled =
    /paid|success|captured|completed/i.test(
      String(payment.status || payment.payment_status || consultation?.payment_status || summary.status || ''),
    ) || Boolean(source.reference);

  if (source.kind === 'package' && !(payable > 0)) {
    return {
      amount: null,
      note: source.line && source.line !== 'Paid through package' ? `Payment done · ${source.line}` : 'Payment done · Paid through package',
    };
  }
  if (fee != null && fee > 0) {
    return { amount: fee, note: source.line };
  }
  if ((payable === 0 || fee === 0) && settled) {
    return { amount: null, note: 'Payment done' };
  }
  if (fee === 0 || payable === 0) return { amount: 0, note: '' };
  return { amount: null, note: source.line };
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
  const charge = consultationChargeLabel(consultation);
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
    charge.amount != null && charge.amount > 0 ? `Fee: ${charge.amount}` : '',
    charge.note ? `Payment: ${charge.note}` : '',
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

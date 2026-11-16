import { formatConsultationAmount } from '../home/catalog';
import { createPlainTextPdfBytes } from '../utils/plainPdf';
import {
  buildDoctorSlipDownloadText,
  formatSlipDate,
  formatSlipStatusLabel,
  formatSlipTimeRange,
  getConsultationTitle,
  getDoctorLocationLine,
  getPatientMeta,
  consultationChargeLabel,
  isClosedNegativeStatus,
} from '../utils/doctorSlipUtils';
import { saveBrowserFile } from '../utils/prescriptionDetailUtils';
import { escapeHtml, printDocumentHtml } from './documentHtml';

const text = (value) => {
  const out = String(value ?? '').trim();
  return out || '—';
};

const note = (label, value) => {
  const body = String(value ?? '').trim();
  if (!body) return '';
  return `<div class="note"><small>${escapeHtml(label)}</small><p>${escapeHtml(body)}</p></div>`;
};

const STYLES = `
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #17302a; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.45; }
.wrap { max-width: 720px; margin: 0 auto; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 12px; border-bottom: 2px solid #0d614e; margin-bottom: 16px; }
.brand strong { display: block; font-size: 14pt; color: #0d614e; }
.brand span { color: #4b5a55; font-size: 9pt; font-family: Arial, sans-serif; }
.badge { padding: 4px 10px; border-radius: 999px; background: #e8f4ef; color: #0d614e; font-family: Arial, sans-serif; font-size: 8pt; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.badge.is-danger { background: #fef2f2; color: #b42318; }
h1 { margin: 0 0 4px; font-size: 18pt; color: #0d614e; }
.sub { margin: 0 0 16px; color: #4b5a55; font-family: Arial, sans-serif; font-size: 9pt; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; margin: 0 0 16px; padding: 12px; border: 1px solid #dceae3; border-radius: 12px; background: #f7faf8; font-family: Arial, sans-serif; }
.grid div { min-width: 0; }
.grid small { display: block; color: #4b5a55; font-size: 8pt; margin-bottom: 2px; }
.grid strong { display: block; font-size: 10pt; color: #17302a; word-break: break-word; }
.section { margin: 0 0 14px; }
.section h2 { margin: 0 0 8px; font-size: 12pt; color: #0d614e; border-bottom: 1px solid #dceae3; padding-bottom: 4px; }
.note { margin: 0 0 8px; font-family: Arial, sans-serif; }
.note small { color: #4b5a55; font-size: 8pt; }
.note p { margin: 2px 0 0; font-size: 10pt; }
.alert { margin: 0 0 14px; padding: 10px 12px; border: 1px solid #f0c2bf; border-radius: 10px; background: #fef2f2; color: #991b1b; font-family: Arial, sans-serif; font-size: 9pt; }
.meds { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 9pt; }
.meds th, .meds td { border: 1px solid #dceae3; padding: 7px 8px; text-align: left; vertical-align: top; }
.meds th { background: #e8f4ef; color: #0d614e; }
.fee { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; background: #fffdf8; border: 1px solid #ebe4d6; font-family: Arial, sans-serif; }
.fee small { display: block; margin-top: 2px; color: #4b5a55; font-size: 8pt; }
.sign { margin-top: 24px; text-align: right; font-family: Arial, sans-serif; }
.sign strong { display: block; color: #0d614e; }
.sign span { color: #4b5a55; font-size: 9pt; }
.foot { margin-top: 18px; padding-top: 10px; border-top: 1px solid #dceae3; color: #4b5a55; font-family: Arial, sans-serif; font-size: 8pt; }
`;

const medicineRows = (items = []) => {
  if (!items.length) return '';
  const rows = items
    .map((item, index) => {
      const name = text(item?.medicine_name || item?.product_name || 'Medicine');
      const instruction = String(item?.instruction || '').trim();
      return `<tr><td>${index + 1}</td><td>${escapeHtml(name)}${
        instruction ? `<div style="color:#4b5a55;margin-top:2px">${escapeHtml(instruction)}</div>` : ''
      }</td></tr>`;
    })
    .join('');
  return `<section class="section"><h2>Prescribed regimen</h2><table class="meds"><thead><tr><th style="width:48px">#</th><th>Medicine</th></tr></thead><tbody>${rows}</tbody></table></section>`;
};

/** Printable doctor-slip HTML for a consultation (includes cancelled / missed status). */
export const buildDoctorSlipHtml = ({ doctor, consultation, visitCount = 1 }) => {
  const prescription = consultation?.prescription || {};
  const medicines = Array.isArray(prescription.items) ? prescription.items : [];
  const notes = consultation?.notes || {};
  const prescriptionMerged = {
    ...prescription,
    symptom_description: prescription.symptom_description || notes.symptom_description || '',
    clinical_notes: prescription.clinical_notes || notes.clinical_notes || '',
    diagnosis_advice: prescription.diagnosis_advice || notes.diagnosis_advice || '',
    history_of_past_illness:
      prescription.history_of_past_illness || notes.history_of_past_illness || '',
  };
  const charge = consultationChargeLabel(consultation);
  const feeText =
    charge.amount != null && charge.amount > 0
      ? [formatConsultationAmount(charge.amount), charge.note].filter(Boolean).join(' · ')
      : charge.note || (charge.amount === 0 ? formatConsultationAmount(0) : '');
  const timeRange = formatSlipTimeRange(consultation?.start_time, consultation?.end_time);
  const patientMeta = getPatientMeta(consultation?.patient);
  const location = getDoctorLocationLine(doctor);
  const doctorName = text(doctor?.doctor_name || 'Doctor');
  const visitTitle = getConsultationTitle(consultation);
  const statusLabel = formatSlipStatusLabel(consultation) || 'Issued';
  const negative = isClosedNegativeStatus(consultation);
  const title = `Doctor Slip — ${doctorName}`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(
    title,
  )}</title><style>${STYLES}</style></head><body><main class="wrap">
<header class="head">
  <div class="brand"><strong>AyurMuni</strong><span>TruIndyaWellness Private Limited · Official consultation slip</span></div>
  <span class="badge${negative ? ' is-danger' : ''}">${escapeHtml(statusLabel)}</span>
</header>
<h1>Consultation Slip</h1>
<p class="sub">${escapeHtml(doctorName)}${doctor?.qualification ? ` · ${escapeHtml(doctor.qualification)}` : ''}${
    visitCount > 1 ? ` · ${visitCount} visits on file` : ''
  }</p>
${
  negative
    ? `<div class="alert">This consultation is recorded as <strong>${escapeHtml(
        statusLabel,
      )}</strong>. The slip remains available for your records.</div>`
    : ''
}
<section class="grid">
  <div><small>Physician</small><strong>${escapeHtml(doctorName)}</strong></div>
  <div><small>Date</small><strong>${escapeHtml(formatSlipDate(consultation?.appointment_date || consultation?.date))}</strong></div>
  <div><small>Patient</small><strong>${escapeHtml(text(consultation?.patient?.patient_name))}${
    patientMeta ? `<div style="color:#4b5a55;font-size:8pt;margin-top:2px">${escapeHtml(patientMeta)}</div>` : ''
  }</strong></div>
  <div><small>Time</small><strong>${escapeHtml(timeRange)}</strong></div>
  <div><small>Status</small><strong>${escapeHtml(statusLabel)}</strong></div>
  <div><small>Ref no.</small><strong>${escapeHtml(
    text(doctor?.registration_number || String(consultation?.consultation_id || '').slice(0, 8)),
  )}</strong></div>
  ${location ? `<div><small>Location</small><strong>${escapeHtml(location)}</strong></div>` : ''}
  ${
    consultation?.concern || consultation?.consultation_concern || visitTitle !== 'Consultation visit'
      ? `<div style="grid-column:1/-1"><small>Concern</small><strong>${escapeHtml(
          consultation?.concern || consultation?.consultation_concern || visitTitle,
        )}</strong></div>`
      : ''
  }
</section>
${
  prescriptionMerged.clinical_notes ||
  prescriptionMerged.diagnosis_advice ||
  prescriptionMerged.symptom_description ||
  prescriptionMerged.allergies ||
  prescriptionMerged.history_of_past_illness ||
  prescriptionMerged.family_history ||
  prescriptionMerged?.follow_up?.date
    ? `<section class="section"><h2>Clinical findings & advice</h2>
${note('Symptoms', prescriptionMerged.symptom_description)}
${note('Past illness', prescriptionMerged.history_of_past_illness)}
${note('Allergies', prescriptionMerged.allergies)}
${note('Family history', prescriptionMerged.family_history)}
${note('Clinical notes', prescriptionMerged.clinical_notes)}
${note('Diagnosis & advice', prescriptionMerged.diagnosis_advice)}
${
  prescriptionMerged?.follow_up?.date
    ? note(
        'Follow-up',
        `${formatSlipDate(prescriptionMerged.follow_up.date)}${
          prescriptionMerged.follow_up.reason ? ` · ${prescriptionMerged.follow_up.reason}` : ''
        }`,
      )
    : ''
}
</section>`
    : ''
}
${medicineRows(medicines)}
${
  feeText
    ? `<section class="section"><div class="fee"><span>Consultation fee</span><strong>${escapeHtml(
        feeText,
      )}</strong></div></section>`
    : ''
}
${consultation?.appointment_notes ? note('Appointment notes', consultation.appointment_notes) : ''}
<div class="sign"><strong>${escapeHtml(doctorName)}</strong><span>${escapeHtml(
    text(doctor?.qualification),
  )}</span>${location ? `<span>${escapeHtml(location)}</span>` : ''}</div>
<p class="foot">Computer-generated confidential consultation slip from AyurMuni. Digitally attested · No wet signature required. Unauthorised alteration is prohibited.</p>
</main></body></html>`;

  return { html, title };
};

/** Download PDF and Print PDF both use this — designed slip → print dialog (Save as PDF). */
export const openDoctorSlipPdf = async (payload) => {
  const { html, title } = buildDoctorSlipHtml(payload);
  if (await printDocumentHtml(html)) return true;

  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.document.title = title;
    setTimeout(() => {
      win.focus();
      win.print();
    }, 250);
    return true;
  }

  const code = String(
    payload?.consultation?.consultation_id ||
      payload?.consultation?.appointment_id ||
      payload?.doctor?.doctor_name ||
      'slip',
  )
    .slice(0, 24)
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  const textBody = buildDoctorSlipDownloadText(payload);
  saveBrowserFile(
    new Blob([createPlainTextPdfBytes(textBody)], { type: 'application/pdf' }),
    `Ayurmuni_Doctor_Slip_${code}.pdf`,
  );
  return true;
};

export const printDoctorSlip = openDoctorSlipPdf;
export const downloadDoctorSlipPdf = openDoctorSlipPdf;

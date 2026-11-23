// Data builders for the app's designed documents: consultation receipt
// (utils/buildConsultationDocumentPdf.ts createMedicalReceiptPdfBytes) and prescription
// (utils/prescriptionPdfBuilder.ts buildPrescriptionPdfFromData). They return the structured input
// that documentHtml.renderDocumentHtml turns into a print-ready page.
import { formatConsultationAmount } from '../home/catalog';
import { SUPPORT_PHONE_DISPLAY } from '../site/support';
import { getConsultationPaymentSource } from '../utils/doctorSlipUtils';
import {
  buildConsultationReceiptBillRows,
  parseConsultationReceiptBreakdown,
  rupeesToPaise,
} from '../utils/consultationReceiptUtils';
import { formatConsultationId, formatPrescriptionId, formatReceiptId } from '../utils/formatDisplayId';
import {
  formatIssuedLabel,
  getAllergiesList,
  getClinicalAdvisory,
  getConcernText,
  getDiagnosisText,
  getDietAdvice,
  getDoctorLocationLine,
  getDoList,
  getDontList,
  getFamilyHistoryText,
  getFollowUpInfo,
  getGynaecologicalLines,
  getMedicineItems,
  getMedicineQuantity,
  getMedicineScheduleChips,
  getPastIllnessText,
  getPaymentAmount,
  getPersonalHistoryLines,
  getRecommendedDietPlans,
  getSuggestionList,
  getSymptomDescription,
  normalizePrescriptionPayload,
  parseAmount,
} from '../utils/prescriptionDetailUtils';

/** @typedef {{ title: string, lines: string[] }} AddressBlock */
/** @typedef {object} StructuredDocumentInput */

export const pick = (...values) => {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
};

export const money = (value) => {
  if (value == null || value === '') return '-';
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : '-';
};

const joinAddress = (address) => {
  if (!address || typeof address !== 'object') {
    return typeof address === 'string' ? address.trim() : '';
  }
  return [
    address.address_line_1,
    address.address_line_2,
    address.line1,
    address.line2,
    address.street,
    address.city,
    address.state,
    address.zipcode,
    address.pincode,
    address.postal_code,
    address.country,
  ]
    .map((part) => (part != null ? String(part).trim() : ''))
    .filter(Boolean)
    .join(', ');
};

/** Same seller block as the order invoice (used when the API omits wellness fields). */
export const INVOICE_SELLER_FALLBACK = {
  wellness_name: 'TruIndyaWellness Private Limited',
  company_name: 'TruIndyaWellness Private Limited',
  seller_address:
    'C-158, Amar Gyan Industrial Estate, Khopat, Thane Maharashtra - 400601, Maharashtra (27), India',
  seller_phone: SUPPORT_PHONE_DISPLAY,
  gstin: 'GSTIN',
  company_email: 'https://ayurmuni.com/',
};

export const mergeWithInvoiceSellerDefaults = (source) => ({
  ...INVOICE_SELLER_FALLBACK,
  ...source,
  wellness: source?.wellness ??
    source?.wellness_info ??
    source?.seller ?? {
      name: INVOICE_SELLER_FALLBACK.wellness_name,
      company_name: INVOICE_SELLER_FALLBACK.company_name,
      address: INVOICE_SELLER_FALLBACK.seller_address,
      phone: INVOICE_SELLER_FALLBACK.seller_phone,
      gstin: INVOICE_SELLER_FALLBACK.gstin,
      email: INVOICE_SELLER_FALLBACK.company_email,
    },
});

export const INVOICE_DECLARATION = [
  '1. All claims, if any, for shortages or damages must be reported to customer service on the day of delivery through the contact us page on the web store.',
  '2. All Disputes are subject to Maharashtra (27) jurisdiction only.',
];

export const INVOICE_FOOTER = 'This is a computer generated Invoice';

const INVOICE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 23-Nov-2026. Strings that are already in that shape are kept. */
export const formatInvoiceDate = (value) => {
  if (value == null || value === '') return '';
  const raw = value instanceof Date ? '' : String(value).trim();
  if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(raw)) return raw;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return raw;
  return `${String(date.getDate()).padStart(2, '0')}-${INVOICE_MONTHS[date.getMonth()]}-${date.getFullYear()}`;
};

export const buildWellnessFromBlock = (source, options = {}) => {
  const merged = mergeWithInvoiceSellerDefaults(source);
  const wellness =
    merged.wellness ?? merged.wellness_info ?? merged.seller ?? merged.vendor ?? merged.company ?? merged.clinic ?? {};
  const name = pick(
    wellness?.name,
    wellness?.company_name,
    wellness?.wellness_name,
    wellness?.business_name,
    merged?.wellness_name,
    merged?.company_name,
    merged?.seller_name,
    merged?.vendor_name,
    INVOICE_SELLER_FALLBACK.wellness_name,
  );
  const address = joinAddress(wellness?.address ?? merged?.seller_address ?? merged?.company_address ?? wellness);
  const phone = pick(
    wellness?.phone,
    wellness?.phone_number,
    wellness?.tel,
    merged?.seller_phone,
    merged?.company_phone,
    INVOICE_SELLER_FALLBACK.seller_phone,
  );
  const gstin = pick(
    wellness?.gstin,
    wellness?.gst_number,
    wellness?.gst_no,
    merged?.gstin,
    merged?.gst_number,
    INVOICE_SELLER_FALLBACK.gstin,
  );
  const email = pick(wellness?.email, merged?.seller_email, merged?.company_email, INVOICE_SELLER_FALLBACK.company_email);
  const gstinText = gstin && !/^gstin$/i.test(gstin) ? gstin : '';
  const lines = [name];
  if (address) lines.push(address);
  if (phone) lines.push(`${options.phoneLabel || 'Tel'}: ${phone}`);
  if (gstinText) lines.push(`GSTIN: ${gstinText}`);
  else if (options.showEmptyGstin) lines.push('GSTIN:');
  if (email && !/^https?:\/\//i.test(email)) lines.push(email);
  return { title: options.title || 'From', lines };
};

/** Seller block used by every tax invoice (product, diet, consultation). */
export const invoiceSellerBlock = (source) =>
  buildWellnessFromBlock(source, { title: 'Sender:', phoneLabel: 'T', showEmptyGstin: true });

export const buildBillToBlock = (source) => {
  const patient = source?.patient ?? source?.billing_address ?? source?.customer ?? source?.user ?? {};
  const name = pick(
    source?.patient_name,
    patient?.patient_name,
    patient?.name,
    patient?.full_name,
    source?.customer_name,
    source?.billing_name,
  );
  const address = joinAddress(
    patient?.address ?? patient?.billing_address ?? source?.billing_address ?? source?.patient_address,
  );
  const phone = pick(patient?.phone_number, patient?.phone, source?.patient_phone, source?.billing_phone);
  const email = pick(patient?.email, source?.patient_email);
  const lines = [name || '-'];
  if (address) lines.push(address);
  if (phone) lines.push(`Phone: ${phone}`);
  if (email) lines.push(`Email: ${email}`);
  return { title: 'Bill To', lines };
};

export const buildShipToBlock = (source) => {
  const ship = source?.ship_to ?? source?.shipping_address ?? source?.delivery_address ?? null;
  const hospitalName = pick(source?.hospital_name, source?.clinic_name, source?.clinic?.name, ship?.name);
  const address = joinAddress(ship ?? source?.clinic_address ?? source?.hospital_address);
  const lines = [hospitalName, address].filter(Boolean);
  if (!lines.length) return null;
  return { title: ship?.title ? String(ship.title) : 'Ship To', lines };
};

const buildPatientShipTo = (patient) => {
  if (!patient) return null;
  const name = pick(patient?.patient_name, patient?.name);
  const address =
    typeof patient?.address === 'string'
      ? patient.address
      : [patient?.address?.address_line_1, patient?.address?.city, patient?.address?.state, patient?.pincode]
          .filter(Boolean)
          .join(', ');
  const lines = [name, address].filter(Boolean);
  return lines.length ? { title: 'Ship To', lines } : null;
};

const feeLine = (sno, description, amount, tax = '0.00') => ({
  sno,
  description,
  qty: 1,
  rate: money(amount),
  taxableValue: money(amount),
  tax,
  total: money(amount),
});

/** Consultation receipt (MedicalReceipt page). */
export const buildReceiptDocument = (receipt) => {
  const specializationText = Array.isArray(receipt?.info?.doctor_specialization)
    ? receipt.info.doctor_specialization.join(', ')
    : receipt?.info?.doctor_specialization || '';
  const doctorName = pick(receipt?.info?.doctor_name, receipt?.doctor_name);
  const breakdown = parseConsultationReceiptBreakdown(receipt);
  const { consultationFee, platformFee, gstAmount, discount, convenienceFee } = breakdown;
  const adminFee = breakdown.administrativeCharges || 0;
  const digitalFee = breakdown.digitalReportAccess || 0;
  const grandTotal = breakdown.packageFunded
    ? 0
    : breakdown.totalPaid > 0
      ? breakdown.totalPaid
      : consultationFee - discount + platformFee + convenienceFee + gstAmount + adminFee + digitalFee;

  const billRows = buildConsultationReceiptBillRows(breakdown);
  const lineItems = billRows.map((row, index) => {
    const signed = row.effect === 'subtract' ? -row.amount : row.amount;
    const description =
      row.key === 'consultation_fee' && specializationText
        ? `Online Consultation - ${specializationText}`
        : row.key === 'consultation_fee'
          ? 'Online Consultation'
          : row.label;
    const tax = row.key === 'gst' ? money(row.amount) : '0.00';
    return feeLine(index + 1, description, signed, tax);
  });

  const taxableSum = consultationFee - discount + platformFee + convenienceFee + adminFee + digitalFee;
  const patient = receipt?.patient ?? {};
  const paymentId = pick(breakdown.paymentId, receipt?.payment_id, receipt?.consultation_id);
  const paymentSourceLine = getConsultationPaymentSource(receipt).line;
  const status = breakdown.paymentStatus
    ? breakdown.paymentStatus.charAt(0).toUpperCase() + breakdown.paymentStatus.slice(1)
    : '';

  const billTo = buildBillToBlock({
    ...receipt,
    patient_name: receipt?.patient_name || receipt?.patient?.name,
    patient,
  });
  const shipTo = buildShipToBlock(receipt) ?? buildPatientShipTo(patient) ?? {
    title: 'Ship To',
    lines: billTo.lines.filter((line) => line && line !== '-'),
  };

  return {
    variant: 'invoice',
    documentHeading: 'CONSULTATION RECEIPT',
    from: invoiceSellerBlock(mergeWithInvoiceSellerDefaults(receipt)),
    billTo,
    shipTo,
    leftMeta: [
      {
        label: 'Invoice Date',
        value: formatInvoiceDate(pick(receipt?.date, receipt?.paid_at, breakdown.paidAt)) || '-',
      },
      { label: 'Invoice Code', value: formatReceiptId(paymentId) },
      ...(breakdown.paymentId ? [{ label: 'Payment ID', value: breakdown.paymentId }] : []),
      ...(breakdown.orderId ? [{ label: 'Order ID', value: breakdown.orderId }] : []),
    ],
    rightMeta: [
      { label: 'Consultation No', value: formatConsultationId(receipt?.consultation_id) },
      { label: 'Doctor', value: doctorName || '-' },
      { label: 'Payment Method', value: breakdown.paymentMethod || '-' },
      ...(breakdown.packageName ? [{ label: 'Package', value: breakdown.packageName }] : []),
      ...(breakdown.packageId ? [{ label: 'Package ID', value: breakdown.packageId }] : []),
      ...(paymentSourceLine ? [{ label: 'Payment source', value: paymentSourceLine }] : []),
      ...(status ? [{ label: 'Payment Status', value: status }] : []),
      ...(breakdown.bank ? [{ label: 'Bank', value: breakdown.bank }] : []),
      ...(breakdown.bankTransactionId ? [{ label: 'Bank Txn ID', value: breakdown.bankTransactionId }] : []),
    ],
    lineItems,
    totals: [
      { label: 'Qty', value: String(lineItems.length) },
      { label: 'Rate', value: '-' },
      { label: 'Taxable', value: money(taxableSum) },
      ...(rupeesToPaise(gstAmount) !== 0 ? [{ label: 'GST', value: money(gstAmount) }] : []),
      { label: 'Grand Total', value: money(grandTotal) },
    ],
    signatoryFor: doctorName || INVOICE_SELLER_FALLBACK.wellness_name,
    showSignature: true,
    declaration: INVOICE_DECLARATION,
    leftMetaTitle: 'Invoice Details-',
    footerNote: INVOICE_FOOTER,
  };
};

const PRESCRIPTION_COLUMNS = [
  { key: 'sno', label: 'S.No', width: 8 },
  { key: 'description', label: 'Prescribed Medicine', width: 46 },
  { key: 'qty', label: 'Qty', width: 10, numeric: true },
  { key: 'directions', label: 'Directions', width: 36 },
];

const buildMedicineRow = (med, index) => {
  const name = pick(med?.medicine_name, med?.name, med?.product_name, med?.title) || `Medicine ${index + 1}`;
  const subtitle = pick(med?.product_name, med?.description, med?.brand_name, med?.composition);
  const subtitleLine = subtitle && subtitle.toLowerCase() !== name.toLowerCase() ? ` (${subtitle})` : '';
  const schedule = (getMedicineScheduleChips(med) || []).map((chip) => `${chip.caption}: ${chip.label}`).join(', ');
  const instruction = pick(med?.instruction, med?.instructions, med?.notes, med?.advice);
  const qty = getMedicineQuantity(med);
  return {
    sno: index + 1,
    description: `${name}${subtitleLine}`,
    qty: String(qty),
    directions: [schedule, instruction].filter(Boolean).join(' | ') || '-',
  };
};

const pushSection = (sections, title, lines, bullet = false) => {
  const filtered = (lines || []).map((line) => String(line).trim()).filter(Boolean);
  if (filtered.length) sections.push({ title, lines: filtered, bullet });
};

const buildPaymentMeta = (data, appointment) => {
  const method = pick(data?.payment?.payment_method, data?.payment?.mode, appointment?.payment?.payment_method);
  const status = pick(data?.payment?.payment_status, data?.payment?.status, appointment?.payment?.payment_status);
  const parts = [method ? `Method: ${method}` : '', status ? `Status: ${status}` : ''].filter(Boolean);
  return parts.join(' - ') || '-';
};

/** Full prescription document (PrescriptionDetail page), mirrors the app's prescription PDF. */
export const buildPrescriptionDocument = (data) => {
  const normalized = normalizePrescriptionPayload(data);
  const prescription = normalized.prescription;
  const doctor = normalized.doctor ?? data?.doctor ?? {};
  const patient = normalized.patient ?? data?.patient ?? {};
  const appointment = normalized.appointment ?? data?.appointment ?? {};

  const doctorName = pick(doctor?.doctor_name, doctor?.name, doctor?.full_name, data?.info?.doctor_name);
  const specialization = Array.isArray(doctor?.doctor_specialization)
    ? doctor.doctor_specialization.join(', ')
    : pick(doctor?.doctor_specialization, doctor?.specialization);

  const rows = getMedicineItems(prescription).map(buildMedicineRow);
  const lineItems = rows.length
    ? rows
    : [{ sno: 1, description: 'No medicines prescribed', qty: '-', directions: '-' }];

  const concernText = getConcernText(data);
  const diagnosisText = getDiagnosisText(prescription);
  const symptomText = getSymptomDescription(prescription);
  const appointmentNotes = pick(appointment?.appointment_notes, data?.appointment_notes);
  const followUp = getFollowUpInfo(prescription, appointment);
  const dietPlans = getRecommendedDietPlans(data);
  const doctorLocation = getDoctorLocationLine(doctor);

  const sections = [];
  if (concernText) pushSection(sections, 'Chief Complaint', [concernText]);
  if (
    diagnosisText &&
    diagnosisText.toLowerCase() !== concernText.toLowerCase() &&
    diagnosisText.toLowerCase() !== symptomText.toLowerCase()
  ) {
    pushSection(sections, 'Diagnosis', [diagnosisText]);
  }
  if (appointmentNotes) pushSection(sections, 'Notes', [appointmentNotes]);
  if (followUp?.hasContent) {
    pushSection(
      sections,
      'Follow-up',
      [
        followUp.dateLabel ? `Date: ${followUp.dateLabel}` : '',
        followUp.reason ? `Reason: ${followUp.reason}` : '',
        followUp.notes ? `Notes: ${followUp.notes}` : '',
        followUp.status ? `Status: ${followUp.status}` : '',
      ].filter(Boolean),
    );
  }
  if (symptomText) pushSection(sections, 'Symptoms', [symptomText]);
  pushSection(sections, 'Allergies', getAllergiesList(prescription), true);
  const pastIllness = getPastIllnessText(prescription);
  if (pastIllness) pushSection(sections, 'Past Illness', [pastIllness]);
  const familyHistory = getFamilyHistoryText(prescription);
  if (familyHistory) pushSection(sections, 'Family History', [familyHistory]);
  pushSection(sections, 'Personal History', getPersonalHistoryLines(prescription));
  pushSection(sections, 'Gynaecological History', getGynaecologicalLines(prescription));
  if (dietPlans?.length) {
    pushSection(
      sections,
      'Recommended Diet Plans',
      dietPlans.map((plan) =>
        [
          pick(plan?.name, plan?.title, plan?.diet_name) || 'Diet Plan',
          plan?.avg_daily_calories != null ? `~${Math.round(Number(plan.avg_daily_calories))} kcal/day` : '',
          plan?.meals_per_day != null ? `${plan.meals_per_day} meals/day` : '',
        ]
          .filter(Boolean)
          .join(' - '),
      ),
      true,
    );
  }
  pushSection(sections, 'Diet Advice', getDietAdvice(prescription), true);
  pushSection(sections, 'Patient Instructions', getSuggestionList(prescription), true);
  pushSection(sections, "Do's", getDoList(prescription), true);
  pushSection(sections, "Don'ts", getDontList(prescription), true);
  const advisory = getClinicalAdvisory(prescription);
  if (advisory) pushSection(sections, 'Clinical Observations', [advisory]);

  const phone = pick(doctor?.phone, doctor?.mobile, doctor?.contact_number);
  pushSection(
    sections,
    'Prescribing Physician',
    [
      doctorName || 'Doctor',
      specialization ? `Specialization: ${specialization}` : '',
      doctorLocation ? `Location: ${doctorLocation}` : '',
      phone ? `Phone: ${phone}` : '',
      doctor?.email ? `Email: ${doctor.email}` : '',
    ].filter(Boolean),
  );

  const paymentAmount = parseAmount(getPaymentAmount(data));
  if (paymentAmount != null) {
    pushSection(sections, 'Consultation amount', [formatConsultationAmount(paymentAmount)]);
  }

  const billTo = buildBillToBlock({
    ...data,
    patient_name: pick(patient?.patient_name, patient?.name),
    patient,
  });
  const demographics = [
    patient?.age != null ? `Age ${patient.age}` : '',
    patient?.gender ? String(patient.gender) : '',
    patient?.relation ? String(patient.relation) : '',
  ]
    .filter(Boolean)
    .join(' - ');
  if (demographics) billTo.lines.splice(1, 0, demographics);

  return {
    documentHeading: 'PRESCRIPTION',
    from: buildWellnessFromBlock(mergeWithInvoiceSellerDefaults(data)),
    billTo,
    shipTo:
      buildShipToBlock({ ...data, delivery_address: patient?.address ?? patient?.delivery_address, patient }) ??
      buildPatientShipTo(patient),
    leftMeta: [
      {
        label: 'Issued Date',
        value:
          formatIssuedLabel(
            pick(
              appointment?.appointment_date,
              appointment?.date,
              prescription?.issued_on,
              prescription?.created_at,
              normalized.issuedOn,
            ),
          ) || '-',
      },
      {
        label: 'Prescription Code',
        value: formatPrescriptionId(pick(prescription?.prescription_code, prescription?.id, normalized.prescriptionId)),
      },
      { label: 'Payment', value: buildPaymentMeta(data, appointment) },
    ],
    rightMeta: [
      {
        label: 'Consultation No',
        value: formatConsultationId(pick(appointment?.consultation_id, normalized.consultationId, appointment?.id)),
      },
      { label: 'Doctor', value: doctorName || '-' },
      { label: 'Specialization', value: specialization || '-' },
    ],
    columns: PRESCRIPTION_COLUMNS,
    hideTotals: true,
    lineItems,
    sections,
    signatoryFor: doctorName || 'Doctor',
    showSignature: true,
    hideDeclaration: true,
    footerNote: 'This is a computer generated Prescription.',
  };
};

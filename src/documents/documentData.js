// Data builders for the app's designed documents: consultation receipt
// (utils/buildConsultationDocumentPdf.ts createMedicalReceiptPdfBytes) and prescription
// (utils/prescriptionPdfBuilder.ts buildPrescriptionPdfFromData). They return the structured input
// that documentHtml.renderDocumentHtml turns into a print-ready page.
import { formatRupee } from '../home/catalog';
import { parseConsultationReceiptBreakdown } from '../utils/consultationReceiptUtils';
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
  getMedicineMrp,
  getMedicineQuantity,
  getMedicineScheduleChips,
  getMedicineUnitPrice,
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
    'C-158,Amar Gyan Industrial Estate, Khopat, Thane Maharashtra - 400601, Maharashtra (27), India',
  seller_phone: '+91 94180 12698',
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

export const buildWellnessFromBlock = (source) => {
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
  const lines = [name];
  if (address) lines.push(address);
  if (phone) lines.push(`Tel: ${phone}`);
  if (gstin) lines.push(`GSTIN: ${gstin}`);
  if (email) lines.push(email);
  return { title: 'From', lines };
};

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
  const { consultationFee, platformFee, gstAmount } = breakdown;
  const adminFee = Number(receipt?.administrative_charges ?? 0) || 0;
  const digitalFee = Number(receipt?.digital_report_access ?? 0) || 0;
  const grandTotal =
    breakdown.totalPaid > 0
      ? breakdown.totalPaid
      : consultationFee + platformFee + gstAmount + adminFee + digitalFee;

  const lineItems = [
    feeLine(1, `Online Consultation${specializationText ? ` - ${specializationText}` : ''}`, consultationFee),
  ];
  if (platformFee > 0) lineItems.push(feeLine(lineItems.length + 1, 'Platform Fee', platformFee));
  if (gstAmount > 0) lineItems.push(feeLine(lineItems.length + 1, 'GST', gstAmount, money(gstAmount)));
  if (adminFee > 0) lineItems.push(feeLine(lineItems.length + 1, 'Administrative Charges', adminFee));
  if (digitalFee > 0) lineItems.push(feeLine(lineItems.length + 1, 'Digital Report Access', digitalFee));

  const taxableSum = consultationFee + platformFee + adminFee + digitalFee;
  const patient = receipt?.patient ?? {};
  const paymentId = pick(breakdown.paymentId, receipt?.payment_id, receipt?.consultation_id);
  const status = breakdown.paymentStatus
    ? breakdown.paymentStatus.charAt(0).toUpperCase() + breakdown.paymentStatus.slice(1)
    : '';

  return {
    documentHeading: 'CONSULTATION RECEIPT',
    from: buildWellnessFromBlock(mergeWithInvoiceSellerDefaults(receipt)),
    billTo: buildBillToBlock({ ...receipt, patient_name: receipt?.patient_name || receipt?.patient?.name, patient }),
    shipTo: buildShipToBlock(receipt) ?? buildPatientShipTo(patient),
    leftMeta: [
      { label: 'Receipt Date', value: pick(receipt?.date, receipt?.paid_at, breakdown.paidAt) || '-' },
      { label: 'Receipt Code', value: formatReceiptId(paymentId) },
      ...(breakdown.paymentId ? [{ label: 'Payment ID', value: breakdown.paymentId }] : []),
      ...(breakdown.orderId ? [{ label: 'Order ID', value: breakdown.orderId }] : []),
    ],
    rightMeta: [
      { label: 'Consultation No', value: formatConsultationId(receipt?.consultation_id) },
      { label: 'Doctor', value: doctorName || '-' },
      { label: 'Payment Method', value: breakdown.paymentMethod || '-' },
      ...(status ? [{ label: 'Payment Status', value: status }] : []),
      ...(breakdown.bank ? [{ label: 'Bank', value: breakdown.bank }] : []),
      ...(breakdown.bankTransactionId ? [{ label: 'Bank Txn ID', value: breakdown.bankTransactionId }] : []),
    ],
    lineItems,
    totals: [
      { label: 'Qty', value: String(lineItems.length) },
      { label: 'Rate', value: '-' },
      { label: 'Taxable', value: money(taxableSum) },
      { label: 'GST', value: money(gstAmount) },
      { label: 'Grand Total', value: money(grandTotal) },
    ],
    signatoryFor: doctorName || INVOICE_SELLER_FALLBACK.wellness_name,
    showSignature: true,
    hideDeclaration: true,
    footerNote: 'THIS IS A COMPUTER GENERATED RECEIPT. NO PHYSICAL SIGNATURE REQUIRED.',
  };
};

const buildMedicineRow = (med, index) => {
  const name = pick(med?.medicine_name, med?.name, med?.product_name, med?.title) || `Medicine ${index + 1}`;
  const subtitle = pick(med?.product_name, med?.description, med?.brand_name, med?.composition);
  const subtitleLine = subtitle && subtitle.toLowerCase() !== name.toLowerCase() ? ` (${subtitle})` : '';
  const schedule = (getMedicineScheduleChips(med) || []).map((chip) => `${chip.caption}: ${chip.label}`).join(', ');
  const instruction = pick(med?.instruction, med?.instructions, med?.notes, med?.advice);
  const unitPrice = getMedicineUnitPrice(med);
  const unitMrp = getMedicineMrp(med);
  const qty = getMedicineQuantity(med);
  const lineTotal = unitPrice != null ? unitPrice * qty : null;
  const lineMrp = (unitMrp ?? unitPrice ?? 0) * qty;
  const mrpNote = unitMrp != null && unitPrice != null && unitMrp > unitPrice ? `MRP ${money(unitMrp)}` : '';
  return {
    sno: index + 1,
    description: [name + subtitleLine, schedule, instruction, mrpNote].filter(Boolean).join(' | '),
    qty: String(qty),
    rate: unitPrice != null ? money(unitPrice) : '-',
    taxableValue: lineTotal != null ? money(lineTotal) : '-',
    tax: '0.00',
    total: lineTotal != null ? money(lineTotal) : '-',
    qtyNum: qty,
    lineTotalNum: lineTotal ?? 0,
    lineMrpNum: lineTotal != null ? lineMrp : 0,
  };
};

const pushSection = (sections, title, lines, bullet = false) => {
  const filtered = (lines || []).map((line) => String(line).trim()).filter(Boolean);
  if (filtered.length) sections.push({ title, lines: filtered, bullet });
};

const buildPaymentMeta = (data, appointment) => {
  const amount = getPaymentAmount(data);
  const method = pick(data?.payment?.payment_method, data?.payment?.mode, appointment?.payment?.payment_method);
  const status = pick(data?.payment?.payment_status, data?.payment?.status, appointment?.payment?.payment_status);
  const parts = [
    amount != null ? `Amount: ${formatRupee(amount, { decimals: 2 })}` : '',
    method ? `Method: ${method}` : '',
    status ? `Status: ${status}` : '',
  ].filter(Boolean);
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
  const totalSum = rows.reduce((sum, row) => sum + row.lineTotalNum, 0);
  const mrpSum = rows.reduce((sum, row) => sum + row.lineMrpNum, 0);
  const totalQty = rows.reduce((sum, row) => sum + row.qtyNum, 0);

  const lineItems = rows.length
    ? rows.map(({ lineTotalNum, lineMrpNum, qtyNum, ...row }) => row) // eslint-disable-line no-unused-vars
    : [{ sno: 1, description: 'No medicines prescribed', qty: '-', rate: '-', taxableValue: '-', tax: '-', total: '-' }];

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

  if (totalSum > 0) {
    const discount = mrpSum - totalSum;
    pushSection(sections, 'Medicine Price Summary', [
      `Total quantity: ${totalQty}`,
      `Total MRP: ${formatRupee(mrpSum, { decimals: 2 })}`,
      discount > 0 ? `Discount: - ${formatRupee(discount, { decimals: 2 })}` : '',
      `Total amount: ${formatRupee(totalSum, { decimals: 2 })}`,
    ]);
  }

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
  const grandTotal = totalSum > 0 ? money(totalSum) : paymentAmount != null ? money(paymentAmount) : '-';

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
    lineItems,
    totals: [
      { label: 'Qty', value: rows.length ? String(totalQty) : '-' },
      { label: 'Rate', value: '-' },
      { label: 'Taxable', value: grandTotal },
      { label: 'IGST', value: '0.00' },
      { label: 'Grand Total', value: grandTotal },
    ],
    sections,
    signatoryFor: doctorName || 'Doctor',
    showSignature: true,
    hideDeclaration: true,
    footerNote: 'This is a computer generated Prescription.',
  };
};

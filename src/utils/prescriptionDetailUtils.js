const DEFAULT_RX_VALIDITY_DAYS = 30;

const parseDurationDays = (value) => {
  if (value == null) return 0;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return 0;
  const num = Number.parseFloat(raw);
  if (/week/.test(raw) && Number.isFinite(num)) return Math.round(num * 7);
  if (/month/.test(raw) && Number.isFinite(num)) return Math.round(num * 30);
  if (Number.isFinite(num)) return Math.round(num);
  return 0;
};

export const getPrescriptionExpiry = (prescription, issuedOn, medicines = []) => {
  const explicit =
    prescription?.expiry_date ||
    prescription?.valid_until ||
    prescription?.valid_till ||
    prescription?.expires_at ||
    prescription?.validity_date ||
    null;
  const issued = issuedOn ? new Date(issuedOn) : null;
  const issuedValid = issued && !Number.isNaN(issued.getTime());

  let expiresAt = explicit ? new Date(explicit) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) expiresAt = null;

  if (!expiresAt && issuedValid) {
    const durationDays = medicines.reduce((max, item) => {
      const days = parseDurationDays(item?.duration ?? item?.days ?? item?.no_of_days);
      return Math.max(max, days);
    }, 0);
    const days = Math.max(DEFAULT_RX_VALIDITY_DAYS, durationDays);
    expiresAt = new Date(issued);
    expiresAt.setDate(expiresAt.getDate() + days);
  }

  if (!expiresAt) {
    return { label: '', expired: false, daysLeft: null, date: null };
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfExpiry = new Date(expiresAt.getFullYear(), expiresAt.getMonth(), expiresAt.getDate()).getTime();
  const daysLeft = Math.round((startOfExpiry - startOfToday) / 86400000);
  return {
    date: expiresAt,
    label: formatIssuedLabel(expiresAt),
    expired: daysLeft < 0,
    daysLeft,
  };
};

export const formatIssuedLabel = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const hasPrescriptionItems = (consultation) =>
  Array.isArray(consultation?.prescription?.items) &&
  consultation.prescription.items.length > 0;

export const hasPrescribedData = (consultation) => {
  const rx = consultation?.prescription;
  if (!rx || typeof rx !== 'object') return false;
  if (hasPrescriptionItems(consultation)) return true;
  const textFields = [
    rx.symptom_description,
    rx.history_of_past_illness,
    rx.allergies,
    rx.family_history,
    rx.clinical_notes,
    rx.diagnosis_advice,
    rx.diet_advice,
    rx.dietary_advice,
    rx.follow_up?.date,
    rx.follow_up?.reason,
  ];
  if (textFields.some((value) => typeof value === 'string' && value.trim().length > 0)) {
    return true;
  }
  const listFields = [
    rx.diet,
    rx.dos,
    rx.donts,
    rx["do's"],
    rx["don'ts"],
    rx.suggestions,
    rx.do_and_dont?.dos,
    rx.do_and_dont?.donts,
    rx.lifestyle?.["do's"],
    rx.lifestyle?.["don'ts"],
    rx.lifestyle?.diet,
  ];
  return listFields.some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return false;
  });
};

export const getDoctorLocationLine = (doctor) => {
  if (!doctor) return '';
  return [doctor.address_line, doctor.city, doctor.state, doctor.pincode]
    .filter(Boolean)
    .join(', ');
};

export const asAdviceList = (value) => {
  if (value == null) return [];
  if (typeof value === 'string') {
    return value
      .split(/\n|•|;|\|/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item == null) return '';
        if (typeof item === 'string' || typeof item === 'number') return String(item).trim();
        return String(
          item.name ??
            item.title ??
            item.text ??
            item.advice ??
            item.instruction ??
            item.description ??
            '',
        ).trim();
      })
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    return asAdviceList(
      value.items ?? value.list ?? value.values ?? value.advice ?? value.text ?? null,
    );
  }
  return [];
};

export const getPrescriptionRoot = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  return (
    payload.prescription ||
    payload.appointment?.prescription ||
    payload.data?.prescription ||
    null
  );
};

export const normalizePrescriptionPayload = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return {
      appointmentId: null,
      consultationId: null,
      prescriptionId: null,
      doctor: null,
      patient: null,
      appointment: null,
      prescription: null,
      issuedOn: null,
      status: null,
    };
  }

  const isSlipItem = !!raw.prescription || !!raw.appointment_date || !!raw.consultation_id;
  const appointment = raw.appointment || (isSlipItem ? raw : null);
  const doctor = raw.doctor || null;
  const patient = appointment?.patient || raw.patient || raw.appointment?.patient || null;
  const prescription = getPrescriptionRoot(raw) || getPrescriptionRoot(appointment);
  const appointmentId =
    String(appointment?.appointment_id || raw.appointment_id || appointment?.id || '').trim() ||
    null;
  const consultationId =
    String(appointment?.consultation_id || raw.consultation_id || '').trim() || null;

  return {
    appointmentId,
    consultationId,
    prescriptionId:
      String(
        prescription?.id ||
          prescription?.prescription_id ||
          raw?.prescription_id ||
          raw?.id ||
          '',
      ).trim() || null,
    doctor,
    patient,
    appointment: appointment || raw,
    prescription,
    issuedOn:
      appointment?.appointment_date ||
      raw.appointment_date ||
      raw.date ||
      prescription?.issued_on ||
      prescription?.created_at ||
      null,
    status: appointment?.appointment_status || raw.appointment_status || prescription?.status || null,
  };
};

export const getMedicineItems = (prescription) => {
  if (!prescription) return [];
  if (Array.isArray(prescription.items)) return prescription.items;
  if (Array.isArray(prescription.medicines)) return prescription.medicines;
  if (Array.isArray(prescription.medicine_items)) return prescription.medicine_items;
  if (Array.isArray(prescription.prescribed_medicines)) return prescription.prescribed_medicines;
  return [];
};

const isBareNumber = (value) => /^\d+(\.\d+)?$/.test(value.trim());

export const formatMedicineDosage = (value) => {
  if (value == null || String(value).trim() === '') return '';
  const raw = String(value).trim();
  if (!isBareNumber(raw)) return raw;
  return `${raw} mg`;
};

export const formatMedicineFrequency = (value) => {
  if (value == null || String(value).trim() === '') return '';
  const raw = String(value).trim();
  const lower = raw.toLowerCase();
  if (lower.includes('day') || lower.includes('time') || lower.includes('hour') || lower.includes('/')) {
    return raw;
  }
  if (isBareNumber(raw)) {
    const n = Number(raw);
    return n === 1 ? '1 time / day' : `${n} times / day`;
  }
  return raw;
};

export const formatMedicineDuration = (value) => {
  if (value == null || String(value).trim() === '') return '';
  const raw = String(value).trim();
  const lower = raw.toLowerCase();
  if (lower.includes('day') || lower.includes('week') || lower.includes('month')) return raw;
  if (isBareNumber(raw)) {
    const n = Number(raw);
    return n === 1 ? '1 day' : `${n} days`;
  }
  return raw;
};

export const getMedicineScheduleChips = (medicine) => {
  if (!medicine || typeof medicine !== 'object') return [];
  const chips = [];
  const dosage = formatMedicineDosage(medicine.dosage);
  if (dosage) chips.push({ key: 'dose', caption: 'Dose', label: dosage });
  const frequency = formatMedicineFrequency(medicine.frequency);
  if (frequency) chips.push({ key: 'freq', caption: 'Frequency', label: frequency });
  const duration = formatMedicineDuration(medicine.duration);
  if (duration) chips.push({ key: 'dur', caption: 'Duration', label: duration });
  if (medicine.quantity != null && String(medicine.quantity).trim() !== '') {
    chips.push({ key: 'qty', caption: 'Qty', label: String(medicine.quantity) });
  }
  return chips;
};

export const getMedicinePrice = (medicine) => {
  if (!medicine || typeof medicine !== 'object') return null;
  const candidates = [
    medicine.selling_price,
    medicine.price,
    medicine.mrp,
    medicine.amount,
    medicine.unit_price,
    medicine.total_price,
  ];
  for (const value of candidates) {
    if (value != null && String(value).trim() !== '') return value;
  }
  return null;
};

export const getRecommendedDietPlans = (payload) => {
  if (!payload || typeof payload !== 'object') return [];
  const lists = [
    payload.diets,
    payload.appointment?.diets,
    payload.prescription?.diets,
    payload.recommended_diets,
  ];
  for (const list of lists) {
    if (Array.isArray(list) && list.length) return list.filter(Boolean);
  }
  return [];
};

export const getPaymentAmount = (payload) => {
  const payment =
    payload?.payment || payload?.appointment?.payment || payload?.consultation?.payment || null;
  if (!payment) return null;
  return payment.consultation_fee ?? payment.amount ?? payment.total_amount ?? payment.paid_amount ?? null;
};

export const getConcernText = (payload) => {
  const normalized = normalizePrescriptionPayload(payload);
  return String(
    normalized.appointment?.concern ||
      payload?.concern ||
      normalized.prescription?.symptom_description ||
      normalized.prescription?.diagnosis ||
      normalized.prescription?.chief_complaint ||
      '',
  ).trim();
};

export const getDiagnosisText = (prescription) => {
  if (!prescription) return '';
  return String(
    prescription.diagnosis_advice ||
      prescription.diagnosis ||
      prescription.provisional_diagnosis ||
      prescription.clinical_diagnosis ||
      prescription.condition ||
      '',
  ).trim();
};

export const getDietAdvice = (prescription) => {
  if (!prescription) return [];
  return asAdviceList(
    prescription.diet ||
      prescription.diet_advice ||
      prescription.dietary_advice ||
      prescription.diet_recommendations ||
      prescription.suggested_diet ||
      prescription.diet_plan ||
      prescription.lifestyle?.diet ||
      prescription.lifestyle?.diet_advice,
  );
};

export const getDoList = (prescription) => {
  if (!prescription) return [];
  return asAdviceList(
    prescription.dos ||
      prescription.do_list ||
      prescription["do's"] ||
      prescription.do_and_dont?.dos ||
      prescription.do_and_dont?.["do's"] ||
      prescription.dos_and_donts?.dos ||
      prescription.lifestyle?.["do's"] ||
      prescription.lifestyle?.dos,
  );
};

export const getDontList = (prescription) => {
  if (!prescription) return [];
  return asAdviceList(
    prescription.donts ||
      prescription.dont_list ||
      prescription["don'ts"] ||
      prescription.do_and_dont?.donts ||
      prescription.do_and_dont?.["don'ts"] ||
      prescription.dos_and_donts?.donts ||
      prescription.lifestyle?.["don'ts"] ||
      prescription.lifestyle?.donts,
  );
};

export const getSuggestionList = (prescription) => {
  if (!prescription) return [];
  return asAdviceList(
    prescription.suggestions ||
      prescription.suggestion ||
      prescription.general_instructions ||
      prescription.patient_instructions ||
      prescription.instructions,
  );
};

export const getClinicalAdvisory = (prescription) => {
  if (!prescription) return '';
  return String(
    prescription.clinical_notes ||
      prescription.clinical_advisory ||
      prescription.warning ||
      prescription.important_notes ||
      '',
  ).trim();
};

export const getClinicalText = (value) => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return asAdviceList(value).join(', ').trim();
};

export const getAllergiesList = (prescription) => {
  if (!prescription) return [];
  return asAdviceList(
    prescription.allergies ||
      prescription.allergy ||
      prescription.known_allergies ||
      prescription.allergy_history,
  );
};

export const getPastIllnessText = (prescription) =>
  getClinicalText(
    prescription?.history_of_past_illness ||
      prescription?.past_illness ||
      prescription?.past_medical_history ||
      prescription?.medical_history,
  );

export const getFamilyHistoryText = (prescription) =>
  getClinicalText(
    prescription?.family_history ||
      prescription?.family_medical_history ||
      prescription?.hereditary_history,
  );

export const getSymptomDescription = (prescription) =>
  getClinicalText(
    prescription?.symptom_description ||
      prescription?.symptoms ||
      prescription?.chief_complaint ||
      prescription?.presenting_complaint,
  );

export const getFollowUpInfo = (prescription, appointment) => {
  const followUp =
    (prescription?.follow_up && typeof prescription.follow_up === 'object'
      ? prescription.follow_up
      : null) ||
    (appointment?.follow_up && typeof appointment.follow_up === 'object'
      ? appointment.follow_up
      : null) ||
    null;
  const dateRaw = followUp?.date || followUp?.follow_up_date || appointment?.follow_up_date || null;
  const date = dateRaw ? String(dateRaw).trim() : null;
  const reason = getClinicalText(
    followUp?.reason || followUp?.note || followUp?.notes || followUp?.purpose,
  );
  const notes = getClinicalText(followUp?.instructions || followUp?.advice || followUp?.description);
  const status = getClinicalText(followUp?.status || followUp?.appointment_status);
  return {
    date,
    dateLabel: date ? formatIssuedLabel(date) : null,
    reason: reason || null,
    schedule: Boolean(followUp?.schedule ?? followUp?.scheduled ?? (date || reason || notes)),
    notes: notes || null,
    status: status || null,
    hasContent: Boolean(date || reason || notes || status || followUp?.schedule),
  };
};

export const consultationHasPrescription = (payload) => {
  const normalized = normalizePrescriptionPayload(payload);
  if (hasPrescribedData({ prescription: normalized.prescription })) return true;
  if (getRecommendedDietPlans(payload).length > 0) return true;
  return (
    getDietAdvice(normalized.prescription).length > 0 ||
    getDoList(normalized.prescription).length > 0 ||
    getDontList(normalized.prescription).length > 0 ||
    getSuggestionList(normalized.prescription).length > 0
  );
};

const lineList = (title, items) => {
  if (!items.length) return [];
  return [title, ...items.map((item) => `  • ${item}`), ''];
};

const medicineLine = (medicine, index) => {
  const name = String(
    medicine?.name ||
      medicine?.medicine_name ||
      medicine?.product_name ||
      medicine?.title ||
      `Medicine ${index + 1}`,
  ).trim();
  const chips = getMedicineScheduleChips(medicine)
    .map((c) => `${c.caption}: ${c.label}`)
    .join(' | ');
  const notes = String(medicine?.instructions || medicine?.notes || medicine?.advice || '').trim();
  return [`  ${index + 1}. ${name}`, chips ? `     ${chips}` : '', notes ? `     Notes: ${notes}` : '']
    .filter(Boolean)
    .join('\n');
};

export const buildPrescriptionDownloadText = (data) => {
  const root = data?.data && typeof data.data === 'object' ? data.data : data;
  if (!root || typeof root !== 'object') {
    throw new Error('Prescription data is empty');
  }
  const doctor = root.doctor || {};
  const patient = root.patient || {};
  const appointment = root.appointment || {};
  const prescription = root.prescription || root;
  const doctorName = String(doctor.name || doctor.doctor_name || doctor.full_name || '').trim();
  const specialization = Array.isArray(doctor.doctor_specialization)
    ? doctor.doctor_specialization.join(', ')
    : String(doctor.doctor_specialization || doctor.specialization || doctor.speciality || '').trim();
  const patientName = String(patient.name || patient.patient_name || patient.full_name || '').trim();
  const code = String(prescription.prescription_code || root.prescription_code || root.id || '').trim();
  const issuedOn = formatIssuedLabel(
    appointment.appointment_date || root.issued_on || prescription.created_at || appointment.date || null,
  );
  const medicines = getMedicineItems(prescription);
  const dos = getDoList(prescription);
  const donts = getDontList(prescription);
  const diets = getDietAdvice(prescription);
  const dietPlans = getRecommendedDietPlans(root);
  const suggestions = getSuggestionList(prescription);
  const allergies = getAllergiesList(prescription);
  const followUp = getFollowUpInfo(prescription, appointment);
  const symptoms = getSymptomDescription(prescription);
  const pastIllness = getPastIllnessText(prescription);
  const familyHistory = getFamilyHistoryText(prescription);
  const clinical = getClinicalAdvisory(prescription);
  const diagnosis = getDiagnosisText(prescription);

  const sections = [
    'AYURMUNI',
    'Digital Prescription',
    '----------------------------------------',
    `Prescription: ${code || '-'}`,
    `Issued on: ${issuedOn}`,
    `Doctor: ${doctorName || '-'}`,
    `Specialization: ${specialization || '-'}`,
    `Patient: ${patientName || '-'}`,
    '----------------------------------------',
    '',
  ];
  if (symptoms) sections.push('Symptoms', `  ${symptoms}`, '');
  if (diagnosis) sections.push('Diagnosis', `  ${diagnosis}`, '');
  if (pastIllness) sections.push('History of past illness', `  ${pastIllness}`, '');
  if (allergies.length) sections.push(...lineList('Allergies', allergies));
  if (familyHistory) sections.push('Family history', `  ${familyHistory}`, '');
  if (clinical) sections.push('Clinical notes', `  ${clinical}`, '');
  if (medicines.length) {
    sections.push('Medicines');
    medicines.forEach((med, i) => sections.push(medicineLine(med, i)));
    sections.push('');
  }
  sections.push(...lineList("Do's", dos));
  sections.push(...lineList("Don'ts", donts));
  sections.push(...lineList('Diet advice', diets));
  if (dietPlans.length) {
    sections.push(
      ...lineList(
        'Recommended diet plans',
        dietPlans.map((d) => String(d?.name || d?.title || d?.diet_name || d).trim()).filter(Boolean),
      ),
    );
  }
  sections.push(...lineList('Advice / suggestions', suggestions));
  if (followUp.hasContent) {
    sections.push('Follow-up');
    if (followUp.dateLabel) sections.push(`  Date: ${followUp.dateLabel}`);
    if (followUp.reason) sections.push(`  Reason: ${followUp.reason}`);
    if (followUp.notes) sections.push(`  Notes: ${followUp.notes}`);
    sections.push('');
  }
  sections.push('----------------------------------------', 'This is a computer generated prescription.');
  return sections.join('\n');
};

export const saveBrowserFile = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

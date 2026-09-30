import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import {
  formatAppointmentTimeLabel,
  formatDoctorDisplayName,
} from '../consult/appointmentUtils';
import { doctorDisplayName, doctorImage, getDoctorId } from '../consult/doctors';
import { formatRupee } from '../home/catalog';
import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import { downloadPrescriptionFile, getAppointmentDetail } from '../services/consultService';
import { formatPrescriptionId } from '../utils/formatDisplayId';
import { createPlainTextPdfBytes } from '../utils/plainPdf';
import {
  buildPrescriptionDownloadText,
  consultationHasPrescription,
  formatIssuedLabel,
  getAllergiesList,
  getClinicalAdvisory,
  getConcernText,
  getDiagnosisText,
  getDoctorLocationLine,
  getDoList,
  getDontList,
  getFamilyHistoryText,
  getFollowUpInfo,
  getMedicineItems,
  getMedicineScheduleChips,
  getPastIllnessText,
  getPaymentAmount,
  getPrescriptionExpiry,
  getRecommendedDietPlans,
  getSuggestionList,
  getSymptomDescription,
  normalizePrescriptionPayload,
  saveBrowserFile,
} from '../utils/prescriptionDetailUtils';
import { useCart } from '../hooks/useCart';

const ExpandableList = ({ title, items, tone }) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 2);
  const canToggle = items.length > 2;
  return (
    <div className={`rx-advice ${tone}`}>
      <div className="rx-advice-head">
        <strong>{title}</strong>
        <span>{items.length}</span>
      </div>
      {shown.map((item, index) => (
        <p key={`${title}-${index}`}>
          <b>{index + 1}.</b> {item}
        </p>
      ))}
      {canToggle ? (
        <button type="button" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Read less' : `Read more (+${items.length - 2})`}
        </button>
      ) : null}
    </div>
  );
};

export default function PrescriptionDetail() {
  const { lookupId: routeId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const params = location.state || {};
  const lookupId = String(
    routeId ||
      params.appointment_id ||
      params.consultation_id ||
      params.PrisData?.appointment_id ||
      params.PrisData?.consultation_id ||
      '',
  ).trim();

  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const { variantQuantities, syncCartQuantity } = useCart();
  const [payload, setPayload] = useState(
    params.PrisData
      ? { ...params.PrisData, doctor: params.doctorData || params.PrisData?.doctor }
      : null,
  );
  const hasSeedData = useMemo(() => consultationHasPrescription(params.PrisData), []);

  const fetchPrescription = useCallback(async () => {
    if (!lookupId) {
      if (!params.PrisData) showSuccessToast('Appointment id missing', 'error');
      setLoading(false);
      return;
    }
    try {
      if (!hasSeedData) setLoading(true);
      const res = await getAppointmentDetail(lookupId);
      if (!res?.success) {
        if (!hasSeedData) {
          showSuccessToast(res?.message || 'Prescription not found', 'error');
          if (!params.PrisData) setPayload(null);
        }
        return;
      }
      setPayload(res?.data ?? null);
    } catch {
      if (!hasSeedData) showSuccessToast('Unable to load prescription', 'error');
    } finally {
      setLoading(false);
    }
  }, [lookupId, hasSeedData]);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to view this prescription'))) return;
      fetchPrescription();
    })();
  }, [fetchPrescription]);

  const normalized = useMemo(() => normalizePrescriptionPayload(payload), [payload]);
  const doctor = normalized.doctor || params.doctorData || null;
  const patient = normalized.patient || payload?.appointment?.patient || payload?.patient || null;
  const prescription = normalized.prescription;
  const appointment = normalized.appointment || payload?.appointment || null;
  const medicines = getMedicineItems(prescription);
  const expiry = getPrescriptionExpiry(prescription, normalized.issuedOn, medicines);
  const dietPlans = getRecommendedDietPlans(payload);
  const doItems = getDoList(prescription);
  const dontItems = getDontList(prescription);
  const suggestions = getSuggestionList(prescription);
  const clinicalNotes = getClinicalAdvisory(prescription);
  const doctorLocation = getDoctorLocationLine(doctor);
  const doctorId = getDoctorId(doctor);
  const hasContent = consultationHasPrescription(payload);
  const paymentAmount = getPaymentAmount(payload);
  const concernText = getConcernText(payload);
  const diagnosisText = getDiagnosisText(prescription);
  const prescriptionCode = formatPrescriptionId(
    prescription?.prescription_code || prescription?.id || normalized.prescriptionId,
  );
  const symptomText = getSymptomDescription(prescription);
  const allergies = getAllergiesList(prescription);
  const pastIllnessText = getPastIllnessText(prescription);
  const familyHistoryText = getFamilyHistoryText(prescription);
  const followUp = getFollowUpInfo(prescription, appointment);
  const paymentStatus = String(
    payload?.payment?.status ||
      payload?.payment?.payment_status ||
      appointment?.payment?.status ||
      appointment?.payment?.payment_status ||
      '',
  ).trim();
  const doctorPhone = doctor?.phone || doctor?.mobile || doctor?.contact_number || '';
  const diseaseTags = Array.isArray(doctor?.health_diseases)
    ? doctor.health_diseases.map((d) => d?.name).filter(Boolean).slice(0, 4)
    : [];
  const specialization = Array.isArray(doctor?.doctor_specialization)
    ? doctor.doctor_specialization.filter(Boolean).join(', ')
    : doctor?.doctor_specialization ||
      doctor?.specialization ||
      doctor?.speciality ||
      diseaseTags.slice(0, 2).join(' · ') ||
      '';
  const patientLine = [
    patient?.age != null ? `${patient.age} yrs` : '',
    patient?.gender ? String(patient.gender) : '',
    patient?.relation ? String(patient.relation) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const visitLine = [
    appointment?.consultation_type ? String(appointment.consultation_type).replace(/_/g, ' ') : '',
    appointment?.start_time && appointment?.end_time
      ? `${formatAppointmentTimeLabel(appointment.start_time)} – ${formatAppointmentTimeLabel(appointment.end_time)}`
      : formatAppointmentTimeLabel(appointment?.start_time),
  ]
    .filter(Boolean)
    .join(' · ');
  const statusLabel = String(prescription?.status || normalized.status || 'issued')
    .replace(/_/g, ' ')
    .trim();
  const presentingComplaint =
    concernText && concernText.toLowerCase() !== symptomText.toLowerCase() ? concernText : '';

  const openDietPlan = (diet) => {
    const planId = diet?.diet_plan_id || diet?.id || diet?.plan_id || null;
    if (!planId) {
      showSuccessToast('Diet plan unavailable', 'error');
      return;
    }
    navigate(`/diet/${planId}`, {
      state: {
        item: {
          ...diet,
          id: planId,
          diet_plan_id: planId,
          name: diet?.name || diet?.title || 'Diet Plan',
        },
      },
    });
  };

  const onShare = async () => {
    const message = [
      `Prescription ${prescriptionCode || ''}`.trim(),
      `Patient: ${patient?.patient_name || 'patient'}`,
      doctor?.doctor_name ? `Doctor: ${doctor.doctor_name}` : '',
      diagnosisText ? `Diagnosis: ${diagnosisText}` : '',
      medicines
        .map((m) => m?.medicine_name)
        .filter(Boolean)
        .join(', ')
        ? `Medicines: ${medicines.map((m) => m?.medicine_name).filter(Boolean).join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Ayurmuni Prescription', text: message });
        return;
      }
      await navigator.clipboard.writeText(message);
      showSuccessToast('Prescription copied', 'success');
    } catch {
      // ignore cancel
    }
  };

  const onPrint = () => {
    window.print();
  };

  const onOrderMedicines = async () => {
    if (expiry.expired) {
      if (doctorId) {
        navigate(`/consult/doctors/${doctorId}`);
        return;
      }
      showSuccessToast('This prescription has expired. Please consult your doctor to reorder.', 'error');
      return;
    }
    const lines = medicines
      .map((item) => ({
        variantId: String(item?.variant_id || item?.variant?.variant_id || item?.product_variant_id || '').trim(),
        quantity: Math.max(1, Number(item?.quantity) || 1),
      }))
      .filter((row) => row.variantId);
    if (!lines.length) {
      navigate('/medicines');
      return;
    }
    setOrdering(true);
    let added = 0;
    for (const line of lines) {
      const nextQty = (Number(variantQuantities[line.variantId]) || 0) + line.quantity;
      const ok = await syncCartQuantity({ variant_id: line.variantId, id: line.variantId, source: 'prescribed' }, nextQty);
      if (ok) added += 1;
    }
    setOrdering(false);
    if (added === 0) {
      showSuccessToast('Could not add medicines to cart', 'error');
      navigate('/cart');
      return;
    }
    showSuccessToast(added === lines.length ? 'Medicines added to cart' : 'Some medicines were added to cart', 'success');
    navigate('/cart');
  };

  const onDownloadPdf = async () => {
    if (downloadingPdf) return;
    const prescriptionId =
      normalized.prescriptionId ||
      String(prescription?.id || prescription?.prescription_id || '').trim();
    if (!prescriptionId) {
      showSuccessToast('Prescription id missing', 'error');
      return;
    }
    try {
      setDownloadingPdf(true);
      const response = await downloadPrescriptionFile(prescriptionId);
      if (!response?.success) throw new Error('Prescription PDF data not found');
      const code = formatPrescriptionId(
        response.prescriptionData?.prescription_code ||
          prescription?.prescription_code ||
          prescriptionId,
      ).replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `Ayurmuni_Prescription_${code}.pdf`;
      if (response.prescriptionData) {
        const mergedPayload = {
          ...(payload ?? {}),
          ...response.prescriptionData,
          doctor: response.prescriptionData.doctor ?? payload?.doctor ?? params.doctorData,
          patient:
            response.prescriptionData.patient ??
            payload?.patient ??
            payload?.appointment?.patient,
          appointment: response.prescriptionData.appointment ?? payload?.appointment,
          prescription:
            response.prescriptionData.prescription ?? response.prescriptionData,
          diets:
            response.prescriptionData.diets ?? payload?.diets ?? payload?.appointment?.diets,
        };
        const text = buildPrescriptionDownloadText(mergedPayload);
        saveBrowserFile(new Blob([createPlainTextPdfBytes(text)], { type: 'application/pdf' }), fileName);
        return;
      }
      if (response.data && !response.base64) {
        saveBrowserFile(new Blob([response.data], { type: 'application/pdf' }), fileName);
        return;
      }
      if (!response.base64) throw new Error('Prescription PDF data is empty');
      const binary = atob(String(response.base64).replace(/^data:application\/pdf;base64,/, ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      saveBrowserFile(new Blob([bytes], { type: 'application/pdf' }), fileName);
    } catch (error) {
      showSuccessToast(error?.message || 'Unable to download prescription PDF', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <AppShell tab="profile">
      <section className="catalog-page rx-page">
        <PageHeader
          title="Prescription"
          subtitle={prescriptionCode && prescriptionCode !== '-' ? prescriptionCode : 'Consultation Rx'}
          actions={
            <>
              {hasContent ? (
                <button type="button" className="ghost" onClick={onDownloadPdf} disabled={downloadingPdf}>
                  {downloadingPdf ? 'Saving…' : 'Download'}
                </button>
              ) : null}
              {hasContent ? (
                <button type="button" className="ghost" onClick={onPrint}>
                  Print
                </button>
              ) : null}
              {doctorId ? (
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    navigate(`/consult/doctors/${doctorId}/history`, {
                      state: { doctorName: doctor?.doctor_name },
                    })
                  }
                >
                  History
                </button>
              ) : null}
            </>
          }
        />

        {loading && !payload ? (
          <p className="muted">Loading prescription…</p>
        ) : !hasContent ? (
          <div className="empty-copy">
            <strong>No prescription yet</strong>
            <p>Medicines and advice will appear here once the doctor issues them.</p>
            <button type="button" className="cta" onClick={() => navigate('/profile/appointments')}>
              My appointments
            </button>
          </div>
        ) : (
          <>
            <article className="rx-paper">
              <button
                type="button"
                className="rx-letterhead"
                onClick={() => doctorId && navigate(`/consult/doctors/${doctorId}`)}
              >
                {doctorImage(doctor) ? (
                  <img src={doctorImage(doctor)} alt="" />
                ) : (
                  <span>{String(doctorDisplayName(doctor) || 'D').charAt(0)}</span>
                )}
                <div>
                  <strong>{formatDoctorDisplayName(doctorDisplayName(doctor) || doctor?.doctor_name)}</strong>
                  {specialization ? <small>{specialization}</small> : null}
                  <small>
                    {[
                      doctor?.experience_display
                        ? `${doctor.experience_display} yrs exp`
                        : doctor?.experience_years
                          ? `${doctor.experience_years} yrs exp`
                          : '',
                      doctorLocation,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </div>
                <em>℞</em>
              </button>
              {diseaseTags.length ? (
                <div className="rx-tags">
                  {diseaseTags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}
              <div className="rx-patient">
                <div>
                  <small>Patient</small>
                  <strong>{patient?.patient_name || 'Patient'}</strong>
                  {patientLine ? <p>{patientLine}</p> : null}
                  {visitLine ? <p>{visitLine}</p> : null}
                </div>
                <div className="rx-meta">
                  {prescriptionCode && prescriptionCode !== '-' ? <b>{prescriptionCode}</b> : null}
                  <span>{formatIssuedLabel(normalized.issuedOn)}</span>
                  {expiry.label ? (
                    <span className={expiry.expired ? 'rx-expiry is-expired' : 'rx-expiry'}>
                      {expiry.expired ? `Expired ${expiry.label}` : `Valid until ${expiry.label}`}
                    </span>
                  ) : null}
                  <i>{statusLabel}</i>
                  {paymentAmount != null ? <span>{formatRupee(paymentAmount)}</span> : null}
                  {paymentStatus ? <small>{paymentStatus.replace(/_/g, ' ')}</small> : null}
                </div>
              </div>
            </article>

            {presentingComplaint ||
            symptomText ||
            clinicalNotes ||
            allergies.length ||
            pastIllnessText ||
            familyHistoryText ? (
              <div className="checkout-card">
                <h3>Clinical findings</h3>
                {[
                  ['Chief complaint', presentingComplaint],
                  ['Symptoms', symptomText],
                  ['Examination', clinicalNotes],
                  ['Allergies', allergies.join(', ')],
                  ['Past illness', pastIllnessText],
                  ['Family history', familyHistoryText],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label} className={`txn-detail-row ${label === 'Allergies' ? 'rx-alert' : ''}`}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
              </div>
            ) : null}

            {diagnosisText ? (
              <div className="rx-diagnosis">
                <h3>Diagnosis & advice</h3>
                <p>{diagnosisText}</p>
              </div>
            ) : null}

            <div className="checkout-card">
              <h3>
                Prescribed medicines
                {medicines.length ? <small> {medicines.length}</small> : null}
              </h3>
              {medicines.length === 0 ? (
                <p className="muted">No medicines prescribed</p>
              ) : (
                medicines.map((medicine, index) => {
                  const chips = getMedicineScheduleChips(medicine);
                  const subtitle =
                    medicine?.product_name || medicine?.brand_name || medicine?.composition || '';
                  const showSub =
                    !!subtitle &&
                    String(subtitle).toLowerCase() !==
                      String(medicine?.medicine_name || '').toLowerCase();
                  return (
                    <div key={medicine?.id || `${medicine?.medicine_name}-${index}`} className="rx-med">
                      <b>{index + 1}</b>
                      <div>
                        <strong>
                          {medicine?.medicine_name || medicine?.product_name || 'Medicine'}
                        </strong>
                        {showSub ? <small>{subtitle}</small> : null}
                        {chips.length ? (
                          <div className="rx-chips">
                            {chips.map((chip) => (
                              <span key={chip.key}>
                                <i>{chip.caption}</i>
                                {chip.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {medicine?.instruction ? <p>{String(medicine.instruction)}</p> : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {dietPlans.length ? (
              <div className="checkout-card">
                <h3>Recommended diet</h3>
                {dietPlans.map((diet, index) => {
                  const planId = diet?.diet_plan_id || diet?.id || index;
                  return (
                    <button
                      key={String(planId)}
                      type="button"
                      className="order-row"
                      onClick={() => openDietPlan(diet)}
                    >
                      <p>
                        {diet?.name || diet?.title || 'Diet Plan'}
                        <small>
                          {[
                            diet?.avg_daily_calories != null
                              ? `~${Math.round(Number(diet.avg_daily_calories))} kcal/day`
                              : '',
                            diet?.meals_per_day != null ? `${diet.meals_per_day} meals/day` : '',
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Open plan'}
                        </small>
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {doItems.length || dontItems.length ? (
              <div className="checkout-card">
                <h3>Lifestyle guidelines</h3>
                {doItems.length ? <ExpandableList title="Do's" items={doItems} tone="do" /> : null}
                {dontItems.length ? (
                  <ExpandableList title="Don'ts" items={dontItems} tone="dont" />
                ) : null}
              </div>
            ) : null}

            {suggestions.length ? (
              <div className="checkout-card">
                <h3>Additional instructions</h3>
                <ul className="rx-bullets">
                  {suggestions.map((item, index) => (
                    <li key={`sug-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {followUp.hasContent ? (
              <div className="rx-follow">
                <strong>{followUp.schedule ? 'Follow-up scheduled' : 'Follow-up advised'}</strong>
                <p>{followUp.dateLabel || 'Date to be confirmed'}</p>
                {followUp.reason ? <small>{followUp.reason}</small> : null}
              </div>
            ) : null}

            <div className="rx-help">
              <strong>Need help with this Rx?</strong>
              <p>For severe reactions or worsening symptoms, contact your doctor right away.</p>
              {doctorPhone ? (
                <a href={`tel:${doctorPhone}`}>Call doctor</a>
              ) : null}
            </div>

            <div className="checkout-sticky rx-sticky">
              <button type="button" className="ghost" onClick={onShare}>
                Share
              </button>
              <button type="button" className="ghost" onClick={onPrint}>
                Print
              </button>
              <button type="button" className="cta" onClick={onOrderMedicines} disabled={ordering}>
                {ordering ? 'Adding…' : expiry.expired ? 'Consult to reorder' : 'Order medicines'}
              </button>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}

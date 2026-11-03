import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarClock,
  Check,
  Download,
  FileText,
  History,
  LifeBuoy,
  Phone,
  Pill,
  Printer,
  Salad,
  Share2,
  ShoppingBag,
  Stethoscope,
  X,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { Button } from '../components/ui';
import {
  ActionStack,
  DetailCard,
  DetailEmpty,
  DetailLayout,
  DetailLink,
  DetailPage,
  DetailSkeleton,
  DetailTop,
  InfoGrid,
  MetaChip,
  StatusPill,
} from '../components/detail/Detail';
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
import { buildPrescriptionDocument } from '../documents/documentData';
import { printDocumentHtml, renderDocumentHtml } from '../documents/documentHtml';
import {
  buildPrescriptionDownloadText,
  consultationHasPrescription,
  formatIssuedLabel,
  getAllergiesList,
  getClinicalAdvisory,
  getDiagnosisText,
  getDoctorLocationLine,
  getDoList,
  getDontList,
  getFamilyHistoryText,
  getFollowUpInfo,
  getGynaecologicalLines,
  getMedicineItems,
  getMedicineScheduleChips,
  mergeMedicineItems,
  getPastIllnessText,
  getPaymentAmount,
  getPersonalHistoryLines,
  getPrescriptionExpiry,
  getRecommendedDietPlans,
  getSuggestionList,
  getSymptomDescription,
  normalizePrescriptionPayload,
  saveBrowserFile,
} from '../utils/prescriptionDetailUtils';
import { useCart } from '../hooks/useCart';
import { nameInitial } from '../utils/initials';

const capitalize = (value) => {
  const text = String(value || '');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const ExpandableList = ({ title, items, tone }) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 2);
  const canToggle = items.length > 2;
  const Icon = tone === 'do' ? Check : X;
  return (
    <div className={`dx-advice dx-advice--${tone}`}>
      <div className="dx-advice__head">
        <span className="dx-advice__icon" aria-hidden>
          <Icon size={14} />
        </span>
        <strong>{title}</strong>
        <span className="dx-advice__count">{items.length}</span>
      </div>
      <ul>
        {shown.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
      {canToggle ? (
        <button type="button" className="dx-advice__toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : `Show ${items.length - 2} more`}
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
  const diagnosisText = getDiagnosisText(prescription);
  const prescriptionCode = formatPrescriptionId(
    prescription?.prescription_code || prescription?.id || normalized.prescriptionId,
  );
  const symptomText = getSymptomDescription(prescription);
  const allergies = getAllergiesList(prescription);
  const pastIllnessText = getPastIllnessText(prescription);
  const familyHistoryText = getFamilyHistoryText(prescription);
  const personalHistory = getPersonalHistoryLines(prescription);
  const gynaecological = getGynaecologicalLines(prescription);
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
    patient?.gender ? capitalize(patient.gender) : '',
    patient?.relation ? capitalize(patient.relation) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const visitLine = [
    appointment?.consultation_type ? capitalize(String(appointment.consultation_type).replace(/_/g, ' ')) : '',
    appointment?.start_time && appointment?.end_time
      ? `${formatAppointmentTimeLabel(appointment.start_time)} – ${formatAppointmentTimeLabel(appointment.end_time)}`
      : formatAppointmentTimeLabel(appointment?.start_time),
  ]
    .filter(Boolean)
    .join(' · ');
  const statusLabel = String(prescription?.status || normalized.status || 'issued')
    .replace(/_/g, ' ')
    .trim();
  const presentingComplaint = symptomText;

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
        const downloadRx = response.prescriptionData.prescription ?? response.prescriptionData;
        const mergedPayload = {
          ...(payload ?? {}),
          ...response.prescriptionData,
          doctor: response.prescriptionData.doctor ?? payload?.doctor ?? params.doctorData,
          patient:
            response.prescriptionData.patient ??
            payload?.patient ??
            payload?.appointment?.patient,
          appointment: response.prescriptionData.appointment ?? payload?.appointment,
          payment:
            response.prescriptionData.payment ??
            payload?.payment ??
            payload?.appointment?.payment,
          prescription: {
            ...(prescription ?? {}),
            ...downloadRx,
            items: mergeMedicineItems(getMedicineItems(downloadRx), getMedicineItems(prescription ?? {})),
          },
          diets:
            response.prescriptionData.diets ?? payload?.diets ?? payload?.appointment?.diets,
        };
        // Designed prescription (same layout as the app PDF): print dialog -> "Save as PDF".
        const html = renderDocumentHtml(buildPrescriptionDocument(mergedPayload), `Prescription ${code}`);
        if (await printDocumentHtml(html)) return;
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

  const doctorName = formatDoctorDisplayName(doctorDisplayName(doctor) || doctor?.doctor_name);
  const doctorPhoto = doctorImage(doctor);
  const doctorMeta = [
    doctor?.experience_display
      ? `${doctor.experience_display} yrs exp`
      : doctor?.experience_years
        ? `${doctor.experience_years} yrs exp`
        : '',
    doctorLocation,
  ]
    .filter(Boolean)
    .join(' · ');
  const hasCode = prescriptionCode && prescriptionCode !== '-';
  const clinicalItems = [
    { label: 'Chief complaint', value: presentingComplaint, wide: true },
    { label: 'Examination', value: clinicalNotes, wide: true },
    { label: 'Allergies', value: allergies.join(', '), tone: 'danger' },
    { label: 'Past illness', value: pastIllnessText },
    { label: 'Family history', value: familyHistoryText },
    { label: 'Personal history', value: personalHistory.join('; '), wide: true },
    { label: 'Gynaecological history', value: gynaecological.join('; '), wide: true },
  ];
  const hasClinical = clinicalItems.some((item) => item.value);

  return (
    <AppShell tab="profile">
      <DetailPage>
        <DetailTop
          backLabel="Back"
          actions={
            hasContent ? (
              <Button variant="ghost" size="sm" leadingIcon={<Share2 size={14} aria-hidden />} onClick={onShare}>
                Share
              </Button>
            ) : null
          }
        />

        {loading && !payload ? (
          <DetailSkeleton media={false} label="Loading prescription" />
        ) : !hasContent ? (
          <DetailEmpty
            icon={FileText}
            title="No prescription yet"
            text="Medicines and advice will appear here once the doctor issues them."
            action={<Button onClick={() => navigate('/profile/appointments')}>My appointments</Button>}
          />
        ) : (
          <DetailLayout
            aside={
              <>
                <DetailCard id="rx-actions" title="Your prescription" icon={Pill}>
                  <ActionStack>
                    <Button
                      leadingIcon={<ShoppingBag size={16} aria-hidden />}
                      loading={ordering}
                      onClick={onOrderMedicines}
                    >
                      {expiry.expired ? 'Consult to reorder' : 'Order medicines'}
                    </Button>
                    <Button
                      variant="secondary"
                      leadingIcon={<Download size={16} aria-hidden />}
                      loading={downloadingPdf}
                      onClick={onDownloadPdf}
                    >
                      Download PDF
                    </Button>
                    <Button variant="secondary" leadingIcon={<Printer size={16} aria-hidden />} onClick={onPrint}>
                      Print
                    </Button>
                  </ActionStack>
                </DetailCard>

                {dietPlans.length ? (
                  <DetailCard id="rx-diet" title="Recommended diet" icon={Salad}>
                    <div className="dx-actions">
                      {dietPlans.map((diet, index) => (
                        <DetailLink
                          key={String(diet?.diet_plan_id || diet?.id || index)}
                          icon={Salad}
                          title={diet?.name || diet?.title || 'Diet Plan'}
                          text={
                            [
                              diet?.avg_daily_calories != null
                                ? `~${Math.round(Number(diet.avg_daily_calories))} kcal/day`
                                : '',
                              diet?.meals_per_day != null ? `${diet.meals_per_day} meals/day` : '',
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Open plan'
                          }
                          onClick={() => openDietPlan(diet)}
                        />
                      ))}
                    </div>
                  </DetailCard>
                ) : null}

                <DetailCard id="rx-help" title="Need help with this Rx?" icon={LifeBuoy} tone="accent">
                  <p className="dx-prose">
                    For severe reactions or worsening symptoms, contact your doctor right away.
                  </p>
                  <div className="dx-actions">
                    {doctorPhone ? (
                      <Button href={`tel:${doctorPhone}`} variant="secondary" leadingIcon={<Phone size={16} aria-hidden />}>
                        Call doctor
                      </Button>
                    ) : null}
                    {doctorId ? (
                      <DetailLink
                        icon={History}
                        title="Consultation history"
                        text="Past visits and prescriptions with this doctor"
                        onClick={() =>
                          navigate(`/consult/doctors/${doctorId}/history`, {
                            state: { doctorName: doctor?.doctor_name },
                          })
                        }
                      />
                    ) : null}
                  </div>
                </DetailCard>
              </>
            }
          >
            <article className="dx-doc dx-doc--rx" aria-labelledby="rx-title">
              <header className="dx-doc__head">
                <button
                  type="button"
                  className="dx-doc__doctor"
                  onClick={() => doctorId && navigate(`/consult/doctors/${doctorId}`)}
                  disabled={!doctorId}
                >
                  <span className="dx-person__avatar" aria-hidden>
                    {doctorPhoto ? <img src={doctorPhoto} alt="" /> : nameInitial(doctorName, 'D')}
                  </span>
                  <span className="dx-doc__brand">
                    <strong id="rx-title">{doctorName}</strong>
                    {specialization ? <span>{specialization}</span> : null}
                    {doctorMeta ? <span>{doctorMeta}</span> : null}
                  </span>
                </button>
                <span className="dx-rx-mark" aria-hidden>
                  ℞
                </span>
              </header>

              {diseaseTags.length ? (
                <div className="dx-chips">
                  {diseaseTags.map((tag) => (
                    <MetaChip key={tag} tone="plain">
                      {tag}
                    </MetaChip>
                  ))}
                </div>
              ) : null}

              <div className="dx-rx-patient">
                <div>
                  <p className="dx-doc__label">Patient</p>
                  <strong>{patient?.patient_name || 'Patient'}</strong>
                  {patientLine ? <span>{patientLine}</span> : null}
                  {visitLine ? <span className="dx-rx-patient__visit">{visitLine}</span> : null}
                </div>
                <div className="dx-rx-patient__meta">
                  <StatusPill status={statusLabel}>{statusLabel}</StatusPill>
                  {hasCode ? <strong>{prescriptionCode}</strong> : null}
                  <span>{formatIssuedLabel(normalized.issuedOn)}</span>
                  {expiry.label ? (
                    <span className={expiry.expired ? 'dx-rx-expiry is-expired' : 'dx-rx-expiry'}>
                      {expiry.expired ? `Expired ${expiry.label}` : `Valid until ${expiry.label}`}
                    </span>
                  ) : null}
                  {paymentAmount != null ? (
                    <span>
                      {formatRupee(paymentAmount)}
                      {paymentStatus ? ` · ${paymentStatus.replace(/_/g, ' ')}` : ''}
                    </span>
                  ) : null}
                </div>
              </div>

              {hasClinical ? (
                <section className="dx-doc__section" aria-label="Clinical findings">
                  <p className="dx-doc__label">Clinical findings</p>
                  <InfoGrid items={clinicalItems} />
                </section>
              ) : null}

              {diagnosisText ? (
                <section className="dx-callout" aria-label="Diagnosis and advice">
                  <Stethoscope size={18} aria-hidden />
                  <div>
                    <p className="dx-doc__label">Diagnosis & advice</p>
                    <p>{diagnosisText}</p>
                  </div>
                </section>
              ) : null}

              <section className="dx-doc__section" aria-label="Prescribed medicines">
                <p className="dx-doc__label">
                  Prescribed medicines{medicines.length ? ` · ${medicines.length}` : ''}
                </p>
                {medicines.length === 0 ? (
                  <p className="dx-note">No medicines prescribed.</p>
                ) : (
                  <ol className="dx-meds">
                    {medicines.map((medicine, index) => {
                      const chips = getMedicineScheduleChips(medicine);
                      const subtitle =
                        medicine?.product_name || medicine?.brand_name || medicine?.composition || '';
                      const showSub =
                        !!subtitle &&
                        String(subtitle).toLowerCase() !== String(medicine?.medicine_name || '').toLowerCase();
                      return (
                        <li key={medicine?.id || `${medicine?.medicine_name}-${index}`} className="dx-med">
                          <span className="dx-med__num" aria-hidden>
                            {index + 1}
                          </span>
                          <div className="dx-med__body">
                            <strong>{medicine?.medicine_name || medicine?.product_name || 'Medicine'}</strong>
                            {showSub ? <small>{subtitle}</small> : null}
                            {chips.length ? (
                              <div className="dx-med__chips">
                                {chips.map((chip) => (
                                  <span key={chip.key}>
                                    <small>{chip.caption}</small>
                                    {chip.label}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {medicine?.instruction ? <p>{String(medicine.instruction)}</p> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              {doItems.length || dontItems.length ? (
                <section className="dx-doc__section" aria-label="Lifestyle guidelines">
                  <p className="dx-doc__label">Lifestyle guidelines</p>
                  <div className="dx-advice-grid">
                    {doItems.length ? <ExpandableList title="Do's" items={doItems} tone="do" /> : null}
                    {dontItems.length ? <ExpandableList title="Don'ts" items={dontItems} tone="dont" /> : null}
                  </div>
                </section>
              ) : null}

              {suggestions.length ? (
                <section className="dx-doc__section" aria-label="Additional instructions">
                  <p className="dx-doc__label">Additional instructions</p>
                  <ul className="dx-bullets">
                    {suggestions.map((item, index) => (
                      <li key={`sug-${index}`}>{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {followUp.hasContent ? (
                <section className="dx-callout dx-callout--gold" aria-label="Follow-up">
                  <CalendarClock size={18} aria-hidden />
                  <div>
                    <p className="dx-doc__label">
                      {followUp.schedule ? 'Follow-up scheduled' : 'Follow-up advised'}
                    </p>
                    <p>
                      <strong>{followUp.dateLabel || 'Date to be confirmed'}</strong>
                    </p>
                    {followUp.reason ? <p>{followUp.reason}</p> : null}
                  </div>
                </section>
              ) : null}

              <footer className="dx-doc__foot">
                Digitally issued via Ayurmuni. Take medicines only as prescribed.
              </footer>
            </article>
          </DetailLayout>
        )}
      </DetailPage>
    </AppShell>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  Download,
  FileText,
  Mail,
  MessageCircle,
  Printer,
  Share2,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import MultipleDoctorSlip from '../components/consult/MultipleDoctorSlip';
import {
  prescriptionPath,
  prescriptionState,
} from '../components/consult/ConsultationTimeline';
import {
  ActionStack,
  DetailCard,
  DetailEmpty,
  DetailLayout,
  DetailPage,
  DetailSkeleton,
  DetailTop,
  InfoGrid,
  StatusPill,
} from '../components/detail/Detail';
import Button from '../components/ui/Button';
import { showSuccessToast } from '../config/key';
import { openDoctorSlipPdf } from '../documents/doctorSlipHtml';
import { formatRupee } from '../home/catalog';
import { getDoctorSlip } from '../services/consultService';
import { requireAuth } from '../services/guestAuth';
import { formatDoctorDisplayName } from '../consult/appointmentUtils';
import { doctorDisplayName, doctorImage, formatDoctorSpecialization } from '../consult/doctors';
import {
  formatSlipDate,
  formatSlipStatusLabel,
  formatSlipTimeRange,
  getConsultationKey,
  getConsultationTitle,
  getDoctorLocationLine,
  getPatientMeta,
  getSlipFee,
  hasPrescribedData,
  isClosedNegativeStatus,
} from '../utils/doctorSlipUtils';
import { getMedicineScheduleChips } from '../utils/prescriptionDetailUtils';
import { getEmailShareUrl, getWhatsAppShareUrl } from '../utils/shareUtils';
import { nameInitial } from '../utils/initials';
import '../design/pages/doctor-slip.css';

export default function DoctorSlip() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const visitId = String(searchParams.get('visit') || '').trim();
  const [loading, setLoading] = useState(true);
  const [slipData, setSlipData] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await requireAuth('Please login to view the doctor slip'))) return;
      if (!doctorId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await getDoctorSlip(doctorId);
      if (!alive) return;
      setSlipData(res?.success === false ? null : res?.data ?? res ?? null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [doctorId]);

  const consultations = useMemo(
    () => (Array.isArray(slipData?.consultations) ? slipData.consultations : []),
    [slipData],
  );
  const doctor = slipData?.doctor;
  const multi = consultations.length > 1;
  const selected = useMemo(() => {
    if (!visitId) return null;
    return (
      consultations.find((item) => getConsultationKey(item) === visitId) ||
      consultations.find(
        (item) =>
          String(item?.consultation_id || '') === visitId ||
          String(item?.appointment_id || '') === visitId,
      ) ||
      null
    );
  }, [consultations, visitId]);
  const showingDetail = !multi || Boolean(selected);
  const active = selected || consultations[0] || null;
  const latest = consultations[0] || null;
  const apiNotes = active?.notes || {};
  const prescription = {
    ...(active?.prescription || {}),
    symptom_description:
      active?.prescription?.symptom_description || apiNotes.symptom_description || '',
    clinical_notes: active?.prescription?.clinical_notes || apiNotes.clinical_notes || '',
    diagnosis_advice: active?.prescription?.diagnosis_advice || apiNotes.diagnosis_advice || '',
    history_of_past_illness:
      active?.prescription?.history_of_past_illness || apiNotes.history_of_past_illness || '',
  };
  const medicines = Array.isArray(prescription.items) ? prescription.items : [];
  const fee = getSlipFee(active);
  const patientMeta = getPatientMeta(active?.patient);
  const timeRange = formatSlipTimeRange(active?.start_time, active?.end_time);
  const location = getDoctorLocationLine(doctor);
  const doctorName = formatDoctorDisplayName(doctorDisplayName(doctor) || doctor?.doctor_name || 'Doctor');
  const specialization = formatDoctorSpecialization(doctor);
  const listPatientMeta = getPatientMeta(latest?.patient);
  const statusLabel = formatSlipStatusLabel(active) || 'Issued';
  const negativeStatus = isClosedNegativeStatus(active);
  const activeKey = getConsultationKey(active);
  const refNo =
    doctor?.registration_number ||
    (activeKey ? String(activeKey).slice(0, 10).toUpperCase() : '—');
  const doctorPhoto = doctorImage(doctor);
  const visitLine = [
    active?.consultation_type
      ? String(active.consultation_type).replace(/_/g, ' ')
      : '',
    timeRange !== '—' ? timeRange : '',
    active?.duration_minutes ? `${active.duration_minutes} min` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const clinicalItems = [
    {
      label: 'Chief complaint',
      value: active?.concern || active?.consultation_concern || prescription.symptom_description,
      wide: true,
    },
    { label: 'Examination', value: prescription.clinical_notes, wide: true },
    { label: 'Allergies', value: prescription.allergies, tone: 'danger' },
    { label: 'Past illness', value: prescription.history_of_past_illness },
    { label: 'Family history', value: prescription.family_history },
    { label: 'Appointment notes', value: active?.appointment_notes, wide: true },
  ];
  const hasClinical = clinicalItems.some((item) => String(item.value || '').trim());
  const diagnosisText = String(prescription.diagnosis_advice || '').trim();
  const followUpLabel = prescription?.follow_up?.date
    ? `${formatSlipDate(prescription.follow_up.date)}${
        prescription.follow_up.reason ? ` · ${prescription.follow_up.reason}` : ''
      }`
    : '';

  const shareText = useMemo(() => {
    if (!active) return '';
    return [
      `Doctor Slip — ${doctorName}`,
      `Patient: ${active?.patient?.patient_name || '—'}`,
      `Date: ${formatSlipDate(active?.appointment_date || active?.date)}`,
      `Time: ${timeRange}`,
      `Status: ${statusLabel}`,
      `Reference: ${refNo}`,
      active?.concern || active?.consultation_concern
        ? `Concern: ${active.concern || active.consultation_concern}`
        : '',
      fee != null ? `Fee: ${formatRupee(fee)}` : '',
      'Shared from Ayurmuni',
    ]
      .filter(Boolean)
      .join('\n');
  }, [active, doctorName, fee, refNo, statusLabel, timeRange]);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/consult/doctors/${doctorId}/slip${
          activeKey ? `?visit=${encodeURIComponent(activeKey)}` : ''
        }`
      : '';

  const openConsultation = (item) => {
    const key = getConsultationKey(item);
    if (!key) return;
    setSearchParams({ visit: key }, { replace: false });
  };

  const openPrescription = (item, doc) => {
    const path = prescriptionPath(item);
    if (!path) return;
    navigate(path, { state: prescriptionState(item, doc) });
  };

  /** Download PDF and Print PDF use the same official document. */
  const openOfficialPdf = async () => {
    if (!active || pdfBusy) return;
    setPdfBusy(true);
    try {
      await openDoctorSlipPdf({
        doctor,
        consultation: active,
        visitCount: consultations.length,
      });
    } catch (error) {
      showSuccessToast(error?.message || 'Unable to open slip PDF', 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleBack = () => {
    if (multi && selected) {
      setSearchParams({}, { replace: false });
      return;
    }
    navigate(doctorId ? `/consult/doctors/${doctorId}` : '/consult');
  };

  return (
    <AppShell tab="consult">
      <DetailPage className="am-slip">
        <DetailTop
          onBack={handleBack}
          backLabel={multi && selected ? 'Consultation register' : 'Back'}
          actions={
            showingDetail && active ? (
              <div className="dx-top__actions am-slip__actions no-print">
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<Share2 size={16} aria-hidden />}
                  onClick={() => {
                    if (navigator.share) {
                      navigator
                        .share({
                          title: `Doctor slip — ${doctor?.doctor_name || 'Doctor'}`,
                          text: shareText,
                          url: shareUrl,
                        })
                        .catch(() => {});
                      return;
                    }
                    navigator.clipboard?.writeText(`${shareText}\n${shareUrl}`).catch(() => {});
                  }}
                >
                  Share
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon={<Download size={16} aria-hidden />}
                  loading={pdfBusy}
                  onClick={openOfficialPdf}
                >
                  Download PDF
                </Button>
              </div>
            ) : null
          }
        />

        {loading ? <DetailSkeleton label="Loading doctor slip" /> : null}

        {!loading && consultations.length === 0 ? (
          <DetailEmpty
            icon={ClipboardList}
            title="No consultations found"
            text="Visits with this doctor will appear here as official consultation slips."
            action={
              <Button
                variant="primary"
                onClick={() => navigate(doctorId ? `/consult/doctors/${doctorId}` : '/consult')}
              >
                View doctor
              </Button>
            }
          />
        ) : null}

        {!loading && multi && !selected ? (
          <div className="am-slip__multi">
            <MultipleDoctorSlip
              consultations={consultations}
              doctor={doctor}
              patient={
                <article className="am-slip-hero" aria-label="Consultation record summary">
                  <div className="am-slip-hero__brand">
                    <img src="/images/FinalLogo.webp" alt="" />
                    <div>
                      <p>Official consultation record</p>
                      <h1>{doctorName}</h1>
                      <span>
                        {[specialization, doctor?.qualification, location]
                          .filter(Boolean)
                          .join(' · ') || 'Ayurveda physician'}
                      </span>
                    </div>
                    <StatusPill status="completed">{consultations.length} visits</StatusPill>
                  </div>
                  <dl className="am-slip-hero__facts">
                    <div>
                      <dt>Latest visit</dt>
                      <dd>{formatSlipDate(latest?.appointment_date || latest?.date)}</dd>
                    </div>
                    <div>
                      <dt>Patient</dt>
                      <dd>{latest?.patient?.patient_name || '—'}</dd>
                    </div>
                    <div>
                      <dt>Details</dt>
                      <dd>{listPatientMeta || '—'}</dd>
                    </div>
                    <div>
                      <dt>Registration</dt>
                      <dd>{doctor?.registration_number || '—'}</dd>
                    </div>
                  </dl>
                  <p className="am-slip__legal-banner">
                    Confidential medical record · Completed, cancelled, and missed visits remain on
                    file for your records.
                  </p>
                </article>
              }
              onViewAll={() =>
                navigate(`/consult/doctors/${doctorId}/history`, {
                  state: { doctorName: doctor?.doctor_name },
                })
              }
              onOpen={openConsultation}
              onOpenLatest={() => openConsultation(latest)}
              onPrescription={openPrescription}
            />
          </div>
        ) : null}

        {!loading && showingDetail && active ? (
          <DetailLayout
            aside={
              <>
                <DetailCard id="slip-actions" title="Your consultation slip" icon={FileText} className="no-print">
                  <ActionStack>
                    <Button
                      leadingIcon={<Download size={16} aria-hidden />}
                      loading={pdfBusy}
                      onClick={openOfficialPdf}
                    >
                      Download PDF
                    </Button>
                    <Button
                      variant="secondary"
                      leadingIcon={<Printer size={16} aria-hidden />}
                      loading={pdfBusy}
                      onClick={openOfficialPdf}
                    >
                      Print PDF
                    </Button>
                    <Button
                      variant="secondary"
                      leadingIcon={<MessageCircle size={16} aria-hidden />}
                      onClick={() =>
                        window.open(getWhatsAppShareUrl(shareText, shareUrl), '_blank', 'noopener,noreferrer')
                      }
                    >
                      WhatsApp
                    </Button>
                    <Button
                      variant="ghost"
                      leadingIcon={<Mail size={16} aria-hidden />}
                      onClick={() => {
                        window.location.href = getEmailShareUrl(
                          'Doctor Slip - Ayurmuni',
                          `${shareText}\n\n${shareUrl}`,
                        );
                      }}
                    >
                      Email
                    </Button>
                    {hasPrescribedData(active) ? (
                      <Button
                        variant="secondary"
                        leadingIcon={<FileText size={16} aria-hidden />}
                        onClick={() => openPrescription(active, doctor)}
                      >
                        View prescription
                      </Button>
                    ) : null}
                  </ActionStack>
                </DetailCard>
                <p className="dx-note no-print">
                  <ShieldCheck size={14} aria-hidden />
                  Official computer-generated slip. Download PDF and Print PDF open the same legal
                  document. Keep with your prescription and payment receipt.
                </p>
              </>
            }
          >
            <article className="dx-doc dx-doc--rx am-slip__doc" aria-labelledby="slip-title">
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
                    <strong id="slip-title">{doctorName}</strong>
                    {specialization ? <span>{specialization}</span> : null}
                    {[doctor?.qualification, location].filter(Boolean).join(' · ') ? (
                      <span>{[doctor?.qualification, location].filter(Boolean).join(' · ')}</span>
                    ) : null}
                  </span>
                </button>
                <span className="dx-rx-mark" aria-hidden>
                  ℞
                </span>
              </header>

              {negativeStatus ? (
                <div className="am-slip__status-alert" role="status">
                  This consultation is recorded as <strong>{statusLabel}</strong>. The slip remains
                  available for your official records.
                </div>
              ) : null}

              <div className="dx-rx-patient">
                <div>
                  <p className="dx-doc__label">Patient</p>
                  <strong>{active?.patient?.patient_name || 'Patient'}</strong>
                  {patientMeta ? <span>{patientMeta}</span> : null}
                  {visitLine ? <span className="dx-rx-patient__visit">{visitLine}</span> : null}
                </div>
                <div className="dx-rx-patient__meta">
                  <StatusPill status={statusLabel}>{statusLabel}</StatusPill>
                  <strong>Ref. {refNo}</strong>
                  <span>{formatSlipDate(active?.appointment_date || active?.date)}</span>
                  <span>{getConsultationTitle(active)}</span>
                  {fee != null ? <span>{formatRupee(fee)}</span> : null}
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
                  <p className="dx-note">
                    {negativeStatus
                      ? 'No medicines were issued for this visit.'
                      : 'No medicines prescribed on this slip.'}
                  </p>
                ) : (
                  <ol className="dx-meds">
                    {medicines.map((medicine, index) => {
                      const chips = getMedicineScheduleChips(medicine);
                      const subtitle =
                        medicine?.product_name || medicine?.brand_name || medicine?.composition || '';
                      const showSub =
                        !!subtitle &&
                        String(subtitle).toLowerCase() !==
                          String(medicine?.medicine_name || '').toLowerCase();
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

              {followUpLabel ? (
                <section className="dx-callout dx-callout--gold" aria-label="Follow-up">
                  <FileText size={18} aria-hidden />
                  <div>
                    <p className="dx-doc__label">Follow-up</p>
                    <p>
                      <strong>{followUpLabel}</strong>
                    </p>
                  </div>
                </section>
              ) : null}

              <footer className="dx-doc__foot">
                Digitally issued via Ayurmuni. Confidential medical record · No wet signature
                required. Unauthorised alteration or misuse is prohibited.
              </footer>
            </article>
          </DetailLayout>
        ) : null}
      </DetailPage>
    </AppShell>
  );
}

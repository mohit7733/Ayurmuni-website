import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  HeartPulse,
  MessageCircle,
  Pill,
  Radio,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Star,
  Stethoscope,
  UserRound,
  Video,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import ShareButton from '../components/ShareButton';
import { Button, Chip, Modal, SkeletonText, Textarea } from '../components/ui';
import {
  DetailCard,
  DetailEmpty,
  DetailHero,
  DetailLayout,
  DetailLink,
  DetailPage,
  DetailSkeleton,
  DetailTop,
  InfoGrid,
  MetaChip,
  PersonCard,
  StatusPill,
} from '../components/detail/Detail';
import {
  buildVideoCallNavParams,
  canModifyAppointment,
  formatAppointmentDateFull,
  formatAppointmentTimeLabel,
  formatDoctorDisplayName,
  getAppointmentIds,
  getAppointmentPatientId,
  isAppointmentInPast,
  resolveAppointmentDateTime,
  resolveAppointmentLookupId,
} from '../consult/appointmentUtils';
import {
  doctorDisplayName,
  doctorImage,
  formatSlotTime,
  generateMonthDates,
  getDoctorId,
  isSlotBookable,
} from '../consult/doctors';
import { formatRupee } from '../home/catalog';
import { showSuccessToast } from '../config/key';
import { Utils } from '../common/utils';
import { requireAuth } from '../services/guestAuth';
import {
  appointmentActionAPI,
  getAppointmentDetail,
  getDoctorById,
} from '../services/consultService';
import {
  getPatientList,
  listPatients,
  switchPatient,
} from '../services/patientService';
import { consultationHasPrescription } from '../utils/prescriptionDetailUtils';
import { formatAppointmentId } from '../utils/formatDisplayId';
import { getAppointmentShareMessage } from '../helper/shareMessage';

const CANCEL_REASONS = [
  'Scheduling conflict',
  'Feeling better / no longer needed',
  'Booked by mistake',
  'Found another doctor',
  'Personal emergency',
];

const CANCEL_NOTES = [
  'Free cancellation up to 6 hours before the scheduled consultation.',
  'Cancellations within 6 hours may be non-refundable, except when the doctor or Ayurmuni cannot provide the consultation.',
  'Approved refunds are usually started within 72 hours and may take 5–7 business days to reflect.',
  'You can rebook another slot anytime from Appointments.',
];

const initialsOf = (name) =>
  String(name || '')
    .replace(/^dr\.?\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const formatLabel = (value) => {
  if (!value) return '';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const followUpLabel = (detail, appointment) => {
  const fu = appointment?.follow_up || detail?.prescription?.follow_up || detail?.follow_up || null;
  const raw = fu?.date ?? fu?.follow_up_date ?? appointment?.follow_up_date ?? detail?.follow_up_date ?? null;
  if (!raw) return fu?.schedule ? 'Scheduled' : '';
  return formatAppointmentDateFull(String(raw)) || String(raw);
};

const prescriptionMedicines = (detail) => {
  const rx = detail?.prescription || detail?.appointment?.prescription || {};
  if (Array.isArray(rx.medicines)) return rx.medicines;
  if (Array.isArray(rx.items)) return rx.items;
  if (Array.isArray(rx.prescribed_medicines)) return rx.prescribed_medicines;
  return [];
};

const prescriptionIdOf = (detail) =>
  detail?.prescription?.id ||
  detail?.prescription?.prescription_id ||
  detail?.appointment?.prescription?.id ||
  detail?.appointment?.prescription_id ||
  '';

export default function AppointmentDetails() {
  const { appointmentId: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [slotDate, setSlotDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotId, setSlotId] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewStars, setReviewStars] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);

  const routeLookupId = resolveAppointmentLookupId({
    appointment_id: routeId,
    consultation_id: routeId,
    id: routeId,
  });

  const fetchDetail = useCallback(async (opts = {}) => {
    if (!routeLookupId) {
      showSuccessToast('Appointment id missing', 'error');
      setDetail(null);
      setLoading(false);
      return;
    }
    if (!opts.silent) setLoading(true);
    const res = await getAppointmentDetail(routeLookupId);
    if (!res?.success) {
      showSuccessToast(res?.message || 'Appointment not found', 'error');
      setDetail(null);
    } else {
      setDetail(res?.data ?? null);
    }
    setLoading(false);
  }, [routeLookupId]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchDetail({ silent: true });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to view this appointment'))) return;
      fetchDetail();
    })();
  }, [fetchDetail]);

  const appointment = detail?.appointment;
  const doctor = detail?.doctor;
  const patient = appointment?.patient;
  const ids = getAppointmentIds({ rawData: detail, appointment, ...appointment });
  const actionId = ids.appointmentId || ids.consultationId || routeLookupId;
  const chatId = resolveAppointmentLookupId({
    rawData: detail,
    appointment,
    ...appointment,
  });
  const canOpenChat = Boolean(chatId);
  const doctorId = getDoctorId(doctor);
  const status = String(appointment?.appointment_status || '').toLowerCase();
  const alreadyReviewed = appointment?.review?.is_rated === true;
  const shouldShowReviewModal = status === 'completed' && !alreadyReviewed;

  useEffect(() => {
    if (!shouldShowReviewModal) return;
    const timer = setTimeout(() => setReviewOpen(true), 2000);
    return () => clearTimeout(timer);
  }, [shouldShowReviewModal]);

  const callStatus = String(appointment?.call_status || '').toLowerCase();
  const isLive = callStatus === 'in_progress';
  const schedule = resolveAppointmentDateTime({
    date: appointment?.appointment_date,
    time: appointment?.start_time,
    appointment,
    rawData: detail,
  });
  const showButtons = canModifyAppointment(status, schedule.date, schedule.time);
  const isRescheduleRequest = status === 'reschedule';
  const showAddToCalendar = detail?.appointment
    ? !isAppointmentInPast({
        appointment,
        date: schedule.date || appointment?.appointment_date,
        time: schedule.time || appointment?.start_time,
        end_time: appointment?.end_time,
        endTime: appointment?.end_time,
      })
    : false;
  const medicines = prescriptionMedicines(detail);
  const hasPrescription =
    consultationHasPrescription(detail) ||
    medicines.length > 0 ||
    Boolean(prescriptionIdOf(detail)) ||
    Boolean(detail?.prescription);
  const showPrescriptionCta =
    hasPrescription &&
    ['completed', 'cancelled', 'missed', 'expired', 'no_show', 'noshow'].includes(status);
  const dates = useMemo(
    () => generateMonthDates(monthOffset).filter((item) => !item.isDisabled),
    [monthOffset],
  );
  const monthLabel = useMemo(
    () =>
      new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      }),
    [monthOffset],
  );

  const paymentAmount =
    detail?.payment?.consultation_fee ??
    detail?.payment?.amount ??
    appointment?.payment?.consultation_fee ??
    appointment?.payment?.amount ??
    null;
  const paymentStatusValue =
    detail?.payment?.status || appointment?.payment_status || appointment?.payment?.status || null;

  const runAction = async (payload) => {
    if (!actionId) return;
    setSaving(true);
    try {
      const res = await appointmentActionAPI(actionId, payload);
      if (res?.success) {
        showSuccessToast(res.message || 'Updated', 'success');
        setCancelOpen(false);
        setRescheduleOpen(false);
        if (payload.action === 'cancel') {
          navigate('/profile/appointments', { replace: true });
          return;
        }
        fetchDetail();
        return;
      }
      showSuccessToast(res?.message || 'You cannot reschedule multiple times', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openCancelFlow = async () => {
    const patientId = getAppointmentPatientId({
      appointment,
      patient,
    });
    if (!patientId) {
      setCancelOpen(true);
      return;
    }
    const list = listPatients(await getPatientList());
    const active = list.find((item) => item?.is_active_profile);
    const match = list.find((item) => String(item?.id) === String(patientId));
    const isActive =
      String(active?.id || '') === String(patientId) || match?.is_active_profile === true;
    if (!isActive) {
      setActivateOpen(true);
      return;
    }
    setCancelOpen(true);
  };

  const confirmActivateThenCancel = async () => {
    const patientId = getAppointmentPatientId({ appointment, patient });
    if (!patientId) {
      setActivateOpen(false);
      setCancelOpen(true);
      return;
    }
    setActivating(true);
    try {
      const res = await switchPatient(patientId);
      if (res?.success === false) {
        showSuccessToast(res?.message || 'Unable to activate this patient. Please try again.', 'error');
        return;
      }
      const data = res?.data ?? res;
      if (data?.user_id) await Utils.storeData('_USER_ID', data.user_id);
      if (data?.access) await Utils.storeData('_TOKEN', data.access);
      if (data?.refresh) await Utils.storeData('_REFRESH_TOKEN', data.refresh);
      setActivateOpen(false);
      setCancelOpen(true);
    } finally {
      setActivating(false);
    }
  };

  const loadSlots = async (date) => {
    if (!doctorId || !date) return;
    setSlotsLoading(true);
    setSlotId('');
    try {
      const res = await getDoctorById(doctorId, { date });
      const data = res?.data ?? res;
      const list = Array.isArray(data?.slots) ? data.slots : [];
      setSlots(list.map((slot) => ({ ...slot, date: slot.date || date })));
    } finally {
      setSlotsLoading(false);
    }
  };

  const openReschedule = () => {
    const date = schedule.date || '';
    if (date) {
      const [year, month] = date.split('-').map(Number);
      const now = new Date();
      const offset = (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
      setMonthOffset(Math.max(0, offset));
    }
    setSlotDate(date || dates[0]?.fullDate || '');
    setRescheduleReason('');
    setRescheduleOpen(true);
    loadSlots(date || dates[0]?.fullDate || '');
  };

  useEffect(() => {
    if (!detail || loading) return;
    const action = location.state?.action;
    if (!action) return;
    navigate(location.pathname, { replace: true, state: {} });
    if (action === 'reschedule' && showButtons) openReschedule();
    if (action === 'cancel' && showButtons) openCancelFlow();
  }, [detail, loading]);

  const addToCalendar = () => {
    const specialization = Array.isArray(doctor?.doctor_specialization)
      ? doctor.doctor_specialization.join(', ')
      : doctor?.doctor_specialization || doctor?.specialization || doctor?.speciality || '';
    navigate('/consult/add-calendar', {
      state: {
        appointment: {
          doctorName: doctor?.doctor_name || doctorDisplayName(doctor),
          doctorImage: doctorImage(doctor),
          specialization,
          date: schedule.date || appointment?.appointment_date,
          startTime: schedule.time || appointment?.start_time,
          endTime: appointment?.end_time,
          concern: appointment?.concern,
          hospitalName: doctor?.hospital_name || appointment?.hospital_name,
          bookingId: ids.consultationId || ids.appointmentId,
          status: appointment?.appointment_status || appointment?.status,
        },
      },
    });
  };

  const openShareExperience = (rating) => {
    if (alreadyReviewed) {
      showSuccessToast('You have already reviewed this consultation', 'error');
      return;
    }
    const lookup = routeLookupId || chatId;
    if (!lookup) {
      showSuccessToast('Missing appointment reference', 'error');
      return;
    }
    const specialization = Array.isArray(doctor?.doctor_specialization)
      ? doctor.doctor_specialization.filter(Boolean).join(', ')
      : doctor?.doctor_specialization || '';
    navigate('/share-experience', {
      state: {
        entityType: 'doctor',
        entityName: doctor?.doctor_name || doctorDisplayName(doctor) || 'Doctor',
        entitySubtitle: specialization,
        appointmentId: lookup,
        initialRating: rating,
      },
    });
  };

  const openPrescription = () => {
    const rxId =
      appointment?.consultation_id ||
      appointment?.appointment_id ||
      chatId ||
      routeLookupId;
    if (!rxId) {
      showSuccessToast('Prescription not available yet', 'error');
      return;
    }
    navigate(`/profile/prescriptions/${rxId}`, {
      state: {
        appointment_id: appointment?.appointment_id || appointment?.consultation_id || routeLookupId,
        consultation_id: appointment?.consultation_id || routeLookupId,
        PrisData: detail,
        doctorData: doctor,
      },
    });
  };

  const joinCall = () => {
    if (!isLive) {
      showSuccessToast(
        'Video call is not active yet. Please wait for the doctor to start the consultation.',
        'error',
      );
      return;
    }
    const params = buildVideoCallNavParams(
      { rawData: detail, appointment },
      {
        role: 'patient',
        otherPartyName: formatDoctorDisplayName(doctorDisplayName(doctor)),
        otherPartyImage: doctorImage(doctor),
      },
    );
    if (!params.appointmentId) {
      showSuccessToast('Video call is not available for this appointment.', 'error');
      return;
    }
    navigate(`/profile/video/${params.appointmentId}`, { state: params });
  };

  const specialization = Array.isArray(doctor?.doctor_specialization)
    ? doctor.doctor_specialization.filter(Boolean).join(', ')
    : doctor?.doctor_specialization || doctor?.specialization || 'General Physician';
  const displayDate = formatAppointmentDateFull(schedule.date || appointment?.appointment_date);
  const displayStart =
    formatAppointmentTimeLabel(schedule.time || appointment?.start_time) ||
    formatSlotTime(appointment?.start_time);
  const displayEnd =
    formatAppointmentTimeLabel(appointment?.end_time) || formatSlotTime(appointment?.end_time);
  const appointmentCode = appointment?.appointment_id ?? appointment?.id ?? ids.appointmentId;
  const shareMessage = getAppointmentShareMessage({
    doctorName: formatDoctorDisplayName(doctorDisplayName(doctor)),
    patientPhone: patient?.phone || patient?.mobile || '',
    date: displayDate,
    time: displayEnd ? `${displayStart} – ${displayEnd}` : displayStart,
    status: formatLabel(status) || 'Confirmed',
    hospitalName: doctor?.hospital_name || appointment?.hospital_name,
    consultationMode: appointment?.consultation_mode || appointment?.mode || 'Video consultation',
  });

  const doctorName = formatDoctorDisplayName(doctorDisplayName(doctor));
  const doctorPhoto = doctorImage(doctor);
  const timeRange = displayEnd ? `${displayStart} – ${displayEnd}` : displayStart;
  const consultType = formatLabel(appointment?.consultation_type ?? appointment?.mode) || 'Video consultation';
  const patientMeta = [
    formatLabel(patient?.relation ?? patient?.patient_relation),
    patient?.age ? `${patient.age} yrs` : '',
    formatLabel(patient?.gender),
  ]
    .filter(Boolean)
    .join(' · ');
  const reviewRating = Number(appointment?.review?.rating || 0);

  const openChat = () =>
    navigate(`/profile/chat/${chatId}`, {
      state: {
        role: 'patient',
        doctorName: doctor?.doctor_name || doctorDisplayName(doctor),
        doctorAvatar: doctorPhoto || doctor?.doctor_image,
        patientName: patient?.patient_name,
        patientAvatar: patient?.patient_image,
        appointmentDate: appointment?.appointment_date,
        doctorId,
        chatContext: {
          call_status: appointment?.call_status,
          appointment_status: appointment?.appointment_status,
          appointment_date: appointment?.appointment_date,
          follow_up: appointment?.follow_up || detail?.prescription?.follow_up || detail?.follow_up,
        },
      },
    });

  return (
    <AppShell tab="profile">
      <DetailPage>
        <DetailTop
          backTo="/profile/appointments"
          backLabel="Appointments"
          actions={
            <>
              {detail ? (
                <ShareButton
                  title="Ayurmuni Appointment"
                  text={shareMessage}
                  url={`${window.location.origin}/profile/appointments/${routeLookupId}`}
                  variant="soft"
                  size="sm"
                />
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<RefreshCw size={14} aria-hidden />}
                loading={refreshing}
                disabled={loading}
                onClick={onRefresh}
              >
                Refresh
              </Button>
            </>
          }
        />

        {loading ? (
          <DetailSkeleton media={false} label="Loading appointment" />
        ) : !detail ? (
          <DetailEmpty
            icon={CalendarX}
            title="Appointment not found"
            text="This visit may have been removed or the link is incomplete."
            action={<Button onClick={() => navigate('/profile/appointments')}>My appointments</Button>}
          />
        ) : (
          <>
            <DetailHero
              variant="band"
              titleId="appointment-title"
              avatar={doctorPhoto ? <img src={doctorPhoto} alt="" /> : initialsOf(doctorName)}
              eyebrow={appointmentCode ? `Appointment · #${formatAppointmentId(appointmentCode)}` : 'Appointment'}
              title={doctorName}
              lede={specialization}
              chips={
                <>
                  {isLive ? (
                    <MetaChip icon={Radio} tone="gold">
                      Live now
                    </MetaChip>
                  ) : null}
                  {displayDate || appointment?.appointment_date ? (
                    <MetaChip icon={CalendarDays}>{displayDate || appointment?.appointment_date}</MetaChip>
                  ) : null}
                  {timeRange ? <MetaChip icon={Clock}>{timeRange}</MetaChip> : null}
                  <MetaChip icon={Video}>{consultType}</MetaChip>
                </>
              }
              aside={
                <>
                  <StatusPill status={status}>{formatLabel(status) || 'Booked'}</StatusPill>
                  {paymentAmount != null ? (
                    <div className="dx-figure">
                      <small>Consultation fee</small>
                      <strong>{formatRupee(paymentAmount)}</strong>
                    </div>
                  ) : null}
                </>
              }
            >
              {isLive || canOpenChat || showButtons ? (
                <div className="dx-actions dx-actions--row">
                  {isLive ? (
                    <Button variant="accent" size="sm" leadingIcon={<Video size={14} aria-hidden />} onClick={joinCall}>
                      Join video call
                    </Button>
                  ) : null}
                  {canOpenChat ? (
                    <Button
                      variant={isLive ? 'secondary' : 'accent'}
                      size="sm"
                      leadingIcon={<MessageCircle size={14} aria-hidden />}
                      onClick={openChat}
                    >
                      Chat with doctor
                    </Button>
                  ) : null}
                  {showButtons ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      leadingIcon={<CalendarClock size={14} aria-hidden />}
                      onClick={openReschedule}
                    >
                      {isRescheduleRequest ? 'Request change' : 'Reschedule'}
                    </Button>
                  ) : null}
                  {showButtons ? (
                    <Button variant="secondary" size="sm" onClick={openCancelFlow}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </DetailHero>

            <DetailLayout
              aside={
                <>
                  <DetailCard id="appointment-records" title="Visit records" icon={FileText}>
                    <div className="dx-actions">
                      {showPrescriptionCta ? (
                        <DetailLink
                          icon={Pill}
                          title="View prescription"
                          text="Medicines, advice and follow-up from this visit"
                          onClick={openPrescription}
                        />
                      ) : null}
                      {ids.consultationId ? (
                        <DetailLink
                          icon={ReceiptText}
                          title="Medical receipt"
                          text="Download your consultation payment receipt"
                          onClick={() => navigate(`/profile/receipts/${ids.consultationId}`)}
                        />
                      ) : null}
                      {showAddToCalendar ? (
                        <DetailLink
                          icon={CalendarPlus}
                          title="Add to calendar"
                          text="Save this visit on your device"
                          onClick={addToCalendar}
                        />
                      ) : null}
                      {doctorId ? (
                        <DetailLink
                          icon={Stethoscope}
                          title="View doctor profile"
                          text="Experience, reviews and next available slots"
                          onClick={() => navigate(`/consult/doctors/${doctorId}`)}
                        />
                      ) : null}
                    </div>
                  </DetailCard>

                  {showButtons ? (
                    <p className="dx-note">
                      <ShieldCheck size={14} aria-hidden />
                      Free cancellation up to 6 hours before your consultation.
                    </p>
                  ) : null}
                </>
              }
            >
              {appointment?.concern ? (
                <DetailCard id="appointment-concern" title="Reason for visit" icon={HeartPulse} tone="accent">
                  <p className="dx-prose">{appointment.concern}</p>
                </DetailCard>
              ) : null}

              <DetailCard id="appointment-facts" title="Appointment details" icon={CalendarDays}>
                <InfoGrid
                  items={[
                    { label: 'Appointment ID', value: appointmentCode ? formatAppointmentId(appointmentCode) : '' },
                    { label: 'Date', value: displayDate || appointment?.appointment_date },
                    { label: 'Time', value: timeRange },
                    { label: 'Consultation type', value: consultType },
                    { label: 'Status', value: formatLabel(appointment?.appointment_status) },
                    { label: 'Call status', value: formatLabel(appointment?.call_status) },
                    { label: 'Consultation fee', value: paymentAmount != null ? formatRupee(paymentAmount) : '' },
                    { label: 'Payment', value: formatLabel(paymentStatusValue) },
                    { label: 'Follow-up', value: followUpLabel(detail, appointment) },
                    { label: 'Cancellation reason', value: appointment?.cancellation_reason, wide: true },
                    { label: 'Reschedule reason', value: appointment?.reschedule_reason, wide: true },
                  ]}
                />
              </DetailCard>

              {patient ? (
                <DetailCard id="appointment-patient" title="Patient" icon={UserRound}>
                  <PersonCard
                    image={patient.patient_image}
                    name={patient.patient_name || 'Patient'}
                    role={patientMeta}
                  />
                  <InfoGrid
                    items={[
                      { label: 'Phone', value: patient.phone_number ?? patient.phone },
                      { label: 'Email', value: patient.email },
                    ]}
                  />
                </DetailCard>
              ) : null}

              {status === 'completed' ? (
                <DetailCard id="appointment-review" title="Your review" icon={Star}>
                  {alreadyReviewed ? (
                    <>
                      <span className="dx-stars" role="img" aria-label={`Rated ${reviewRating} out of 5`}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} size={20} className={star <= reviewRating ? 'is-on' : ''} aria-hidden />
                        ))}
                      </span>
                      {appointment?.review?.review ? <p className="dx-prose">{appointment.review.review}</p> : null}
                    </>
                  ) : (
                    <Button variant="secondary" leadingIcon={<Star size={16} aria-hidden />} onClick={() => setReviewOpen(true)}>
                      Rate your consultation
                    </Button>
                  )}
                </DetailCard>
              ) : null}
            </DetailLayout>
          </>
        )}

        <Modal
          open={cancelOpen}
          onClose={() => !saving && setCancelOpen(false)}
          title="Cancel appointment"
          description="Please review the cancellation notes before confirming."
          footer={
            <>
              <Button variant="secondary" onClick={() => setCancelOpen(false)} disabled={saving}>
                Keep appointment
              </Button>
              <Button
                variant="danger"
                loading={saving}
                disabled={!cancelReason}
                onClick={() =>
                  runAction({
                    action: 'cancel',
                    cancellation_reason: cancelNote.trim()
                      ? `${cancelReason} — ${cancelNote.trim()}`
                      : cancelReason,
                  })
                }
              >
                Confirm cancel
              </Button>
            </>
          }
        >
          <ul className="dx-notes">
            {CANCEL_NOTES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="dx-field-label">Reason for cancellation</p>
          <div className="dx-chip-group">
            {CANCEL_REASONS.map((item) => (
              <Chip key={item} selected={cancelReason === item} onClick={() => setCancelReason(item)}>
                {item}
              </Chip>
            ))}
          </div>
          <Textarea
            rows={3}
            placeholder="Add a note (optional)"
            value={cancelNote}
            onChange={(e) => setCancelNote(e.target.value)}
          />
        </Modal>

        <Modal
          open={activateOpen}
          onClose={() => setActivateOpen(false)}
          title="Switch patient profile"
          description={
            patient?.patient_name
              ? `${patient.patient_name} is not the active profile. Activate this patient to cancel the appointment.`
              : 'This appointment belongs to an inactive patient profile. Activate that patient to cancel the appointment.'
          }
          footer={
            <>
              <Button variant="secondary" onClick={() => setActivateOpen(false)}>
                Not now
              </Button>
              <Button loading={activating} onClick={confirmActivateThenCancel}>
                Activate and continue
              </Button>
            </>
          }
        />

        <Modal
          open={rescheduleOpen}
          onClose={() => !saving && setRescheduleOpen(false)}
          title={isRescheduleRequest ? 'Request change' : 'Reschedule appointment'}
          description={`Pick a new slot with ${doctorName}.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setRescheduleOpen(false)} disabled={saving}>
                Close
              </Button>
              <Button
                loading={saving}
                disabled={!slotId}
                onClick={() =>
                  runAction({
                    action: isRescheduleRequest ? 'confirm_reschedule' : 'reschedule',
                    availability: slotId,
                    ...(!isRescheduleRequest ? { reschedule_reason: rescheduleReason.trim() } : {}),
                  })
                }
              >
                Confirm
              </Button>
            </>
          }
        >
          <div className="dx-month">
            <button
              type="button"
              aria-label="Previous month"
              disabled={monthOffset === 0}
              onClick={() => setMonthOffset((n) => n - 1)}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <strong>{monthLabel}</strong>
            <button type="button" aria-label="Next month" onClick={() => setMonthOffset((n) => n + 1)}>
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
          <div className="dx-dates" role="listbox" aria-label="Choose a date">
            {dates.map((item) => (
              <button
                key={item.fullDate}
                type="button"
                role="option"
                aria-selected={slotDate === item.fullDate}
                className={slotDate === item.fullDate ? 'is-on' : ''}
                onClick={() => {
                  setSlotDate(item.fullDate);
                  loadSlots(item.fullDate);
                }}
              >
                <small>{item.label}</small>
                <strong>{item.day}</strong>
              </button>
            ))}
          </div>
          {slotsLoading ? (
            <SkeletonText lines={2} />
          ) : (
            (() => {
              const open = slots.filter((slot) => isSlotBookable(slot, slotDate));
              return open.length ? (
                <div className="dx-chip-group">
                  {open.map((slot) => (
                    <Chip
                      key={slot.id}
                      selected={String(slotId) === String(slot.id)}
                      onClick={() => setSlotId(slot.id)}
                    >
                      {formatSlotTime(slot.start_time)}
                    </Chip>
                  ))}
                </div>
              ) : (
                <p className="dx-note">No open slots on this day. Try another date.</p>
              );
            })()
          )}
          {!isRescheduleRequest ? (
            <Textarea
              rows={3}
              placeholder="Reason for reschedule"
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
            />
          ) : null}
        </Modal>

        <Modal
          open={reviewOpen && !alreadyReviewed}
          onClose={() => setReviewOpen(false)}
          title="Rate your consultation"
          description={`How was your visit with ${doctorName}?`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setReviewOpen(false)}>
                Later
              </Button>
              <Button
                disabled={!reviewStars}
                onClick={() => {
                  setReviewOpen(false);
                  openShareExperience(reviewStars);
                }}
              >
                Continue
              </Button>
            </>
          }
        >
          <div className="dx-stars dx-stars--pick" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={reviewStars === star}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
                className={star <= reviewStars ? 'is-on' : ''}
                onClick={() => setReviewStars(star)}
              >
                <Star size={28} aria-hidden />
              </button>
            ))}
          </div>
        </Modal>
      </DetailPage>
    </AppShell>
  );
}

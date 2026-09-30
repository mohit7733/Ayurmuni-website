import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import ShareButton from '../components/ShareButton';
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

const STATUS_STYLE = {
  confirmed: { background: '#eef4ff', color: '#1048b9' },
  upcoming: { background: '#eef4ff', color: '#1048b9' },
  booked: { background: '#eef4ff', color: '#1048b9' },
  pending: { background: '#fff7ed', color: '#ea580c' },
  cancelled: { background: '#fee2e2', color: '#ef4444' },
  completed: { background: '#dcfce7', color: '#16a34a' },
  missed: { background: '#f3f4f6', color: '#6b7280' },
  expired: { background: '#f3f4f6', color: '#6b7280' },
  no_show: { background: '#f3f4f6', color: '#6b7280' },
  noshow: { background: '#f3f4f6', color: '#6b7280' },
  reschedule: { background: '#fef3c7', color: '#b45309' },
  rescheduled: { background: '#fef3c7', color: '#b45309' },
};

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
  const statusStyle = STATUS_STYLE[status] || { background: '#f3f4f6', color: '#64748b' };
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

  return (
    <AppShell tab="profile">
      <section className="catalog-page appoint-detail-page">
        <PageHeader
          title="Appointment Details"
          subtitle={formatLabel(status) || 'Consultation'}
          backTo="/profile/appointments"
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
              <button type="button" className="ghost" onClick={onRefresh} disabled={refreshing || loading}>
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </>
          }
        />

        {loading ? (
          <p className="muted">Loading appointment…</p>
        ) : !detail ? (
          <div className="empty-copy">
            <strong>Appointment not found</strong>
            <p>This visit may have been removed or the link is incomplete.</p>
            <button type="button" className="cta" onClick={() => navigate('/profile/appointments')}>
              My appointments
            </button>
          </div>
        ) : (
          <div className="appoint-detail-layout">
            <div className="appoint-detail-main">
            {status ? (
              <span className="confirm-status" style={{ background: statusStyle.background, color: statusStyle.color }}>
                {formatLabel(status)}
              </span>
            ) : null}

            <div className="hero-doc compact appoint-hero">
              <div className="doctor-photo">
                {doctorImage(doctor) ? <img src={doctorImage(doctor)} alt="" /> : <span>+</span>}
              </div>
              <div>
                <div className="history-name-row">
                  <h2>{formatDoctorDisplayName(doctorDisplayName(doctor))}</h2>
                  {isLive ? <em className="live-badge">LIVE</em> : null}
                </div>
                <p>{specialization}</p>
              </div>
            </div>

            <div className="confirm-meta-grid appoint-meta">
              <div className="confirm-meta-chip">
                <small>Date</small>
                <strong>{displayDate || appointment?.appointment_date || '—'}</strong>
              </div>
              <div className="confirm-meta-chip">
                <small>Time</small>
                <strong>
                  {displayEnd ? `${displayStart} – ${displayEnd}` : displayStart || '—'}
                </strong>
              </div>
            </div>

            {patient ? (
              <div className="checkout-card appoint-patient">
                <h3>Patient information</h3>
                {[
                  ['Name', patient.patient_name],
                  ['Relation', patient.relation ?? patient.patient_relation],
                  ['Age', patient.age],
                  ['Gender', formatLabel(patient.gender)],
                  ['Phone', patient.phone_number ?? patient.phone],
                  ['Email', patient.email],
                ]
                  .filter(([, value]) => value !== undefined && value !== null && value !== '')
                  .map(([label, value]) => (
                    <div key={label} className="txn-detail-row">
                      <span>{label}</span>
                      <strong>{String(value)}</strong>
                    </div>
                  ))}
              </div>
            ) : null}

            <div className="checkout-card appoint-facts">
              <h3>Appointment details</h3>
              {[
                ['Appointment ID', appointmentCode ? formatAppointmentId(appointmentCode) : ''],
                ['Date', displayDate || appointment?.appointment_date],
                ['Start Time', displayStart],
                ['End Time', displayEnd],
                ['Status', formatLabel(appointment?.appointment_status)],
                ['Call Status', formatLabel(appointment?.call_status)],
                ['Consultation Type', formatLabel(appointment?.consultation_type ?? appointment?.mode)],
                ['Consultation Fee', paymentAmount != null ? formatRupee(paymentAmount) : null],
                ['Payment', formatLabel(paymentStatusValue)],
                ['Follow-up date', followUpLabel(detail, appointment)],
                ['Cancellation Reason', appointment?.cancellation_reason],
                ['Reschedule Reason', appointment?.reschedule_reason],
              ]
                .filter(([, value]) => value !== undefined && value !== null && value !== '')
                .map(([label, value]) => (
                  <div key={label} className="txn-detail-row">
                    <span>{label}</span>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
            </div>

            {appointment?.concern ? (
              <div className="checkout-card appoint-concern">
                <h3>Reason for visit</h3>
                <p>{appointment.concern}</p>
              </div>
            ) : null}

            {status === 'completed' ? (
              <div className="checkout-card appoint-review">
                <h3>Your review</h3>
                {alreadyReviewed ? (
                  <>
                    <div className="review-stars static">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className={star <= Number(appointment?.review?.rating || 0) ? 'on' : ''}>
                          ★
                        </span>
                      ))}
                    </div>
                    {appointment?.review?.review ? <p>{appointment.review.review}</p> : null}
                  </>
                ) : (
                  <button type="button" className="ghost" onClick={() => setReviewOpen(true)}>
                    Tap to rate your consultation
                  </button>
                )}
              </div>
            ) : null}
            </div>

            <aside className="appoint-detail-side">
            <div className="detail-cta appoint-hero-actions">
              {isLive ? (
                <button type="button" className="cta" onClick={joinCall}>
                  Join Video Call
                </button>
              ) : null}
              {canOpenChat ? (
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    navigate(`/profile/chat/${chatId}`, {
                      state: {
                        role: 'patient',
                        doctorName: doctor?.doctor_name || doctorDisplayName(doctor),
                        doctorAvatar: doctorImage(doctor) || doctor?.doctor_image,
                        patientName: patient?.patient_name,
                        patientAvatar: patient?.patient_image,
                        appointmentDate: appointment?.appointment_date,
                        doctorId,
                        chatContext: {
                          call_status: appointment?.call_status,
                          appointment_status: appointment?.appointment_status,
                          appointment_date: appointment?.appointment_date,
                          follow_up:
                            appointment?.follow_up ||
                            detail?.prescription?.follow_up ||
                            detail?.follow_up,
                        },
                      },
                    })
                  }
                >
                  Chat with Doctor
                </button>
              ) : null}
              {doctorId ? (
                <button type="button" className="ghost" onClick={() => navigate(`/consult/doctors/${doctorId}`)}>
                  View doctor
                </button>
              ) : null}
            </div>

            {showPrescriptionCta ? (
              <button type="button" className="checkout-card order-row appoint-link" onClick={openPrescription}>
                <p>
                  View Prescription
                  <small>Medicines, advice, and follow-up from this visit</small>
                </p>
              </button>
            ) : null}

            {ids.consultationId ? (
              <button
                type="button"
                className="checkout-card order-row appoint-link"
                onClick={() => navigate(`/profile/receipts/${ids.consultationId}`)}
              >
                <p>
                  Medical Receipt
                  <small>Download your consultation payment receipt</small>
                </p>
              </button>
            ) : null}

            {showAddToCalendar ? (
              <button type="button" className="checkout-card order-row appoint-link" onClick={addToCalendar}>
                <p>
                  Add to Calendar
                  <small>Save this visit on your device</small>
                </p>
              </button>
            ) : null}

            {showButtons ? (
              <div className="checkout-sticky">
                <button type="button" className="ghost" onClick={openReschedule}>
                  {isRescheduleRequest ? 'Request change' : 'Reschedule'}
                </button>
                <button type="button" className="cta danger" onClick={openCancelFlow}>
                  Cancel
                </button>
              </div>
            ) : null}
            </aside>
          </div>
        )}

        {cancelOpen ? (
          <div className="web-modal" role="dialog">
            <div className="web-modal-card">
              <h3>Cancel Appointment</h3>
              <p>Please review the cancellation notes before confirming.</p>
              <ul className="cancel-notes">
                {CANCEL_NOTES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>Reason for cancellation</p>
              {CANCEL_REASONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`chip ${cancelReason === item ? 'on' : ''}`}
                  onClick={() => setCancelReason(item)}
                >
                  {item}
                </button>
              ))}
              <textarea
                rows={3}
                placeholder="Add a note (optional)"
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
              />
              <div className="detail-cta">
                <button type="button" className="ghost" onClick={() => setCancelOpen(false)} disabled={saving}>
                  Keep appointment
                </button>
                <button
                  type="button"
                  className="cta danger"
                  disabled={saving || !cancelReason}
                  onClick={() =>
                    runAction({
                      action: 'cancel',
                      cancellation_reason: cancelNote.trim()
                        ? `${cancelReason} — ${cancelNote.trim()}`
                        : cancelReason,
                    })
                  }
                >
                  {saving ? 'Cancelling…' : 'Confirm cancel'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activateOpen ? (
          <div className="web-modal" role="dialog">
            <div className="web-modal-card">
              <h3>Switch patient profile</h3>
              <p>
                {patient?.patient_name
                  ? `${patient.patient_name} is not the active profile. Activate this patient to cancel the appointment.`
                  : 'This appointment belongs to an inactive patient profile. Activate that patient to cancel the appointment.'}
              </p>
              <div className="detail-cta">
                <button type="button" className="ghost" onClick={() => setActivateOpen(false)}>
                  Not now
                </button>
                <button type="button" className="cta" disabled={activating} onClick={confirmActivateThenCancel}>
                  {activating ? 'Switching…' : 'Activate and continue'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {rescheduleOpen ? (
          <div className="web-modal" role="dialog">
            <div className="web-modal-card">
              <h3>{isRescheduleRequest ? 'Request change' : 'Reschedule'}</h3>
              <div className="month-nav">
                <button type="button" className="ghost" disabled={monthOffset === 0} onClick={() => setMonthOffset((n) => n - 1)}>
                  ‹
                </button>
                <span>{monthLabel}</span>
                <button type="button" className="ghost" onClick={() => setMonthOffset((n) => n + 1)}>
                  ›
                </button>
              </div>
              <div className="home-rail date-rail">
                {dates.map((item) => (
                  <button
                    key={item.fullDate}
                    type="button"
                    className={`date-chip ${slotDate === item.fullDate ? 'on' : ''}`}
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
                <p className="muted">Loading slots…</p>
              ) : (
                <div className="slot-grid">
                  {slots.filter((slot) => isSlotBookable(slot, slotDate)).map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      className={`chip ${String(slotId) === String(slot.id) ? 'on' : ''}`}
                      onClick={() => setSlotId(slot.id)}
                    >
                      {formatSlotTime(slot.start_time)}
                    </button>
                  ))}
                </div>
              )}
              {!isRescheduleRequest ? (
                <textarea
                  rows={3}
                  placeholder="Reason for reschedule"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                />
              ) : null}
              <div className="detail-cta">
                <button type="button" className="ghost" onClick={() => setRescheduleOpen(false)} disabled={saving}>
                  Close
                </button>
                <button
                  type="button"
                  className="cta"
                  disabled={saving || !slotId}
                  onClick={() =>
                    runAction({
                      action: isRescheduleRequest ? 'confirm_reschedule' : 'reschedule',
                      availability: slotId,
                      ...(!isRescheduleRequest ? { reschedule_reason: rescheduleReason.trim() } : {}),
                    })
                  }
                >
                  {saving ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {reviewOpen && !alreadyReviewed ? (
          <div className="web-modal" role="dialog">
            <div className="web-modal-card">
              <h3>Rate your consultation</h3>
              <p>How was your visit with {formatDoctorDisplayName(doctorDisplayName(doctor))}?</p>
              <div className="review-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={star <= reviewStars ? 'on' : ''}
                    onClick={() => setReviewStars(star)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <div className="detail-cta">
                <button type="button" className="ghost" onClick={() => setReviewOpen(false)}>
                  Later
                </button>
                <button
                  type="button"
                  className="cta"
                  disabled={!reviewStars}
                  onClick={() => {
                    setReviewOpen(false);
                    openShareExperience(reviewStars);
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

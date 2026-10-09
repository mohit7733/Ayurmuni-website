import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, Check, Copy, Mail, MessageCircle, Share2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  CONSULT_BOOKING_KEY,
  doctorDisplayName,
  doctorImage,
  resolveDoctorSpecializations,
} from '../consult/doctors';
import {
  formatDoctorDisplayName,
  getConsultationScheduleLabels,
} from '../consult/appointmentUtils';
import { getAppointmentShareMessage } from '../helper/shareMessage';
import { formatRupee } from '../home/catalog';
import { formatAppointmentId } from '../utils/formatDisplayId';
import { showSuccessToast } from '../config/key';
import { Utils } from '../common/utils';
import {
  Badge,
  Button,
  Disclaimer,
  EmptyState,
  Modal,
  StepIndicator,
} from '../components/ui';
import {
  BOOKING_COPY as T,
  BOOKING_STATUS_TONE,
  bookingStatusLabel,
} from '../content/booking';
import '../design/pages/booking.css';

const pick = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
};

const SHARE_OPTIONS = [
  { id: 'whatsapp', title: 'WhatsApp', icon: MessageCircle },
  { id: 'message', title: 'Messages', icon: Share2 },
  { id: 'email', title: 'Email', icon: Mail },
  { id: 'copy', title: 'Copy', icon: Copy },
];

const bookingCode = (detail) =>
  pick(
    detail?.consultation_id,
    detail?.booking_id,
    detail?.booking_code,
    detail?.order_code,
    detail?.reference_code,
    detail?.appointment_id,
    detail?.id,
    detail?.slot?.id,
    detail?.appointment?.id,
  );

const MetaChip = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="bk-meta-chip">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
};

const shareByType = async (type, message) => {
  if (type === 'copy') {
    await navigator.clipboard.writeText(message);
    showSuccessToast('Copied appointment details', 'success');
    return;
  }
  if (type === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    return;
  }
  if (type === 'email') {
    window.location.href = `mailto:?subject=${encodeURIComponent('Appointment Details')}&body=${encodeURIComponent(message)}`;
    return;
  }
  if (type === 'message') {
    if (navigator.share) {
      await navigator.share({ title: 'Ayurmuni Appointment', text: message });
      return;
    }
    window.location.href = `sms:?body=${encodeURIComponent(message)}`;
  }
};

export default function BookingConfirm() {
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);
  const [registeredPhone, setRegisteredPhone] = useState('');

  const detail = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(CONSULT_BOOKING_KEY) || 'null');
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const info = await Utils.getData('_USER_INFO');
      if (!active) return;
      setRegisteredPhone(pick(info?.phone_number, info?.phone));
    })();
    return () => {
      active = false;
    };
  }, []);

  const booking = useMemo(() => {
    if (!detail) return null;
    const slot = detail.slot ?? detail.appointment ?? {};
    const info = detail.info ?? detail.doctor ?? {};
    const dateRaw = pick(slot?.date, detail.date, detail.appointment_date, slot?.appointment_date);
    const timeRaw = pick(slot?.slot_time, slot?.start_time, slot?.time, detail.slot_time, detail.start_time, detail.time);
    const endTimeRaw = pick(slot?.end_time, detail.end_time);
    const labels = getConsultationScheduleLabels({
      date: dateRaw,
      time: timeRaw,
      end_time: endTimeRaw,
      status: pick(detail.appointment_status, detail.status, slot?.appointment_status),
    });
    const specialization = Array.isArray(detail.doctor_specialization)
      ? detail.doctor_specialization.filter(Boolean).join(', ')
      : pick(
          detail.doctor_specialization,
          info?.specialization,
          info?.speciality,
          resolveDoctorSpecializations(info).join(', '),
          resolveDoctorSpecializations(detail.doctor).join(', '),
        );
    const timeRange = labels.endTimeLabel ? `${labels.timeLabel} – ${labels.endTimeLabel}` : labels.timeLabel;
    const status = pick(detail.appointment_status, detail.status, slot?.appointment_status, 'CONFIRMED');
    return {
      doctorName: formatDoctorDisplayName(
        pick(info?.doctor_name, detail.doctor_name, doctorDisplayName(info), doctorDisplayName(detail.doctor), 'Doctor'),
      ),
      doctorImage: pick(detail.doctor_image, doctorImage(info), doctorImage(detail.doctor)),
      specialization,
      dateRaw,
      weekday: labels.weekday,
      dateLabel: labels.dateLabel,
      timeLabel: labels.timeLabel,
      endTimeLabel: labels.endTimeLabel || '',
      timeRange,
      concern: pick(slot?.concern, detail.concern, detail.appointment?.concern),
      patientName: pick(
        detail.patient?.patient_name,
        detail.patient_name,
        detail.patient?.full_name,
        [detail.patient?.first_name, detail.patient?.last_name].filter(Boolean).join(' '),
        slot?.patient?.patient_name,
        detail.appointment?.patient?.patient_name,
      ),
      patientPhone: pick(
        detail.patient?.phone_number,
        detail.patient?.phone,
        slot?.patient?.phone_number,
        slot?.patient?.phone,
        detail.patient_phone,
        detail.appointment?.patient?.phone_number,
      ),
      hospitalName: pick(detail.hospital_name, info?.hospital_name, info?.clinic_name, detail.clinic_name),
      consultationMode: pick(detail.consultation_mode, detail.mode, slot?.consultation_mode, 'Video consultation'),
      bookingId: bookingCode(detail),
      status,
      amount: pick(detail.amount, detail.consultation_fee, detail.total_amount, detail.summary?.total_payable_amount, slot?.amount),
      startRaw: timeRaw,
      endRaw: endTimeRaw,
    };
  }, [detail]);

  if (!detail || !booking) {
    return (
      <AppShell tab="consult">
        <div className="bk-page">
          <EmptyState
            title={T.missingTitle}
            description={T.missingText}
            action={
              <>
                <Button variant="secondary" onClick={() => navigate('/consult')}>
                  {T.consultHome}
                </Button>
                <Button onClick={() => navigate('/home')}>{T.home}</Button>
              </>
            }
          />
        </div>
      </AppShell>
    );
  }

  const statusKey = String(booking.status).toUpperCase();
  const statusTone = BOOKING_STATUS_TONE[statusKey] || 'success';
  const statusLabel = bookingStatusLabel(booking.status);
  const dateDisplay = [booking.weekday, booking.dateLabel].filter(Boolean).join(', ');
  const paidLabel = booking.amount ? formatRupee(booking.amount) : '';
  const shareMessage = getAppointmentShareMessage({
    doctorName: booking.doctorName,
    patientPhone: booking.patientPhone || registeredPhone,
    date: dateDisplay,
    time: booking.timeRange,
    status: statusLabel,
    hospitalName: booking.hospitalName,
    consultationMode: booking.consultationMode,
  });

  const addToCalendar = () => {
    navigate('/consult/add-calendar', {
      state: {
        appointment: {
          doctorName: booking.doctorName,
          doctorImage: booking.doctorImage,
          specialization: booking.specialization,
          date: booking.dateRaw,
          dateLabel: booking.dateLabel,
          weekday: booking.weekday,
          startTime: booking.startRaw || booking.timeLabel,
          endTime: booking.endRaw || booking.endTimeLabel,
          timeLabel: booking.timeLabel,
          timeRange: booking.timeRange,
          concern: booking.concern,
          hospitalName: booking.hospitalName,
          bookingId: booking.bookingId,
          status: booking.status,
        },
      },
    });
  };

  const onShare = async (type) => {
    try {
      await shareByType(type, shareMessage);
    } catch {
      showSuccessToast('Unable to share right now', 'error');
    } finally {
      setShareOpen(false);
    }
  };

  return (
    <AppShell tab="consult">
      <div className="bk-page bk-confirm-page">
        <StepIndicator steps={T.steps} current={2} label={T.stepsLabel} />

        <section className="bk-success" aria-labelledby="bk-confirm-title">
          <span className="bk-success__icon" aria-hidden>
            <Check size={28} strokeWidth={3} />
          </span>
          <h1 id="bk-confirm-title">{T.confirmTitle}</h1>
          <p>{T.confirmLede}</p>
          <div className="bk-success__meta">
            <Badge tone={statusTone}>{statusLabel}</Badge>
            {booking.bookingId ? (
              <Badge tone="neutral">
                {T.bookingId} {formatAppointmentId(booking.bookingId)}
              </Badge>
            ) : null}
          </div>
        </section>

        <div className="bk-layout bk-confirm-layout">
          <div className="bk-main">
            <section className="bk-card">
              <div className="bk-doctor">
                <span className="bk-doctor__photo" aria-hidden={!booking.doctorImage}>
                  {booking.doctorImage ? (
                    <img src={booking.doctorImage} alt="" />
                  ) : (
                    <span>{booking.doctorName.charAt(0)}</span>
                  )}
                </span>
                <div className="bk-doctor__copy">
                  <strong>{booking.doctorName}</strong>
                  {booking.specialization ? <p>{booking.specialization}</p> : null}
                  {booking.hospitalName ? <small>{booking.hospitalName}</small> : null}
                </div>
              </div>
              <div className="bk-meta-grid">
                <MetaChip label={T.date} value={dateDisplay} />
                <MetaChip label={T.time} value={booking.timeRange} />
                <MetaChip label={T.mode} value={booking.consultationMode} />
                <MetaChip label={T.paid} value={paidLabel} />
              </div>
            </section>
          </div>

          <aside className="bk-aside bk-confirm-aside">
            {booking.patientName || booking.concern || booking.hospitalName ? (
              <section className="bk-card" aria-labelledby="bk-details-title">
                <div className="bk-card__head">
                  <h2 id="bk-details-title">{T.details}</h2>
                </div>
                <dl className="bk-info-rows">
                  {booking.patientName ? (
                    <div>
                      <dt>{T.patient}</dt>
                      <dd>{booking.patientName}</dd>
                    </div>
                  ) : null}
                  {booking.concern ? (
                    <div>
                      <dt>{T.concernLabel}</dt>
                      <dd>{booking.concern}</dd>
                    </div>
                  ) : null}
                  {booking.hospitalName ? (
                    <div>
                      <dt>{T.clinic}</dt>
                      <dd>{booking.hospitalName}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            <div className="bk-actions">
              <Button variant="secondary" onClick={addToCalendar} leadingIcon={<CalendarPlus size={16} aria-hidden />}>
                {T.calendar}
              </Button>
              <Button variant="secondary" onClick={() => setShareOpen(true)} leadingIcon={<Share2 size={16} aria-hidden />}>
                {T.share}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/profile/appointments')}>
                {T.appointments}
              </Button>
            </div>

            <div className="bk-aside__cta">
              <Button size="lg" block onClick={() => navigate('/home', { replace: true })}>
                {T.home}
              </Button>
            </div>
            <Disclaimer />
          </aside>
        </div>
      </div>

      <div className="bk-sticky bk-confirm-sticky" role="region" aria-label={T.home}>
        <Button block onClick={() => navigate('/home', { replace: true })}>
          {T.home}
        </Button>
      </div>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title={T.shareTitle} description={T.shareLede} size="sm">
        <div className="bk-share-preview">
          <div className="bk-doctor">
            <span className="bk-doctor__photo" aria-hidden={!booking.doctorImage}>
              {booking.doctorImage ? (
                <img src={booking.doctorImage} alt="" />
              ) : (
                <span>{booking.doctorName.charAt(0)}</span>
              )}
            </span>
            <div className="bk-doctor__copy">
              <strong>{booking.doctorName}</strong>
              {booking.specialization ? <p>{booking.specialization}</p> : null}
              <small>{[dateDisplay, booking.timeRange].filter(Boolean).join(' · ')}</small>
            </div>
          </div>
        </div>
        <div className="bk-share-options">
          {SHARE_OPTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" className="bk-share-option" onClick={() => onShare(item.id)}>
                <span className="bk-share-option__icon" aria-hidden>
                  <Icon size={18} />
                </span>
                {item.title}
              </button>
            );
          })}
        </div>
        <Button variant="secondary" block onClick={() => setShareOpen(false)}>
          {T.cancel}
        </Button>
      </Modal>
    </AppShell>
  );
}

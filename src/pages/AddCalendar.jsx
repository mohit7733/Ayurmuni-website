import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, Download, ExternalLink } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import {
  formatAppointmentDateFull,
  formatAppointmentTimeLabel,
  formatAppointmentWeekday,
  formatDoctorDisplayName,
} from '../consult/appointmentUtils';
import {
  CONSULT_BOOKING_KEY,
  doctorDisplayName,
  doctorImage,
  resolveDoctorSpecializations,
} from '../consult/doctors';
import { showSuccessToast } from '../config/key';
import { formatAppointmentId } from '../utils/formatDisplayId';
import {
  buildAppointmentCalendarEvent,
  openGoogleCalendar,
  openOutlookCalendar,
  shareCalendarInvite,
} from '../utils/calendarUtils';
import {
  Badge,
  Button,
  Disclaimer,
  EmptyState,
} from '../components/ui';
import {
  BOOKING_COPY as T,
  BOOKING_STATUS_TONE,
  bookingStatusLabel,
} from '../content/booking';
import '../design/pages/booking.css';

const CALENDAR_OPTIONS = [
  {
    key: 'google',
    label: 'Google Calendar',
    hint: 'Opens in a new tab',
    icon: ExternalLink,
  },
  {
    key: 'outlook',
    label: 'Outlook Calendar',
    hint: 'Opens in a new tab',
    icon: ExternalLink,
  },
  {
    key: 'device',
    label: 'Other calendar apps',
    hint: 'Download .ics invite',
    icon: Download,
  },
];

const pick = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
};

const appointmentFromStoredBooking = () => {
  try {
    const detail = JSON.parse(sessionStorage.getItem(CONSULT_BOOKING_KEY) || 'null');
    if (!detail) return null;
    const slot = detail.slot ?? detail.appointment ?? {};
    const info = detail.info ?? detail.doctor ?? {};
    const specialization = Array.isArray(detail.doctor_specialization)
      ? detail.doctor_specialization.filter(Boolean).join(', ')
      : pick(detail.doctor_specialization, resolveDoctorSpecializations(info).join(', '));
    return {
      doctorName: pick(detail.doctor_name, doctorDisplayName(info), doctorDisplayName(detail.doctor), 'Doctor'),
      doctorImage: pick(detail.doctor_image, doctorImage(info), doctorImage(detail.doctor)),
      specialization,
      date: pick(slot?.date, detail.date, detail.appointment_date),
      startTime: pick(slot?.start_time, detail.start_time, slot?.slot_time),
      endTime: pick(slot?.end_time, detail.end_time),
      concern: pick(slot?.concern, detail.concern),
      hospitalName: pick(detail.hospital_name, info?.hospital_name, info?.clinic_name),
      bookingId: pick(detail.consultation_id, detail.booking_id, detail.appointment_id, detail.id),
      status: pick(detail.appointment_status, detail.status, 'CONFIRMED'),
    };
  } catch {
    return null;
  }
};

export default function AddCalendar() {
  const navigate = useNavigate();
  const locationAppointment = useLocation().state?.appointment;
  const appointment = useMemo(() => {
    if (locationAppointment && Object.keys(locationAppointment).length) return locationAppointment;
    return appointmentFromStoredBooking() || {};
  }, [locationAppointment]);
  const hasAppointment = Object.keys(appointment).length > 0;
  const [busy, setBusy] = useState(null);

  const display = useMemo(() => {
    const dateRaw = appointment.date || appointment.appointment_date || '';
    const startRaw = appointment.startTime || appointment.time || appointment.slot_time || '';
    const endRaw = appointment.endTime || appointment.end_time || '';
    const weekday = appointment.weekday || formatAppointmentWeekday(dateRaw);
    const dateLabel = appointment.dateLabel || formatAppointmentDateFull(dateRaw);
    const startLabel = appointment.timeLabel || formatAppointmentTimeLabel(startRaw) || startRaw;
    const endLabel = endRaw ? formatAppointmentTimeLabel(endRaw) || endRaw : '';
    const timeRange = appointment.timeRange || (endLabel ? `${startLabel} – ${endLabel}` : startLabel);
    return {
      doctorName: formatDoctorDisplayName(appointment.doctorName || 'Doctor'),
      doctorImage: appointment.doctorImage || '',
      specialization: appointment.specialization || '',
      dateRaw,
      weekday,
      dateLabel,
      startRaw,
      endRaw,
      timeRange,
      concern: appointment.concern || '',
      hospitalName: appointment.hospitalName || '',
      bookingId: appointment.bookingId || '',
      status: appointment.status || 'CONFIRMED',
    };
  }, [appointment]);

  const calendarEvent = useMemo(
    () =>
      buildAppointmentCalendarEvent({
        doctorName: display.doctorName,
        specialization: display.specialization,
        date: display.dateRaw,
        startTime: display.startRaw,
        endTime: display.endRaw,
        concern: display.concern,
        hospitalName: display.hospitalName,
        bookingId: display.bookingId,
      }),
    [display],
  );

  const runAction = async (type) => {
    if (!display.dateRaw) {
      showSuccessToast('Appointment date is missing', 'error');
      return;
    }
    try {
      setBusy(type);
      if (type === 'google') openGoogleCalendar(calendarEvent);
      else if (type === 'outlook') openOutlookCalendar(calendarEvent);
      else await shareCalendarInvite(calendarEvent);
    } finally {
      setBusy(null);
    }
  };

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/home');
  };

  const statusKey = String(display.status || '').toUpperCase();
  const statusTone = BOOKING_STATUS_TONE[statusKey] || 'success';
  const statusLabel = bookingStatusLabel(display.status);

  if (!hasAppointment) {
    return (
      <AppShell tab="consult">
        <div className="bk-page">
          <PageHeader title={T.calTitle} subtitle={T.calSubtitle} />
          <EmptyState
            title={T.calMissing}
            action={
              <>
                <Button variant="secondary" onClick={() => navigate('/consult')}>
                  {T.consultHome}
                </Button>
                <Button onClick={goBack}>{T.cancel}</Button>
              </>
            }
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell tab="consult">
      <div className="bk-page">
        <PageHeader title={T.calTitle} subtitle={T.calSubtitle} onBack={goBack} />

        <section className="bk-cal-hero" aria-labelledby="bk-cal-hero-title">
          <span className="bk-cal-hero__icon" aria-hidden>
            <CalendarDays size={24} />
          </span>
          <h2 id="bk-cal-hero-title">{T.calHeroTitle}</h2>
          <p>
            Add {display.doctorName} to your calendar for timely reminders.
          </p>
        </section>

        <div className="bk-layout">
          <div className="bk-main">
            <section className="bk-card">
              <div className="bk-doctor">
                <span className="bk-doctor__photo" aria-hidden={!display.doctorImage}>
                  {display.doctorImage ? (
                    <img src={display.doctorImage} alt="" />
                  ) : (
                    <span>{display.doctorName.charAt(0)}</span>
                  )}
                </span>
                <div className="bk-doctor__copy">
                  <strong>{display.doctorName}</strong>
                  {display.specialization ? <p>{display.specialization}</p> : null}
                  <Badge tone={statusTone}>{statusLabel}</Badge>
                </div>
              </div>
              <dl className="bk-info-rows bk-info-rows--spaced">
                <div>
                  <dt>{T.date}</dt>
                  <dd>{[display.weekday, display.dateLabel].filter(Boolean).join(', ')}</dd>
                </div>
                {display.timeRange ? (
                  <div>
                    <dt>{T.time}</dt>
                    <dd>{display.timeRange}</dd>
                  </div>
                ) : null}
                {display.concern ? (
                  <div>
                    <dt>{T.concernLabel}</dt>
                    <dd>{display.concern}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>{T.location}</dt>
                  <dd>{display.hospitalName || T.videoDefault}</dd>
                </div>
                {display.bookingId ? (
                  <div>
                    <dt>{T.bookingId}</dt>
                    <dd>{formatAppointmentId(display.bookingId)}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          </div>

          <aside className="bk-aside">
            <section className="bk-card" aria-labelledby="bk-cal-choose">
              <div className="bk-card__head">
                <h2 id="bk-cal-choose">{T.calChoose}</h2>
              </div>
              <div className="bk-cal-options">
                {CALENDAR_OPTIONS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className="bk-cal-option"
                      disabled={Boolean(busy)}
                      onClick={() => runAction(item.key)}
                    >
                      <span className="bk-cal-option__icon" aria-hidden>
                        <Icon size={18} />
                      </span>
                      <span className="bk-cal-option__copy">
                        <strong>{item.label}</strong>
                        <small>{busy === item.key ? '…' : item.hint}</small>
                      </span>
                      <ChevronRight size={18} className="bk-cal-option__chev" aria-hidden />
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="bk-aside__cta">
              <Button size="lg" block onClick={goBack}>
                {T.calDone}
              </Button>
              <Button variant="ghost" onClick={goBack}>
                {T.calLater}
              </Button>
            </div>
            <Disclaimer />
          </aside>
        </div>
      </div>

      <div className="bk-sticky" role="region" aria-label={T.calDone}>
        <Button block onClick={goBack}>
          {T.calDone}
        </Button>
      </div>
    </AppShell>
  );
}

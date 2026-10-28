import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Video } from 'lucide-react';
import {
  buildVideoCallNavParams,
  formatAppointmentDayShort,
  formatAppointmentTimeLabel,
  formatDoctorDisplayName,
  getJoinableAppointment,
  getMsUntilJoinWindowChange,
  isActiveAppointmentStatus,
  isAppointmentInPast,
  sortAppointmentsByDateTime,
} from '../consult/appointmentUtils';
import { requireAuth } from '../services/guestAuth';
import './home-upcoming.css';

const statusLabel = (status) => {
  const raw = String(status || '').replace(/_/g, ' ').trim();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : '';
};

const initialsOf = (name) =>
  String(name || '')
    .replace(/^(dr|prof)\.?\s*/gi, '')
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'Dr';

/** "in 3 hrs" / "in 25 min" / "Tomorrow" / "in 4 days"; '' when the start can't be parsed. */
const relativeStart = (item) => {
  const date = String(item?.date || '').slice(0, 10);
  const time = String(item?.time || '00:00').slice(0, 8);
  const start = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`);
  if (!date || Number.isNaN(start.getTime())) return '';
  const mins = Math.round((start.getTime() - Date.now()) / 60000);
  if (mins <= 0) return 'Now';
  if (mins < 60) return `in ${mins} min`;
  if (mins < 24 * 60) {
    const hrs = Math.round(mins / 60);
    return `in ${hrs} hr${hrs > 1 ? 's' : ''}`;
  }
  const days = Math.round(mins / (24 * 60));
  return days === 1 ? 'Tomorrow' : `in ${days} days`;
};

/**
 * Mirrors app HomeJoinAppointmentsSection: confirmed, not past, sorted by start;
 * Join banner inside the 5-min pre-start window until end; horizontal rail of the rest.
 */
export default function HomeJoinAppointments({ appointments, loading }) {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 15_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setTick((value) => value + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Banner keeps a just-completed slot until its end_time; the list does not (app development parity).
  const bannerCandidates = useMemo(
    () =>
      sortAppointmentsByDateTime(
        (appointments || []).filter((item) => {
          const callLive = String(item?.call_status || '').toLowerCase() === 'in_progress';
          const completed = String(item?.status || '').toLowerCase() === 'completed';
          return (callLive || completed || isActiveAppointmentStatus(item?.status)) && !isAppointmentInPast(item);
        }),
      ),
    // tick drops appointments whose end time passed while Home stays open
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, tick],
  );

  const upcoming = useMemo(
    () =>
      bannerCandidates.filter(
        (item) =>
          String(item?.call_status || '').toLowerCase() === 'in_progress' ||
          isActiveAppointmentStatus(item?.status),
      ),
    [bannerCandidates],
  );

  // Re-render exactly when the next banner window opens (start - 5 min) or closes (end_time).
  useEffect(() => {
    const waits = bannerCandidates
      .map((item) => getMsUntilJoinWindowChange(item, 5))
      .filter((ms) => ms != null && ms > 0);
    if (!waits.length) return undefined;
    const timer = setTimeout(() => setTick((value) => value + 1), Math.min(Math.min(...waits) + 300, 55_000));
    return () => clearTimeout(timer);
  }, [bannerCandidates, tick]);

  const joinable = useMemo(
    () => getJoinableAppointment(bannerCandidates, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bannerCandidates, tick],
  );

  const openAppointments = async () => {
    if (await requireAuth('Please login to view appointments')) {
      navigate('/profile/appointments?mode=upcoming');
    }
  };

  const joinCall = () => {
    const params = buildVideoCallNavParams(
      { rawData: joinable.item.raw, ...joinable.item },
      {
        role: 'patient',
        otherPartyName: formatDoctorDisplayName(joinable.item.doctorName),
        otherPartyImage: joinable.item.image,
      },
    );
    navigate(`/profile/video/${params.appointmentId}`, { state: params });
  };

  const next = joinable?.item || upcoming[0] || null;
  const more = Math.max(0, upcoming.length - 1);
  const openNext = () => {
    const id = next?.appointmentId || next?.consultationId;
    if (id) navigate(`/profile/appointments/${id}`);
  };

  if (loading && !next) return null;
  if (!next) return null;

  const name = formatDoctorDisplayName(next.doctorName);
  const sub = next.specialty || next.therapies || next.concern || 'Ayurvedic consultation';
  const live = Boolean(joinable?.isLive);
  const soon = Boolean(joinable && !joinable.isLive);
  const when = soon ? `in ${joinable.minutesLeft} min` : live ? 'Live now' : relativeStart(next);
  const timeRange = [
    formatAppointmentTimeLabel(next.time),
    next.endTime ? formatAppointmentTimeLabel(next.endTime) : '',
  ]
    .filter(Boolean)
    .join(' – ');

  return (
    <section
      className={`am-diet-active hm-appt${live ? ' is-live' : ''}`}
      aria-labelledby="hm-appt-title"
    >
      <div className="am-diet-active__media hm-appt__media" aria-hidden>
        {next.image ? <img src={next.image} alt="" loading="lazy" /> : <span>{initialsOf(name)}</span>}
      </div>
      <div className="am-diet-active__body">
        <p className="am-diet-active__eyebrow">
          <span className="am-diet-active__dot" aria-hidden />
          {live ? 'Your consultation is live' : 'Your upcoming appointment'}
        </p>
        <h2 id="hm-appt-title" className="am-diet-active__title">{name}</h2>
        <p className="am-diet-active__sub">{sub}</p>
      </div>
      {next.status ? <span className="hm-appt__status">{statusLabel(next.status)}</span> : null}

      <dl className="hm-appt__strip">
        <div>
          <dt>Date</dt>
          <dd>{formatAppointmentDayShort(next.date) || '—'}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{timeRange || '—'}</dd>
        </div>
        {when ? (
          <div>
            <dt>Starts</dt>
            <dd>{when}</dd>
          </div>
        ) : null}
      </dl>

      <div className="hm-appt__actions">
        {joinable ? (
          <button type="button" className="am-diet-active__cta hm-appt__cta" onClick={joinCall}>
            <Video size={16} aria-hidden />
            {live ? 'Join call' : `Join in ${joinable.minutesLeft} min`}
          </button>
        ) : (
          <button type="button" className="am-diet-active__cta hm-appt__cta" onClick={openNext}>
            View appointment <ArrowRight size={16} aria-hidden />
          </button>
        )}
        <button type="button" className="hm-appt__link" onClick={openAppointments}>
          {more > 0 ? `+${more} more` : 'View all'}
        </button>
      </div>
    </section>
  );
}
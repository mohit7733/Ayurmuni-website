import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock, Stethoscope, Video } from 'lucide-react';
import {
  buildVideoCallNavParams,
  formatDoctorDisplayName,
  getJoinableAppointment,
} from '../consult/appointmentUtils';
import { formatSlotTime } from '../consult/doctors';
import { requireAuth } from '../services/guestAuth';
import Button from './ui/Button';
import { SkeletonCard } from './ui/Skeleton';

const formatDay = (value) => {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function HomeJoinAppointments({ appointments, loading }) {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const confirmed = useMemo(
    () =>
      (appointments || []).filter(
        (item) => String(item?.status || '').toLowerCase() === 'confirmed',
      ),
    [appointments],
  );

  const joinable = useMemo(
    () => getJoinableAppointment(confirmed, 5),
    // tick re-checks the join window
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirmed, tick],
  );

  const list = useMemo(() => {
    if (!joinable) return confirmed;
    const joinId = joinable.item.consultationId || joinable.item.id;
    return confirmed.filter(
      (item) => (item.consultationId || item.id) !== joinId,
    );
  }, [confirmed, joinable]);

  if (!joinable && !loading && list.length === 0) return null;

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

  return (
    <section className="hm-appts" aria-labelledby="hm-appts-title">
      <div className="hm-appts__head">
        <h2 id="hm-appts-title">Upcoming appointments</h2>
        {!loading && confirmed.length > 1 ? (
          <Button variant="ghost" size="sm" onClick={openAppointments} trailingIcon={<ArrowRight size={16} aria-hidden />}>
            View all
          </Button>
        ) : null}
      </div>
      {loading ? (
        <div aria-busy="true">
          <SkeletonCard variant="doctor" />
        </div>
      ) : (
        <>
          {joinable ? (
            <div className={`hm-join ${joinable.isLive ? 'is-live' : ''}`}>
              <span className="hm-join__icon" aria-hidden>
                <Video size={20} />
              </span>
              <div className="hm-join__copy">
                <strong>{joinable.isLive ? 'Your consultation is live' : 'Starting soon'}</strong>
                <p>
                  {formatDoctorDisplayName(joinable.item.doctorName)}
                  {joinable.item.time ? ` · ${formatSlotTime(joinable.item.time)}` : ''}
                </p>
              </div>
              <Button variant={joinable.isLive ? 'accent' : 'secondary'} size="sm" onClick={joinCall}>
                {joinable.isLive ? 'Join call' : `In ${joinable.minutesLeft} min`}
              </Button>
            </div>
          ) : null}
          {list.length > 0 ? (
            <ul className="hm-appts__list">
              {list.map((item) => (
                <li key={item.id || item.appointmentId} className="hm-appt">
                  <span className="hm-appt__img" aria-hidden>
                    {item.image ? <img src={item.image} alt="" loading="lazy" /> : <Stethoscope size={18} />}
                  </span>
                  <div className="hm-appt__copy">
                    <button
                      type="button"
                      className="am-stretched hm-appt__name"
                      onClick={() => navigate(`/profile/appointments/${item.appointmentId || item.id}`)}
                    >
                      {formatDoctorDisplayName(item.doctorName)}
                    </button>
                    <p>
                      <CalendarClock size={14} aria-hidden />
                      {formatDay(item.date)}
                      {item.time ? ` · ${formatSlotTime(item.time)}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}

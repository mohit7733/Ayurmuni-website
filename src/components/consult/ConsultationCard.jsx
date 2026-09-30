import { CalendarDays, Clock, Stethoscope } from 'lucide-react';
import {
  canModifyAppointment,
  formatDoctorDisplayName,
  getConsultationScheduleLabels,
} from '../../consult/appointmentUtils';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

const PAST_STATUSES = ['completed', 'cancelled', 'missed', 'expired', 'no_show', 'noshow'];

const STATUS_TONE = {
  confirmed: 'info',
  upcoming: 'info',
  booked: 'info',
  pending: 'warning',
  cancelled: 'danger',
  completed: 'success',
  reschedule: 'accent',
  rescheduled: 'accent',
};

export const consultStatusTone = (status) => STATUS_TONE[String(status || '').toLowerCase()] || 'neutral';

const formatStatusLabel = (status) => String(status || '').replace(/_/g, ' ').trim();

export default function ConsultationCard({ item, onOpen, onReceipt, onBook }) {
  const schedule = getConsultationScheduleLabels(item);
  const status = String(item.status || schedule.status || '').toLowerCase();
  const showReschedule = canModifyAppointment(status, item.date, item.time);
  const showBookAgain = !showReschedule && PAST_STATUSES.includes(status) && Boolean(item.doctorId);
  const name = formatDoctorDisplayName(item.doctorName);

  return (
    <article className="am-consult-card">
      <div className="am-consult-card__top">
        <span className="am-consult-card__photo" aria-hidden>
          {item.image ? <img src={item.image} alt="" loading="lazy" /> : <Stethoscope size={20} />}
        </span>
        <div className="am-consult-card__id">
          <h3>
            <button type="button" className="am-stretched" onClick={() => onOpen(item)}>
              {name}
            </button>
          </h3>
          <p>{item.specialty || 'Ayurveda'}</p>
        </div>
        {status ? (
          <Badge tone={consultStatusTone(status)} className="am-consult-card__status">
            {formatStatusLabel(status)}
          </Badge>
        ) : null}
      </div>

      {schedule.dateLabel || schedule.timeLabel ? (
        <ul className="am-consult-card__meta">
          {schedule.dateLabel ? (
            <li>
              <CalendarDays size={15} aria-hidden />
              {[schedule.weekday, schedule.dateLabel].filter(Boolean).join(', ')}
            </li>
          ) : null}
          {schedule.timeLabel ? (
            <li>
              <Clock size={15} aria-hidden />
              {schedule.timeLabel}
            </li>
          ) : null}
        </ul>
      ) : null}

      {item.consultationId || showReschedule || showBookAgain ? (
        <div className="am-consult-card__actions">
          {item.consultationId ? (
            <Button variant="secondary" size="sm" onClick={() => onReceipt(item)}>
              Receipt
            </Button>
          ) : null}
          {showReschedule ? (
            <Button size="sm" onClick={() => onBook(item)}>
              {status === 'reschedule' ? 'Request change' : 'Reschedule'}
            </Button>
          ) : showBookAgain ? (
            <Button size="sm" onClick={() => onBook(item)}>
              Book again
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

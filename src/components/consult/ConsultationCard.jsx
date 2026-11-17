import { useState } from 'react';
import { CalendarDays, Clock, Stethoscope } from 'lucide-react';
import {
  canOfferReschedule,
  formatDoctorDisplayName,
  getConsultationScheduleLabels,
} from '../../consult/appointmentUtils';
import { doctorImage } from '../../consult/doctors';
import { nameInitials } from '../../utils/initials';
import Badge from '../ui/Badge';
import DietitianBadge from '../DietitianBadge';
import Button from '../ui/Button';

const PAST_STATUSES = ['completed', 'cancelled', 'missed', 'expired', 'no_show', 'noshow'];

const STATUS_TONE = {
  confirmed: 'success',
  upcoming: 'success',
  booked: 'success',
  pending: 'neutral',
  cancelled: 'danger',
  completed: 'success',
  reschedule: 'primary',
  rescheduled: 'primary',
};

export const consultStatusTone = (status) => STATUS_TONE[String(status || '').toLowerCase()] || 'neutral';

const formatStatusLabel = (status) =>
  ['testing', 'test'].includes(String(status || '').toLowerCase())
    ? 'Processing'
    : String(status || '').replace(/_/g, ' ').trim();

const statusClass = (status) => String(status || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-');

/** Resolve a doctor photo from mapped consultation fields or the original API row. */
export const consultationDoctorPhoto = (item) => {
  const sources = [
    item,
    item?.doctor,
    item?.raw,
    item?.raw?.doctor,
    item?.raw?.appointment?.doctor,
    item?.rawData,
    item?.rawData?.doctor,
    item?.appointment?.doctor,
  ];
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    const url = doctorImage({
      ...src,
      profile_image:
        src.profile_image ||
        src.doctor_image ||
        src.profile_picture ||
        src.avatar ||
        src.photo,
    });
    if (url) return url;
  }
  return String(item?.image || '').trim();
};

function DoctorPhoto({ url, name }) {
  const [failedUrl, setFailedUrl] = useState('');
  const showPhoto = Boolean(url) && failedUrl !== url;
  const initials = nameInitials(name, 2, '');

  return (
    <span className={`am-consult-card__photo${showPhoto ? '' : ' am-consult-card__photo--fallback'}`} aria-hidden>
      {showPhoto ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          width="48"
          height="48"
          onError={() => setFailedUrl(url)}
        />
      ) : initials ? (
        <span className="am-consult-card__initials">{initials}</span>
      ) : (
        <Stethoscope size={18} />
      )}
    </span>
  );
}

export default function ConsultationCard({ item, onOpen, onReceipt, onBook }) {
  const schedule = getConsultationScheduleLabels(item);
  const status = String(item.status || schedule.status || '').toLowerCase();
  const showReschedule = canOfferReschedule(status, item.date, item.time, item);
  const showBookAgain = !showReschedule && PAST_STATUSES.includes(status) && Boolean(item.doctorId);
  const name = formatDoctorDisplayName(item.doctorName);
  const photoUrl = consultationDoctorPhoto(item);

  return (
    <article className="am-consult-card">
      <div className="am-consult-card__top">
        <DoctorPhoto url={photoUrl} name={name} />
        <div className="am-consult-card__id">
          <h3>
            <button type="button" className="am-stretched" onClick={() => onOpen(item)}>
              {name}
            </button>
          </h3>
          <div className="am-consult-card__chips">
            <DietitianBadge doctor={item} />
            <p>{item.specialty || 'Ayurveda'}</p>
          </div>
        </div>
        {status ? (
          <Badge
            tone={consultStatusTone(status)}
            className={`am-consult-card__status am-consult-card__status--${statusClass(status)}`}
          >
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

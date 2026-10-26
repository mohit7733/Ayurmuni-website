import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Briefcase, CalendarCheck, Sparkles, Star } from 'lucide-react';
import { formatAppointmentDateFull, formatDoctorDisplayName } from '../consult/appointmentUtils';
import {
  doctorDisplayName,
  doctorExperience,
  doctorFavorite,
  doctorImage,
  doctorQualification,
  doctorRating,
  doctorSpeciality,
  favoriteFromToggle,
  getDoctorId,
} from '../consult/doctors';
import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import { toggleFavDoctor } from '../services/consultService';
import FavButton from './ui/FavButton';
import { nameInitial } from '../utils/initials';

/**
 * T129 — "Visited Doctors" (app parity: VisitedDoctorHomeCard).
 * Data: GET customers/doctors/recent/ = doctors the customer has paid to consult.
 */
function VisitedDoctorCard({ item, fallbackSpeciality }) {
  const navigate = useNavigate();
  const id = getDoctorId(item);
  const name = formatDoctorDisplayName(doctorDisplayName(item));
  const image = doctorImage(item);
  const rating = doctorRating(item);
  const credential =
    doctorQualification(item) || item?.doctor_designation || doctorSpeciality(item) || fallbackSpeciality;
  const experience = doctorExperience(item);
  const reviewCount = Number(item?.total_reviews || item?.review_count || item?.reviews_count || 0);
  const verified = Boolean(item?.is_verified);
  const available = item?.has_availability === true;
  const lastVisit = formatAppointmentDateFull(item?.last_consulted_date || '');
  const visits = Number(item?.consultation_count || 0);
  const [fav, setFav] = useState(() => doctorFavorite(item));

  const openProfile = () => {
    if (id) navigate(`/consult/doctors/${id}`);
  };

  const toggleFav = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!(await requireAuth('Please login to save favourite doctors'))) return;
    if (!id) return;
    const prev = fav;
    setFav(!prev);
    try {
      const res = await toggleFavDoctor(id);
      if (res?.success === false) {
        setFav(prev);
        showSuccessToast(res?.message || 'Failed to update favourite', 'error');
        return;
      }
      const next = favoriteFromToggle(res);
      if (next !== undefined) setFav(next);
    } catch {
      setFav(prev);
      showSuccessToast('Failed to update favourite status', 'error');
    }
  };

  return (
    <li className="vd-card">
      <button type="button" className="vd-card__main" onClick={openProfile} aria-label={`View ${name} profile`}>
        <span className="vd-card__ring">
          {image ? (
            <img src={image} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="vd-card__initial" aria-hidden>
              {nameInitial(name)}
            </span>
          )}
          {available ? <i className="vd-card__dot" title="Available" /> : null}
        </span>
        <span className="vd-card__id">
          <span className="vd-card__name">
            <strong>{name}</strong>
            {verified ? <BadgeCheck size={15} aria-label="Verified" /> : null}
          </span>
          {credential ? <span className="vd-card__cred">{credential}</span> : null}
          <span className="vd-card__chips">
            {rating ? (
              <span className="vd-chip vd-chip--rating">
                <Star size={12} fill="currentColor" aria-hidden />
                <b>{rating}</b>
                {reviewCount ? <em>({reviewCount})</em> : null}
              </span>
            ) : (
              <span className="vd-chip vd-chip--new">
                <Sparkles size={12} aria-hidden />
                New
              </span>
            )}
            {experience ? (
              <span className="vd-chip">
                <Briefcase size={12} aria-hidden />
                {experience}
              </span>
            ) : null}
          </span>
        </span>
      </button>
      <div className="vd-card__foot">
        {lastVisit ? (
          <span className="vd-card__visit" title={`Last visit ${lastVisit}`}>
            <CalendarCheck size={13} aria-hidden />
            <span className="vd-card__visit-label">Last visit · </span>
            {lastVisit}
            {visits > 1 ? <em> · {visits} visits</em> : null}
          </span>
        ) : (
          <span />
        )}
        <div className="vd-card__actions">
          <FavButton
            on={fav}
            className="vd-card__fav"
            label={fav ? `Remove ${name} from favourites` : `Save ${name}`}
            onClick={toggleFav}
          />
          <button type="button" className="vd-card__book" onClick={openProfile} aria-label={`Book ${name} again`}>
            Book again
            <ArrowRight size={14} aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

export default function VisitedDoctorList({ items, label, fallbackSpeciality = 'Ayurvedic doctor' }) {
  if (!items?.length) return null;
  return (
    <div className="vd-wrap">
      <ul className="vd-list" aria-label={label}>
        {items.map((item) => (
          <VisitedDoctorCard
            key={getDoctorId(item) || item.doctor_id || item.id}
            item={item}
            fallbackSpeciality={fallbackSpeciality}
          />
        ))}
      </ul>
    </div>
  );
}

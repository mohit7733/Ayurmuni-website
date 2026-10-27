import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Briefcase, MapPin, Star } from 'lucide-react';
import { formatDoctorDisplayName } from '../consult/appointmentUtils';
import {
  doctorDisplayName,
  doctorExperience,
  doctorFavorite,
  doctorImage,
  doctorLocation,
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
import DietitianBadge from './DietitianBadge';
import { nameInitial } from '../utils/initials';

function DoctorTableRow({ item, fallbackSpeciality }) {
  const navigate = useNavigate();
  const id = getDoctorId(item);
  const name = formatDoctorDisplayName(doctorDisplayName(item));
  const image = doctorImage(item);
  const rating = doctorRating(item);
  const credential = doctorQualification(item) || doctorSpeciality(item) || fallbackSpeciality;
  const experience = doctorExperience(item);
  const location = doctorLocation(item);
  const reviewCount = Number(item?.total_reviews || item?.review_count || 0);
  const verified = Boolean(item?.is_verified);
  const [fav, setFav] = useState(() => doctorFavorite(item));
  const reviewLabel = reviewCount === 1 ? '1 review' : `${reviewCount} reviews`;

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
    <tr>
      <th scope="row">
        <div className="hm-doc-table__doctor">
          {image ? (
            <img className="hm-doc-table__photo" src={image} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="hm-doc-table__photo hm-doc-table__photo--fallback" aria-hidden>
              {nameInitial(name)}
            </span>
          )}
          <div className="hm-doc-table__id">
            <p className="hm-doc-table__name">
              <button type="button" onClick={openProfile}>
                {name}
              </button>
              {verified ? (
                <BadgeCheck size={14} aria-label="Verified" />
              ) : null}
            </p>
            <DietitianBadge doctor={item} />
            {credential ? <p className="hm-doc-table__cred">{credential}</p> : null}
          </div>
        </div>
      </th>
      <td className="hm-doc-table__col-exp">
        {experience ? (
          <span className="hm-doc-table__meta">
            <Briefcase size={14} aria-hidden />
            {experience}
          </span>
        ) : (
          <span className="hm-doc-table__empty">—</span>
        )}
      </td>
      <td className="hm-doc-table__col-location">
        {location ? (
          <span className="hm-doc-table__meta">
            <MapPin size={14} aria-hidden />
            {location}
          </span>
        ) : (
          <span className="hm-doc-table__empty">—</span>
        )}
      </td>
      <td>
        {rating ? (
          <span className="hm-doc-table__rating">
            <Star size={13} aria-hidden fill="currentColor" />
            <strong>{rating}</strong>
            {reviewCount ? <span>{reviewLabel}</span> : null}
          </span>
        ) : (
          <span className="hm-doc-table__empty">—</span>
        )}
      </td>
      <td className="hm-doc-table__actions-cell">
        <div className="hm-doc-table__actions">
          <FavButton
            on={fav}
            label={fav ? `Remove ${name} from favourites` : `Save ${name}`}
            onClick={toggleFav}
          />
          <button type="button" className="hm-doc-table__profile" aria-label={`View ${name} profile`} onClick={openProfile}>
            <span>View profile</span>
            <ArrowRight size={14} aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function DoctorTable({ items, label, fallbackSpeciality = 'Ayurveda' }) {
  return (
    <div className="hm-doc-table-wrap">
      <table className="hm-doc-table">
        <caption className="am-sr-only">{label}</caption>
        <thead>
          <tr>
            <th scope="col">Doctor</th>
            <th className="hm-doc-table__col-exp" scope="col">Experience</th>
            <th className="hm-doc-table__col-location" scope="col">Location</th>
            <th scope="col">Rating</th>
            <th className="hm-doc-table__actions-cell" scope="col">
              <span className="am-sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <DoctorTableRow
              key={getDoctorId(item) || item.doctor_id || item.id}
              item={item}
              fallbackSpeciality={fallbackSpeciality}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Briefcase, MapPin, Sparkles, Star } from 'lucide-react';
import { formatDoctorDisplayName } from '../consult/appointmentUtils';
import {
  doctorDisplayName,
  doctorExperience,
  doctorFavorite,
  doctorFeeLabel,
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
import { nameInitial } from '../utils/initials';

/** T131 — compact premium card for the All doctors grid (same data + actions as SuggestedDoctorCard). */
export default function DoctorListCard({ item, fallbackSpeciality = 'Ayurveda' }) {
  const navigate = useNavigate();
  const id = getDoctorId(item);
  const name = formatDoctorDisplayName(doctorDisplayName(item));
  const image = doctorImage(item);
  const rating = doctorRating(item);
  const fee = doctorFeeLabel(item);
  const credential = doctorQualification(item) || doctorSpeciality(item) || fallbackSpeciality;
  const experience = doctorExperience(item);
  const location = doctorLocation(item);
  const reviewCount = Number(item?.total_reviews || item?.review_count || 0);
  const verified = Boolean(item?.is_verified);
  const initial = nameInitial(name);
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
    <article className="dl-card">
      <div className="dl-card__top">
        <span className={`dl-card__ring${image ? '' : ' is-mono'}`}>
          {image ? (
            <img src={image} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="dl-card__mono" aria-hidden>
              {initial}
            </span>
          )}
        </span>
        <div className="dl-card__rate">
          {rating ? (
            <span className="dl-chip dl-chip--rating">
              <Star size={12} fill="currentColor" aria-hidden />
              <b>{rating}</b>
              {reviewCount ? <em>({reviewCount})</em> : null}
            </span>
          ) : (
            <span className="dl-chip dl-chip--new">
              <Sparkles size={12} aria-hidden />
              New
            </span>
          )}
        </div>
        <FavButton
          on={fav}
          className="dl-card__fav"
          label={fav ? `Remove ${name} from favourites` : `Save ${name}`}
          onClick={toggleFav}
        />
      </div>

      <h3 className="dl-card__name">
        <button type="button" className="am-stretched" onClick={openProfile}>
          {name}
        </button>
        {verified ? <BadgeCheck size={15} aria-label="Verified" /> : null}
      </h3>
      {credential ? <p className="dl-card__cred">{credential}</p> : null}

      <ul className="dl-card__facts">
        {experience ? (
          <li>
            <Briefcase size={12} aria-hidden />
            {experience}
          </li>
        ) : null}
        {location ? (
          <li>
            <MapPin size={12} aria-hidden />
            <span>{location}</span>
          </li>
        ) : null}
      </ul>

      <div className="dl-card__foot">
        {fee ? (
          <span className="dl-card__fee">
            <small>Consult</small>
            {fee}
          </span>
        ) : (
          <span />
        )}
        <span className="dl-card__cta">
          View profile
          <ArrowRight size={14} aria-hidden />
        </span>
      </div>
    </article>
  );
}

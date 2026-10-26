import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Briefcase, MapPin, Star } from 'lucide-react';
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

export default function SuggestedDoctorCard({ item, fallbackSpeciality = 'Ayurveda' }) {
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
    <article className="am-flip-doc">
      <div className="am-flip-doc__media">
        {image ? (
          <img src={image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="am-flip-doc__fallback" aria-hidden>
            {nameInitial(name)}
          </span>
        )}
        <div className="am-flip-doc__shade" aria-hidden />

        <div className="am-flip-doc__chips">
          {rating ? (
            <span className="am-flip-doc__chip">
              <Star size={12} aria-hidden fill="currentColor" />
              {rating}
              {reviewCount ? <span>({reviewCount})</span> : null}
            </span>
          ) : null}
          {verified ? (
            <span className="am-flip-doc__chip am-flip-doc__chip--verified">
              <BadgeCheck size={13} aria-hidden />
              Verified
            </span>
          ) : null}
        </div>

        <div className="am-card-corner">
          <FavButton
            on={fav}
            label={fav ? `Remove ${name} from favourites` : `Save ${name}`}
            onClick={toggleFav}
          />
        </div>
      </div>

      <div className="am-flip-doc__body">
        <h3 className="am-flip-doc__name">
          <button type="button" className="am-stretched" onClick={openProfile}>
            {name}
          </button>
        </h3>
        {credential ? <p className="am-flip-doc__spec">{credential}</p> : null}
        {experience || location ? (
          <ul className="am-flip-doc__facts">
            {experience ? (
              <li>
                <Briefcase size={13} aria-hidden />
                {experience}
              </li>
            ) : null}
            {location ? (
              <li>
                <MapPin size={13} aria-hidden />
                {location}
              </li>
            ) : null}
          </ul>
        ) : null}
        <div className="am-flip-doc__cta">
          {fee ? (
            <span className="am-flip-doc__fee">
              <small>Consult</small>
              {fee}
            </span>
          ) : (
            <span />
          )}
          <span className="am-flip-doc__cta-link">
            View profile
            <ArrowRight size={14} aria-hidden />
          </span>
        </div>
      </div>
    </article>
  );
}

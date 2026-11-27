import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Briefcase, MapPin, Sparkles, Star } from 'lucide-react';
import { formatDoctorDisplayName } from '../consult/appointmentUtils';
import {
  doctorDisplayName,
  doctorExperience,
  doctorFeeLabel,
  doctorImage,
  doctorLocation,
  doctorQualification,
  doctorRating,
  doctorSpeciality,
  getDoctorAvailabilityLabel,
  getDoctorId,
} from '../consult/doctors';
import { toggleDoctorFavourite, useDoctorFavFlag } from '../consult/doctorFavSync';
import '../design/components/doctor-availability.css';
import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import FavButton from './ui/FavButton';
import DietitianBadge from './DietitianBadge';
import { nameInitial } from '../utils/initials';

/** T131 — compact premium card for the All doctors grid. */
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
  const availability = getDoctorAvailabilityLabel(item);
  const initial = nameInitial(name);
  const fav = useDoctorFavFlag(item);
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(image) && !imgFailed;

  const openProfile = () => {
    if (id) navigate(`/consult/doctors/${id}`);
  };

  const toggleFav = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!(await requireAuth('Please login to save favourite doctors'))) return;
    if (!id) return;
    const result = await toggleDoctorFavourite(item);
    if (!result.ok) {
      showSuccessToast(result.message || 'Failed to update favourite', 'error');
      return;
    }
    showSuccessToast(
      result.message || (result.saved ? 'Added to favourites' : 'Removed from favourites'),
      'success',
    );
  };

  return (
    <article className="dl-card">
      <div className="dl-card__top">
        <span className={`dl-card__ring${showPhoto ? '' : ' is-mono'}`}>
          {showPhoto ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
            />
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
        {/* {experience ? (
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
        ) : null} */}
        <DietitianBadge doctor={item} />
        <li className={`dl-card__avail${availability === 'Available' ? ' is-on' : ''}`}>
          <span>{availability}</span>
        </li>
      </ul>

      <ul className="hm-doc-card__specialized-bio" aria-label="Specialized Bio" style={{ margin: '16px 4px' }}>
        {item.specialized_bio.length ?
          item.specialized_bio.map((bio) => (
            <li key={bio} className="hm-doc-card__specialized-bio-item">
              <span>{bio}</span>
            </li>
          )) : null}
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
        <button type="button" className="dl-card__cta" onClick={openProfile}>
          View profile
          <ArrowRight size={14} aria-hidden />
        </button>
      </div>
    </article>
  );
}

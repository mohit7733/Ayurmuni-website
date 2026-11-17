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
  resolveDoctorHealthDiseases,
  resolveDoctorSpecializations,
} from '../consult/doctors';
import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import { toggleFavDoctor } from '../services/consultService';
import FavButton from './ui/FavButton';
import DietitianBadge from './DietitianBadge';
import { nameInitial } from '../utils/initials';

/** Specialty / concern chips — skips values already shown as credential. */
function focusTags(item, credential) {
  const skip = String(credential || '').toLowerCase();
  const seen = new Set();
  const out = [];
  const push = (value) => {
    const label = String(value || '').trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key) || skip.includes(key)) return;
    seen.add(key);
    out.push(label);
  };

  resolveDoctorSpecializations(item).forEach(push);
  resolveDoctorHealthDiseases(item).forEach(push);
  return out.slice(0, 2);
}

function DoctorCard({ item, fallbackSpeciality, index }) {
  const navigate = useNavigate();
  const id = getDoctorId(item);
  const name = formatDoctorDisplayName(doctorDisplayName(item));
  const image = doctorImage(item);
  const credential = doctorQualification(item) || doctorSpeciality(item) || fallbackSpeciality;
  const experience = doctorExperience(item);
  const location = doctorLocation(item);
  const rating = doctorRating(item);
  const fee = doctorFeeLabel(item);
  const reviewCount = Number(item?.total_reviews || item?.review_count || 0);
  const verified = Boolean(item?.is_verified);
  const tags = focusTags(item, credential);
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
    <article className="hm-doc-card" style={{ '--hm-doc-i': index }}>
      <div className={`hm-doc-card__media${image ? ' hm-doc-card__media--photo' : ''}`}>
        {image ? (
          <img className="hm-doc-card__photo" src={image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="hm-doc-card__initial" aria-hidden>
            {nameInitial(name)}
          </span>
        )}
        <div className="hm-doc-card__media-scrim" aria-hidden />

        <div className="hm-doc-card__chips">
          {rating ? (
            <span className="hm-doc-card__chip">
              <Star size={11} aria-hidden fill="currentColor" />
              {rating}
              {reviewCount ? <em>({reviewCount})</em> : null}
            </span>
          ) : null}
          {verified ? (
            <span className="hm-doc-card__chip hm-doc-card__chip--verified">
              <BadgeCheck size={12} aria-hidden />
              Verified
            </span>
          ) : null}
        </div>


        <div className="hm-doc-card__fav">
          <FavButton
            on={fav}
            label={fav ? `Remove ${name} from favourites` : `Save ${name}`}
            onClick={toggleFav}
          />
        </div>
        <div className="hm-doc-card__dietitian">
          <DietitianBadge doctor={item} />
        </div>
      </div>

      <div className="hm-doc-card__body">
        <div className="hm-doc-card__id">
          <h3 className="hm-doc-card__name">
            <button type="button" className="hm-doc-card__name-btn am-stretched" onClick={openProfile}>
              {name}
            </button>
          </h3>
          {credential ? <p className="hm-doc-card__cred">{credential}</p> : null}
        </div>

        {/* {experience || location ? (
          <ul className="hm-doc-card__facts">
            {experience ? (
              <li>
                <Briefcase size={13} aria-hidden />
                <span>{experience}</span>
              </li>
            ) : null}
            
          </ul>
        ) : null} */}
        <ul className="hm-doc-card__specialized-bio" aria-label="Specialized Bio">
          {item.specialized_bio.length ?
            item.specialized_bio.map((bio) => (
              <li key={bio} className="hm-doc-card__specialized-bio-item">
                <span>{bio}</span>
              </li>
            )) : null}
        </ul>

        {/* {tags.length ? (
          <ul className="hm-doc-card__tags">
            {tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        ) : null} */}

        <div className="hm-doc-card__foot">
          {fee ? (
            <span className="hm-doc-card__fee">
              <small>Consult</small>
              {fee}
            </span>
          ) : (
            <span className="hm-doc-card__fee hm-doc-card__fee--empty">
              <small>Consult</small>
              —
            </span>
          )}
          <span className="hm-doc-card__cta" aria-hidden>
            View profile
            <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </article>
  );
}

export default function DoctorTable({ items, label, fallbackSpeciality = 'Ayurveda' }) {
  return (
    <div className="hm-doc-rail" role="list" aria-label={label}>
      {items.map((item, index) => (
        <div
          key={getDoctorId(item) || item.doctor_id || item.id}
          className="hm-doc-rail__item"
          role="listitem"
        >
          <DoctorCard item={item} fallbackSpeciality={fallbackSpeciality} index={index} />
        </div>
      ))}
    </div>
  );
}

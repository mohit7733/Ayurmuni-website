import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Briefcase, MapPin, Star } from 'lucide-react';
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
  getDoctorId,
  isDietitian,
  resolveDoctorHealthDiseases,
  resolveDoctorSpecializations,
} from '../consult/doctors';
import { toggleDoctorFavourite, useDoctorFavFlag } from '../consult/doctorFavSync';
import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import FavButton from './ui/FavButton';
import DietitianBadge from './DietitianBadge';
import { nameInitial } from '../utils/initials';
import Rail, { RailItem } from './ui/Rail';

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
  const dietitian = isDietitian(item);
  const tags = focusTags(item, credential);
  const fav = useDoctorFavFlag(item);

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

        <div className="hm-doc-card__fav">
          <FavButton
            on={fav}
            label={fav ? `Remove ${name} from favourites` : `Save ${name}`}
            onClick={toggleFav}
          />
        </div>
      </div>

      <div className="hm-doc-card__body">
        {(rating || verified || dietitian) ? (
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
            {dietitian ? <DietitianBadge doctor={item} visible /> : null}
          </div>
        ) : null}
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
          <button type="button" className="hm-doc-card__cta" onClick={openProfile}>
            View profile
            <ArrowRight size={13} aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function DoctorTable({ items, label, fallbackSpeciality = 'Ayurveda' }) {
  if (!items?.length) return null;
  return (
    <Rail label={label} className="hm-doc-rail" auto interval={3200} controls>
      {items.map((item, index) => (
        <RailItem key={getDoctorId(item) || item.doctor_id || item.id} className="hm-doc-rail__item">
          <DoctorCard item={item} fallbackSpeciality={fallbackSpeciality} index={index} />
        </RailItem>
      ))}
    </Rail>
  );
}

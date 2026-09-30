import { useNavigate } from 'react-router-dom';
import { BadgeCheck, BriefcaseMedical, ChevronRight, Languages } from 'lucide-react';
import {
  doctorDisplayName,
  doctorExperience,
  doctorFeeLabel,
  doctorImage,
  doctorRating,
  doctorSpeciality,
  getDoctorId,
  resolveLanguages,
} from '../consult/doctors';
import Rating from './ui/Rating';

export default function DoctorCard({ item }) {
  const navigate = useNavigate();
  const id = getDoctorId(item);
  const name = doctorDisplayName(item);
  const image = doctorImage(item);
  const fee = doctorFeeLabel(item);
  const rating = doctorRating(item);
  const speciality = doctorSpeciality(item) || 'Ayurveda';
  const experience = doctorExperience(item);
  const languages = resolveLanguages(item).slice(0, 2);
  const reviewCount = Number(item?.total_reviews || item?.review_count || 0);
  const verified = Boolean(item?.is_verified);

  return (
    <article className="am-doctor-card">
      <div className="am-doctor-card__top">
        <div className="am-doctor-card__photo">
          {image ? (
            <img src={image} alt={name} loading="lazy" decoding="async" width="72" height="72" />
          ) : (
            <span aria-hidden>{name.charAt(0)}</span>
          )}
          {verified ? (
            <span className="am-doctor-card__verified" title="Verified doctor">
              <BadgeCheck size={16} aria-hidden />
              <span className="am-sr-only">Verified doctor</span>
            </span>
          ) : null}
        </div>
        <div className="am-doctor-card__id">
          <h3 className="am-doctor-card__name">
            <button
              type="button"
              className="am-stretched"
              onClick={() => id && navigate(`/consult/doctors/${id}`)}
            >
              {name}
            </button>
          </h3>
          <p className="am-doctor-card__spec">{speciality}</p>
          <Rating value={rating} count={reviewCount} />
        </div>
      </div>

      {experience || languages.length ? (
        <ul className="am-doctor-card__meta">
          {experience ? (
            <li>
              <BriefcaseMedical size={15} aria-hidden />
              {experience}
            </li>
          ) : null}
          {languages.length ? (
            <li>
              <Languages size={15} aria-hidden />
              {languages.join(', ')}
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="am-doctor-card__foot">
        {fee ? (
          <p className="am-doctor-card__fee">
            <strong>{fee}</strong>
            <span>per consult</span>
          </p>
        ) : (
          <span />
        )}
        <span className="am-doctor-card__cta" aria-hidden>
          View profile
          <ChevronRight size={16} />
        </span>
      </div>
    </article>
  );
}

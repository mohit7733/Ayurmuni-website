import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, BriefcaseMedical, Languages, MapPin, Star } from 'lucide-react';
import {
  doctorConsultFee,
  doctorDisplayName,
  doctorExperience,
  doctorFeeLabel,
  doctorImage,
  doctorLocation,
  doctorRating,
  doctorSpeciality,
  getDoctorId,
  resolveLanguages,
} from '../consult/doctors';

export default function SuggestedDoctorCard({ item, fallbackSpeciality = 'Ayurveda' }) {
  const navigate = useNavigate();
  const id = getDoctorId(item);
  const name = doctorDisplayName(item);
  const image = doctorImage(item);
  const fee = doctorConsultFee(item) > 0 ? doctorFeeLabel(item) : '';
  const rating = doctorRating(item);
  const speciality = doctorSpeciality(item) || fallbackSpeciality;
  const experience = doctorExperience(item);
  const location = doctorLocation(item);
  const languages = resolveLanguages(item).slice(0, 2);
  const reviewCount = Number(item?.total_reviews || item?.review_count || 0);
  const verified = Boolean(item?.is_verified);

  const openProfile = () => {
    if (id) navigate(`/consult/doctors/${id}`);
  };

  return (
    <article className="am-flip-doc">
      <div className="am-flip-doc__body">
        <div className="am-flip-doc__chips">
          {rating ? (
            <span className="am-flip-doc__chip">
              <Star size={12} aria-hidden />
              {rating}
              {reviewCount ? <span>({reviewCount})</span> : null}
            </span>
          ) : null}
          {verified ? (
            <span className="am-flip-doc__chip am-flip-doc__chip--gold">
              <BadgeCheck size={13} aria-hidden />
              Verified
            </span>
          ) : null}
        </div>

        <h3 className="am-flip-doc__name">
          <button type="button" className="am-stretched" onClick={openProfile}>
            {name}
          </button>
        </h3>
        <p className="am-flip-doc__spec">{speciality}</p>

        {experience || languages.length || location ? (
          <ul className="am-flip-doc__facts">
            {experience ? (
              <li>
                <BriefcaseMedical size={13} aria-hidden />
                {experience}
              </li>
            ) : null}
            {languages.length ? (
              <li>
                <Languages size={13} aria-hidden />
                {languages.join(', ')}
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

        <div className="am-flip-doc__foot">
          {fee ? (
            <p className="am-flip-doc__fee">
              <strong>{fee}</strong>
              <span>per consult</span>
            </p>
          ) : null}
          <span className="am-flip-doc__cta">
            View profile
            <ArrowRight size={14} aria-hidden />
          </span>
        </div>
      </div>

      <div className="am-flip-doc__photo">
        {image ? (
          <img src={image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="am-flip-doc__fallback" aria-hidden>
            {name.charAt(0) || 'A'}
          </span>
        )}
      </div>
    </article>
  );
}

import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import {
  doctorDisplayName,
  doctorConsultFee,
  doctorExperience,
  doctorFeeLabel,
  doctorImage,
  doctorRating,
  doctorSpeciality,
  getDoctorId,
} from '../consult/doctors';
import Rating from './ui/Rating';

export default function RecentDoctorCard({ item, fallbackRole = 'Ayurvedic doctor' }) {
  const navigate = useNavigate();
  const id = getDoctorId(item);
  const name = doctorDisplayName(item);
  const image = doctorImage(item);
  const role = doctorSpeciality(item) || item?.doctor_designation || fallbackRole;
  const rating = doctorRating(item);
  const experience = doctorExperience(item);
  const fee = doctorConsultFee(item) > 0 ? doctorFeeLabel(item) : '';
  const reviewCount = Number(item?.total_reviews || item?.review_count || 0);

  return (
    <article className="am-recent-card">
      <div className="am-recent-card__photo">
        {image ? (
          <img src={image} alt="" loading="lazy" decoding="async" width="64" height="64" />
        ) : (
          <span aria-hidden>{name.charAt(0)}</span>
        )}
      </div>
      <div className="am-recent-card__body">
        <h3 className="am-recent-card__name">
          <button
            type="button"
            className="am-stretched"
            onClick={() => id && navigate(`/consult/doctors/${id}`)}
          >
            {name}
          </button>
        </h3>
        <p className="am-recent-card__role">{role}</p>
        {rating || experience ? (
          <div className="am-recent-card__meta">
            {rating ? <Rating value={rating} count={reviewCount} /> : null}
            {experience ? <span>{experience}</span> : null}
          </div>
        ) : null}
        <div className="am-recent-card__foot">
          {fee ? (
            <p className="am-recent-card__fee">
              <strong>{fee}</strong>
              <span>per consult</span>
            </p>
          ) : (
            <span />
          )}
          <span className="am-recent-card__cta" aria-hidden>
            View profile
            <ChevronRight size={14} />
          </span>
        </div>
      </div>
    </article>
  );
}

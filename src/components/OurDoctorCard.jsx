import { ArrowRight, BadgeCheck, Star } from 'lucide-react';
import {
  doctorDisplayName,
  doctorExperience,
  doctorFeeLabel,
  doctorImage,
  doctorQualification,
  doctorRating,
  resolveDoctorSpecializations,
} from '../consult/doctors';
import './our-doctor-card.css';

/**
 * Premium "Our doctors" card used on the homepage and the health concern page.
 * Wrap its rail in a `.hm-odocs` container to get the homepage rail sizing.
 */
/** Explicit approval flag from the API (not the permissive list filter default). */
const hasApprovalFlag = (d) => {
  const status = String(d?.approval_status ?? d?.verification_status ?? '').trim().toLowerCase();
  if (['approved', 'verified'].includes(status)) return true;
  const flag = d?.is_approved ?? d?.is_verified;
  return flag === true || flag === 'true' || flag === 1 || flag === '1';
};

export default function OurDoctorCard({ item, index, onOpen }) {
  const name = doctorDisplayName(item);
  const image = doctorImage(item);
  const qualification = doctorQualification(item);
  const specs = resolveDoctorSpecializations(item).slice(0, 2).join(', ');
  const experience = doctorExperience(item);
  const rating = doctorRating(item);
  const fee = doctorFeeLabel(item);
  const verified = hasApprovalFlag(item);
  const line = [qualification, specs && specs !== qualification ? specs : ''].filter(Boolean);

  return (
    <article className="hm-odoc" style={{ '--hm-odoc-i': Math.min(index, 6) }}>
      <span className="hm-odoc__photo">
        {image ? (
          <img src={image} alt="" loading="lazy" decoding="async" width="52" height="52" />
        ) : (
          <span aria-hidden>{name.charAt(0)}</span>
        )}
      </span>
      <div className="hm-odoc__id">
        <h3 className="hm-odoc__name">
          <span>{name}</span>
          {verified ? <BadgeCheck className="hm-odoc__tick" size={15} aria-label="Verified" /> : null}
        </h3>
        {line.length ? (
          <p className="hm-odoc__line">
            {line.map((part, i) => (
              <span key={part} className={i ? 'hm-odoc__spec' : 'hm-odoc__qual'}>
                {part}
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <div className="hm-odoc__foot">
        {experience || rating || fee ? (
          <ul className="hm-odoc__meta">
            {experience ? <li>{experience}</li> : null}
            {rating ? (
              <li>
                <Star size={11} aria-hidden /> {rating}
              </li>
            ) : null}
            {fee ? (
              <li className="hm-odoc__fee">
                <strong>{fee}</strong>
              </li>
            ) : null}
          </ul>
        ) : null}
        <button type="button" className="hm-odoc__cta am-stretched" onClick={onOpen}>
          Consult
          <ArrowRight size={13} aria-hidden />
        </button>
      </div>
    </article>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Briefcase, Repeat, Sparkles, Star } from 'lucide-react';
import { formatDoctorDisplayName } from '../consult/appointmentUtils';
import {
  doctorDisplayName,
  doctorExperience,
  doctorImage,
  doctorQualification,
  doctorRating,
  doctorSpeciality,
  getDoctorId,
} from '../consult/doctors';
import { toggleDoctorFavourite, useDoctorFavFlag } from '../consult/doctorFavSync';
import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import FavButton from './ui/FavButton';
import DietitianBadge from './DietitianBadge';
import { nameInitial } from '../utils/initials';
import Rail, { RailItem } from './ui/Rail';

/** Scrolls long doctor names horizontally when they don't fit. */
function MarqueeName({ children }) {
  const wrapRef = useRef(null);
  const textRef = useRef(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    if (!wrap || !text) return undefined;

    const measure = () => {
      const delta = Math.ceil(text.scrollWidth - wrap.clientWidth);
      setShift(delta > 2 ? delta : 0);
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(wrap);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [children]);

  return (
    <span
      ref={wrapRef}
      className={`vd-card__name-scroll${shift ? ' is-marquee' : ''}`}
      style={shift ? { '--vd-name-shift': `-${shift}px` } : undefined}
    >
      <strong ref={textRef}>{children}</strong>
    </span>
  );
}

/**
 * T129 — "Visited Doctors" (app parity: VisitedDoctorHomeCard).
 * Data: GET customers/doctors/recent/ = doctors the customer has paid to consult.
 */
function VisitedDoctorCard({ item, fallbackSpeciality }) {
  const navigate = useNavigate();
  const id = getDoctorId(item);
  const name = formatDoctorDisplayName(doctorDisplayName(item));
  const image = doctorImage(item);
  const rating = doctorRating(item);
  const credential =
    doctorQualification(item) || item?.doctor_designation || doctorSpeciality(item) || fallbackSpeciality;
  const experience = doctorExperience(item);
  const reviewCount = Number(item?.total_reviews || item?.review_count || item?.reviews_count || 0);
  const verified = Boolean(item?.is_verified);
  const available = item?.has_availability === true;
  const visits = Number(item?.consultation_count || 0);
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
    <article className="vd-card">
      <button type="button" className="vd-card__main" onClick={openProfile} aria-label={`View ${name} profile`}>
        <span className="vd-card__avatar">
          {!rating ? (
            <span className="vd-chip vd-chip--new">
              <Sparkles size={12} aria-hidden />
              New
            </span>
          ) : null}
          <span className="vd-card__ring">
            {image ? (
              <img src={image} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="vd-card__initial" aria-hidden>
                {nameInitial(name)}
              </span>
            )}
            {available ? <i className="vd-card__dot" title="Available" /> : null}
          </span>
        </span>
        <span className="vd-card__id">
          <span className="vd-card__name-row">
            <span className="vd-card__name">
              <MarqueeName>{name}</MarqueeName>
              {verified ? <BadgeCheck size={15} aria-label="Verified" /> : null}
            </span>
            {experience ? (
              <span className="vd-chip vd-chip--exp">
                <Briefcase size={12} aria-hidden />
                {experience}
              </span>
            ) : null}
          </span>
          <DietitianBadge doctor={item} />
          {credential ? <span className="vd-card__cred">{credential}</span> : null}
          {rating ? (
            <span className="vd-card__chips">
              <span className="vd-chip vd-chip--rating">
                <Star size={12} fill="currentColor" aria-hidden />
                <b>{rating}</b>
                {reviewCount ? <em>({reviewCount})</em> : null}
              </span>
            </span>
          ) : null}
        </span>
      </button>
      <div className="vd-card__foot">
        {visits > 0 ? (
          <span className="vd-chip vd-chip--visits">
            <Repeat size={12} aria-hidden />
            <b>{visits}</b>
            {visits === 1 ? ' visit' : ' visits'}
          </span>
        ) : (
          <span />
        )}
        <div className="vd-card__actions">
          <FavButton
            on={fav}
            className="vd-card__fav"
            label={fav ? `Remove ${name} from favourites` : `Save ${name}`}
            onClick={toggleFav}
          />
          <button type="button" className="vd-card__book" onClick={openProfile} aria-label={`Book ${name} again`}>
            Book again
            <ArrowRight size={14} aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function VisitedDoctorList({ items, label, fallbackSpeciality = 'Ayurvedic doctor' }) {
  if (!items?.length) return null;
  return (
    <div className="vd-wrap">
      <Rail label={label} className="vd-list" auto interval={3200} controls>
        {items.map((item) => (
          <RailItem key={getDoctorId(item) || item.doctor_id || item.id} className="vd-list__item">
            <VisitedDoctorCard item={item} fallbackSpeciality={fallbackSpeciality} />
          </RailItem>
        ))}
      </Rail>
    </div>
  );
}

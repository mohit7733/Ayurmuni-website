import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Star } from 'lucide-react';
import { formatDoctorDisplayName } from '../consult/appointmentUtils';
import {
  doctorDisplayName,
  doctorFavorite,
  doctorFeeLabel,
  doctorImage,
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
import DietitianBadge from './DietitianBadge';
import { nameInitial } from '../utils/initials';

/** Scrolls long doctor names when they don't fit. */
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
      className={`am-flip-doc__name-scroll${shift ? ' is-marquee' : ''}`}
      style={shift ? { '--am-flip-name-shift': `-${shift}px` } : undefined}
    >
      <span ref={textRef}>{children}</span>
    </span>
  );
}

export default function SuggestedDoctorCard({ item, fallbackSpeciality = 'Ayurveda' }) {
  const navigate = useNavigate();
  const id = getDoctorId(item);
  const name = formatDoctorDisplayName(doctorDisplayName(item));
  const image = doctorImage(item);
  const rating = doctorRating(item);
  const fee = doctorFeeLabel(item);
  const credential = doctorQualification(item) || doctorSpeciality(item) || fallbackSpeciality;
  const reviewCount = Number(item?.total_reviews || item?.review_count || 0);
  const verified = Boolean(item?.is_verified);
  const bios = Array.isArray(item?.specialized_bio)
    ? item.specialized_bio.map((bio) => String(bio || '').trim()).filter(Boolean).slice(0, 2)
    : [];
  const [fav, setFav] = useState(() => doctorFavorite(item));
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
        {showPhoto ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
          />
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
        <div className="hm-doc-card__dietitian">
          <DietitianBadge doctor={item} />
        </div>
      </div>

      <div className="am-flip-doc__body">
        <h3 className="am-flip-doc__name">
          <button type="button" className="am-stretched" onClick={openProfile}>
            <MarqueeName>{name}</MarqueeName>
          </button>
        </h3>
        {credential ? <p className="am-flip-doc__spec">{credential}</p> : null}
        {bios.length ? (
          <ul className="hm-doc-card__specialized-bio" aria-label="Specialized Bio">
            {bios.map((bio) => (
              <li key={bio} className="hm-doc-card__specialized-bio-item">
                <span>{bio}</span>
              </li>
            ))}
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
          <button type="button" className="am-flip-doc__cta-link" onClick={openProfile}>
            View profile
            <ArrowRight size={14} aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}

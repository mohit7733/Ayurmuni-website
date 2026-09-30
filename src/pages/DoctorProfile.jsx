import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  BadgeCheck,
  BriefcaseMedical,
  CalendarClock,
  ExternalLink,
  Heart,
  Languages,
  MapPin,
  RefreshCw,
  Stethoscope,
  Video,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import ShareButton from '../components/ShareButton';
import { formatRupee } from '../home/catalog';
import { getDoctorById, toggleFavDoctor } from '../services/consultService';
import { getReviews } from '../services/productService';
import { requireAuth } from '../services/guestAuth';
import { showSuccessToast } from '../config/key';
import { formatDoctorDisplayName } from '../consult/appointmentUtils';
import {
  doctorConsultFee,
  doctorExperience,
  doctorFavorite,
  doctorImage,
  doctorLocation,
  doctorQualification,
  doctorRating,
  doctorSpeciality,
  favoriteFromToggle,
  formatEarliestDate,
  getDoctorId,
  parseDoctor,
  resolveDoctorHealthDiseases,
  resolveDoctorSpecializations,
  resolveConsultationModes,
  resolveLanguages,
  resolveSocialAccounts,
} from '../consult/doctors';
import {
  extractReviewsList,
  isReviewVideoUrl,
  normalizeReviewsForDisplay,
} from '../utils/reviewUtils';
import {
  Badge,
  Button,
  Disclaimer,
  EmptyState,
  ErrorState,
  IconButton,
  Rating,
  ReviewCard,
  Skeleton,
  SkeletonText,
} from '../components/ui';
import { DOCTOR_PROFILE_COPY as T } from '../content/doctorProfile';
import '../design/pages/doctor-profile.css';

const ChipRow = ({ items, tone }) => {
  if (!items?.length) return null;
  return (
    <ul className="dp-chip-row">
      {items.map((item) => (
        <li key={item} className={`dp-chip${tone ? ` dp-chip--${tone}` : ''}`}>
          {item}
        </li>
      ))}
    </ul>
  );
};

const openSocial = (url) => {
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  window.open(href, '_blank', 'noopener,noreferrer');
};

function doctorDisplaySafe(doctor) {
  return (
    doctor?.doctor_name ||
    doctor?.full_name ||
    doctor?.name ||
    [doctor?.first_name, doctor?.last_name].filter(Boolean).join(' ') ||
    'Doctor'
  );
}

function ProfileSkeleton() {
  return (
    <div className="dp-skel" aria-busy="true">
      <div className="dp-skel-hero">
        <Skeleton variant="circle" width={88} height={88} />
        <div className="dp-skel-hero__copy">
          <Skeleton width="60%" height={28} />
          <Skeleton width="40%" />
          <SkeletonText lines={2} />
        </div>
      </div>
      <Skeleton variant="rect" height={120} />
      <Skeleton variant="rect" height={160} />
      <span className="am-sr-only">{T.loading}</span>
    </div>
  );
}

export default function DoctorProfile() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const seeded = location.state?.doctor || location.state?.doctorDetails || null;
  const [doctor, setDoctor] = useState(seeded);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(!seeded);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fav, setFav] = useState(doctorFavorite(seeded));
  const [showFullAbout, setShowFullAbout] = useState(false);
  const [showAllConditions, setShowAllConditions] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!doctorId) return;
      if (isRefresh) setRefreshing(true);
      else if (!seeded) setLoading(true);
      try {
        const [docRes, reviewRes] = await Promise.all([
          getDoctorById(doctorId),
          getReviews({ entity_type: 'doctor', doctor_id: doctorId }),
        ]);
        const profile = parseDoctor(docRes);
        if (!profile && docRes?.success === false) {
          setFailed(true);
          showSuccessToast(docRes?.message || 'Doctor not found', 'error');
        } else {
          setFailed(false);
        }
        if (profile) {
          setDoctor((prev) => ({ ...(prev || {}), ...profile }));
          setFav(doctorFavorite(profile));
        }
        setReviews(normalizeReviewsForDisplay(extractReviewsList(reviewRes)));
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [doctorId, seeded],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const id = getDoctorId(doctor) || doctorId;
  const image = doctorImage(doctor);
  const fee = doctorConsultFee(doctor);
  const feeLabel = fee ? formatRupee(fee) : '';
  const about = String(doctor?.bio || doctor?.about || doctor?.description || '')
    .replace(/\r\n/g, '\n')
    .trim();
  const shouldTruncate = about.length > 160;
  const aboutText = shouldTruncate && !showFullAbout ? `${about.slice(0, 150)}` : about;
  const languages = useMemo(() => resolveLanguages(doctor), [doctor]);
  const specializations = useMemo(() => resolveDoctorSpecializations(doctor), [doctor]);
  const healthDiseases = useMemo(() => resolveDoctorHealthDiseases(doctor), [doctor]);
  const consultationModes = useMemo(() => resolveConsultationModes(doctor), [doctor]);
  const socialAccounts = useMemo(() => resolveSocialAccounts(doctor), [doctor]);
  const visibleConditions = showAllConditions ? healthDiseases : healthDiseases.slice(0, 6);
  const hiddenConditions = Math.max(0, healthDiseases.length - 6);
  const qualification = doctorQualification(doctor);
  const locationLabel = doctorLocation(doctor);
  const experienceLabel = doctorExperience(doctor);
  const ratingValue = doctorRating(doctor);
  const reviewCount = Number(doctor?.total_reviews || reviews.length || 0);
  const isVerified = Boolean(doctor?.is_verified);
  const hasAvailability = Boolean(doctor?.has_availability);
  const slotsCount = Number(doctor?.available_slots_count || 0);
  const earliestDate = formatEarliestDate(doctor?.earliest_available_date);
  const showAvailability = hasAvailability || slotsCount > 0 || Boolean(earliestDate);
  const displayName = formatDoctorDisplayName(doctorDisplaySafe(doctor));
  const speciality = doctorSpeciality(doctor) || 'Ayurveda';

  const toggleFav = async () => {
    if (!(await requireAuth('Please login to save favourite doctors'))) return;
    if (!id) {
      showSuccessToast('Doctor unavailable', 'error');
      return;
    }
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
      else showSuccessToast(res?.message || 'Favourite updated', 'success');
    } catch {
      setFav(prev);
      showSuccessToast('Failed to update favourite status', 'error');
    }
  };

  const book = async () => {
    if (!(await requireAuth('Please login to book an appointment'))) return;
    if (!id) return;
    navigate(`/consult/doctors/${id}/slots`, { state: { doctor } });
  };

  const openSlip = async () => {
    if (!(await requireAuth('Please login to view the doctor slip'))) return;
    navigate(`/consult/doctors/${id}/slip`);
  };

  const headerActions = (
    <>
      <IconButton label={fav ? T.saved : T.save} pressed={fav} onClick={toggleFav}>
        <Heart size={18} fill={fav ? 'currentColor' : 'none'} aria-hidden />
      </IconButton>
      <ShareButton
        title={`Dr. ${displayName} - Ayurmuni`}
        text={`Consult with Dr. ${displayName}, ${speciality} on Ayurmuni`}
        url={window.location.href}
        showModal={true}
      />
      <Button
        variant="ghost"
        size="sm"
        loading={refreshing}
        disabled={loading}
        onClick={() => load(true)}
        leadingIcon={<RefreshCw size={16} aria-hidden />}
      >
        {refreshing ? T.refreshing : T.refresh}
      </Button>
    </>
  );

  if (loading) {
    return (
      <AppShell tab="consult">
        <div className="dp-page">
          <PageHeader title={T.title} backTo="/consult/doctors" actions={headerActions} />
          <ProfileSkeleton />
        </div>
      </AppShell>
    );
  }

  if (!doctor) {
    return (
      <AppShell tab="consult">
        <div className="dp-page">
          <PageHeader title={T.title} backTo="/consult/doctors" />
          {failed ? (
            <ErrorState title={T.notFoundTitle} description={T.notFoundText} onRetry={() => load(false)} />
          ) : (
            <EmptyState
              icon={<Stethoscope size={28} />}
              title={T.notFoundTitle}
              description={T.notFoundText}
              action={
                <Button onClick={() => navigate('/consult/doctors')}>{T.browseAll}</Button>
              }
            />
          )}
        </div>
      </AppShell>
    );
  }

  const availabilityLine = [
    slotsCount > 0 ? T.slotsOpen(slotsCount) : null,
    earliestDate ? T.nextSlot(earliestDate) : null,
  ]
    .filter(Boolean)
    .join(' · ') || T.checkSlots;

  const bookActions = (
    <>
      <Button variant="secondary" onClick={openSlip} disabled={!id}>
        {T.doctorSlip}
      </Button>
      <Button
        variant="accent"
        onClick={book}
        disabled={!id}
        leadingIcon={<CalendarClock size={18} aria-hidden />}
      >
        {T.book}
      </Button>
    </>
  );

  return (
    <AppShell tab="consult">
      <div className="dp-page">
        <PageHeader
          title={T.title}
          subtitle={speciality}
          backTo="/consult/doctors"
          actions={headerActions}
        />

        <div className="dp-layout">
          <div className="dp-main">
            <section className="dp-hero" aria-labelledby="dp-name">
              <div className="dp-hero__top">
                <div className="dp-photo">
                  <div className="dp-photo__img" aria-hidden={!image}>
                    {image ? (
                      <img src={image} alt={displayName} width={112} height={112} />
                    ) : (
                      <span>{displayName.charAt(0)}</span>
                    )}
                  </div>
                  {isVerified ? (
                    <span className="dp-photo__verified" title={T.verified}>
                      <BadgeCheck size={16} aria-hidden />
                      <span className="am-sr-only">{T.verified}</span>
                    </span>
                  ) : null}
                </div>

                <div className="dp-hero__id">
                  {isVerified ? <Badge tone="success">{T.verified}</Badge> : null}
                  <h1 id="dp-name">{displayName}</h1>
                  <p className="dp-hero__spec">{speciality}</p>
                  {qualification ? <p className="dp-hero__qual">{qualification}</p> : null}
                  <div className="dp-hero__rating">
                    {ratingValue ? <Rating value={ratingValue} count={reviewCount} size="md" /> : null}
                  </div>
                  {(experienceLabel || locationLabel) && (
                    <ul className="dp-hero__meta">
                      {experienceLabel ? (
                        <li>
                          <BriefcaseMedical size={14} aria-hidden />
                          {experienceLabel}
                        </li>
                      ) : null}
                      {locationLabel ? (
                        <li>
                          <MapPin size={14} aria-hidden />
                          {locationLabel}
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>
              </div>

              <ul className="dp-stats" aria-label="Doctor highlights">
                <li>
                  <strong>{experienceLabel || '—'}</strong>
                  <span>{T.yearsExp}</span>
                </li>
                <li>
                  <strong>{ratingValue || '—'}</strong>
                  <span>{T.rating}</span>
                </li>
                <li>
                  <strong>{reviewCount}</strong>
                  <span>{T.reviews}</span>
                </li>
              </ul>
            </section>

            {about ? (
              <section className="dp-card" aria-labelledby="dp-about">
                <div className="dp-card__head">
                  <h2 id="dp-about">{T.about}</h2>
                </div>
                <p className="dp-about">
                  {aboutText}
                  {shouldTruncate ? (
                    <button
                      type="button"
                      className="dp-about__toggle"
                      onClick={() => setShowFullAbout((open) => !open)}
                      aria-expanded={showFullAbout}
                    >
                      {showFullAbout ? T.showLess : T.showMore}
                    </button>
                  ) : null}
                </p>
              </section>
            ) : null}

            {specializations.length > 0 ? (
              <section className="dp-card" aria-labelledby="dp-specs">
                <div className="dp-card__head">
                  <h2 id="dp-specs">{T.specializations}</h2>
                </div>
                <ChipRow items={specializations} tone="primary" />
              </section>
            ) : null}

            {healthDiseases.length > 0 ? (
              <section className="dp-card" aria-labelledby="dp-treats">
                <div className="dp-card__head">
                  <h2 id="dp-treats">{T.treats}</h2>
                  <span className="dp-card__count">{healthDiseases.length}</span>
                </div>
                <ChipRow items={visibleConditions} />
                {hiddenConditions > 0 ? (
                  <div className="dp-more">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowAllConditions((open) => !open)}
                    >
                      {showAllConditions ? T.showLess : T.moreConditions(hiddenConditions)}
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : null}

            {socialAccounts.length > 0 ? (
              <section className="dp-card" aria-labelledby="dp-social">
                <div className="dp-card__head">
                  <h2 id="dp-social">{T.social}</h2>
                </div>
                <div className="dp-social">
                  {socialAccounts.map((item) => (
                    <Button
                      key={item.label}
                      variant="secondary"
                      size="sm"
                      onClick={() => openSocial(item.url)}
                      trailingIcon={<ExternalLink size={14} aria-hidden />}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="dp-card" aria-labelledby="dp-reviews">
              <div className="dp-card__head">
                <h2 id="dp-reviews">{T.ratingsTitle}</h2>
                {reviews.length > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      navigate('/reviews', {
                        state: {
                          entityType: 'doctor',
                          doctorId: id,
                          reviews,
                        },
                      })
                    }
                  >
                    {T.viewAllReviews}
                  </Button>
                ) : null}
              </div>
              {reviews.length > 0 ? (
                <div className="dp-reviews">
                  {reviews.slice(0, 3).map((item, index) => {
                    const media = (item.image_urls || []).map((url) => ({
                      url,
                      type: isReviewVideoUrl(url) ? 'video' : 'image',
                    }));
                    return (
                      <ReviewCard
                        key={item.id || index}
                        name={item.patient_name || 'Patient'}
                        rating={item.rating}
                        text={item.comment || item.review || item.message || ''}
                        media={media}
                        onMediaClick={(mediaIndex) =>
                          navigate('/reviews/gallery', {
                            state: { images: item.image_urls, selectedIndex: mediaIndex },
                          })
                        }
                      />
                    );
                  })}
                </div>
              ) : (
                <EmptyState compact title={T.noReviews} description={T.noReviewsText} />
              )}
            </section>

            <Disclaimer variant="banner" />
          </div>

          <aside className="dp-aside" aria-label={T.consultation}>
            <div className="dp-fee">
              <div>
                <p className="dp-fee__label">{T.consultation}</p>
                <p className="dp-fee__value">{feeLabel || '—'}</p>
              </div>
              {consultationModes.length > 0 ? (
                <div className="dp-fee__mode">
                  <p className="dp-fee__label">{T.consultVia}</p>
                  <Badge tone="info" icon={<Video size={12} aria-hidden />}>
                    {T.videoConsult}
                  </Badge>
                </div>
              ) : null}
            </div>

            {showAvailability ? (
              <div className={`dp-avail${hasAvailability ? ' is-open' : ''}`}>
                <span className="dp-avail__icon" aria-hidden>
                  <CalendarClock size={18} />
                </span>
                <div>
                  <strong>{hasAvailability ? T.available : T.limited}</strong>
                  <p>{availabilityLine}</p>
                </div>
              </div>
            ) : null}

            {languages.length > 0 ? (
              <section className="dp-card" aria-labelledby="dp-langs">
                <div className="dp-card__head">
                  <h2 id="dp-langs" className="dp-card__title-icon">
                    <Languages size={16} aria-hidden />
                    {T.languages}
                  </h2>
                </div>
                <ChipRow items={languages} tone="accent" />
              </section>
            ) : null}

            <div className="dp-aside__actions">{bookActions}</div>
          </aside>
        </div>
      </div>

      <div className="dp-sticky" role="region" aria-label={T.book}>
        <div className="dp-sticky__fee">
          <strong>{feeLabel || T.feeFallback}</strong>
          <small>
            {hasAvailability && slotsCount > 0 ? T.slotsOpen(slotsCount) : T.feeFallback}
          </small>
        </div>
        <Button
          variant="accent"
          onClick={book}
          disabled={!id}
          leadingIcon={<CalendarClock size={18} aria-hidden />}
        >
          {T.book}
        </Button>
      </div>
    </AppShell>
  );
}

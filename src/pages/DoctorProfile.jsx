import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  BadgeCheck,
  BriefcaseMedical,
  CalendarClock,
  ExternalLink,
  HeartPulse,
  Languages,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Star,
  Stethoscope,
  UserRound,
  Video,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  ActionStack,
  DetailCard,
  DetailEmpty,
  DetailHero,
  DetailLayout,
  DetailPage,
  DetailSkeleton,
  DetailTop,
  MetaChip,
  StatusPill,
  SummaryRows,
} from '../components/detail/Detail';
import ShareButton from '../components/ShareButton';
import { formatRupee } from '../home/catalog';
import { getDoctorById, toggleFavDoctor } from '../services/consultService';
import { getReviews } from '../services/productService';
import { requireAuth } from '../services/guestAuth';
import { invalidateApiCache } from '../services/apiClient';
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
  Button,
  Disclaimer,
  EmptyState,
  ErrorState,
  FavButton,
  Rating,
  ReviewCard,
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
      if (isRefresh) {
        setRefreshing(true);
        invalidateApiCache(['customers/doctors/', 'review/']);
      } else if (!seeded) setLoading(true);
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
      <FavButton on={fav} label={fav ? T.saved : T.save} onClick={toggleFav} />
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
        <DetailPage>
          <DetailTop backTo="/consult/doctors" backLabel="Doctors" actions={headerActions} />
          <DetailSkeleton media={false} label={T.loading} />
        </DetailPage>
      </AppShell>
    );
  }

  if (!doctor) {
    return (
      <AppShell tab="consult">
        <DetailPage>
          <DetailTop backTo="/consult/doctors" backLabel="Doctors" />
          {failed ? (
            <ErrorState title={T.notFoundTitle} description={T.notFoundText} onRetry={() => load(false)} />
          ) : (
            <DetailEmpty
              icon={Stethoscope}
              title={T.notFoundTitle}
              text={T.notFoundText}
              action={<Button onClick={() => navigate('/consult/doctors')}>{T.browseAll}</Button>}
            />
          )}
        </DetailPage>
      </AppShell>
    );
  }

  const availabilityLine = [
    slotsCount > 0 ? T.slotsOpen(slotsCount) : null,
    earliestDate ? T.nextSlot(earliestDate) : null,
  ]
    .filter(Boolean)
    .join(' · ') || T.checkSlots;
  const showQualification =
    qualification && qualification.trim().toLowerCase() !== speciality.trim().toLowerCase();

  return (
    <AppShell tab="consult">
      <DetailPage className="dp-page--dx">
        <DetailTop backTo="/consult/doctors" backLabel="Doctors" actions={headerActions} />

        <DetailHero
          variant="band"
          className="dp-hero--dx"
          titleId="dp-name"
          avatar={
            <>
              {image ? <img src={image} alt="" /> : displayName.replace(/^dr\.?\s*/i, '').charAt(0)}
            </>
          }
          eyebrow="Ayurveda doctor"
          title={displayName}
          lede={showQualification ? `${speciality} · ${qualification}` : speciality}
          chips={
            <>
              {ratingValue ? (
                <MetaChip icon={Star} tone="gold">
                  {ratingValue} · {reviewCount} {T.reviews.toLowerCase()}
                </MetaChip>
              ) : null}
              {experienceLabel ? <MetaChip icon={BriefcaseMedical}>{experienceLabel}</MetaChip> : null}
              {locationLabel ? <MetaChip icon={MapPin}>{locationLabel}</MetaChip> : null}
              {consultationModes.length > 0 ? <MetaChip icon={Video}>{T.videoConsult}</MetaChip> : null}
            </>
          }
          aside={
            <>
              {isVerified ? (
                <StatusPill tone="success">
                  <BadgeCheck size={12} aria-hidden /> {T.verified}
                </StatusPill>
              ) : null}
              <div className="dx-figure">
                <small>{T.consultation}</small>
                <strong>{feeLabel || T.feeFallback}</strong>
              </div>
            </>
          }
        >
          <div className="dx-actions dx-actions--row">
            <Button
              variant="accent"
              size="sm"
              onClick={book}
              disabled={!id}
              leadingIcon={<CalendarClock size={16} aria-hidden />}
            >
              {T.book}
            </Button>
            <Button variant="secondary" size="sm" onClick={openSlip} disabled={!id}>
              {T.doctorSlip}
            </Button>
          </div>
        </DetailHero>

        <DetailLayout
          aside={
            <>
              <DetailCard id="dp-consult" title={T.consultation} icon={CalendarClock} tone="accent">
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
                <SummaryRows
                  rows={[
                    { label: T.consultVia, value: consultationModes.length > 0 ? T.videoConsult : '' },
                    { label: T.yearsExp, value: experienceLabel },
                  ]}
                  total={{ label: 'Consultation fee', value: feeLabel }}
                />
                <ActionStack>
                  <Button onClick={book} disabled={!id} leadingIcon={<CalendarClock size={16} aria-hidden />}>
                    {T.book}
                  </Button>
                  <Button variant="secondary" onClick={openSlip} disabled={!id}>
                    {T.doctorSlip}
                  </Button>
                </ActionStack>
              </DetailCard>

              {languages.length > 0 ? (
                <DetailCard id="dp-langs" title={T.languages} icon={Languages}>
                  <ChipRow items={languages} tone="accent" />
                </DetailCard>
              ) : null}

              <p className="dx-note">
                <ShieldCheck size={14} aria-hidden />
                Verified BAMS / MD practitioners. Consultations are private and secure.
              </p>
            </>
          }
        >
          {about ? (
            <DetailCard id="dp-about" title={T.about} icon={UserRound}>
              <p className="dx-prose">
                {aboutText}
                {shouldTruncate && !showFullAbout ? '… ' : ' '}
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
            </DetailCard>
          ) : null}

          {healthDiseases.length > 0 ? (
            <DetailCard id="dp-treats" title={T.treats} icon={HeartPulse} meta={String(healthDiseases.length)}>
              <ChipRow items={visibleConditions} />
              {hiddenConditions > 0 ? (
                <div className="dp-more">
                  <Button variant="link" size="sm" onClick={() => setShowAllConditions((open) => !open)}>
                    {showAllConditions ? T.showLess : T.moreConditions(hiddenConditions)}
                  </Button>
                </div>
              ) : null}
            </DetailCard>
          ) : null}

          {specializations.length > 0 ? (
            <DetailCard id="dp-specs" title={T.specializations} icon={Stethoscope}>
              <ChipRow items={specializations} tone="primary" />
            </DetailCard>
          ) : null}

          {socialAccounts.length > 0 ? (
            <DetailCard id="dp-social" title={T.social} icon={ExternalLink}>
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
            </DetailCard>
          ) : null}

          <DetailCard
            id="dp-reviews"
            title={T.ratingsTitle}
            icon={Star}
            action={
              reviews.length > 0 ? (
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
              ) : null
            }
          >
            {ratingValue ? (
              <div className="dp-score">
                <strong>{ratingValue}</strong>
                <div>
                  <Rating value={ratingValue} size="md" />
                  <small>
                    {reviewCount} {T.reviews.toLowerCase()}
                  </small>
                </div>
              </div>
            ) : null}
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
          </DetailCard>

          <Disclaimer variant="banner" />
        </DetailLayout>
      </DetailPage>

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

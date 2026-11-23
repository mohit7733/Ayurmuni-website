import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ImagePlus,
  Leaf,
  ShieldCheck,
  Star,
  Stethoscope,
  X,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import { createReview } from '../services/reviewService';
import {
  buildReviewSubmitPayload,
  uploadReviewAsset,
} from '../utils/reviewUtils';
import {
  setPendingDietPlanReview,
  setPendingProductReview,
} from '../utils/pendingReviews';
import {
  hydrateReviewedDietPlans,
  isDietPlanAssignmentReviewed,
  markDietPlanAssignmentReviewed,
} from '../utils/reviewedDietPlans';
import '../design/pages/share-experience.css';

const MAX_MEDIA = 5;
const MAX_REVIEW = 800;

const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

const ENTITY_COPY = {
  doctor: {
    eyebrow: 'Consultation review',
    placeholder:
      'How was the consultation? Share what helped, what could improve, and how the doctor made you feel.',
    emptyThumb: Stethoscope,
  },
  product: {
    eyebrow: 'Product review',
    placeholder:
      'What did you notice about quality, taste, packaging, or results? Specific details help others decide.',
    emptyThumb: Leaf,
  },
  diet_plan: {
    eyebrow: 'Diet plan review',
    placeholder:
      'Was the plan easy to follow? Tell us about meals, energy, and anything you would change.',
    emptyThumb: Leaf,
  },
};

export default function ShareExperience() {
  const navigate = useNavigate();
  const params = useLocation().state || {};
  const entityType = params.entityType || 'doctor';
  const entityName = params.entityName || '';
  const entitySubtitle = params.entitySubtitle || '';
  const entityImage = params.entityImage || '';
  const appointmentId = params.appointmentId || '';
  const variantId = params.variantId || '';
  const orderId = params.orderId || '';
  const patientDietPlanId = params.patientDietPlanId || '';
  const dietPlanId = params.dietPlanId || '';
  const [rating, setRating] = useState(Math.max(0, Math.min(5, Number(params.initialRating) || 0)));
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [mediaItems, setMediaItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const copy = ENTITY_COPY[entityType] || ENTITY_COPY.doctor;
  const EmptyIcon = copy.emptyThumb;
  const activeRating = hoverRating || rating;

  const canSubmitRefs =
    entityType === 'doctor'
      ? !!appointmentId
      : entityType === 'product'
        ? !!variantId && !!orderId
        : entityType === 'diet_plan'
          ? !!patientDietPlanId
          : false;

  const headerTitle =
    entityType === 'doctor'
      ? 'Rate Your Consultation'
      : entityType === 'product'
        ? 'Rate This Product'
        : entityType === 'diet_plan'
          ? 'Rate This Diet Plan'
          : 'Share Experience';

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to share your experience'))) return;
      if (entityType !== 'diet_plan' || !patientDietPlanId) return;
      await hydrateReviewedDietPlans();
      if (isDietPlanAssignmentReviewed(patientDietPlanId)) {
        showSuccessToast('You have already reviewed this diet plan', 'error');
        navigate(-1);
      }
    })();
  }, [entityType, patientDietPlanId, navigate]);

  useEffect(() => {
    setImageFailed(false);
  }, [entityImage]);

  useEffect(
    () => () => {
      mediaItems.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    },
    [mediaItems],
  );

  const pickMedia = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const room = MAX_MEDIA - mediaItems.length;
    if (room <= 0) {
      showSuccessToast(`You can add up to ${MAX_MEDIA} files`, 'error');
      return;
    }
    const next = files.slice(0, room).map((file) => ({
      id: `local-${Date.now()}-${file.name}`,
      file,
      type: String(file.type || '').startsWith('video') ? 'video' : 'image',
      previewUrl: URL.createObjectURL(file),
    }));
    setMediaItems((prev) => [...prev, ...next]);
  };

  const removeMedia = (id) => {
    setMediaItems((prev) => {
      const item = prev.find((row) => row.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((row) => row.id !== id);
    });
  };

  const goBackAfterSubmit = () => {
    if (entityType === 'doctor' && appointmentId) {
      navigate(`/profile/appointments/${appointmentId}`, { replace: true });
      return;
    }
    if (entityType === 'product' && orderId) {
      navigate(`/profile/orders/${orderId}`, { replace: true });
      return;
    }
    if (entityType === 'diet_plan' && dietPlanId) {
      navigate(`/diet/${dietPlanId}`, { replace: true });
      return;
    }
    navigate(-1);
  };

  const handleSubmit = async () => {
    if (!rating) {
      showSuccessToast('Please select a rating', 'error');
      return;
    }
    if (!canSubmitRefs) {
      showSuccessToast(
        entityType === 'product'
          ? 'Missing order or product reference'
          : entityType === 'diet_plan'
            ? 'Missing diet plan reference'
            : 'Missing appointment reference',
        'error',
      );
      return;
    }
    try {
      setBusy(true);
      const uploadedUrls = await Promise.all(
        mediaItems.map((item) => uploadReviewAsset(item.file, entityType)),
      );
      const reviewPayload = buildReviewSubmitPayload({
        rating,
        review,
        imageUrls: uploadedUrls,
        entityType,
        appointmentId,
        orderId,
        variantId,
        patientDietPlanId,
      });
      const response = await createReview({
        entityType,
        appointmentId: entityType === 'doctor' ? appointmentId : undefined,
        variantId: entityType === 'product' ? variantId : undefined,
        orderId: entityType === 'product' ? orderId : undefined,
        patientDietPlanId: entityType === 'diet_plan' ? patientDietPlanId : undefined,
        reviewData: reviewPayload,
      });
      if (response?.success) {
        showSuccessToast(response.message || 'Thank you for sharing your experience!', 'success');
        if (entityType === 'product' && variantId && orderId) {
          setPendingProductReview({
            variantId: String(variantId),
            orderId: String(orderId),
            rating,
            review: review.trim(),
            image_urls: uploadedUrls.filter(Boolean),
          });
        }
        if (entityType === 'diet_plan' && patientDietPlanId) {
          const responseAvg =
            response?.data?.avg_rating ??
            response?.avg_rating ??
            response?.data?.diet_plan?.avg_rating ??
            null;
          await markDietPlanAssignmentReviewed(String(patientDietPlanId));
          setPendingDietPlanReview({
            patientDietPlanId: String(patientDietPlanId),
            dietPlanId: dietPlanId ? String(dietPlanId) : undefined,
            rating,
            avg_rating:
              responseAvg != null && Number.isFinite(Number(responseAvg))
                ? Number(responseAvg)
                : rating,
          });
        }
        goBackAfterSubmit();
        return;
      }
      showSuccessToast(response?.message || 'Unable to submit review', 'error');
    } catch {
      showSuccessToast('Something went wrong while submitting', 'error');
    } finally {
      setBusy(false);
    }
  };

  const countClass =
    review.length >= MAX_REVIEW ? 'is-max' : review.length >= MAX_REVIEW * 0.9 ? 'is-near' : '';

  return (
    <AppShell tab="profile">
      <section className="catalog-page review-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>{headerTitle}</h1>
            <p>Your feedback helps others choose with confidence</p>
          </div>
        </header>

        <div className="sx-shell">
          <article className="sx-entity">
            <div className="sx-entity__thumb" aria-hidden={!entityImage || imageFailed}>
              {entityImage && !imageFailed ? (
                <img
                  src={entityImage}
                  alt=""
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <span className="sx-entity__fallback">
                  <EmptyIcon size={22} strokeWidth={1.75} />
                </span>
              )}
            </div>
            <div className="sx-entity__copy">
              <span className="sx-eyebrow">{copy.eyebrow}</span>
              <strong>{entityName || 'Your experience'}</strong>
              {entitySubtitle ? <p>{entitySubtitle}</p> : null}
            </div>
          </article>

          <section className="sx-card sx-rating">
            <div className="sx-card__head">
              <h3>
                Your rating <span className="sx-req">*</span>
              </h3>
              {activeRating > 0 ? (
                <span key={activeRating} className="sx-rating__tag">
                  {activeRating}/5 · {RATING_LABELS[activeRating]}
                </span>
              ) : (
                <span className="sx-rating__hint">Tap a star to rate</span>
              )}
            </div>
            <div
              className="sx-stars"
              role="radiogroup"
              aria-label="Your rating"
              onMouseLeave={() => setHoverRating(0)}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  className={`sx-star${star <= activeRating ? ' is-on' : ''}${
                    star === rating ? ' is-picked' : ''
                  }`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onFocus={() => setHoverRating(star)}
                  onBlur={() => setHoverRating(0)}
                >
                  <Star size={34} strokeWidth={1.75} />
                </button>
              ))}
            </div>
          </section>

          <section className="sx-card sx-text">
            <div className="sx-card__head">
              <h3>Tell us more</h3>
              <span className="sx-opt">Optional</span>
            </div>
            <textarea
              className="sx-textarea"
              value={review}
              maxLength={MAX_REVIEW}
              placeholder={copy.placeholder}
              onChange={(event) => setReview(event.target.value)}
            />
            <p className={`sx-count ${countClass}`}>
              {review.length}/{MAX_REVIEW}
            </p>
          </section>

          <section className="sx-card sx-media">
            <div className="sx-card__head">
              <h3>
                Photos & videos <span className="sx-opt">Optional</span>
              </h3>
              <span className="sx-badge">
                {mediaItems.length}/{MAX_MEDIA}
              </span>
            </div>

            {mediaItems.length > 0 ? (
              <div className="sx-thumbs">
                {mediaItems.map((item) => (
                  <div key={item.id} className="sx-thumb">
                    {item.type === 'video' ? (
                      <span className="sx-thumb__video">Video</span>
                    ) : (
                      <img src={item.previewUrl} alt="" />
                    )}
                    <button
                      type="button"
                      className="sx-thumb__remove"
                      onClick={() => removeMedia(item.id)}
                      aria-label="Remove media"
                    >
                      <X size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {mediaItems.length < MAX_MEDIA ? (
              <label className="sx-drop">
                <input
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  multiple
                  onChange={pickMedia}
                />
                <span className="sx-drop__icon" aria-hidden>
                  <ImagePlus size={18} />
                </span>
                <span className="sx-drop__text">
                  <strong>Add photos or videos</strong>
                  <small>Up to {MAX_MEDIA} files · helps others see real results</small>
                </span>
              </label>
            ) : null}
          </section>

          <aside className="sx-guide">
            <strong className="sx-guide__title">
              <ShieldCheck size={15} aria-hidden /> Review guidelines
            </strong>
            <ul>
              <li>Be honest and specific about what stood out</li>
              <li>Focus on quality, results, and overall experience</li>
              <li>Skip promotional links or personal contact details</li>
              <li>Keep language respectful for the community</li>
            </ul>
          </aside>

          <button
            type="button"
            className="cta sx-submit"
            disabled={busy}
            onClick={handleSubmit}
          >
            {busy ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>
      </section>
    </AppShell>
  );
}

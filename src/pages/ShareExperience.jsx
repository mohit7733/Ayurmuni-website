import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

export default function ShareExperience() {
  const navigate = useNavigate();
  const params = useLocation().state || {};
  const entityType = params.entityType || 'doctor';
  const entityName = params.entityName || '';
  const entitySubtitle = params.entitySubtitle || '';
  const appointmentId = params.appointmentId || '';
  const variantId = params.variantId || '';
  const orderId = params.orderId || '';
  const patientDietPlanId = params.patientDietPlanId || '';
  const dietPlanId = params.dietPlanId || '';
  const [rating, setRating] = useState(Math.max(0, Math.min(5, Number(params.initialRating) || 0)));
  const [review, setReview] = useState('');
  const [mediaItems, setMediaItems] = useState([]);
  const [busy, setBusy] = useState(false);

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

  return (
    <AppShell tab="profile">
      <section className="catalog-page review-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>{headerTitle}</h1>
            <p>Share your experience</p>
          </div>
        </header>

        <div className="review-hero">
          <small>Share Your Experience</small>
          <strong>{entityName}</strong>
          {entitySubtitle ? <p>{entitySubtitle}</p> : null}
        </div>

        <div className="checkout-card review-section review-section--rating">
          <h3>Your rating</h3>
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={star <= rating ? 'on' : ''}
                onClick={() => setRating(star)}
                aria-label={`${star} star`}
              >
                ★
              </button>
            ))}
          </div>
          <p className="muted">
            {rating ? `You rated ${rating} out of 5` : 'Tap a star to rate'}
          </p>
        </div>

        <div className="checkout-card review-section review-section--text">
          <h3>Tell us more</h3>
          <textarea
            className="review-text"
            value={review}
            maxLength={800}
            placeholder="What did you like? How was the quality, service, or consultation experience?"
            onChange={(event) => setReview(event.target.value)}
          />
          <small className="muted">{review.length}/800</small>
        </div>

        <div className="checkout-card review-section review-section--media">
          <div className="review-media-head">
            <h3>Photos & videos</h3>
            <small>Optional • up to {MAX_MEDIA}</small>
          </div>
          <div className="review-media-grid">
            {mediaItems.map((item) => (
              <div key={item.id} className="review-media-tile">
                {item.type === 'video' ? (
                  <span>Video</span>
                ) : (
                  <img src={item.previewUrl} alt="" />
                )}
                <button type="button" onClick={() => removeMedia(item.id)} aria-label="Remove">
                  ×
                </button>
              </div>
            ))}
            {mediaItems.length < MAX_MEDIA ? (
              <label className="review-add-tile">
                <input type="file" accept="image/*,video/*" hidden multiple onChange={pickMedia} />
                + Add
              </label>
            ) : null}
          </div>
        </div>

        <button type="button" className="cta review-submit" disabled={busy} onClick={handleSubmit}>
          {busy ? 'Submitting…' : 'Submit Review'}
        </button>
      </section>
    </AppShell>
  );
}

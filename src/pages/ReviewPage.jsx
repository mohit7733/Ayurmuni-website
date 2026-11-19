import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import AdvanceLoad from '../components/ui/AdvanceLoad';
import PageHeader from '../components/PageHeader';
import ReviewCard from '../components/ui/ReviewCard';
import RatingSummary from '../components/ui/RatingSummary';
import { getReviews } from '../services/productService';
import {
  collectReviewImageUrls,
  extractReviewsList,
  formatReviewDate,
  getAverageRating,
  isReviewVideoUrl,
  normalizeReviewsForDisplay,
} from '../utils/reviewUtils';
import '../design/pages/reviews.css';

const STAR_FILTERS = ['5', '4', '3', '2', '1'];

export default function ReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = location.state || {};
  const entityType = params.entityType || (params.variantId ? 'product' : 'doctor');
  const doctorId = params.doctorId;
  const variantId = params.variantId;
  const seeded = Array.isArray(params.reviews) ? params.reviews : [];

  const [fetched, setFetched] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!entityType) return;
      setLoading(true);
      const payload = { entity_type: entityType };
      if (doctorId) payload.doctor_id = doctorId;
      if (variantId) payload.variant_id = variantId;
      const res = await getReviews(payload);
      if (!alive) return;
      setFetched(extractReviewsList(res));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [doctorId, entityType, variantId]);

  const reviews = useMemo(
    () => normalizeReviewsForDisplay(fetched ?? seeded),
    [fetched, seeded],
  );

  const counts = useMemo(() => {
    const next = { photos: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((item) => {
      if (item.image_urls?.length) next.photos += 1;
      const star = Math.round(Number(item.rating) || 0);
      if (next[star] != null) next[star] += 1;
    });
    return next;
  }, [reviews]);

  const filters = useMemo(() => {
    const items = [{ key: 'all', label: `All ${reviews.length}` }];
    if (counts.photos) items.push({ key: 'photos', label: `Photos ${counts.photos}` });
    STAR_FILTERS.forEach((key) => {
      if (counts[key]) items.push({ key, label: `${key}★ ${counts[key]}` });
    });
    if (reviews.length > 1) items.push({ key: 'recent', label: 'Recent' });
    return items;
  }, [counts, reviews.length]);

  const visible = useMemo(() => {
    if (filter === 'photos') return reviews.filter((item) => item.image_urls?.length);
    if (STAR_FILTERS.includes(filter)) {
      return reviews.filter((item) => Math.round(Number(item.rating) || 0) === Number(filter));
    }
    if (filter === 'recent') {
      return [...reviews].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
    }
    return reviews;
  }, [filter, reviews]);

  const average = getAverageRating(reviews);
  const gallery = collectReviewImageUrls(reviews);

  const openGallery = (images, selectedIndex = 0) => {
    navigate('/reviews/gallery', { state: { images, selectedIndex } });
  };

  return (
    <AppShell tab={entityType === 'product' ? 'products' : 'consult'}>
      <section className="catalog-page rv-page">
        <PageHeader title="Reviews" />
        {reviews.length > 0 ? (
          <RatingSummary
            average={average}
            count={reviews.length}
            reviews={reviews}
            extra={
              gallery.length > 0 ? (
                <button type="button" className="am-rating-summary__media" onClick={() => openGallery(gallery)}>
                  {gallery.filter((url) => !isReviewVideoUrl(url)).slice(0, 3).map((url) => (
                    <img key={url} src={url} alt="" />
                  ))}
                  <span>{gallery.length} photos</span>
                </button>
              ) : null
            }
          />
        ) : null}
        {reviews.length > 0 ? (
          <div className="rv-filters">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`chip ${filter === item.key ? 'on' : ''}`}
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
        {loading && reviews.length === 0 ? (
          <AdvanceLoad variant="list" count={3} label="Loading reviews" />
        ) : visible.length === 0 ? (
          <p className="empty-copy">No reviews yet</p>
        ) : (
          <div className="rv-grid">
            {visible.map((item, index) => {
              const media = (item.image_urls || []).map((url) => ({
                url,
                type: isReviewVideoUrl(url) ? 'video' : 'image',
              }));
              return (
                <ReviewCard
                  key={item.id || index}
                  name={item.patient_name || 'Patient'}
                  rating={item.rating}
                  date={formatReviewDate(item.created_at || item.updated_at || item.date)}
                  text={item.comment || item.review || item.message || ''}
                  media={media}
                  maxMedia={3}
                  onMediaClick={(mediaIndex) => openGallery(item.image_urls, mediaIndex)}
                />
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}

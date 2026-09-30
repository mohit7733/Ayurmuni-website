import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { getReviews } from '../services/productService';
import {
  collectReviewImageUrls,
  extractReviewsList,
  getAverageRating,
  isReviewVideoUrl,
  normalizeReviewsForDisplay,
} from '../utils/reviewUtils';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'photos', label: 'Photos' },
  { key: '5', label: '5★' },
  { key: '4', label: '4★' },
  { key: '3', label: '3★' },
  { key: 'recent', label: 'Recent' },
];

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

  const visible = useMemo(() => {
    if (filter === 'photos') return reviews.filter((item) => item.image_urls?.length);
    if (filter === '5' || filter === '4' || filter === '3') {
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

  return (
    <AppShell tab={entityType === 'product' ? 'products' : 'consult'}>
      <section className="catalog-page reviews-page">
        <PageHeader
          title="Reviews"
          subtitle={
            reviews.length
              ? `${average || '—'} average · ${reviews.length} reviews`
              : 'What patients are saying'
          }
        />
        <div className="home-rail subcat-rail">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`chip ${filter === item.key ? 'on' : ''}`}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {gallery.length > 0 ? (
          <button
            type="button"
            className="ghost"
            onClick={() =>
              navigate('/reviews/gallery', { state: { images: gallery, selectedIndex: 0 } })
            }
          >
            View media ({gallery.length})
          </button>
        ) : null}
        {loading && reviews.length === 0 ? (
          <p className="muted">Loading reviews…</p>
        ) : visible.length === 0 ? (
          <p className="empty-copy">No reviews yet</p>
        ) : (
          visible.map((item, index) => (
            <article key={item.id || index} className="checkout-card review-card">
              <header>
                <strong>{item.patient_name || 'Patient'}</strong>
                <span>{item.rating ? `${item.rating}★` : ''}</span>
              </header>
              <p>{item.comment || item.review || item.message || ''}</p>
              {item.image_urls?.length ? (
                <div className="review-media-grid">
                  {item.image_urls.map((url, mediaIndex) =>
                    isReviewVideoUrl(url) ? (
                      <video key={url} src={url} controls />
                    ) : (
                      <button
                        key={url}
                        type="button"
                        className="review-media-tile"
                        onClick={() =>
                          navigate('/reviews/gallery', {
                            state: { images: item.image_urls, selectedIndex: mediaIndex },
                          })
                        }
                      >
                        <img src={url} alt="" />
                      </button>
                    ),
                  )}
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>
    </AppShell>
  );
}

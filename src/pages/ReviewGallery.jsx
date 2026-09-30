import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { isReviewVideoUrl } from '../utils/reviewUtils';

export default function ReviewGallery() {
  const location = useLocation();
  const images = useMemo(
    () => (Array.isArray(location.state?.images) ? location.state.images.filter(Boolean) : []),
    [location.state],
  );
  const [index, setIndex] = useState(Number(location.state?.selectedIndex) || 0);
  const current = images[index] || images[0];

  return (
    <AppShell tab="products">
      <section className="catalog-page review-gallery-page">
        <PageHeader title="Review media" subtitle={`${images.length} photos & videos`} />
        {images.length === 0 ? (
          <p className="empty-copy">No media to show</p>
        ) : (
          <>
            <div className="review-gallery-hero">
              {isReviewVideoUrl(current) ? (
                <video src={current} controls />
              ) : (
                <img src={current} alt="" />
              )}
            </div>
            <div className="catalog-grid">
              {images.map((url, mediaIndex) => (
                <button
                  key={`${url}-${mediaIndex}`}
                  type="button"
                  className={`review-media-tile ${mediaIndex === index ? 'on' : ''}`}
                  onClick={() => setIndex(mediaIndex)}
                >
                  {isReviewVideoUrl(url) ? <video src={url} muted /> : <img src={url} alt="" />}
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}

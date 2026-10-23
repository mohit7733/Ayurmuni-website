import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Modal from '../components/ui/Modal';
import { isReviewVideoUrl } from '../utils/reviewUtils';

export default function ReviewGallery() {
  const location = useLocation();
  const navigate = useNavigate();
  const images = useMemo(
    () => (Array.isArray(location.state?.images) ? location.state.images.filter(Boolean) : []),
    [location.state],
  );
  const initialIndex = Number(location.state?.selectedIndex);
  const [index, setIndex] = useState(
    Number.isInteger(initialIndex) && initialIndex >= 0 && initialIndex < images.length
      ? initialIndex
      : 0,
  );
  const current = images[index];

  const closeGallery = () => {
    if (images.length) {
      navigate(-1);
      return;
    }
    navigate('/reviews', { replace: true });
  };

  return (
    <AppShell tab="products" hideFooter>
      <Modal
        open
        onClose={closeGallery}
        size="lg"
        className="review-gallery-modal"
        hideClose={false}
      >
        {current ? (
          <div className="review-gallery-viewer">
            {images.length > 1 ? (
              <button
                type="button"
                className="review-gallery-viewer__nav"
                onClick={() => setIndex((index - 1 + images.length) % images.length)}
                aria-label="Previous review media"
              >
                <ChevronLeft aria-hidden />
              </button>
            ) : null}
            {isReviewVideoUrl(current) ? (
              <video src={current} controls />
            ) : (
              <img src={current} alt="Review photo" />
            )}
            {images.length > 1 ? (
              <button
                type="button"
                className="review-gallery-viewer__nav"
                onClick={() => setIndex((index + 1) % images.length)}
                aria-label="Next review media"
              >
                <ChevronRight aria-hidden />
              </button>
            ) : null}
          </div>
        ) : (
          <p className="empty-copy">No media to show</p>
        )}
      </Modal>
    </AppShell>
  );
}

import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { Button, Modal } from './ui';
import { showSuccessToast } from '../config/key';
import { submitReview } from '../services/reviewService';

export default function ReviewSubmitModal({ open, onClose, product, onSuccess }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      showSuccessToast('Please select a rating', 'error');
      return;
    }

    if (!comment.trim()) {
      showSuccessToast('Please write a review', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('product_id', product.product_id || product.id);
      formData.append('variant_id', product.variant_id || product.id);
      formData.append('rating', rating);
      formData.append('title', title.trim());
      formData.append('comment', comment.trim());
      
      // Add images if any
      images.forEach((image, index) => {
        formData.append(`image_${index}`, image);
      });

      const result = await submitReview(formData);

      if (result?.success !== false) {
        showSuccessToast('Review submitted successfully!', 'success');
        resetForm();
        onSuccess?.();
        onClose();
      } else {
        showSuccessToast(result?.message || 'Failed to submit review', 'error');
      }
    } catch (error) {
      showSuccessToast('Failed to submit review. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setRating(0);
    setHoverRating(0);
    setTitle('');
    setComment('');
    setImages([]);
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 5) {
      showSuccessToast('You can upload maximum 5 images', 'error');
      return;
    }

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith('image/')) {
        showSuccessToast('Only image files are allowed', 'error');
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        showSuccessToast('Image size should be less than 5MB', 'error');
        return false;
      }
      return true;
    });

    setImages([...images, ...validFiles]);
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Write a Review"
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Product Info */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', background: 'var(--am-bg-subtle)', borderRadius: 'var(--am-radius-md)' }}>
          {product?.image && (
            <img
              src={product.image}
              alt={product.name}
              style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: 'var(--am-radius-sm)' }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: '14px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {product?.name || 'Product'}
            </strong>
            {product?.size && (
              <span style={{ fontSize: '12px', color: 'var(--am-text-muted)' }}>
                {product.size}
              </span>
            )}
          </div>
        </div>

        {/* Rating */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
            Your Rating *
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  transition: 'transform 0.2s'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.9)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <Star
                  size={32}
                  fill={star <= (hoverRating || rating) ? '#FFB800' : 'none'}
                  stroke={star <= (hoverRating || rating) ? '#FFB800' : '#D1D5DB'}
                  strokeWidth={2}
                />
              </button>
            ))}
            {rating > 0 && (
              <span style={{ marginLeft: '12px', fontSize: '16px', fontWeight: '600', color: 'var(--am-text)' }}>
                {rating}/5
              </span>
            )}
          </div>
          {rating > 0 && (
            <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--am-text-muted)' }}>
              {rating === 5 ? 'Excellent!' : rating === 4 ? 'Very Good!' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
            </p>
          )}
        </div>

        {/* Review Title */}
        <div>
          <label htmlFor="review-title" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
            Review Title (Optional)
          </label>
          <input
            id="review-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sum up your experience"
            maxLength={100}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--am-border-color)',
              borderRadius: 'var(--am-radius-md)',
              fontSize: '14px',
              fontFamily: 'inherit'
            }}
          />
          <p style={{ marginTop: '4px', fontSize: '11px', color: 'var(--am-text-muted)', textAlign: 'right' }}>
            {title.length}/100
          </p>
        </div>

        {/* Review Comment */}
        <div>
          <label htmlFor="review-comment" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
            Your Review *
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us about your experience with this product..."
            rows={5}
            maxLength={1000}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--am-border-color)',
              borderRadius: 'var(--am-radius-md)',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
          <p style={{ marginTop: '4px', fontSize: '11px', color: 'var(--am-text-muted)', textAlign: 'right' }}>
            {comment.length}/1000
          </p>
        </div>

        {/* Image Upload */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
            Add Photos (Optional)
          </label>
          <p style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--am-text-muted)' }}>
            Share photos of your experience (max 5 images, up to 5MB each)
          </p>
          
          {images.length > 0 && (
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {images.map((image, index) => (
                <div key={index} style={{ position: 'relative' }}>
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`Review ${index + 1}`}
                    style={{
                      width: '80px',
                      height: '80px',
                      objectFit: 'cover',
                      borderRadius: 'var(--am-radius-md)',
                      border: '1px solid var(--am-border-color)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: 'var(--am-danger)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {images.length < 5 && (
            <label
              style={{
                display: 'inline-block',
                padding: '10px 16px',
                border: '1px dashed var(--am-border-color)',
                borderRadius: 'var(--am-radius-md)',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--am-accent)';
                e.currentTarget.style.background = 'var(--am-accent-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--am-border-color)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                style={{ display: 'none' }}
              />
              📷 Upload Photos ({images.length}/5)
            </label>
          )}
        </div>

        {/* Guidelines */}
        <div style={{ padding: '12px', background: 'var(--am-bg-subtle)', borderRadius: 'var(--am-radius-md)', fontSize: '12px' }}>
          <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--am-text)' }}>
            Review Guidelines:
          </strong>
          <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--am-text-muted)' }}>
            <li>Be honest and specific about your experience</li>
            <li>Focus on product quality, effectiveness, and value</li>
            <li>Avoid promotional content or external links</li>
            <li>Respect others and avoid offensive language</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

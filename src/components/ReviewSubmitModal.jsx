import { useEffect, useMemo, useState } from "react";
import { Star, X, ImagePlus, ShieldCheck } from "lucide-react";
import { Button, Modal } from "./ui";
import { showSuccessToast } from "../config/key";
import { submitReview } from "../services/reviewService";
import "../design/components/review-modal.css";

const RATING_LABELS = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good!",
  5: "Excellent!",
};

const MAX_TITLE = 100;
const MAX_COMMENT = 1000;
const MAX_IMAGES = 5;

export default function ReviewSubmitModal({
  open,
  onClose,
  product,
  onSuccess,
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const activeRating = hoverRating || rating;

  // Create preview URLs once per image (and release them) instead of on every render
  const previews = useMemo(
    () => images.map((image) => URL.createObjectURL(image)),
    [images],
  );
  useEffect(
    () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
    [previews],
  );

  const resetForm = () => {
    setRating(0);
    setHoverRating(0);
    setTitle("");
    setComment("");
    setImages([]);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      showSuccessToast("Please select a rating", "error");
      return;
    }

    if (!comment.trim()) {
      showSuccessToast("Please write a review", "error");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();

      formData.append("product_id", product.product_id || product.id);
      formData.append("variant_id", product.variant_id || product.id);
      formData.append("rating", rating);
      formData.append("title", title.trim());
      formData.append("comment", comment.trim());

      images.forEach((image, index) => {
        formData.append(`image_${index}`, image);
      });

      const result = await submitReview(formData);

      if (result?.success !== false) {
        showSuccessToast("Review submitted successfully!", "success");
        resetForm();
        onSuccess?.();
        onClose();
      } else {
        showSuccessToast(result?.message || "Failed to submit review", "error");
      }
    } catch (error) {
      showSuccessToast("Failed to submit review. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);

    if (images.length + files.length > MAX_IMAGES) {
      showSuccessToast("You can upload maximum 5 images", "error");
      return;
    }

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        showSuccessToast("Only image files are allowed", "error");
        return false;
      }

      if (file.size > 5 * 1024 * 1024) {
        showSuccessToast("Image size should be less than 5MB", "error");
        return false;
      }

      return true;
    });

    setImages([...images, ...validFiles]);

    // Allows selecting the same image again after removing it
    e.target.value = "";
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const countClass = (len, max) =>
    len >= max ? "is-max" : len >= max * 0.9 ? "is-near" : "";

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
            {submitting ? "Submitting..." : "Submit Review"}
          </Button>
        </>
      }
    >
      <div className="rv-form">
        {/* Product Info */}
        <div className="rv-product">
          {product?.image ? (
            <img
              className="rv-product__img"
              src={product.image}
              alt={product.name || "Product"}
            />
          ) : (
            <div className="rv-product__img rv-product__img--empty">
              <ImagePlus size={18} />
            </div>
          )}

          <div className="rv-product__copy">
            <span className="rv-eyebrow">Reviewing</span>
            <strong className="rv-product__name">
              {product?.name || "Product"}
            </strong>
            {product?.size && (
              <span className="rv-product__size">{product.size}</span>
            )}
          </div>
        </div>

        {/* Rating */}
        <section className="rv-card rv-rating">
          <div className="rv-card__head">
            <span className="rv-label">
              Your Rating <span className="rv-req">*</span>
            </span>

            {activeRating > 0 && (
              <span key={activeRating} className="rv-rating__tag">
                {activeRating}/5 · {RATING_LABELS[activeRating]}
              </span>
            )}
          </div>

          <div
            className="rv-stars"
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
                aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                className={`rv-star${star <= activeRating ? " is-on" : ""}${
                  star === rating ? " is-picked" : ""
                }`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onFocus={() => setHoverRating(star)}
                onBlur={() => setHoverRating(0)}
              >
                <Star size={32} strokeWidth={2} />
              </button>
            ))}
          </div>
        </section>

        {/* Review Title + Review Comment */}
        <div className="rv-fields">
          <div className="rv-field">
            <label htmlFor="review-title" className="rv-label">
              Review Title <span className="rv-opt">(Optional)</span>
            </label>

            <input
              id="review-title"
              type="text"
              className="rv-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sum up your experience"
              maxLength={MAX_TITLE}
            />

            <p className={`rv-count ${countClass(title.length, MAX_TITLE)}`}>
              {title.length}/{MAX_TITLE}
            </p>
          </div>

          <div className="rv-field">
            <label htmlFor="review-comment" className="rv-label">
              Your Review <span className="rv-req">*</span>
            </label>

            <textarea
              id="review-comment"
              className="rv-input rv-textarea"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us about your experience with this product..."
              rows={4}
              maxLength={MAX_COMMENT}
            />

            <p
              className={`rv-count ${countClass(comment.length, MAX_COMMENT)}`}
            >
              {comment.length}/{MAX_COMMENT}
            </p>
          </div>
        </div>

        {/* Image Upload */}
        <section className="rv-card">
          <div className="rv-card__head">
            <span className="rv-label">
              Add Photos <span className="rv-opt">(Optional)</span>
            </span>
            <span className="rv-badge">
              {images.length}/{MAX_IMAGES}
            </span>
          </div>

          {images.length > 0 && (
            <div className="rv-thumbs">
              {images.map((image, index) => (
                <div className="rv-thumb" key={`${image.name}-${index}`}>
                  <img
                    src={previews[index]}
                    alt={`Review image ${index + 1}`}
                  />

                  <button
                    type="button"
                    className="rv-thumb__remove"
                    aria-label={`Remove image ${index + 1}`}
                    onClick={() => removeImage(index)}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {images.length < MAX_IMAGES && (
            <label className="rv-drop">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="rv-drop__input"
              />
              <span className="rv-drop__icon">
                <ImagePlus size={18} />
              </span>
              <span className="rv-drop__text">
                <strong>Upload Photos</strong>
                <small>Up to 5 images · Max 5MB each</small>
              </span>
            </label>
          )}
        </section>

        {/* Guidelines */}
        <aside className="rv-guide">
          <strong className="rv-guide__title">
            <ShieldCheck size={15} aria-hidden /> Review Guidelines
          </strong>

          <ul>
            <li>Be honest and specific about your experience</li>
            <li>Focus on product quality, effectiveness, and value</li>
            <li>Avoid promotional content or external links</li>
            <li>Respect others and avoid offensive language</li>
          </ul>
        </aside>
      </div>
    </Modal>
  );
}

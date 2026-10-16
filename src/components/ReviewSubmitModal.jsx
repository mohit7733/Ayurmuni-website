import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, ShieldCheck, Star, X } from "lucide-react";

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
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function ReviewSubmitModal({
  open,
  onClose,
  product,
  onSuccess,
}) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const starRefs = useRef([]);
  const fileInputRef = useRef(null);

  // Generate preview URLs only when the selected files change.
  const previews = useMemo(
    () => images.map((image) => URL.createObjectURL(image)),
    [images],
  );

  // Release old preview URLs to avoid memory leaks.
  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const resetForm = () => {
    setRating(0);
    setTitle("");
    setComment("");
    setImages([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (!product || !(product.product_id || product.id)) {
      showSuccessToast("Product information is missing", "error");
      return;
    }

    if (rating === 0) {
      showSuccessToast("Please select a rating", "error");
      starRefs.current[0]?.focus();
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
      formData.append("rating", String(rating));
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
        onClose?.();
      } else {
        showSuccessToast(result?.message || "Failed to submit review", "error");
      }
    } catch {
      showSuccessToast("Failed to submit review. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageSelect = (event) => {
    const input = event.target;
    const files = Array.from(input.files || []);

    // Allow selecting the same file again later.
    input.value = "";

    if (!files.length) return;

    const validFiles = [];

    files.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        showSuccessToast("Only image files are allowed", "error");
        return;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        showSuccessToast("Each image must be smaller than 5MB", "error");
        return;
      }

      validFiles.push(file);
    });

    if (!validFiles.length) return;

    const availableSlots = MAX_IMAGES - images.length;

    if (validFiles.length > availableSlots) {
      showSuccessToast(
        `You can upload a maximum of ${MAX_IMAGES} images`,
        "error",
      );
    }

    setImages((current) => [
      ...current,
      ...validFiles.slice(0, Math.max(0, MAX_IMAGES - current.length)),
    ]);
  };

  const removeImage = (indexToRemove) => {
    setImages((current) =>
      current.filter((_, index) => index !== indexToRemove),
    );
  };

  const handleStarKeyDown = (event, star) => {
    let nextRating = star;

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      nextRating = Math.min(5, star + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      nextRating = Math.max(1, star - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      nextRating = 1;
    } else if (event.key === "End") {
      event.preventDefault();
      nextRating = 5;
    } else {
      return;
    }

    setRating(nextRating);
    starRefs.current[nextRating - 1]?.focus();
  };

  const countClass = (length, max) =>
    length >= max ? "is-max" : length >= max * 0.9 ? "is-near" : "";

  const ratingHint = {
    1: "Sorry to hear that. What could be better?",
    2: "Thanks for your feedback. What was missing?",
    3: "Share what you liked or what could improve.",
    4: "Great! What did you like most?",
    5: "Wonderful! What made this product excellent?",
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : handleClose}
      title="Write a Review"
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </Button>
        </>
      }
    >
      <div className="rv-form">
        {/* Product header */}
        <div className="rv-product">
          {product?.image ? (
            <img
              className="rv-product__img"
              src={product.image}
              alt={product.name || "Product"}
            />
          ) : (
            <div
              className="rv-product__img rv-product__img--empty"
              aria-hidden="true"
            >
              <ImagePlus size={21} />
            </div>
          )}

          <div className="rv-product__copy">
            <span className="rv-eyebrow">REVIEWING</span>

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

            {rating > 0 && (
              <span className="rv-rating__tag" aria-live="polite">
                {rating}/5 · {RATING_LABELS[rating]}
              </span>
            )}
          </div>

          <div className="rv-stars" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                ref={(element) => {
                  starRefs.current[star - 1] = element;
                }}
                type="button"
                role="radio"
                aria-checked={rating === star}
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
                tabIndex={
                  rating === star || (rating === 0 && star === 1) ? 0 : -1
                }
                className={[
                  "rv-star",
                  star <= rating ? "is-on" : "",
                  star === rating ? "is-picked" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setRating(star)}
                onKeyDown={(event) => handleStarKeyDown(event, star)}
              >
                <Star size={23} strokeWidth={1.8} />
              </button>
            ))}
          </div>

          {rating > 0 && (
            <p className="rv-rating__hint" aria-live="polite">
              {ratingHint[rating]}
            </p>
          )}
        </section>

        {/* Review fields */}
        <div className="rv-fields">
          <div className="rv-field">
            <label htmlFor="review-title" className="rv-label">
              Review Title <span className="rv-opt">Optional</span>
            </label>

            <input
              id="review-title"
              type="text"
              className="rv-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Sum up your experience"
              maxLength={MAX_TITLE}
              autoComplete="off"
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
              onChange={(event) => setComment(event.target.value)}
              placeholder="Tell us about your experience with this product..."
              rows={4}
              maxLength={MAX_COMMENT}
              required
            />

            <p
              className={`rv-count ${countClass(comment.length, MAX_COMMENT)}`}
            >
              {comment.length}/{MAX_COMMENT}
            </p>
          </div>
        </div>

        {/* Photo upload */}
        <section className="rv-card rv-photos">
          <div className="rv-card__head">
            <div className="rv-photos__heading">
              <span className="rv-label">Add Photos</span>
              <span className="rv-opt">Optional</span>
            </div>

            <span className="rv-badge">
              {images.length}/{MAX_IMAGES}
            </span>
          </div>

          {images.length > 0 && (
            <div className="rv-thumbs">
              {images.map((image, index) => (
                <div
                  className="rv-thumb"
                  key={`${image.name}-${image.lastModified}-${index}`}
                >
                  <img
                    src={previews[index]}
                    alt={`Review attachment ${index + 1}`}
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
            <label className="rv-drop" htmlFor="review-photo-upload">
              <input
                ref={fileInputRef}
                id="review-photo-upload"
                type="file"
                accept="image/*"
                multiple
                aria-label="Upload review photos"
                onChange={handleImageSelect}
                className="rv-drop__input"
              />

              <span className="rv-drop__icon" aria-hidden="true">
                <ImagePlus size={20} />
              </span>

              <span className="rv-drop__text">
                <strong>Upload photos</strong>
                <small>PNG, JPG or other images · Up to 5MB each</small>
                <small>
                  {MAX_IMAGES - images.length} upload
                  {MAX_IMAGES - images.length === 1 ? "" : "s"} remaining
                </small>
              </span>
            </label>
          )}
        </section>

        {/* Guidelines */}
        <aside className="rv-guide">
          <strong className="rv-guide__title">
            <ShieldCheck size={17} aria-hidden="true" />
            Review guidelines
          </strong>

          <ul>
            <li>Be honest and specific about your experience.</li>
            <li>Focus on product quality, effectiveness, and value.</li>
            <li>Avoid promotional content or external links.</li>
            <li>Respect others and avoid offensive language.</li>
          </ul>
        </aside>
      </div>
    </Modal>
  );
}

import { Play } from "lucide-react";
import { useState } from "react";
import Rating from "./Rating";
import Modal from "./Modal";
import { cx } from "./cx";

export default function ReviewCard({
  name,
  rating,
  date,
  text,
  media = [],
  onMediaClick,
  className,
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const initial = String(name || "A")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <>
      <article className={cx("am-review", className)}>
        <header className="am-review__head">
          <span className="am-review__avatar" aria-hidden>
            {initial}
          </span>
          <h3 className="am-review__name">{name || "Verified patient"}</h3>
          <button
            className="am-review__view"
            type="button"
            onClick={() => setReviewOpen(true)}
            aria-label={`View review by ${name || "verified patient"}`}
          >
            View review
          </button>
        </header>
      </article>

      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title={`Review by ${name || "Verified patient"}`}
        description={date || undefined}
        size="md"
        className="am-review-modal"
      >
        <div className="am-review-modal__content">
          <Rating value={rating} />
          {text ? <p className="am-review__text">{text}</p> : null}
          {media.length ? (
            <ul className="am-review__media">
              {media.map((item, index) => (
                <li key={item.url || index}>
                  <button
                    type="button"
                    onClick={() => onMediaClick?.(index)}
                    aria-label={`Open review ${item.type === "video" ? "video" : "photo"} ${index + 1}`}
                  >
                    {item.type === "video" ? (
                      <span className="am-review__video" aria-hidden>
                        <Play size={16} />
                      </span>
                    ) : (
                      <img
                        src={item.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

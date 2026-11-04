import { Play } from "lucide-react";
import Rating from "./Rating";
import { cx } from "./cx";

export default function ReviewCard({
  name,
  rating,
  date,
  text,
  media = [],
  onMediaClick,
  maxMedia,
  className,
}) {
  const limit = maxMedia > 0 ? maxMedia : media.length;
  const shown = media.slice(0, limit);
  const extra = media.length - shown.length;
  const initial = String(name || "A")
    .trim()
    .charAt(0)
    .toUpperCase();
  return (
    <article className={cx("am-review", className)}>
      <header className="am-review__head">
        <span className="am-review__avatar" aria-hidden>
          {initial}
        </span>
        <div className="am-review__who">
          <h3 className="am-review__name">{name || "Verified patient"}</h3>
          {date ? <p className="am-review__date">{date}</p> : null}
        </div>
        <Rating value={rating} />
      </header>
      {text ? <p className="am-review__text">{text}</p> : null}
      {shown.length ? (
        <ul className="am-review__media">
          {shown.map((item, index) => (
            <li key={item.url || index}>
              <button
                type="button"
                onClick={() => onMediaClick?.(index)}
                aria-label={`Open review ${item.type === "video" ? "video" : "photo"} ${index + 1}`}
              >
                {item.type === "video" ? (
                  <span className="am-review__video" aria-hidden>
                    <Play size={18} />
                  </span>
                ) : (
                  <img src={item.url} alt="" loading="lazy" decoding="async" />
                )}
                {extra > 0 && index === shown.length - 1 ? (
                  <span className="am-review__more" aria-hidden>+{extra}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

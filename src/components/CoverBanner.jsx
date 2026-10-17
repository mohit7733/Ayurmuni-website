import { useEffect, useState } from "react";

export default function CoverBanner({ items, interval = 4000, label = "Offers" }) {
  const [index, setIndex] = useState(0);
  const count = items?.length || 0;

  useEffect(() => {
    if (count < 2) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, interval);
    return () => window.clearInterval(timer);
  }, [count, interval]);

  if (!count) return null;
  const active = items[Math.min(index, count - 1)];

  return (
    <div className="care-banner" aria-roledescription="carousel" aria-label={label}>
      <img src={active.image} alt={active.title || ""} />
      {count > 1 ? (
        <div className="care-banner__dots">
          {items.map((item, i) => (
            <button
              key={item.id || i}
              type="button"
              className={i === index ? "is-on" : ""}
              aria-label={`Show slide ${i + 1} of ${count}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

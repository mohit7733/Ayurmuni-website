import { Star } from 'lucide-react';
import { cx } from './cx';

export default function Rating({ value, count, size = 'sm', showValue = true, className }) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const rounded = Math.round(n * 10) / 10;
  const reviews = Number(count) || 0;
  const srText = `Rated ${rounded} out of 5${reviews ? `, ${reviews} reviews` : ''}`;
  return (
    <span className={cx('am-rating', `am-rating--${size}`, className)}>
      <span className="am-sr-only">{srText}</span>
      <span className="am-rating__visual" aria-hidden>
        <Star className="am-rating__star" size={size === 'lg' ? 18 : 14} />
        {showValue ? <strong>{rounded.toFixed(1)}</strong> : null}
        {reviews ? <span className="am-rating__count">({reviews})</span> : null}
      </span>
    </span>
  );
}

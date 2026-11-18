import Rating from './Rating';
import { getRatingBreakdown } from '../../utils/reviewUtils';

export default function RatingSummary({ average, count, reviews = [], extra }) {
  const total = Number(count) || reviews.length || 0;
  const score = Number(average) || 0;
  const buckets = getRatingBreakdown(reviews);
  const base = Math.max(reviews.length, 1);

  return (
    <div className="am-rating-summary">
      <div className="am-rating-summary__score">
        <strong>{score ? score.toFixed(1) : '—'}</strong>
        <Rating value={score} stars showValue={false} />
        <span>
          {total} {total === 1 ? 'review' : 'reviews'}
        </span>
      </div>
      <ol className="am-rating-summary__bars" aria-label="Rating breakdown">
        {buckets.map((bucket) => (
          <li key={bucket.star}>
            <span>{bucket.star}</span>
            <span className="am-rating-summary__track">
              <span style={{ width: `${Math.round((bucket.count / base) * 100)}%` }} />
            </span>
            <span>{bucket.count}</span>
          </li>
        ))}
      </ol>
      {extra || null}
    </div>
  );
}

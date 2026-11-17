/** Five-star score chips for the product filter. Parent keeps the selected minimum. */

const STAR_PATH =
  'M12 2.2l2.55 5.55 6.1.7-4.52 4.15 1.25 6.05L12 15.9l-5.38 2.75 1.25-6.05L3.35 8.45l6.1-.7L12 2.2z';

const RATINGS = [0, 3, 3.5, 4, 4.5];

function ScoreStars({ value }) {
  return (
    <span className="st-filter-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((index) => {
        const fill = Math.max(0, Math.min(1, value - (index - 1)));
        return (
          <span className="st-filter-stars__slot" key={index}>
            <svg viewBox="0 0 24 24" className="is-empty">
              <path d={STAR_PATH} />
            </svg>
            <span className="st-filter-stars__clip" style={{ width: `${fill * 100}%` }}>
              <svg viewBox="0 0 24 24" className="is-full">
                <path d={STAR_PATH} />
              </svg>
            </span>
          </span>
        );
      })}
    </span>
  );
}

export default function FilterRatingChoices({ value, onChange, label = 'Minimum rating' }) {
  return (
    <div className="st-filter-ratings" role="group" aria-label={label}>
      {RATINGS.map((rating) => {
        const selected = value === rating;
        return (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className={`st-filter-rating st-filter-rating--score${selected ? ' is-selected' : ''}`}
            aria-pressed={selected}
          >
            {rating === 0 ? (
              'Any rating'
            ) : (
              <>
                <ScoreStars value={rating} />
                <span>{rating} & up</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

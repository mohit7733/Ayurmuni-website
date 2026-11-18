import { packageCountLabel, packageCountProgress, readPackageQuantity } from '../utils/packageCount';
import '../design/components/package-count.css';

/**
 * Compact usage block for one purchase: remaining count, bar, and validity.
 */
export default function PackageCount({
  remaining,
  total,
  quantity_remaining,
  quantity_total,
  expired = false,
  includeUnit = false,
  unit = 'consultation',
  validTill = '',
  variant = '',
  compact = false,
  barOnly = false,
  className = '',
}) {
  const qty = readPackageQuantity({
    remaining,
    total,
    quantity_remaining,
    quantity_total,
  });
  const label = packageCountLabel(qty, { expired, includeUnit, unit });
  const progress = packageCountProgress(qty);
  const showBar = progress != null;
  const muted = expired || label === 'All used';
  const showLabel = !barOnly && Boolean(label);
  const showValid = !barOnly && Boolean(validTill);

  if (!showLabel && !showBar && !showValid) return null;

  const classes = [
    'pkg-count',
    muted ? 'is-muted' : '',
    variant === 'on-dark' ? 'pkg-count--on-dark' : '',
    compact || barOnly ? 'pkg-count--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const percent = showBar ? Math.round(progress * 100) : 0;

  return (
    <div className={classes}>
      {showLabel ? (
        <div className="pkg-count__row">
          <span className={`pkg-count__chip pkg-count__chip--usage${muted ? ' is-muted' : ''}`}>{label}</span>
        </div>
      ) : null}
      {showBar ? (
        <div
          className="pkg-count__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={label || 'Package usage'}
        >
          <span className="pkg-count__fill" style={{ width: `${percent}%` }} />
        </div>
      ) : null}
      {showValid ? (
        <p className="pkg-count__valid">{expired ? `Expired on ${validTill}` : `Valid till ${validTill}`}</p>
      ) : null}
    </div>
  );
}

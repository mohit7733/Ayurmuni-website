import { packageCountLabel, packageCountProgress, readPackageQuantity } from '../utils/packageCount';
import '../design/components/package-count.css';

/**
 * Compact usage block: optional chips, a slim brand-green bar, and validity.
 * Hidden entirely when there is no real count, date, or shifted-on value.
 */
export default function PackageCount({
  remaining,
  total,
  quantity_remaining,
  quantity_total,
  expired = false,
  includeUnit = false,
  unit = 'consultation',
  shiftedOn = '',
  validTill = '',
  originalTill = '',
  carriedRemaining,
  carriedTotal,
  carriedFrom = '',
  variant = '',
  compact = false,
  barOnly = false,
  className = '',
}) {
  const source = {
    remaining,
    total,
    quantity_remaining,
    quantity_total,
  };
  const qty = readPackageQuantity(source);
  const carried = readPackageQuantity({ remaining: carriedRemaining, total: carriedTotal });
  const hasCarried = carried.total != null && carried.total > 0;
  const label = packageCountLabel(qty, { expired, includeUnit, unit });
  const carriedLabel = hasCarried ? packageCountLabel(carried, { expired, includeUnit, unit }) : '';
  const progress = packageCountProgress(qty);
  const combinedTotal = (qty.total || 0) + (hasCarried ? carried.total : 0);
  const showBar = hasCarried ? combinedTotal > 0 : progress != null;
  const ownMuted = expired || label === 'All used';
  const muted = ownMuted && !(hasCarried && (carried.remaining || 0) > 0);
  const orig = originalTill && originalTill !== validTill ? originalTill : '';
  const showLabel = !barOnly && Boolean(label) && !(hasCarried && (qty.total || 0) <= 0);
  const showCarried = !barOnly && Boolean(carriedLabel);
  const showShifted = !barOnly && Boolean(shiftedOn);
  const showValid = !barOnly && Boolean(validTill);
  const showOrig = !barOnly && Boolean(orig);

  if (!showLabel && !showCarried && !showShifted && !showBar && !showValid && !showOrig) return null;

  const classes = [
    'pkg-count',
    muted ? 'is-muted' : '',
    variant === 'on-dark' ? 'pkg-count--on-dark' : '',
    compact || barOnly ? 'pkg-count--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const percent = showBar && !hasCarried ? Math.round(progress * 100) : 0;
  const ownWidth = hasCarried && combinedTotal > 0 ? (Math.max(0, qty.remaining || 0) / combinedTotal) * 100 : 0;
  const carriedWidth = hasCarried && combinedTotal > 0 ? (Math.max(0, carried.remaining || 0) / combinedTotal) * 100 : 0;

  return (
    <div className={classes}>
      {showShifted || showLabel || showCarried ? (
        <div className="pkg-count__row">
          {showShifted ? <span className="pkg-count__chip">{`Shifted on ${shiftedOn}`}</span> : null}
          {showLabel ? (
            <span className={`pkg-count__chip pkg-count__chip--usage${ownMuted ? ' is-muted' : ''}`}>{label}</span>
          ) : null}
          {showCarried ? (
            <span className={`pkg-count__chip pkg-count__chip--shifted${carried.remaining <= 0 ? ' is-muted' : ''}`}>
              {carriedLabel}
            </span>
          ) : null}
          {showCarried && carriedFrom ? <span className="pkg-count__from">From {carriedFrom}</span> : null}
        </div>
      ) : null}
      {showBar ? (
        <div
          className="pkg-count__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={hasCarried ? Math.round(ownWidth + carriedWidth) : percent}
          aria-label={[label, carriedLabel, carriedFrom ? `from ${carriedFrom}` : ''].filter(Boolean).join(', ') || 'Package usage'}
        >
          {hasCarried ? (
            <>
              <span className="pkg-count__fill" style={{ width: `${ownWidth}%` }} />
              <span className="pkg-count__fill pkg-count__fill--shifted" style={{ width: `${carriedWidth}%` }} />
            </>
          ) : (
            <span className="pkg-count__fill" style={{ width: `${percent}%` }} />
          )}
        </div>
      ) : null}
      {showValid ? (
        <p className="pkg-count__valid">{expired ? `Expired on ${validTill}` : `Valid till ${validTill}`}</p>
      ) : null}
      {showOrig ? <p className="pkg-count__valid pkg-count__valid--orig">{`Originally till ${orig}`}</p> : null}
    </div>
  );
}

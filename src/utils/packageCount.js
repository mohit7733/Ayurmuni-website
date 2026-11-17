/** Shared labels and progress for package / plan usage counts. Real quantities only. */

const toCount = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const readPackageQuantity = (source = {}) => {
  const remaining = toCount(
    source.remaining ?? source.quantity_remaining ?? source.quantityRemaining,
  );
  const total = toCount(
    source.total ??
      source.quantity_total ??
      source.quantityTotal ??
      source.sessions ??
      source.total_sessions ??
      source.sessionCount,
  );
  return { remaining, total };
};

const unitWord = (count, unit = 'consultation') => {
  const base = String(unit || 'consultation').trim() || 'consultation';
  if (count === 1) return base;
  return base.endsWith('s') ? base : `${base}s`;
};

/**
 * Usage label for a package or benefit count.
 * remaining + total → "3 of 5 left" (or "3 of 5 consultations left" when includeUnit).
 * remaining only → "3 left" / "3 consultations left".
 * remaining ≤ 0 → "All used". expired → "Expired". Missing data → "".
 */
export const packageCountLabel = (source = {}, options = {}) => {
  const expired = options.expired === true || source.expired === true;
  if (expired) return 'Expired';

  const { remaining, total } = readPackageQuantity(source);
  if (remaining == null) return '';
  if (remaining <= 0) return 'All used';

  const includeUnit = options.includeUnit === true;
  const unit = options.unit || 'consultation';

  if (total != null && total > 0) {
    if (includeUnit) return `${remaining} of ${total} ${unitWord(total, unit)} left`;
    return `${remaining} of ${total} left`;
  }

  if (includeUnit) return `${remaining} ${unitWord(remaining, unit)} left`;
  return remaining === 1 ? '1 left' : `${remaining} left`;
};

/** Remaining/total as 0–1, or null when a bar should stay hidden. */
export const packageCountProgress = (source = {}) => {
  const { remaining, total } = readPackageQuantity(source);
  if (remaining == null || total == null || total <= 0) return null;
  return Math.max(0, Math.min(1, remaining / total));
};

export const isPackageCountExpired = (source = {}, now = Date.now()) => {
  if (source.expired === true) return true;
  const status = String(source.status || '').toLowerCase();
  if (status === 'expired') return true;
  const until =
    source.valid_until || source.validTill || source.expiresAt || source.expires_at || source.expiresOn;
  if (!until) return false;
  const time = new Date(until).getTime();
  return Number.isFinite(time) && time < now;
};

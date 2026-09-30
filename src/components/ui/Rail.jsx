import { SkeletonCard } from './Skeleton';
import { cx } from './cx';

export default function Rail({ label, className, children }) {
  return (
    <ul className={cx('am-rail', className)} aria-label={label}>
      {children}
    </ul>
  );
}

export function RailItem({ size, className, children }) {
  return <li className={cx('am-rail__item', size && `am-rail__item--${size}`, className)}>{children}</li>;
}

export function RailSkeleton({ count = 4, variant = 'product', size, label = 'Loading' }) {
  return (
    <div className="am-rail" role="status">
      <span className="am-sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cx('am-rail__item', size && `am-rail__item--${size}`)} aria-hidden>
          <SkeletonCard variant={variant} />
        </div>
      ))}
    </div>
  );
}

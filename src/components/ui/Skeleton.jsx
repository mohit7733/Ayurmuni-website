import { cx } from './cx';

export default function Skeleton({ variant = 'text', width, height, className }) {
  const style = {};
  if (width != null) style['--am-skel-w'] = typeof width === 'number' ? `${width}px` : width;
  if (height != null) style['--am-skel-h'] = typeof height === 'number' ? `${height}px` : height;
  return <span className={cx('am-skeleton', `am-skeleton--${variant}`, className)} style={style} aria-hidden />;
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <span className={cx('am-skeleton-stack', className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </span>
  );
}

export function SkeletonCard({ variant = 'product' }) {
  return (
    <div className={cx('am-skeleton-card', `am-skeleton-card--${variant}`)} aria-hidden>
      <Skeleton variant={variant === 'doctor' ? 'circle' : 'rect'} className="am-skeleton-card__media" />
      <Skeleton width="80%" />
      <Skeleton width="55%" />
      <Skeleton variant="rect" height={40} />
    </div>
  );
}

export function SkeletonGrid({ count = 4, variant = 'product', label = 'Loading', className }) {
  return (
    <div className={cx('am-skeleton-grid', className)} role="status" aria-live="polite">
      <span className="am-sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} variant={variant} />
      ))}
    </div>
  );
}

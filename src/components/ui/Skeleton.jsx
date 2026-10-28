import Skeleton from '../skeletons/Block';
import { CardGridSkeleton, ProductCardSkeleton, DoctorCardSkeleton } from '../skeletons/Skeletons';
import { cx } from './cx';

export default Skeleton;

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
  return variant === 'doctor' ? <DoctorCardSkeleton /> : <ProductCardSkeleton />;
}

/** Grid of card skeletons matching the real grid (pass the same className as the real grid). */
export function SkeletonGrid({ label = 'Loading', variant = 'product', count = 4, className }) {
  return <CardGridSkeleton kind={variant === 'doctor' ? 'doctor' : 'product'} count={count} className={className} label={label} />;
}
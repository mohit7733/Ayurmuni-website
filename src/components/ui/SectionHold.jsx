import { SkeletonFor } from '../skeletons/Skeletons';

/**
 * Holds a section's space with a skeleton until its data is ready.
 * variant: block (default) | products | doctors | cards | list | detail | page | chips.
 * `scale` is kept for backwards compatibility and ignored.
 */
// eslint-disable-next-line no-unused-vars
export default function SectionHold({ label = 'Loading', minHeight = 160, scale, variant = 'block', count, className }) {
  return (
    <div className="am-hold am-hold--skeleton" style={{ minHeight }}>
      <SkeletonFor variant={variant} label={label} minHeight={minHeight} count={count} className={className} />
    </div>
  );
}
import { cx } from '../ui/cx';

/** Base shimmer block. variant: text | rect | circle. */
export default function Skeleton({ variant = 'text', width, height, className }) {
  const style = {};
  if (width != null) style['--am-skel-w'] = typeof width === 'number' ? `${width}px` : width;
  if (height != null) style['--am-skel-h'] = typeof height === 'number' ? `${height}px` : height;
  return <span className={cx('am-skeleton', `am-skeleton--${variant}`, className)} style={style} aria-hidden />;
}
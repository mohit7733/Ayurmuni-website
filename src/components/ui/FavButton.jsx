import { Heart } from 'lucide-react';
import { cx } from './cx';

export default function FavButton({ on, label, corner = false, className, onClick, ...rest }) {
  return (
    <button
      type="button"
      className={cx('am-fav-btn', corner && 'am-fav-btn--corner', on && 'is-on', className)}
      aria-pressed={Boolean(on)}
      aria-label={label}
      onClick={onClick}
      {...rest}
    >
      <Heart size={18} aria-hidden fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}

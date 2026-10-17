import { Video } from 'lucide-react';
import { cx } from './cx';

export default function VideoCallButton({ label, className, onClick, ...rest }) {
  return (
    <button
      type="button"
      className={cx('am-video-btn', className)}
      aria-label={label}
      title={label}
      onClick={onClick}
      {...rest}
    >
      <Video size={18} aria-hidden />
    </button>
  );
}

import { Leaf } from 'lucide-react';
import { cx } from './cx';

export default function MediaCard({ image, title, subtitle, fallbackIcon: FallbackIcon = Leaf, onClick, className }) {
  return (
    <article className={cx('am-media-card', className)}>
      <div className="am-media-card__img">
        {image ? (
          <img src={image} alt="" loading="lazy" decoding="async" />
        ) : (
          <FallbackIcon size={28} aria-hidden />
        )}
      </div>
      <div className="am-media-card__body">
        <h3>
          <button type="button" className="am-stretched" onClick={onClick}>
            {title}
          </button>
        </h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </article>
  );
}

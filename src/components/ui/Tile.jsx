import { Leaf } from 'lucide-react';
import { cx } from './cx';

export function TileGrid({ label, className, children }) {
  return (
    <ul className={cx('am-tile-grid', className)} aria-label={label}>
      {children}
    </ul>
  );
}

export default function Tile({
  image,
  icon: Icon = Leaf,
  label,
  onClick,
  className,
  cutout = false,
  loopCopy = false,
}) {
  return (
    <li aria-hidden={loopCopy || undefined} inert={loopCopy ? true : undefined}>
      <button type="button" className={cx('am-tile', cutout && 'am-tile--cutout', className)} onClick={onClick}>
        <span className="am-tile__img" aria-hidden>
          {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <Icon size={26} />}
        </span>
        <span className="am-tile__label">{label}</span>
      </button>
    </li>
  );
}

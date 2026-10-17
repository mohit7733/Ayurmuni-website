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
    // Loop copies stay hoverable/clickable (no `inert`) but are hidden from
    // assistive tech and skipped by keyboard focus.
    <li aria-hidden={loopCopy || undefined}>
      <button
        type="button"
        className={cx('am-tile', cutout && 'am-tile--cutout', className)}
        onClick={onClick}
        tabIndex={loopCopy ? -1 : undefined}
      >
        <span className="am-tile__img" aria-hidden>
          {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <Icon size={26} />}
        </span>
        <span className="am-tile__label">{label}</span>
      </button>
    </li>
  );
}

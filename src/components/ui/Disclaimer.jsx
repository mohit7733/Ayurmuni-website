import { Info } from 'lucide-react';
import { cx } from './cx';

/** Renders only real, caller-supplied notes; there is no default boilerplate text. */
export default function Disclaimer({ variant = 'inline', children, className }) {
  if (!children) return null;
  return (
    <p className={cx('am-disclaimer', `am-disclaimer--${variant}`, className)}>
      <Info size={16} aria-hidden className="am-disclaimer__icon" />
      <span>{children}</span>
    </p>
  );
}

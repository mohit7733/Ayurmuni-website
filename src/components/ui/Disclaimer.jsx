import { Info } from 'lucide-react';
import { COPY } from '../../content/copy';
import { cx } from './cx';

export default function Disclaimer({ variant = 'inline', long = false, children, className }) {
  return (
    <p className={cx('am-disclaimer', `am-disclaimer--${variant}`, className)}>
      <Info size={16} aria-hidden className="am-disclaimer__icon" />
      <span>{children || (long ? COPY.healthDisclaimerLong : COPY.healthDisclaimer)}</span>
    </p>
  );
}

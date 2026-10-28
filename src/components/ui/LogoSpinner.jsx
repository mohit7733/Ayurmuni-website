import { cx } from './cx';

const SCALES = {
  micro: 'micro',
  compact: 'compact',
  section: 'section',
  feature: 'feature',
  page: 'page',
};

/** Ayurmuni seal. Scale follows the section: strips stay small, full pages grow. */
export default function LogoSpinner({ scale = 'section', label = 'Loading', className }) {
  const tone = SCALES[scale] || 'section';
  return (
    <span className={cx('am-logo-spin', `am-logo-spin--${tone}`, className)} role="status" aria-label={label}>
      <span className="am-logo-spin__glow" aria-hidden />
      <span className="am-logo-spin__orbit" aria-hidden />
      <span className="am-logo-spin__mark" aria-hidden>
        <img src="/favicon.png" alt="" />
      </span>
    </span>
  );
}

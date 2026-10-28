import { cx } from './cx';

const SCALES = {
  micro: 'micro',
  compact: 'compact',
  section: 'section',
  feature: 'feature',
  page: 'page',
};

/** AyurMuni logo loader: the real mark with a thin ring, sized 28-56px, drawn only inside its own box. */
export default function LogoSpinner({ scale = 'section', label = 'Loading', className }) {
  const tone = SCALES[scale] || 'section';
  return (
    <span className={cx('am-logo-spin', `am-logo-spin--${tone}`, className)} role="status" aria-label={label}>
      <span className="am-logo-spin__orbit" aria-hidden />
      <span className="am-logo-spin__mark" aria-hidden>
        <img src="/favicon.png" alt="" />
      </span>
    </span>
  );
}

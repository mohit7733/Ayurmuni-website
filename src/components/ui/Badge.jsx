import { cx } from './cx';

export default function Badge({ tone = 'neutral', size = 'sm', icon, className, children, ...rest }) {
  return (
    <span className={cx('am-badge', `am-badge--${tone}`, `am-badge--${size}`, className)} {...rest}>
      {icon}
      {children}
    </span>
  );
}

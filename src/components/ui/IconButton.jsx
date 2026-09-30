import { cx } from './cx';

export default function IconButton({
  label,
  badge,
  variant = 'soft',
  size = 'md',
  pressed,
  className,
  children,
  type = 'button',
  ...rest
}) {
  const count = Number(badge) || 0;
  const badgeText = count > 99 ? '99+' : String(count);
  return (
    <button
      type={type}
      className={cx('am-icon-btn', `am-icon-btn--${variant}`, `am-icon-btn--${size}`, className)}
      aria-label={count > 0 ? `${label} (${badgeText})` : label}
      aria-pressed={pressed}
      {...rest}
    >
      {children}
      {count > 0 ? (
        <span className="am-icon-btn__badge" aria-hidden>
          {badgeText}
        </span>
      ) : null}
    </button>
  );
}

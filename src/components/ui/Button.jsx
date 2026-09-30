import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cx } from './cx';

export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  leadingIcon = null,
  trailingIcon = null,
  to,
  href,
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}) {
  const classes = cx(
    'am-btn',
    `am-btn--${variant}`,
    `am-btn--${size}`,
    block && 'am-btn--block',
    loading && 'is-loading',
    className,
  );
  const content = (
    <>
      {loading ? <Loader2 className="am-btn__spinner" size={18} aria-hidden /> : leadingIcon}
      {children != null ? <span className="am-btn__label">{children}</span> : null}
      {trailingIcon}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
}

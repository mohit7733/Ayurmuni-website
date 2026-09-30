import { cx } from './cx';

export default function Chip({ selected, icon, count, className, children, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      className={cx('am-chip', selected && 'is-selected', className)}
      aria-pressed={selected === undefined ? undefined : Boolean(selected)}
      {...rest}
    >
      {icon}
      <span>{children}</span>
      {count != null ? <span className="am-chip__count">{count}</span> : null}
    </button>
  );
}

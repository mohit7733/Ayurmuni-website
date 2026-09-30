import { cx } from './cx';

export default function Card({
  as: Tag = 'div',
  variant = 'elevated',
  padding = 'md',
  interactive = false,
  className,
  children,
  ...rest
}) {
  return (
    <Tag
      className={cx(
        'am-card',
        `am-card--${variant}`,
        `am-card--pad-${padding}`,
        interactive && 'am-card--interactive',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

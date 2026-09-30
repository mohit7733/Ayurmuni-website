import { cx } from './cx';

export default function SectionHeader({
  as: Heading = 'h2',
  eyebrow,
  title,
  description,
  action,
  align = 'start',
  id,
  className,
}) {
  return (
    <div className={cx('am-section-header', align === 'center' && 'am-section-header--center', className)}>
      <div className="am-section-header__copy">
        {eyebrow ? <p className="am-eyebrow">{eyebrow}</p> : null}
        <Heading id={id} className="am-section-header__title">
          {title}
        </Heading>
        {description ? <p className="am-section-header__desc">{description}</p> : null}
      </div>
      {action ? <div className="am-section-header__action">{action}</div> : null}
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { cx } from '../ui/cx';
import { Skeleton, SkeletonText } from '../ui';
import LogoSpinner from '../ui/LogoSpinner';
import '../../design/detail.css';

export function DetailPage({ className, children }) {
  return <div className={cx('dx-page', className)}>{children}</div>;
}

export function DetailTop({ backTo, onBack, backLabel = 'Back', actions }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (onBack) return onBack();
    if (backTo) return navigate(backTo);
    if (window.history.length > 1) return navigate(-1);
    return navigate('/home');
  };
  return (
    <div className="dx-top">
      <button type="button" className="am-back" onClick={goBack}>
        <ArrowLeft size={18} aria-hidden />
        {backLabel}
      </button>
      {actions ? <div className="dx-top__actions">{actions}</div> : null}
    </div>
  );
}

export function DetailHero({
  variant = 'media',
  media,
  mediaClassName,
  eyebrow,
  title,
  titleId,
  lede,
  chips,
  aside,
  avatar,
  children,
  className,
}) {
  return (
    <section
      className={cx('dx-hero', `dx-hero--${variant}`, media && 'has-media', className)}
      aria-labelledby={titleId}
    >
      {media ? <div className={cx('dx-hero__media', mediaClassName)}>{media}</div> : null}
      <div className="dx-hero__body">
        {avatar ? (
          <span className="dx-hero__avatar" aria-hidden>
            {avatar}
          </span>
        ) : null}
        <div className="dx-hero__copy">
          {eyebrow ? <p className="dx-eyebrow">{eyebrow}</p> : null}
          <h1 id={titleId} className="dx-title">
            {title}
          </h1>
          {lede ? <p className="dx-lede">{lede}</p> : null}
          {chips ? <div className="dx-chips">{chips}</div> : null}
          {children}
        </div>
        {aside ? <div className="dx-hero__aside">{aside}</div> : null}
      </div>
    </section>
  );
}

export function MetaChip({ icon: Icon, tone, children }) {
  return (
    <span className={cx('dx-chip', tone && `dx-chip--${tone}`)}>
      {Icon ? <Icon size={14} aria-hidden /> : null}
      {children}
    </span>
  );
}

const STATUS_TONES = [
  ['danger', /(cancel|fail|reject|declin|missed|expired|refused|no.?show)/],
  ['warning', /(pend|await|process|initiat|request|due|hold|resched|partial)/],
  ['info', /(ship|dispatch|transit|out for|packed|confirm|scheduled|upcoming|ongoing|active|progress)/],
  ['success', /(deliver|complet|success|paid|done|captured|refund|ended|verified|approved)/],
];

export function statusTone(status) {
  const value = String(status || '').toLowerCase();
  if (!value) return 'neutral';
  for (const [tone, pattern] of STATUS_TONES) if (pattern.test(value)) return tone;
  return 'neutral';
}

export function StatusPill({ status, tone, children }) {
  const label = children ?? status;
  if (!label) return null;
  return <span className={cx('dx-status', `dx-status--${tone || statusTone(status)}`)}>{label}</span>;
}

export function DetailLayout({ children, aside, asideFirst = false }) {
  return (
    <div className={cx('dx-layout', !aside && 'dx-layout--single', asideFirst && 'dx-layout--aside-first')}>
      <div className="dx-main">{children}</div>
      {aside ? <aside className="dx-aside">{aside}</aside> : null}
    </div>
  );
}

export function DetailCard({ id, title, icon: Icon, meta, action, tone, className, children }) {
  return (
    <section className={cx('dx-card', tone && `dx-card--${tone}`, className)} aria-labelledby={title ? id : undefined}>
      {title ? (
        <header className="dx-card__head">
          <h2 id={id} className="dx-card__title">
            {Icon ? (
              <span className="dx-card__icon" aria-hidden>
                <Icon size={16} />
              </span>
            ) : null}
            {title}
          </h2>
          {meta || action ? (
            <div className="dx-card__side">
              {meta ? <span className="dx-card__meta">{meta}</span> : null}
              {action}
            </div>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

const hasValue = (value) => value != null && value !== '' && value !== false;

export function InfoGrid({ items, columns }) {
  const rows = (items || []).filter((item) => item && hasValue(item.value));
  if (!rows.length) return null;
  return (
    <dl className={cx('dx-info', columns && `dx-info--${columns}`)}>
      {rows.map((item) => (
        <div key={item.label} className={cx(item.wide && 'is-wide', item.tone && `is-${item.tone}`)}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SummaryRows({ rows, total }) {
  const list = (rows || []).filter((row) => row && hasValue(row.value));
  return (
    <dl className="dx-rows">
      {list.map((row) => (
        <div key={row.label} className={cx('dx-row', row.tone && `is-${row.tone}`)}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
      {total && hasValue(total.value) ? (
        <div className="dx-row dx-row--total">
          <dt>{total.label}</dt>
          <dd>{total.value}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function StatGrid({ items }) {
  const list = (items || []).filter((item) => item && hasValue(item.value));
  if (!list.length) return null;
  return (
    <ul className="dx-stats">
      {list.map(({ label, value, icon: Icon }) => (
        <li key={label} className="dx-stat">
          {Icon ? (
            <span className="dx-stat__icon" aria-hidden>
              <Icon size={16} />
            </span>
          ) : null}
          <strong>{value}</strong>
          <small>{label}</small>
        </li>
      ))}
    </ul>
  );
}

export function Steps({ items, activeIndex, onPick }) {
  return (
    <ol className="dx-steps">
      {items.map((item, index) => {
        const body = (
          <>
            <span className="dx-step__num" aria-hidden>
              {index + 1}
            </span>
            <span className="dx-step__copy">
              {item.title ? <strong>{item.title}</strong> : null}
              {item.text ? <span>{item.text}</span> : null}
            </span>
            {item.meta ? <span className="dx-step__meta">{item.meta}</span> : null}
          </>
        );
        return (
          <li key={item.id ?? index}>
            {onPick ? (
              <button
                type="button"
                className={cx('dx-step', index === activeIndex && 'is-active')}
                aria-current={index === activeIndex ? 'step' : undefined}
                onClick={() => onPick(item, index)}
              >
                {body}
              </button>
            ) : (
              <div className="dx-step">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Timeline({ items }) {
  return (
    <ol className="dx-timeline">
      {items.map((item) => (
        <li key={item.key || item.title} className={cx('dx-timeline__item', item.state && `is-${item.state}`)}>
          <span className="dx-timeline__dot" aria-hidden />
          <div className="dx-timeline__copy">
            <strong>{item.title}</strong>
            {item.text ? <span>{item.text}</span> : null}
          </div>
          {item.time ? <time className="dx-timeline__time">{item.time}</time> : null}
        </li>
      ))}
    </ol>
  );
}

export function PersonCard({ image, fallback, name, role, meta, action, onClick }) {
  const initials = String(name || '')
    .replace(/^dr\.?\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const content = (
    <>
      <span className="dx-person__avatar" aria-hidden>
        {image ? <img src={image} alt="" loading="lazy" /> : fallback || initials || '•'}
      </span>
      <span className="dx-person__copy">
        <strong>{name}</strong>
        {role ? <span>{role}</span> : null}
        {meta ? <small>{meta}</small> : null}
      </span>
    </>
  );
  return (
    <div className="dx-person">
      {onClick ? (
        <button type="button" className="dx-person__main" onClick={onClick}>
          {content}
        </button>
      ) : (
        <div className="dx-person__main">{content}</div>
      )}
      {action ? <div className="dx-person__action">{action}</div> : null}
    </div>
  );
}

export function DetailLink({ icon: Icon, title, text, onClick, href, external }) {
  const body = (
    <>
      {Icon ? (
        <span className="dx-link__icon" aria-hidden>
          <Icon size={18} />
        </span>
      ) : null}
      <span className="dx-link__copy">
        <strong>{title}</strong>
        {text ? <span>{text}</span> : null}
      </span>
      <ChevronRight size={18} className="dx-link__chev" aria-hidden />
    </>
  );
  if (href) {
    return (
      <a className="dx-link" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" className="dx-link" onClick={onClick}>
      {body}
    </button>
  );
}

export function ActionStack({ children }) {
  return <div className="dx-actions">{children}</div>;
}

export function DetailSkeleton({ media = true, label = 'Loading' }) {
  return (
    <div className="dx-skeleton" role="status" aria-live="polite">
      <LogoSpinner scale="feature" label={label} />
      <div className={cx('dx-hero', media && 'has-media')}>
        {media ? <Skeleton variant="rect" className="dx-hero__media" /> : null}
        <div className="dx-hero__body">
          <Skeleton width="30%" />
          <Skeleton width="70%" height={28} />
          <SkeletonText lines={3} />
        </div>
      </div>
      <div className="dx-card">
        <SkeletonText lines={4} />
      </div>
    </div>
  );
}

export function DetailEmpty({ icon: Icon, title, text, action }) {
  return (
    <div className="dx-card dx-empty">
      {Icon ? (
        <span className="dx-empty__icon" aria-hidden>
          <Icon size={26} />
        </span>
      ) : null}
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
      {action ? <div className="dx-empty__action">{action}</div> : null}
    </div>
  );
}

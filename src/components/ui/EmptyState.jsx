import { AlertCircle, RefreshCw } from 'lucide-react';
import { COPY } from '../../content/copy';
import Button from './Button';
import { cx } from './cx';

export default function EmptyState({ icon, title, description, action, tone = 'neutral', compact = false, className }) {
  return (
    <div
      className={cx('am-empty', `am-empty--${tone}`, compact && 'am-empty--compact', className)}
      role={tone === 'error' ? 'alert' : undefined}
    >
      {icon ? (
        <span className="am-empty__icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      {title ? <h2 className="am-empty__title">{title}</h2> : null}
      {description ? <p className="am-empty__desc">{description}</p> : null}
      {action ? <div className="am-empty__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = COPY.genericErrorTitle, description = COPY.genericErrorText, onRetry, compact }) {
  return (
    <EmptyState
      tone="error"
      compact={compact}
      icon={<AlertCircle size={28} />}
      title={title}
      description={description}
      action={
        onRetry ? (
          <Button variant="secondary" leadingIcon={<RefreshCw size={16} aria-hidden />} onClick={onRetry}>
            {COPY.retry}
          </Button>
        ) : null
      }
    />
  );
}

import { ArrowRight } from 'lucide-react';
import { Button, EmptyState, SectionHeader, SectionHold } from './ui';
import { CONCERN_COPY as T } from '../content/concern';

/**
 * One compact concern section: header (+ service category eyebrow, View all), then either the
 * logo loader held inside the section, a compact empty state, or the rail passed as children.
 */
export default function ConcernPanel({
  id,
  title,
  description,
  eyebrow,
  onViewAll,
  loading = false,
  empty = false,
  emptyText,
  emptyIcon,
  emptyTitle,
  emptyAction,
  loadingVariant = 'products',
  className,
  children,
}) {
  const showAction = Boolean(onViewAll) && !loading && !empty;
  return (
    <section
      className={className ? `cn-panel ${className}` : 'cn-panel'}
      aria-labelledby={id}
      aria-busy={loading || undefined}
    >
      <SectionHeader
        id={id}
        className="cn-head"
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={
          showAction ? (
            <Button
              variant="ghost"
              size="sm"
              className="cn-head__link"
              onClick={onViewAll}
              trailingIcon={<ArrowRight size={16} aria-hidden />}
            >
              {T.viewAll}
              <span className="am-sr-only"> {title}</span>
            </Button>
          ) : null
        }
      />
      {loading ? (
        <SectionHold label={`Loading ${title}`} minHeight={150} variant={loadingVariant} />
      ) : empty ? (
        <EmptyState
          compact
          icon={emptyIcon}
          title={emptyTitle || T.emptyTitle}
          description={emptyText}
          action={emptyAction}
        />
      ) : (
        children
      )}
    </section>
  );
}
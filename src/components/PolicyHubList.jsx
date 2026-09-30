import { ChevronRight, FileText, RefreshCw, Shield } from 'lucide-react';
import { getPolicyDoc, isPolicyAccepted } from '../utils/policyUtils';
import { Button, EmptyState } from './ui';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';

const iconFor = (item) => {
  const doc = getPolicyDoc(item);
  const key = `${doc?.policy_type || ''} ${doc?.title || ''} ${doc?.name || ''}`.toLowerCase();
  if (key.includes('privacy') || key.includes('consent')) return Shield;
  return FileText;
};

export default function PolicyHubList({ policies, error, onRetry, onOpen }) {
  return (
    <>
      {error ? (
        <div className="sx-error">
          <p>{error}</p>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<RefreshCw size={16} aria-hidden />}
            onClick={onRetry}
          >
            {T.hubRetry}
          </Button>
        </div>
      ) : null}
      <div className="sx-list">
        {policies.map((item, index) => {
          const policy = getPolicyDoc(item);
          const updated = isPolicyAccepted(item);
          const Icon = iconFor(item);
          return (
            <button
              key={policy?.id || String(index)}
              type="button"
              className="sx-row"
              onClick={() => onOpen(item)}
            >
              <span className="sx-row__icon" aria-hidden>
                <Icon size={18} />
              </span>
              <span className="sx-row__copy">
                <strong>{policy?.title || policy?.name || 'Policy'}</strong>
                {policy?.subtitle ? <small>{policy.subtitle}</small> : null}
                {updated ? <em>{T.hubUpdated}</em> : null}
              </span>
              <ChevronRight size={18} aria-hidden />
            </button>
          );
        })}
        {!policies.length && !error ? (
          <EmptyState compact title={T.hubEmpty} />
        ) : null}
      </div>
    </>
  );
}

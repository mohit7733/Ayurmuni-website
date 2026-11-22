import {
  ChevronRight,
  FileText,
  RefreshCw,
  RotateCcw,
  Scale,
  Shield,
  ShieldAlert,
  Stethoscope,
  Truck,
} from 'lucide-react';
import { getPolicyDoc, isPolicyAccepted } from '../utils/policyUtils';
import { Button, EmptyState } from './ui';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';

const iconFor = (item) => {
  const doc = getPolicyDoc(item);
  const key = `${doc?.policy_type || ''} ${doc?.title || ''} ${doc?.name || ''}`.toLowerCase();
  if (key.includes('privacy') || key.includes('consent') || key.includes('erasure') || key.includes('deletion')) {
    return { Icon: Shield, tone: 'shield' };
  }
  if (key.includes('grievance')) return { Icon: Scale, tone: 'alert' };
  if (key.includes('medical') || key.includes('telemedicine') || key.includes('disclaimer')) {
    return { Icon: Stethoscope, tone: 'alert' };
  }
  if (key.includes('shipping') || key.includes('delivery')) return { Icon: Truck, tone: 'truck' };
  if (key.includes('return') || key.includes('refund') || key.includes('cancellation')) {
    return { Icon: RotateCcw, tone: 'refresh' };
  }
  if (key.includes('terms')) return { Icon: ShieldAlert, tone: 'shield' };
  return { Icon: FileText, tone: 'doc' };
};

export default function PolicyHubList({
  policies,
  error,
  onRetry,
  onOpen,
  heading,
  description,
  note,
}) {
  return (
    <div className="sx-hub-panel">
      {heading ? (
        <div className="sx-hub-list-heading">
          <div>
            <h2>{heading}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <span>
            {policies.length} {policies.length === 1 ? 'document' : 'documents'}
          </span>
        </div>
      ) : null}

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
          const { Icon, tone } = iconFor(item);
          return (
            <button
              key={policy?.id || String(index)}
              type="button"
              className="sx-row"
              onClick={() => onOpen(item)}
            >
              <span className={`sx-row__icon sx-row__icon--${tone}`} aria-hidden>
                <Icon size={18} />
              </span>
              <span className="sx-row__copy">
                <strong>{policy?.title || policy?.name || 'Policy'}</strong>
                {policy?.subtitle ? <small>{policy.subtitle}</small> : null}
                {updated ? <em>{T.hubUpdated}</em> : null}
              </span>
              <ChevronRight size={16} aria-hidden />
            </button>
          );
        })}
        {!policies.length && !error ? (
          <EmptyState compact title={T.hubEmpty} />
        ) : null}
      </div>

      {note ? <p className="sx-hub-note">{note}</p> : null}
    </div>
  );
}

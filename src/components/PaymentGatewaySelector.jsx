import { CreditCard } from 'lucide-react';
import { Chip } from './ui';
import { PAYMENT_GATEWAY_OPTIONS } from '../payment/gateways';
import '../design/components/payment-gateway.css';

/**
 * "Pay using" row.
 * One gateway → static label (not a button).
 * Two or more → selectable chips.
 */
export default function PaymentGatewaySelector({ gateways, selected, onSelect, disabled }) {
  if (!Array.isArray(gateways) || gateways.length === 0) return null;

  const activeId = gateways.includes(selected) ? selected : gateways[0];
  const activeMeta = PAYMENT_GATEWAY_OPTIONS[activeId] || { title: activeId };

  if (gateways.length === 1) {
    return (
      <div className="pgw pgw--readonly" aria-label="Pay using">
        <span className="pgw__label">Pay using</span>
        <span className="pgw__value">
          <CreditCard size={14} aria-hidden="true" />
          {activeMeta.title}
        </span>
      </div>
    );
  }

  return (
    <div className="pgw" role="radiogroup" aria-label="Pay using">
      <span className="pgw__label">Pay using</span>
      {gateways.map((id) => (
        <Chip
          key={id}
          role="radio"
          aria-checked={id === activeId}
          selected={id === activeId}
          disabled={disabled}
          icon={<CreditCard size={14} aria-hidden="true" />}
          onClick={() => onSelect?.(id)}
          title={PAYMENT_GATEWAY_OPTIONS[id]?.subtitle}
        >
          {PAYMENT_GATEWAY_OPTIONS[id]?.title || id}
        </Chip>
      ))}
    </div>
  );
}

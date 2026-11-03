import { CreditCard } from 'lucide-react';
import { Chip } from './ui';
import { PAYMENT_GATEWAY_OPTIONS } from '../payment/gateways';
import '../design/components/payment-gateway.css';

/** "Pay using" chips. Renders nothing unless more than one gateway is enabled. */
export default function PaymentGatewaySelector({ gateways, selected, onSelect, disabled }) {
  if (!Array.isArray(gateways) || gateways.length < 2) return null;
  return (
    <div className="pgw" role="radiogroup" aria-label="Pay using">
      <span className="pgw__label">Pay using</span>
      {gateways.map((id) => (
        <Chip
          key={id}
          role="radio"
          aria-checked={id === selected}
          selected={id === selected}
          disabled={disabled}
          icon={<CreditCard size={14} aria-hidden="true" />}
          onClick={() => onSelect(id)}
          title={PAYMENT_GATEWAY_OPTIONS[id]?.subtitle}
        >
          {PAYMENT_GATEWAY_OPTIONS[id]?.title || id}
        </Chip>
      ))}
    </div>
  );
}
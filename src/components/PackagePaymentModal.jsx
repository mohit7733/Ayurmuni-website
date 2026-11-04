import { Button, Modal } from './ui';
import PaymentGatewaySelector from './PaymentGatewaySelector';
import '../design/pages/packages-premium.css';

/**
 * Package payment sheet: the server's fee breakdown (checkout.fees) and the amount the gateway
 * will charge (purchase.paid_price). Shown after packages/purchase/ and before the gateway opens.
 */
export default function PackagePaymentModal({ review, gateways, onGateway, onPay, onClose }) {
  const quote = review?.quote;
  const fees = quote && !quote.error ? quote.fees : null;
  const loading = Boolean(review?.loading);
  const paying = Boolean(review?.paying);
  const error = review?.error || quote?.error || '';
  const ready = Boolean(quote && !quote.error && !loading);
  return (
    <Modal
      open={Boolean(review)}
      onClose={paying ? undefined : onClose}
      size="sm"
      title={review?.item?.name || 'Payment'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={paying}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onPay} disabled={!ready || paying}>
            {loading || paying ? 'Please wait...' : fees?.total ? `Pay ${fees.total}` : 'Pay'}
          </Button>
        </>
      }
    >
      <PaymentGatewaySelector
        gateways={gateways}
        selected={review?.gateway}
        onSelect={onGateway}
        disabled={loading || paying}
      />
      {fees ? (
        <div className="am-detail__price" style={{ marginTop: 8 }}>
          {fees.rows.map((row) => (
            <div key={row.key}>
              <span>{row.label}</span>
              <span>{row.value}</span>
            </div>
          ))}
          <div className="is-total">
            <span>Total payable</span>
            <strong>{fees.total}</strong>
          </div>
        </div>
      ) : null}
      {loading && !fees ? <p style={{ margin: '8px 0 0' }}>Fetching payment details...</p> : null}
      {error ? (
        <p role="alert" style={{ margin: '8px 0 0', color: 'var(--am-danger, #b42318)' }}>
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
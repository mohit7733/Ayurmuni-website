// Payment gateway selection. Web checkout uses Cashfree only.
// (Razorpay / ICICI PayPhi / PineLabs are not offered on web.)

export const PAYMENT_GATEWAY_OPTIONS = {
  cashfree: { id: 'cashfree', title: 'Cashfree', subtitle: 'UPI, cards, net banking & wallets' },
};

/** Parse API / UI gateway id -> cashfree | null (other gateways are not offered on web). */
export const parsePaymentGateway = (value) => {
  const s = String(value ?? '').trim().toLowerCase();
  if (s === 'cashfree') return 'cashfree';
  return null;
};

/** Value to send as `payment_gateway` on book-slot / place-order / verify. */
export const toApiPaymentGateway = (gateway) => parsePaymentGateway(gateway) || 'cashfree';

/**
 * Enabled gateways for web. Cashfree only — Razorpay is not offered even if the
 * profile still lists it.
 */
export const resolveEnabledGateways = () => ['cashfree'];

export const resolveDefaultGateway = () => 'cashfree';

const str = (value) => (value == null ? '' : String(value).trim());

/** Order id for verify-payment `gateway_order_id`. */
export const getGatewayOrderId = (data) =>
  str(data?.cashfree_order_id) ||
  str(data?.cf_order_id) ||
  str(data?.cashfree?.order_id) ||
  str(data?.payment_session_id ? data?.order_id : '') ||
  str(data?.gateway_order_id);

/** True when the book-slot / order response carries any gateway order (i.e. money is due). */
export const hasGatewayOrder = (data) =>
  Boolean(
    data?.razorpay_order_id ||
      data?.gateway_order_id ||
      data?.payment_session_id ||
      data?.cashfree_order_id ||
      data?.cashfree ||
      data?.invoice_no ||
      data?.icici,
  );
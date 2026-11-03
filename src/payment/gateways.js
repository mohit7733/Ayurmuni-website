// Payment gateway selection. Ported from the app's config/paymentGateways.ts.
// Web supports Cashfree and Razorpay only (ICICI PayPhi / PineLabs need native SDKs).

export const PAYMENT_GATEWAY_OPTIONS = {
  cashfree: { id: 'cashfree', title: 'Cashfree', subtitle: 'UPI, cards, net banking & wallets' },
  razorpay: { id: 'razorpay', title: 'Razorpay', subtitle: 'UPI, cards, net banking' },
};

const WEB_GATEWAYS = ['cashfree', 'razorpay'];

/** Parse API / UI gateway id -> cashfree | razorpay | null (other gateways are not runnable on web). */
export const parsePaymentGateway = (value) => {
  const s = String(value ?? '').trim().toLowerCase();
  if (s === 'razorpay') return 'razorpay';
  if (s === 'cashfree') return 'cashfree';
  return null;
};

/** Value to send as `payment_gateway` on book-slot / place-order / verify. */
export const toApiPaymentGateway = (gateway) => parsePaymentGateway(gateway) || 'cashfree';

const asBool = (value, fallback) => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const s = String(value).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return fallback;
};

/**
 * Enabled gateways from the customer profile (`customers/profile/` body).
 * Prefers `payment_gateways` (array or { cashfree, razorpay } map); `cashfree_enabled` /
 * `razorpay_enabled` override. Falls back to Cashfree when nothing runnable is enabled.
 */
export const resolveEnabledGateways = (profile) => {
  const source = profile?.customer ?? profile ?? {};
  const raw = source?.payment_gateways;
  const flags = { cashfree: true, razorpay: true };

  if (Array.isArray(raw)) {
    const listed = new Set(raw.map(parsePaymentGateway).filter(Boolean));
    WEB_GATEWAYS.forEach((id) => {
      flags[id] = listed.has(id);
    });
  } else if (raw && typeof raw === 'object') {
    WEB_GATEWAYS.forEach((id) => {
      flags[id] = asBool(raw[id], flags[id]);
    });
  }

  flags.cashfree = asBool(source?.cashfree_enabled, flags.cashfree);
  flags.razorpay = asBool(source?.razorpay_enabled, flags.razorpay);

  const enabled = WEB_GATEWAYS.filter((id) => flags[id]);
  return enabled.length ? enabled : ['cashfree'];
};

export const resolveDefaultGateway = (profile, enabled) => {
  const list = Array.isArray(enabled) && enabled.length ? enabled : ['cashfree'];
  if (list.includes('cashfree')) return 'cashfree';
  if (list.includes('razorpay')) return 'razorpay';
  const source = profile?.customer ?? profile ?? {};
  const preferred = parsePaymentGateway(source?.default_payment_gateway);
  return preferred && list.includes(preferred) ? preferred : list[0];
};

const str = (value) => (value == null ? '' : String(value).trim());

/** Order id for verify-payment `gateway_order_id`. */
export const getGatewayOrderId = (data, gateway) => {
  if (gateway === 'razorpay') {
    return str(data?.razorpay_order_id) || str(data?.gateway_order_id);
  }
  return (
    str(data?.cashfree_order_id) ||
    str(data?.cf_order_id) ||
    str(data?.cashfree?.order_id) ||
    str(data?.payment_session_id ? data?.order_id : '') ||
    str(data?.gateway_order_id)
  );
};

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
// Package purchase contract (POST packages/purchase/ -> gateway -> POST packages/verify-payment/).
// Pure helpers only: the amount charged always comes from the server (purchase.paid_price ===
// checkout.amount); nothing here recomputes GST or fees on the client.
import { formatRupee } from '../home/catalog';
import { buildPackageVerifyPayload } from '../services/packageService';
import { resolveCashfreeMode } from './cashfree';

const WEB_PACKAGE_GATEWAYS = ['cashfree', 'razorpay'];

const str = (value) => (value == null ? '' : String(value).trim());

/** Autopay (recurring) plans are Razorpay subscriptions on the backend. */
export const isAutopayPackage = (item) => {
  const mode = str(item?.billingMode ?? item?.billing_mode).toLowerCase();
  const type = str(item?.purchaseType ?? item?.purchase_type).toLowerCase();
  if (/autopay|subscription|recurring/.test(type)) return true;
  return Boolean(mode) && mode !== 'one_time' && mode !== 'onetime' && mode !== 'one-time';
};

/** Gateways the package sheet may offer: autopay is Razorpay only; never ICICI on the web. */
export const packageGatewayChoices = (item, enabled = WEB_PACKAGE_GATEWAYS) => {
  if (isAutopayPackage(item)) return ['razorpay'];
  const list = (Array.isArray(enabled) ? enabled : []).filter((id) => WEB_PACKAGE_GATEWAYS.includes(id));
  return list.length ? list : ['cashfree'];
};

/** Gateway to send for this package (autopay forces razorpay; default cashfree). */
export const resolvePackageGateway = (item, selected, enabled) => {
  const choices = packageGatewayChoices(item, enabled);
  const wanted = str(selected).toLowerCase();
  if (choices.includes(wanted)) return wanted;
  return choices.includes('cashfree') ? 'cashfree' : choices[0];
};

/** POST packages/purchase/ body. */
export const buildPackagePurchasePayload = ({ packageId, patientId, gateway, item } = {}) => ({
  package_id: str(packageId ?? item?.id),
  ...(str(patientId) ? { patient_id: str(patientId) } : {}),
  payment_gateway: resolvePackageGateway(item, gateway),
});

const toNumber = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Display-only rupee text from a server decimal string ("3538.82" -> "₹3,538.82"). */
export const formatServerMoney = (value) => {
  const n = toNumber(value);
  if (n == null) return '';
  return Number.isInteger(n) ? formatRupee(n) : formatRupee(n, { decimals: 2 });
};

const percentText = (value) => {
  const n = toNumber(value);
  if (n == null) return '';
  return `${Number.isInteger(n) ? n : Number(n.toFixed(2))}%`;
};

/** Fee rows for the payment sheet, straight from `checkout.fees` (fallback `purchase.fees`). */
export const mapPackageFees = (fees) => {
  if (!fees || typeof fees !== 'object') return null;
  const total = toNumber(fees.total_payable_amount);
  if (total == null) return null;
  const rows = [];
  if (toNumber(fees.selling_price) != null) {
    rows.push({ key: 'price', label: 'Package price', value: formatServerMoney(fees.selling_price) });
  }
  if (toNumber(fees.gst_amount) != null) {
    const pct = percentText(fees.gst_percent);
    rows.push({ key: 'gst', label: pct ? `GST (${pct})` : 'GST', value: formatServerMoney(fees.gst_amount) });
  }
  if (toNumber(fees.platform_fee) != null) {
    const pct = percentText(fees.platform_fee_percent);
    rows.push({
      key: 'platform',
      label: pct && toNumber(fees.platform_fee_percent) > 0 ? `Platform fee (${pct})` : 'Platform fee',
      value: formatServerMoney(fees.platform_fee),
    });
  }
  return { rows, total: formatServerMoney(fees.total_payable_amount), totalRaw: str(fees.total_payable_amount) };
};

const toPaise = (value) => {
  const n = toNumber(value);
  return n != null && n > 0 ? Math.round(n * 100) : 0;
};

/**
 * Normalised purchase response. `error` is set when the response cannot be paid safely
 * (missing ids, or checkout.amount !== purchase.paid_price).
 */
export const parsePackagePurchase = (response, requestedGateway) => {
  const data = response?.data || {};
  const purchase = data.purchase || {};
  const checkout = data.checkout || {};
  const gateway = str(checkout.payment_gateway || purchase.payment_gateway || requestedGateway).toLowerCase();
  const type = str(checkout.type).toLowerCase() === 'subscription' ? 'subscription' : 'order';
  const subscriptionId = str(checkout.razorpay_subscription_id);
  const gatewayOrderId = str(checkout.gateway_order_id || checkout.cashfree_order_id || checkout.razorpay_order_id);
  const amount = str(checkout.amount ?? purchase.paid_price);
  const fees = mapPackageFees(checkout.fees || purchase.fees);
  const parsed = {
    purchase,
    checkout,
    purchaseId: str(purchase.id),
    gateway,
    type,
    isSubscription: type === 'subscription',
    gatewayOrderId,
    sessionId: str(checkout.payment_session_id),
    mode: resolveCashfreeMode(response),
    razorpayKey: str(data.razorpay_key),
    subscriptionId,
    amount,
    amountPaise: toPaise(amount),
    fees,
    message: str(response?.message),
    error: '',
  };
  const paid = toNumber(purchase.paid_price);
  const charged = toNumber(checkout.amount);
  if (!parsed.purchaseId) parsed.error = 'Could not start payment.';
  else if (paid != null && charged != null && Math.round(paid * 100) !== Math.round(charged * 100)) {
    parsed.error = 'Payment amount mismatch. Please try again.';
  } else if (gateway === 'cashfree' && (!parsed.sessionId || !gatewayOrderId)) {
    parsed.error = 'Payment gateway not ready. Please try again.';
  } else if (gateway === 'razorpay') {
    if (!parsed.razorpayKey) parsed.error = 'Payment gateway not ready. Please try again.';
    else if (parsed.isSubscription ? !subscriptionId : !gatewayOrderId) {
      parsed.error = 'Payment gateway not ready. Please try again.';
    }
  } else if (gateway !== 'cashfree' && gateway !== 'razorpay') {
    parsed.error = 'This payment method is not available on the website.';
  }
  if (!parsed.error && !parsed.isSubscription && parsed.amountPaise <= 0) parsed.error = 'Invalid package amount.';
  return parsed;
};

/**
 * POST packages/verify-payment/ body.
 * Razorpay: the app's field names (purchase_id, razorpay_order_id, razorpay_payment_id,
 * razorpay_signature [+ razorpay_subscription_id]). Cashfree: purchase_id + gateway_order_id
 * (+ gateway_payment_id when Cashfree reported it) - field names unconfirmed by the backend.
 */
export const buildPackageGatewayVerifyPayload = (parsed, response = {}) => {
  if (parsed?.gateway === 'razorpay') {
    return buildPackageVerifyPayload({
      purchase: { id: parsed.purchaseId },
      response,
      orderId: parsed.isSubscription ? '' : parsed.gatewayOrderId,
      subscriptionId: parsed.subscriptionId,
      isSubscription: parsed.isSubscription,
    });
  }
  const paymentId = str(response?.gateway_payment_id);
  return {
    purchase_id: str(parsed?.purchaseId),
    payment_gateway: 'cashfree',
    gateway_order_id: str(response?.gateway_order_id) || str(parsed?.gatewayOrderId),
    ...(paymentId ? { gateway_payment_id: paymentId } : {}),
  };
};
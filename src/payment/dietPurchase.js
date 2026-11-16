// Diet plan purchase contract (POST diet/purchase/ -> gateway -> POST diet/verify-payment/ -> start).
// Amounts on the invoice come from the server. Nothing here recomputes GST or fees.
import { formatRupee } from '../home/catalog';
import { resolveCashfreeMode } from './cashfree';

const str = (value) => (value == null ? '' : String(value).trim());

const toNumber = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const flagFalse = (value) =>
  value === false || value === 0 || value === '0' || String(value).trim().toLowerCase() === 'false';

const flagTrue = (value) =>
  value === true || value === 1 || value === '1' || String(value).trim().toLowerCase() === 'true';

/** Display rupee text from a server decimal ("3538.82" -> "₹3,538.82"). */
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

const moneyRow = (key, label, value, { deduct = false } = {}) => {
  const n = toNumber(value);
  if (n == null) return null;
  if (deduct && n <= 0) return null;
  const shown = deduct ? `− ${formatServerMoney(n)}` : formatServerMoney(n);
  return { key, label, value: shown, deduct };
};

/**
 * A catalog plan that must be paid before the first start.
 * Paused, stopped, and completed runs already went through start, so they are not charged again.
 * Price 0, or is_paid explicitly false, starts directly.
 */
export const dietPlanNeedsPurchase = (plan, status = 'not_started') => {
  if (!plan) return false;
  const state = String(status || 'not_started').toLowerCase();
  if (state && state !== 'not_started' && state !== 'none') return false;
  if (flagFalse(plan.is_paid)) return false;
  const price = toNumber(plan.price ?? plan.selling_price ?? plan.amount ?? plan.paid_price);
  if (flagTrue(plan.is_paid)) return !(price != null && price <= 0);
  return price != null && price > 0;
};

export const isDietAlreadyPurchasedMessage = (message) =>
  /already (purchased|paid|bought)/i.test(String(message || ''));

/** Diet checkout is Cashfree only. */
export const dietGatewayChoices = () => ['cashfree'];

export const resolveDietGateway = () => 'cashfree';

/** POST diet/purchase/ body. */
export const buildDietPurchasePayload = ({ dietPlanId, patientId, gateway, enabled } = {}) => ({
  diet_plan_id: str(dietPlanId),
  ...(str(patientId) ? { patient_id: str(patientId) } : {}),
  payment_gateway: resolveDietGateway(gateway, enabled),
});

/** Invoice rows from `checkout.fees` (fallback `purchase.fees`). */
export const mapDietFees = (fees) => {
  if (!fees || typeof fees !== 'object' || Array.isArray(fees)) return null;
  const total = toNumber(fees.total_payable_amount ?? fees.total ?? fees.paid_price);
  const rows = [];
  const push = (row) => {
    if (row) rows.push(row);
  };
  push(moneyRow('price', 'Diet plan', fees.selling_price ?? fees.price ?? fees.plan_price));
  if (toNumber(fees.discount_amount) != null) push(moneyRow('discount', 'Discount', fees.discount_amount, { deduct: true }));
  else push(moneyRow('discount', 'Discount', fees.discount, { deduct: true }));
  push(moneyRow('coupon', 'Coupon', fees.coupon_discount ?? fees.coupon_amount, { deduct: true }));
  push(moneyRow('offer', 'Offer', fees.offer_discount ?? fees.offer_amount, { deduct: true }));
  push(moneyRow('subtotal', 'Taxable value', fees.taxable_amount ?? fees.subtotal));
  if (toNumber(fees.gst_amount) != null) {
    const pct = percentText(fees.gst_percent);
    push(moneyRow('gst', pct ? `GST (${pct})` : 'GST', fees.gst_amount));
  }
  if (toNumber(fees.platform_fee) != null) {
    const pct = percentText(fees.platform_fee_percent);
    push(
      moneyRow(
        'platform',
        pct && toNumber(fees.platform_fee_percent) > 0 ? `Platform fee (${pct})` : 'Platform fee',
        fees.platform_fee,
      ),
    );
  }
  push(moneyRow('convenience', 'Convenience fee', fees.convenience_fee));
  const totalRaw = fees.total_payable_amount ?? fees.total ?? fees.paid_price;
  if (toNumber(totalRaw) == null && !rows.length) return null;
  if (!rows.length && toNumber(totalRaw) != null) {
    rows.push({ key: 'price', label: 'Diet plan', value: formatServerMoney(totalRaw), deduct: false });
  }
  return {
    rows,
    total: formatServerMoney(totalRaw) || (rows.length ? rows[rows.length - 1].value : ''),
    totalRaw: str(totalRaw),
  };
};

const toPaise = (value) => {
  const n = toNumber(value);
  return n != null && n > 0 ? Math.round(n * 100) : 0;
};

const PAID_STATUSES = new Set(['paid', 'success', 'successful', 'captured', 'completed']);

const formatIssuedOn = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Normalised purchase response.
 * `skipGateway` means nothing is due (already paid, or payable is 0) — start the plan.
 * `error` means the response cannot be paid safely.
 */
export const parseDietPurchase = (response, requestedGateway) => {
  const root = response?.data && typeof response.data === 'object' ? response.data : {};
  const purchase = root.purchase && typeof root.purchase === 'object' ? root.purchase : root;
  const checkout = root.checkout && typeof root.checkout === 'object' ? root.checkout : root;
  const gateway = str(checkout.payment_gateway || purchase.payment_gateway || requestedGateway).toLowerCase();
  const gatewayOrderId = str(
    checkout.gateway_order_id ||
      checkout.cashfree_order_id ||
      checkout.razorpay_order_id ||
      checkout.order_id,
  );
  const feeSource =
    (checkout.fees && typeof checkout.fees === 'object' ? checkout.fees : null) ||
    (purchase.fees && typeof purchase.fees === 'object' ? purchase.fees : null);
  const amount = str(
    checkout.amount ?? purchase.paid_price ?? purchase.amount ?? feeSource?.total_payable_amount,
  );
  const fees =
    mapDietFees(feeSource) ||
    (amount
      ? {
          rows: [{ key: 'price', label: 'Diet plan', value: formatServerMoney(amount) }],
          total: formatServerMoney(amount),
          totalRaw: amount,
        }
      : null);
  const status = str(purchase.status || purchase.payment_status).toLowerCase();
  const parsed = {
    purchase,
    checkout,
    purchaseId: str(purchase.id || purchase.purchase_id),
    gateway: gateway || 'cashfree',
    gatewayOrderId,
    sessionId: str(checkout.payment_session_id),
    mode: resolveCashfreeMode(response),
    razorpayKey: str(root.razorpay_key || checkout.razorpay_key || checkout.key || purchase.razorpay_key),
    amount,
    amountPaise: toPaise(amount),
    fees,
    invoiceNo: str(purchase.invoice_no || purchase.invoice_number || checkout.invoice_no || purchase.id || purchase.purchase_id),
    issuedOn: formatIssuedOn(purchase.created_at || purchase.created || checkout.created_at),
    alreadyPaid: PAID_STATUSES.has(status),
    skipGateway: false,
    message: str(response?.message),
    error: '',
  };
  const paid = toNumber(purchase.paid_price);
  const charged = toNumber(checkout.amount);
  const sameNode = checkout === purchase;
  if (!parsed.purchaseId) parsed.error = 'Could not start payment.';
  else if (!sameNode && paid != null && charged != null && Math.round(paid * 100) !== Math.round(charged * 100)) {
    parsed.error = 'Payment amount mismatch. Please try again.';
  } else if (parsed.alreadyPaid || parsed.amountPaise <= 0) {
    parsed.skipGateway = true;
  } else if (gateway !== 'cashfree') {
    parsed.error = 'This plan can only be paid with Cashfree.';
  } else if (!parsed.sessionId || !gatewayOrderId) {
    parsed.error = 'Payment gateway not ready. Please try again.';
  }
  return parsed;
};

/**
 * POST diet/verify-payment/ body.
 * Cashfree: purchase_id + gateway_order_id (+ gateway_payment_id when reported).
 * Razorpay: purchase_id + gateway_order_id + gateway_payment_id + gateway_signature.
 * Alias fields the API accepts are included so either naming is satisfied.
 */
export const buildDietVerifyPayload = (parsed, response = {}) => {
  const orderId =
    str(response?.gateway_order_id) ||
    str(response?.razorpay_order_id) ||
    str(response?.cashfree_order_id) ||
    str(response?.order_id) ||
    str(parsed?.gatewayOrderId);
  const paymentId =
    str(response?.gateway_payment_id) ||
    str(response?.razorpay_payment_id) ||
    str(response?.cf_payment_id) ||
    str(response?.cashfree_payment_id);
  const signature = str(response?.gateway_signature) || str(response?.razorpay_signature);
  if (parsed?.gateway === 'razorpay') {
    return {
      purchase_id: str(parsed?.purchaseId),
      gateway_order_id: orderId,
      gateway_payment_id: paymentId,
      gateway_signature: signature,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    };
  }
  return {
    purchase_id: str(parsed?.purchaseId),
    gateway_order_id: orderId,
    ...(paymentId ? { gateway_payment_id: paymentId, cf_payment_id: paymentId } : {}),
    ...(orderId ? { cashfree_order_id: orderId } : {}),
  };
};

const PAID_VERIFY = new Set(['paid', 'success', 'successful', 'completed', 'captured', 'active']);
const UNPAID_VERIFY = new Set(['failed', 'failure', 'pending', 'created', 'initiated', 'cancelled', 'canceled', 'expired']);

/** True when diet/verify-payment/ says the charge is captured. */
export const isDietPaymentVerified = (verify) => {
  if (!verify || typeof verify !== 'object') return false;
  if (verify.success === false || verify.success === 'false' || verify.success === 0) return false;
  const status = str(
    verify?.data?.purchase?.status || verify?.data?.payment_status || verify?.data?.status,
  ).toLowerCase();
  if (UNPAID_VERIFY.has(status)) return false;
  if (verify.success === true || verify.success === 'true' || verify.success === 1) return true;
  return PAID_VERIFY.has(status);
};

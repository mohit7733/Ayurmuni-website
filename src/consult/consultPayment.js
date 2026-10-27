// Consultation payment + plan-funding helpers. Ported from the app's RazorpayScreen.tsx
// and components/packages/packageUi.ts (origin/development).
import { roundMoney } from '../cart/feeQuote';
import { hasGatewayOrder } from '../payment/gateways';

export const isApiSuccess = (response) =>
  response?.success === true || response?.success === 'true' || response?.success === 1;

/** Gateway rejected the order because one already exists for this merchant reference. */
export const isDuplicateGatewayOrder = (response) => {
  const errors = response?.data?.errors ?? response?.errors ?? {};
  const code = String(errors?.error_code ?? response?.data?.error_code ?? '').toUpperCase();
  const text = String(errors?.error_message ?? '').toLowerCase();
  return code === 'DUPLICATE_REQUEST' || text.includes('duplicate merchant reference');
};

export const readAppointmentId = (data) =>
  String(
    data?.appointment_id || data?.appointmentId || data?.consultation_id || data?.appointment?.id || '',
  ).trim();

const PAID_STATUSES = ['success', 'paid', 'captured', 'completed', 'confirmed'];

/** book-slot finished the booking itself - nothing to pay at a gateway. */
export const isBookingAlreadyPaid = (data) => {
  if (hasGatewayOrder(data)) return false;
  const status = String(data?.status ?? data?.payment_status ?? '').toLowerCase();
  const bookingStatus = String(data?.booking?.status ?? '').toLowerCase();
  return (
    PAID_STATUSES.includes(status) ||
    PAID_STATUSES.includes(bookingStatus) ||
    data?.funded_by_package === true ||
    Boolean(data?.package_purchase_id)
  );
};

/** book-slot / retry may put fields on `data` or at the top level. */
export const pickConsultPaymentData = (response) => {
  if (!response || typeof response !== 'object') return {};
  const data = response.data && typeof response.data === 'object' ? response.data : {};
  return {
    ...response,
    ...data,
    payment_id: data.payment_id ?? response.payment_id,
    appointment_id: data.appointment_id ?? response.appointment_id,
    gateway: data.payment_gateway ?? data.gateway ?? response.gateway,
    payment_gateway: data.payment_gateway ?? data.gateway ?? response.gateway,
    gateway_order_id: data.gateway_order_id ?? response.gateway_order_id,
    razorpay_order_id: data.razorpay_order_id ?? response.razorpay_order_id,
    razorpay_key: data.razorpay_key ?? response.razorpay_key,
    key_id: data.key_id ?? response.key_id,
    summary: data.summary ?? response.summary,
    status: data.status ?? response.status,
    payment_status: data.payment_status ?? response.payment_status,
  };
};

export const pickConsultRazorpayKey = (paymentData) =>
  String(
    paymentData?.razorpay_key ||
      paymentData?.gateway_key ||
      paymentData?.key ||
      paymentData?.key_id ||
      paymentData?.checkout?.key ||
      paymentData?.checkout?.razorpay_key ||
      '',
  ).trim();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Razorpay needs order_xxxxx - never fall back to the app appointment/order UUID. */
export const pickConsultRazorpayOrderId = (paymentData) => {
  const candidates = [
    paymentData?.razorpay_order_id,
    paymentData?.razorpayOrderId,
    paymentData?.rzp_order_id,
    paymentData?.gateway_order_id,
    paymentData?.checkout?.razorpay_order_id,
  ];
  for (const value of candidates) {
    const id = String(value ?? '').trim();
    if (id.startsWith('order_')) return id;
  }
  for (const value of candidates) {
    const id = String(value ?? '').trim();
    if (id && !UUID.test(id)) return id;
  }
  return '';
};

/** Payable after the plan is applied (fee-quote with package_purchase_id). Missing -> covered (0). */
export const resolvePlanPayableRupees = (data) => {
  const summary = data?.summary ?? {};
  const candidates = [
    summary?.total_payable_amount,
    data?.total_payable_amount,
    summary?.payable_amount,
    data?.payable_amount,
    data?.amount,
  ];
  for (const value of candidates) {
    if (value == null || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return roundMoney(n);
  }
  return 0;
};

export const PLAN_NOT_ELIGIBLE = 'This package cannot be used for this doctor.';

/** fee-quote `data.package_funding` -> selectable only when `can_fund` is true. */
export const readPlanFunding = (res) => {
  const data = res?.data ?? {};
  const funding = data?.package_funding ?? {};
  const canFund = isApiSuccess(res) && funding?.can_fund === true;
  const payableRaw = funding?.total_payable_amount;
  const payable =
    payableRaw != null && payableRaw !== '' && Number.isFinite(Number(payableRaw))
      ? roundMoney(Number(payableRaw))
      : canFund
        ? resolvePlanPayableRupees(data)
        : null;
  const remaining = funding?.quantity_remaining;
  return {
    loading: false,
    canFund,
    reason: canFund ? '' : String(funding?.ineligible_reason || res?.message || PLAN_NOT_ELIGIBLE),
    payable,
    quantityRemaining: remaining != null && Number.isFinite(Number(remaining)) ? Number(remaining) : null,
  };
};

/** Consultation benefit of a purchased plan (label based - API has no benefit code). */
export const getConsultBenefit = (plan) => {
  const consults = (plan?.benefits || []).filter((b) => /consult/i.test(String(b?.label || '')));
  return (
    consults.find((b) => /doctor/i.test(String(b.label))) ??
    consults.find((b) => !/diet/i.test(String(b.label))) ??
    consults[0] ??
    null
  );
};

export const getPlanConsultState = (plan, now = Date.now()) => {
  if (plan?.expires_at) {
    const expires = new Date(plan.expires_at).getTime();
    if (Number.isFinite(expires) && expires <= now) return 'expired';
  }
  const benefit = getConsultBenefit(plan);
  if (!benefit) return 'no_consult';
  const status = String(benefit.status || 'available').toLowerCase();
  if (status !== 'available') return 'exhausted';
  if (benefit.quantity_remaining != null && benefit.quantity_remaining <= 0) return 'exhausted';
  return 'usable';
};

export const isActivePlan = (plan) => String(plan?.status || '').toLowerCase() === 'active';

/** "3 of 5 consultations left" style label for the plan picker / selected plan card. */
export const planRemainingLabel = (plan, withTotal = false) => {
  const benefit = getConsultBenefit(plan);
  if (!benefit) return '';
  if (benefit.quantity_remaining == null) return 'Unlimited consultations';
  const total = withTotal && benefit.quantity_total != null ? ` of ${benefit.quantity_total}` : '';
  return `${benefit.quantity_remaining}${total} consultation${benefit.quantity_remaining === 1 ? '' : 's'} left`;
};
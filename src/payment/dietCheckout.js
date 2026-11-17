import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import { purchaseDietPlan, startDietPlan, verifyDietPayment } from '../services/dietService';
import { getActivePatientId } from '../services/packageService';
import {
  clearCashfreePending,
  harvestCashfreeGateway,
  openCashfreeCheckout,
  saveCashfreePending,
  shouldVerifyCashfreePayment,
} from './cashfree';
import {
  buildDietPurchasePayload,
  buildDietVerifyPayload,
  isDietAlreadyPurchasedMessage,
  isDietPaymentVerified,
  parseDietPurchase,
} from './dietPurchase';

const SETTLED_KEY = 'ayurmuni_diet_paid';
const SETTLED_TTL_MS = 24 * 60 * 60 * 1000;

const storage = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);

const readSettled = () => {
  try {
    const parsed = JSON.parse(storage()?.getItem(SETTLED_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

/** Payment for this plan is already verified, so the next Start must not charge again. */
export const isDietPaymentSettled = (planId) => {
  const id = String(planId || '').trim();
  const row = readSettled()[id];
  if (!row?.at) return false;
  return Date.now() - Number(row.at) < SETTLED_TTL_MS;
};

export const rememberDietPaymentSettled = (planId, purchaseId) => {
  const id = String(planId || '').trim();
  if (!id) return;
  const store = storage();
  if (!store) return;
  try {
    const all = readSettled();
    all[id] = { purchaseId: String(purchaseId || ''), at: Date.now() };
    store.setItem(SETTLED_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
};

export const clearDietPaymentSettled = (planId) => {
  const id = String(planId || '').trim();
  const store = storage();
  if (!id || !store) return;
  try {
    const all = readSettled();
    delete all[id];
    store.setItem(SETTLED_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function verifyDietUntilSettled(body) {
  let last = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    last = await verifyDietPayment(body);
    if (isDietPaymentVerified(last)) return last;
    const pending = String(last?.message || '').toLowerCase().includes('pending');
    if (!pending || attempt === 3) return last;
    await sleep(1200);
  }
  return last;
}

/**
 * Step 1: POST diet/purchase/ with the chosen gateway.
 * Returns the parsed invoice, `{ skipGateway }` when nothing is due, or `{ error }`.
 */
export async function requestDietPurchase(dietPlanId, gateway, enabled) {
  if (!(await requireAuth('Please login to start a diet plan'))) return { cancelled: true };
  const id = String(dietPlanId || '').trim();
  if (!id) return { error: 'Could not start payment.' };
  try {
    const body = buildDietPurchasePayload({
      dietPlanId: id,
      gateway,
      enabled,
      patientId: await getActivePatientId(),
    });
    const result = await purchaseDietPlan(body);
    if (!result?.success) {
      const message = result?.message || 'Could not start payment.';
      if (isDietAlreadyPurchasedMessage(message)) return { skipGateway: true, alreadyPaid: true, error: '' };
      return { error: message };
    }
    return parseDietPurchase(result, body.payment_gateway);
  } catch (err) {
    const message = err?.message || 'Unable to start payment.';
    if (isDietAlreadyPurchasedMessage(message)) return { skipGateway: true, alreadyPaid: true, error: '' };
    return { error: message };
  }
}

async function payWithCashfree(plan, parsed) {
  saveCashfreePending({
    kind: 'diet',
    dietPlanId: String(plan?.dietPlanId || plan?.id || ''),
    purchaseId: parsed.purchaseId,
    orderId: parsed.gatewayOrderId,
    sessionId: parsed.sessionId,
    waterGoal: plan?.waterGoal ?? null,
  });
  const result = await openCashfreeCheckout({
    sessionId: parsed.sessionId,
    mode: parsed.mode,
    paymentId: parsed.purchaseId,
  });
  if (result?.redirect) return 'redirect';
  if (!shouldVerifyCashfreePayment(result)) {
    clearCashfreePending();
    showSuccessToast(result?.error?.message || 'Payment cancelled. You can try again anytime.', 'error');
    return 'cancelled';
  }
  const verify = await verifyDietUntilSettled(
    buildDietVerifyPayload(parsed, {
      gateway_order_id: result?.gateway?.gateway_order_id,
      gateway_payment_id: result?.gateway?.gateway_payment_id,
      cashfree_order_id: result?.gateway?.gateway_order_id,
      cf_payment_id: result?.gateway?.gateway_payment_id,
    }),
  );
  if (isDietPaymentVerified(verify)) {
    clearCashfreePending();
    showSuccessToast(verify?.message || 'Payment successful.', 'success');
    return 'verified';
  }
  showSuccessToast(verify?.message || 'Payment verification failed.', 'error');
  return 'failed';
}

/**
 * Step 2: open Cashfree for a parsed purchase and verify.
 * Resolves "verified" | "failed" | "cancelled" | "redirect".
 * The plan is started by the caller only after "verified".
 */
export async function payDietPurchase(plan, parsed) {
  if (!parsed || parsed.error) {
    showSuccessToast(parsed?.error || 'Could not start payment.', 'error');
    return 'failed';
  }
  if (parsed.skipGateway) return 'verified';
  if (parsed.gateway !== 'cashfree') {
    showSuccessToast('This plan can only be paid with Cashfree.', 'error');
    return 'failed';
  }
  try {
    return await payWithCashfree(plan, parsed);
  } catch (err) {
    showSuccessToast(err?.message || 'Unable to start payment.', 'error');
    return 'failed';
  }
}

/** Cashfree return page: verify the diet purchase, then start the plan. */
export async function verifyPendingDietPlan(pending, searchParams = {}) {
  const gateway = harvestCashfreeGateway(
    { searchParams, gateway: pending?.gateway },
    pending?.purchaseId,
  );
  const parsed = {
    gateway: 'cashfree',
    purchaseId: String(pending?.purchaseId || ''),
    gatewayOrderId: String(searchParams.order_id || pending?.orderId || ''),
  };
  const verify = await verifyDietUntilSettled(
    buildDietVerifyPayload(parsed, {
      gateway_order_id: parsed.gatewayOrderId,
      gateway_payment_id: pending?.gatewayPaymentId || gateway.gateway_payment_id,
      cashfree_order_id: parsed.gatewayOrderId,
      cf_payment_id: pending?.gatewayPaymentId || gateway.gateway_payment_id,
    }),
  );
  if (!isDietPaymentVerified(verify)) {
    return {
      ok: false,
      started: false,
      verify,
      message: verify?.message || 'Payment was not completed. You can try again.',
    };
  }
  const planId = String(pending?.dietPlanId || '').trim();
  rememberDietPaymentSettled(planId, parsed.purchaseId);
  const waterGoal = Number(pending?.waterGoal);
  try {
    const start = await startDietPlan(
      planId,
      Number.isFinite(waterGoal) && waterGoal > 0 ? { daily_water_intake_goal: waterGoal } : undefined,
    );
    if (start?.success === false) {
      return {
        ok: true,
        started: false,
        verify,
        message: start?.message || 'Payment confirmed. Tap Start on the plan — you will not be charged again.',
      };
    }
    clearDietPaymentSettled(planId);
    return { ok: true, started: true, verify };
  } catch (error) {
    return {
      ok: true,
      started: false,
      verify,
      message: error?.message || 'Payment confirmed. Tap Start on the plan — you will not be charged again.',
    };
  }
}

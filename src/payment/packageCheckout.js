import { showSuccessToast } from "../config/key";
import { requireAuth } from "../services/guestAuth";
import { getActivePatientId, purchasePackage, rememberPackagePurchased, refreshPackageCache, verifyPackagePayment } from "../services/packageService";
import { user_profile } from "../services/profileService";
import {
  clearCashfreePending,
  harvestCashfreeGateway,
  openCashfreeCheckout,
  saveCashfreePending,
  shouldVerifyCashfreePayment,
} from "./cashfree";
import { buildPackageGatewayVerifyPayload, buildPackagePurchasePayload, parsePackagePurchase } from "./packagePurchase";
import { loadRazorpay, normalizeRazorpayContact } from "./razorpay";

/**
 * Step 1: POST packages/purchase/ with the chosen gateway. Returns the parsed checkout
 * (fees + gateway ids) or { error }. Nothing is charged here.
 */
export async function requestPackagePurchase(item, gateway) {
  if (!(await requireAuth("Sign in to buy this package."))) return { cancelled: true };
  try {
    const body = buildPackagePurchasePayload({ item, gateway, patientId: await getActivePatientId() });
    const result = await purchasePackage(body.package_id, body.patient_id, body.payment_gateway);
    if (!result?.success) return { error: result?.message || "Could not start payment." };
    return parsePackagePurchase(result, body.payment_gateway);
  } catch (err) {
    return { error: err?.message || "Unable to start payment." };
  }
}

/**
 * An activated package comes back success:true with purchase status "active".
 * The shared Cashfree check treats "active" as unpaid, which would show this
 * success as an error toast.
 */
const isPackageActivated = (verify) => {
  if (!verify || typeof verify !== "object") return false;
  if (verify.success === false || verify.success === "false" || verify.success === 0) return false;
  if (verify.success === true || verify.success === "true" || verify.success === 1) return true;
  const status = String(verify?.data?.status || "").toLowerCase();
  return status === "active" || status === "paid";
};

const markVerified = (item, parsed, verify, onVerified) => {
  rememberPackagePurchased(item.id);
  refreshPackageCache();
  onVerified?.(parsed.purchase);
  showSuccessToast(verify?.message || "Package activated successfully.", "success");
};

async function payWithCashfree(item, parsed, onVerified) {
  saveCashfreePending({
    kind: "package",
    packageId: item.id,
    purchaseId: parsed.purchaseId,
    orderId: parsed.gatewayOrderId,
    sessionId: parsed.sessionId,
  });
  const result = await openCashfreeCheckout({ sessionId: parsed.sessionId, mode: parsed.mode, paymentId: parsed.purchaseId });
  if (result?.redirect) return "redirect";
  if (!shouldVerifyCashfreePayment(result)) {
    clearCashfreePending();
    showSuccessToast(result?.error?.message || "Payment cancelled. You can try again anytime.", "error");
    return "cancelled";
  }
  const verify = await verifyPackagePayment(buildPackageGatewayVerifyPayload(parsed, result?.gateway || {}));
  if (isPackageActivated(verify)) {
    clearCashfreePending();
    markVerified(item, parsed, verify, onVerified);
    return "verified";
  }
  showSuccessToast(verify?.message || "Payment verification failed.", "error");
  return "failed";
}

async function payWithRazorpay(item, parsed, onVerified) {
  let profile = {};
  try {
    const res = await user_profile();
    profile = res?.data || {};
  } catch {
    profile = {};
  }
  const customerName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
    || profile.full_name
    || "AyurMuni Customer";
  const Razorpay = await loadRazorpay();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };
    const rzp = new Razorpay({
      key: parsed.razorpayKey,
      ...(parsed.isSubscription
        ? { subscription_id: parsed.subscriptionId }
        : { amount: parsed.amountPaise, order_id: parsed.gatewayOrderId }),
      currency: parsed.purchase?.currency || "INR",
      name: "AyurMuni",
      description: item.name,
      prefill: {
        name: customerName,
        email: profile.email || "customer@ayurmuni.com",
        contact: normalizeRazorpayContact(profile.phone_number || profile.mobile || profile.phone),
      },
      theme: { color: "#0D614E" },
      handler: async (response) => {
        let outcome = "failed";
        try {
          const verify = await verifyPackagePayment(buildPackageGatewayVerifyPayload(parsed, response));
          if (isPackageActivated(verify)) {
            outcome = "verified";
            markVerified(item, parsed, verify, onVerified);
          } else {
            showSuccessToast(verify?.message || "Payment verification failed.", "error");
          }
        } catch (err) {
          showSuccessToast(err?.message || "Payment verification failed.", "error");
        } finally {
          finish(outcome);
        }
      },
      modal: {
        ondismiss: () => {
          if (settled) return;
          showSuccessToast("Payment cancelled. You can try again anytime.", "error");
          finish("cancelled");
        },
      },
    });
    rzp.on("payment.failed", (event) => {
      if (settled) return;
      showSuccessToast(event?.error?.description || "Unable to complete payment. Please try again.", "error");
      finish("failed");
    });
    rzp.open();
  });
}

/**
 * Step 2: open the gateway for a parsed purchase and verify. Resolves
 * "verified" | "failed" | "cancelled" | "redirect".
 */
export async function payPackagePurchase(item, parsed, { onVerified } = {}) {
  if (!parsed || parsed.error) {
    showSuccessToast(parsed?.error || "Could not start payment.", "error");
    return "failed";
  }
  try {
    return parsed.gateway === "razorpay"
      ? await payWithRazorpay(item, parsed, onVerified)
      : await payWithCashfree(item, parsed, onVerified);
  } catch (err) {
    showSuccessToast(err?.message || "Unable to start payment.", "error");
    return "failed";
  }
}

/** Cashfree return page: verify a package purchase saved before a redirect. */
export async function verifyPendingPackage(pending, searchParams = {}) {
  const gateway = harvestCashfreeGateway({ searchParams, gateway: pending?.gateway }, pending?.purchaseId);
  const parsed = {
    gateway: "cashfree",
    purchaseId: String(pending?.purchaseId || ""),
    gatewayOrderId: String(searchParams.order_id || pending?.orderId || ""),
  };
  const verify = await verifyPackagePayment(
    buildPackageGatewayVerifyPayload(parsed, {
      gateway_order_id: parsed.gatewayOrderId,
      gateway_payment_id: pending?.gatewayPaymentId || gateway.gateway_payment_id,
    }),
  );
  const ok = isPackageActivated(verify);
  if (ok) {
    if (pending?.packageId) rememberPackagePurchased(pending.packageId);
    refreshPackageCache();
  }
  return { ok, verify };
}
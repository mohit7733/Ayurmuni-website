import { showSuccessToast } from "../config/key";
import { requireAuth } from "../services/guestAuth";
import { buildPackageVerifyPayload, getActivePatientId, purchasePackage, rememberPackagePurchased, refreshPackageCache, verifyPackagePayment } from "../services/packageService";
import { user_profile } from "../services/profileService";
import { loadRazorpay, normalizeRazorpayContact } from "./razorpay";

const toPaise = (rupees) => {
  const amount = Number(rupees);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
};

/**
 * Shared package checkout (list + detail pages): purchase -> Razorpay -> verify-payment.
 * Resolves "verified" only when verify-payment succeeded; otherwise "failed" | "cancelled".
 * On "verified" the package cache is dropped and the plan is remembered as purchased.
 */
export async function startPackageCheckout(item, { onVerified } = {}) {
  if (!(await requireAuth("Sign in to buy this package."))) return "cancelled";
  try {
    const result = await purchasePackage(item.id, await getActivePatientId());
    if (!result?.success) {
      showSuccessToast(result?.message || "Could not start payment.", "error");
      return "failed";
    }
    const data = result.data || {};
    const purchase = data.purchase || {};
    const checkout = data.checkout || {};
    const key = String(data.razorpay_key || "").trim();
    const orderId = String(checkout.razorpay_order_id || purchase.razorpay_order_id || "").trim();
    const subscriptionId = String(checkout.razorpay_subscription_id || purchase.razorpay_subscription_id || "").trim();
    const isSubscription = checkout.type === "subscription" || (!orderId && Boolean(subscriptionId));
    if (!key || (isSubscription ? !subscriptionId : !orderId)) {
      showSuccessToast("Payment gateway not ready. Please try again.", "error");
      return "failed";
    }
    const amount = toPaise(purchase.paid_price ?? item.price);
    if (!isSubscription && amount <= 0) {
      showSuccessToast("Invalid package amount.", "error");
      return "failed";
    }
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
    return await new Promise((resolve) => {
      let settled = false;
      const finish = (outcome) => {
        if (settled) return;
        settled = true;
        resolve(outcome);
      };
      const rzp = new Razorpay({
        key,
        ...(isSubscription ? { subscription_id: subscriptionId } : { amount, order_id: orderId }),
        currency: purchase.currency || "INR",
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
            const verify = await verifyPackagePayment(
              buildPackageVerifyPayload({ purchase, response, orderId, subscriptionId, isSubscription }),
            );
            if (verify?.success) {
              outcome = "verified";
              rememberPackagePurchased(item.id);
              refreshPackageCache();
              onVerified?.(purchase);
              showSuccessToast(verify?.message || "Package activated successfully.", "success");
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
      rzp.on("payment.failed", () => {
        if (settled) return;
        showSuccessToast("Unable to complete payment. Please try again.", "error");
        finish("failed");
      });
      rzp.open();
    });
  } catch (err) {
    showSuccessToast(err?.message || "Unable to start payment.", "error");
    return "failed";
  }
}
import { loadRazorpay, normalizeRazorpayContact } from './razorpay';

/** Rupees -> paise for Razorpay (rounded, never negative). */
export const toRazorpayPaise = (rupees, fallbackRupees = 0) => {
  const direct = Number(rupees);
  const amount = Number.isFinite(direct) && direct > 0 ? direct : Number(fallbackRupees);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
};

/**
 * Open the Razorpay modal for an existing order (book-slot / place-order already created it).
 * Resolves { status: 'success', response } | { status: 'cancelled' } | { status: 'failed', message }.
 * Verification is left to the caller so it can show its own "verifying" state.
 */
export async function openRazorpayCheckout({
  key,
  orderId,
  amountPaise,
  name = 'AyurMuni',
  description = '',
  customerName,
  customerEmail,
  customerPhone,
  themeColor = '#0D614E',
}) {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };
    const rzp = new Razorpay({
      key,
      order_id: orderId,
      ...(amountPaise > 0 ? { amount: amountPaise } : {}),
      currency: 'INR',
      name,
      description,
      prefill: {
        name: customerName || 'AyurMuni Customer',
        email: customerEmail || 'customer@ayurmuni.com',
        contact: normalizeRazorpayContact(customerPhone),
      },
      theme: { color: themeColor },
      handler: (response) => finish({ status: 'success', response }),
      modal: { ondismiss: () => finish({ status: 'cancelled' }) },
    });
    rzp.on('payment.failed', (event) =>
      finish({
        status: 'failed',
        message: event?.error?.description || 'Unable to complete payment. Please try again.',
      }),
    );
    rzp.open();
  });
}
// Razorpay helpers: on-demand script loading (cached, timeout, retry) and
// tolerant extraction of key / order id from backend order responses.

const SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let pending = null;

const injectOnce = (timeoutMs) =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Payment is only available in the browser.'));
      return;
    }
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    document.querySelectorAll(`script[src="${SRC}"]`).forEach((s) => s.remove());
    const script = document.createElement('script');
    script.src = SRC;
    script.async = true;
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error('timeout'));
    }, timeoutMs);
    script.onload = () => {
      clearTimeout(timer);
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error('missing'));
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error('blocked'));
    };
    document.head.appendChild(script);
  });

/** Resolves window.Razorpay; retries, then throws a user-readable error. */
export const loadRazorpay = ({ retries = 2, timeoutMs = 12000 } = {}) => {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(window.Razorpay);
  if (pending) return pending;
  pending = (async () => {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await injectOnce(timeoutMs);
      } catch (err) {
        lastErr = err;
        if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    throw new Error(
      lastErr?.message === 'timeout'
        ? 'Payment gateway took too long to load. Check your connection and try again.'
        : 'Could not load the payment gateway. Disable any ad/script blocker for this site and try again.',
    );
  })().finally(() => {
    if (!(typeof window !== 'undefined' && window.Razorpay)) pending = null;
  });
  return pending;
};

/** Warm the script early (e.g. when checkout mounts). Never throws. */
export const preloadRazorpay = () => {
  loadRazorpay({ retries: 0 }).catch(() => {});
};

/** Merge top-level + data + nested payment — same as the app's useProductOnlinePayment. */
export const pickPaymentData = (orderResponse) => {
  if (!orderResponse || typeof orderResponse !== 'object') return null;

  const data =
    orderResponse.data && typeof orderResponse.data === 'object' ? orderResponse.data : {};
  const nestedPayment =
    (data.payment && typeof data.payment === 'object' && data.payment) ||
    (orderResponse.payment && typeof orderResponse.payment === 'object' && orderResponse.payment) ||
    (data.order?.payment && typeof data.order.payment === 'object' && data.order.payment) ||
    {};

  return {
    ...orderResponse,
    ...data,
    ...(data.order && typeof data.order === 'object' ? data.order : {}),
    ...nestedPayment,
  };
};

/** Never fall back to the app order UUID. Razorpay needs order_xxxxx. */
export const pickRazorpayOrderId = (paymentData) => {
  const candidates = [
    paymentData?.razorpay_order_id,
    paymentData?.razorpayOrderId,
    paymentData?.rzp_order_id,
  ];
  for (const value of candidates) {
    const id = String(value ?? '').trim();
    if (id) return id;
  }
  return '';
};

export const pickRazorpayKey = (paymentData) =>
  String(paymentData?.razorpay_key ?? paymentData?.key ?? paymentData?.key_id ?? '').trim();

/** Same contact rules as the app's openRazorpayPayment. */
export const normalizeRazorpayContact = (value) => {
  let contact = String(value || '').replace(/\D/g, '');
  if (contact.length === 10) contact = `91${contact}`;
  if (contact.length < 10) contact = '919999999999';
  return contact;
};

/** Returns { key, orderId, payment } using the app's field names only. */
export const extractRazorpayCheckout = (response) => {
  const payment = pickPaymentData(response) || {};
  return {
    key: pickRazorpayKey(payment),
    orderId: pickRazorpayOrderId(payment),
    payment,
  };
};

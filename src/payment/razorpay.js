// ON HOLD. Product checkout and consultation pay use Cashfree (src/payment/cashfree.js).
// Kept so Razorpay can be switched back without rebuilding the loader.
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

const KEY_FIELDS = ['razorpay_key', 'razorpay_key_id', 'razorpayKey', 'razorpayKeyId', 'key_id', 'keyId', 'key'];
const ORDER_FIELDS = ['razorpay_order_id', 'razorpayOrderId', 'rzp_order_id', 'gateway_order_id', 'payment_order_id'];

// Breadth-first search through nested objects (response.data.payment..., etc.)
const findField = (root, names, test) => {
  const queue = [root];
  const seen = new Set();
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    for (const name of names) {
      const v = node[name];
      if ((typeof v === 'string' || typeof v === 'number') && String(v).trim() && (!test || test(String(v).trim()))) {
        return String(v).trim();
      }
    }
    Object.values(node).forEach((v) => {
      if (v && typeof v === 'object') queue.push(v);
    });
  }
  return '';
};

const isRzpKey = (v) => /^rzp_(test|live)_/.test(v);

/** Returns { key, orderId } from any reasonable backend payload shape. */
export const extractRazorpayCheckout = (response) => {
  const envKey = String(import.meta.env.VITE_RAZORPAY_KEY_ID || import.meta.env.VITE_RAZORPAY_KEY || '').trim();
  const key =
    findField(response, KEY_FIELDS, isRzpKey) || findField(response, KEY_FIELDS.slice(0, 6)) || envKey;
  const orderId =
    findField(response, ORDER_FIELDS) ||
    // Razorpay order ids look like "order_XXXX"; accept a generic order_id only in that form.
    findField(response, ['order_id', 'orderId', 'id'], (v) => /^order_[A-Za-z0-9]+$/.test(v));
  return { key, orderId };
};

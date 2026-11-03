// Cashfree PG (JS SDK v3). Razorpay checkout is on hold; this is the live gateway.
// https://www.cashfree.com/docs/payments/online/web/redirect

const SRC = 'https://sdk.cashfree.com/js/v3/cashfree.js';
const pendingByMode = new Map();

export const CASHFREE_PENDING_KEY = 'ayurmuni_cashfree_pending';

const envMode = () => {
  const raw = String(import.meta.env.VITE_CASHFREE_MODE || 'production').trim().toLowerCase();
  return raw === 'sandbox' || raw === 'test' ? 'sandbox' : 'production';
};

const injectOnce = (timeoutMs) =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Payment is only available in the browser.'));
      return;
    }
    if (typeof window.Cashfree === 'function') {
      resolve(window.Cashfree);
      return;
    }
    document.querySelectorAll(`script[src="${SRC}"]`).forEach((node) => node.remove());
    const script = document.createElement('script');
    script.src = SRC;
    script.async = true;
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error('timeout'));
    }, timeoutMs);
    script.onload = () => {
      clearTimeout(timer);
      if (typeof window.Cashfree === 'function') resolve(window.Cashfree);
      else reject(new Error('missing'));
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error('blocked'));
    };
    document.head.appendChild(script);
  });

/** Resolves a Cashfree SDK instance for sandbox or production. */
export const loadCashfree = ({ mode = envMode(), retries = 2, timeoutMs = 12000 } = {}) => {
  const resolved = mode === 'production' ? 'production' : 'sandbox';
  if (pendingByMode.has(resolved)) return pendingByMode.get(resolved);
  const task = (async () => {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const Cashfree = await injectOnce(timeoutMs);
        return Cashfree({ mode: resolved });
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
  })().catch((err) => {
    pendingByMode.delete(resolved);
    throw err;
  });
  pendingByMode.set(resolved, task);
  return task;
};

export const preloadCashfree = () => {
  loadCashfree({ retries: 0 }).catch(() => {});
};

const SESSION_FIELDS = [
  'payment_session_id',
  'paymentSessionId',
  'cashfree_payment_session_id',
  'cashfreePaymentSessionId',
];
const ORDER_FIELDS = [
  'cashfree_order_id',
  'cashfreeOrderId',
  'gateway_order_id',
  'cf_order_id',
  'order_id',
  'orderId',
];
const MODE_FIELDS = ['cashfree_mode', 'cashfree_env', 'cf_environment', 'pg_environment', 'environment'];

const findField = (root, names, test) => {
  const queue = [root];
  const seen = new Set();
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    for (const name of names) {
      const value = node[name];
      if (
        (typeof value === 'string' || typeof value === 'number') &&
        String(value).trim() &&
        (!test || test(String(value).trim()))
      ) {
        return String(value).trim();
      }
    }
    Object.values(node).forEach((value) => {
      if (value && typeof value === 'object') queue.push(value);
    });
  }
  return '';
};

const looksLikeSession = (value) => /^session_/i.test(String(value || ''));

export const resolveCashfreeMode = (response) => {
  const raw = findField(response, MODE_FIELDS, (value) => /sandbox|production|test|prod/i.test(value)).toLowerCase();
  if (raw.includes('prod')) return 'production';
  if (raw.includes('sandbox') || raw.includes('test')) return 'sandbox';
  return envMode();
};

const firstNamed = (node, names, test) => {
  if (!node || typeof node !== 'object') return '';
  for (const name of names) {
    const value = node[name];
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) {
      const text = String(value).trim();
      if (!test || test(text)) return text;
    }
  }
  return '';
};

const findNodeWith = (root, names) => {
  const queue = [root];
  const seen = new Set();
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (firstNamed(node, names)) return node;
    Object.values(node).forEach((value) => {
      if (value && typeof value === 'object') queue.push(value);
    });
  }
  return null;
};

/** Returns { sessionId, orderId, paymentId, mode } from a book/order response. */
export const extractCashfreeCheckout = (response) => {
  const sessionNode = findNodeWith(response, SESSION_FIELDS);
  const sessionId =
    firstNamed(sessionNode, SESSION_FIELDS, looksLikeSession) ||
    firstNamed(sessionNode, SESSION_FIELDS) ||
    findField(response, SESSION_FIELDS);
  const orderId =
    firstNamed(sessionNode, ['gateway_order_id']) ||
    firstNamed(sessionNode, ORDER_FIELDS, (value) => !looksLikeSession(value)) ||
    findField(response, ['gateway_order_id', 'cashfree_order_id', 'cf_order_id']);
  const paymentId =
    firstNamed(sessionNode, ['payment_id'], (value) => !looksLikeSession(value)) ||
    findField(response, ['payment_id'], (value) => !looksLikeSession(value));
  const fromApi = harvestCashfreeGateway(response, paymentId);
  return {
    sessionId,
    orderId: orderId || fromApi.gateway_order_id,
    paymentId,
    gatewayPaymentId: fromApi.gateway_payment_id,
    signature: fromApi.gateway_signature,
    mode: resolveCashfreeMode(response),
  };
};

const statusValues = (response) => {
  const nodes = [
    response,
    response?.data,
    response?.data?.payment,
    response?.data?.order,
    response?.payment,
    response?.order,
  ].filter((node) => node && typeof node === 'object');
  return nodes.flatMap((node) =>
    [node.payment_status, node.order_status, node.status]
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  );
};

const isPaidStatus = (value) =>
  /^(paid|success|captured|completed)$/i.test(value) || String(value).toUpperCase() === 'PAID';

const isUnpaidStatus = (value) =>
  /^(pending|created|initiated|active|failed|failure|user_dropped|cancelled|canceled|expired|terminated)$/i.test(
    value,
  );

/** True when the backend verify call says the Cashfree payment is paid. */
export const isCashfreePaymentVerified = (response) => {
  if (!response || typeof response !== 'object') return false;
  const statuses = statusValues(response);
  const paid = statuses.some(isPaidStatus);
  const unpaid = statuses.some(isUnpaidStatus);
  if (unpaid && !paid) return false;
  if (response.success === false || response.success === 'false' || response.success === 0) return false;
  if (paid) return true;
  return response.success === true || response.success === 'true' || response.success === 1;
};

const asText = (value) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return '';
};

const normKey = (key) => String(key || '').toLowerCase().replace(/[_-]/g, '');

const PAYMENT_RANK = [
  'gatewaypaymentid',
  'cfpaymentid',
  'cashfreepaymentid',
  'referenceid',
  'transactionid',
  'txnid',
  'pgpaymentid',
  'bankreference',
  'authid',
  'paymentid',
];
const ORDER_KEYS = new Set(['gatewayorderid', 'cashfreeorderid', 'cforderid', 'orderid']);
const SIGN_KEYS = new Set(['gatewaysignature', 'signature', 'txnsignature', 'paymentsignature']);

const paymentRank = (name) => {
  const index = PAYMENT_RANK.indexOf(name);
  return index === -1 ? -1 : index;
};

const queryObject = (text) => {
  const raw = String(text || '').trim();
  if (!raw.includes('=')) return null;
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`https://cashfree.local/?${raw.replace(/^\?/, '')}`);
    if (![...url.searchParams.keys()].length) return null;
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return null;
  }
};

/** Pull gateway ids out of a Cashfree checkout postMessage, return query, or API payload. */
export const harvestCashfreeGateway = (root, internalPaymentId = '') => {
  const found = { gateway_order_id: '', gateway_payment_id: '', gateway_signature: '' };
  const internal = asText(internalPaymentId);
  let bestPaymentRank = 99;
  const visit = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > 8) return;
    Object.entries(node).forEach(([key, value]) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            visit(JSON.parse(trimmed), depth + 1);
            return;
          } catch {
            /* keep the raw string */
          }
        }
        const query = queryObject(trimmed);
        if (query) visit(query, depth + 1);
      }
      const text = asText(value);
      const name = normKey(key);
      if (!text) {
        if (value && typeof value === 'object') visit(value, depth + 1);
        return;
      }
      if (!found.gateway_order_id && ORDER_KEYS.has(name) && !looksLikeSession(text)) {
        found.gateway_order_id = text;
      }
      const rank = paymentRank(name);
      if (
        rank !== -1 &&
        rank < bestPaymentRank &&
        text !== internal &&
        !looksLikeSession(text) &&
        text !== found.gateway_order_id
      ) {
        bestPaymentRank = rank;
        found.gateway_payment_id = text;
      }
      if (!found.gateway_signature && SIGN_KEYS.has(name) && text.length > 8) {
        found.gateway_signature = text;
      }
      if (value && typeof value === 'object') visit(value, depth + 1);
    });
  };
  if (typeof root === 'string') {
    const query = queryObject(root);
    if (query) visit(query, 0);
    try {
      visit(JSON.parse(root), 0);
    } catch {
      /* not json */
    }
  } else {
    visit(root, 0);
  }
  return found;
};

const mergeGateway = (internalPaymentId, ...parts) => {
  const merged = { gateway_order_id: '', gateway_payment_id: '', gateway_signature: '' };
  const take = (next) => {
    if (!next) return;
    if (!merged.gateway_order_id && next.gateway_order_id) merged.gateway_order_id = asText(next.gateway_order_id);
    if (!merged.gateway_payment_id && next.gateway_payment_id) merged.gateway_payment_id = asText(next.gateway_payment_id);
    if (!merged.gateway_signature && next.gateway_signature) merged.gateway_signature = asText(next.gateway_signature);
  };
  parts.forEach((part) => {
    if (!part) return;
    take(part);
    take(harvestCashfreeGateway(part, internalPaymentId));
  });
  return merged;
};

/**
 * Body for POST .../verify-payment/
 * { payment_id, gateway_order_id, gateway_payment_id, gateway_signature, payment_gateway }
 */
export const buildCashfreeVerifyPayload = (checkout, result) => {
  const internalPaymentId = asText(checkout?.paymentId);
  const gateway = mergeGateway(
    internalPaymentId,
    result?.gateway,
    result?.paymentDetails,
    result?.searchParams,
    result?.rawMessage,
    result?.messages,
    {
      gateway_order_id: checkout?.orderId,
      gateway_payment_id: checkout?.gatewayPaymentId,
      gateway_signature: checkout?.signature,
    },
  );
  return {
    payment_id: internalPaymentId,
    gateway_order_id: gateway.gateway_order_id,
    gateway_payment_id: gateway.gateway_payment_id,
    gateway_signature: gateway.gateway_signature,
    payment_gateway: 'cashfree',
  };
};

export const isRecordUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Modal checkout finished, or the checkout message included a payment id. */
export const shouldVerifyCashfreePayment = (result) =>
  Boolean(result?.paymentDetails || asText(result?.gateway?.gateway_payment_id));

/**
 * Cashfree's modal does not put cf_payment_id on the checkout promise.
 * After the customer pays, the webhook stores it on the payment row.
 * Poll that row when the checkout message did not include gateway_payment_id.
 */
export const enrichCashfreeVerifyPayload = async (payload, loaders = []) => {
  if (asText(payload?.gateway_payment_id)) return payload;
  const internal = asText(payload?.payment_id);
  const reads = loaders.filter((load) => typeof load === 'function');
  if (!reads.length) return payload;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    for (const load of reads) {
      try {
        const response = await load();
        const found = harvestCashfreeGateway(response, internal);
        if (!found.gateway_payment_id) continue;
        return {
          ...payload,
          gateway_order_id: asText(payload?.gateway_order_id) || found.gateway_order_id,
          gateway_payment_id: found.gateway_payment_id,
          gateway_signature: asText(payload?.gateway_signature) || found.gateway_signature,
        };
      } catch {
        /* webhook may not have landed yet */
      }
    }
    if (attempt < 4) await sleep(1200);
  }
  return payload;
};

export const saveCashfreePending = (payload) => {
  try {
    sessionStorage.setItem(
      CASHFREE_PENDING_KEY,
      JSON.stringify({ ...payload, savedAt: Date.now() }),
    );
  } catch {
    /* ignore quota */
  }
};

export const readCashfreePending = () => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CASHFREE_PENDING_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearCashfreePending = () => {
  sessionStorage.removeItem(CASHFREE_PENDING_KEY);
};

const isCashfreeOrigin = (origin) => {
  try {
    const host = new URL(origin).hostname;
    return host.endsWith('cashfree.com') || host.endsWith('cashfree.net');
  } catch {
    return false;
  }
};

/** Opens hosted checkout in a modal. Resolves with { error, redirect, paymentDetails, gateway }. */
export const openCashfreeCheckout = async ({ sessionId, mode, paymentId }) => {
  const captured = { gateway_order_id: '', gateway_payment_id: '', gateway_signature: '' };
  const messages = [];
  const onMessage = (event) => {
    const next = harvestCashfreeGateway(event.data, paymentId);
    let status = '';
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      status = asText(
        data?.paymentStatus || data?.txStatus || data?.event_data?.paymentStatus || data?.event_data?.txStatus,
      );
    } catch {
      status = '';
    }
    if (!isCashfreeOrigin(event.origin) && !next.gateway_signature && !next.gateway_payment_id && !status) return;
    messages.push(event.data);
    captured.gateway_order_id = captured.gateway_order_id || next.gateway_order_id;
    captured.gateway_payment_id = captured.gateway_payment_id || next.gateway_payment_id;
    captured.gateway_signature = captured.gateway_signature || next.gateway_signature;
  };
  window.addEventListener('message', onMessage);
  try {
    const cashfree = await loadCashfree({ mode });
    // Modal checkout reports the result in this promise. Do not send a localhost
    // returnUrl; Cashfree rejects it. The session id may end in "paymentpayment";
    // that suffix is part of the id and must be kept.
    const result = await cashfree.checkout({
      mode,
      paymentSessionId: String(sessionId || '').replace(/\s+/g, ''),
      redirectTarget: '_modal',
    });
    if (result?.paymentDetails && !captured.gateway_payment_id) await sleep(700);
    const gateway = mergeGateway(paymentId, captured, ...messages, result?.paymentDetails);
    const pending = readCashfreePending();
    if (pending) {
      saveCashfreePending({
        ...pending,
        orderId: pending.orderId || gateway.gateway_order_id,
        gatewayPaymentId: pending.gatewayPaymentId || gateway.gateway_payment_id,
        signature: pending.signature || gateway.gateway_signature,
        gateway,
      });
    }
    return { ...result, gateway, rawMessage: messages.at(-1) ?? null, messages };
  } finally {
    window.removeEventListener('message', onMessage);
  }
};

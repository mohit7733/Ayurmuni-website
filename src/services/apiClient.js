import { Utils } from '../common/utils';
import { BaseUrl } from '../config/key';

let isRefreshing = false;
let refreshPromise = null;

const refreshAccessToken = async () => {
  try {
    const refreshToken = await Utils.getData('_REFRESH_TOKEN');
    if (!refreshToken) return null;

    const response = await fetchWithTimeout(`${BaseUrl.base_url}user/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    const data = await parseJsonBody(response);
    if (!data || !response.ok || !data?.success) {
      return null;
    }

    const accessToken = data?.data?.access;
    const newRefreshToken = data?.data?.refresh;
    if (!accessToken) return null;

    // Same account, new token: adopt it silently (no cache wipe / session listeners).
    adoptedIdentity = fingerprint(accessToken);
    await Utils.storeData('_TOKEN', accessToken);
    if (newRefreshToken) {
      await Utils.storeData('_REFRESH_TOKEN', newRefreshToken);
    }

    return accessToken;
  } catch {
    return null;
  }
};

const parseJsonBody = async (response) => {
  try {
    const rawText = await response.text();
    const trimmed = rawText.trim();
    if (!trimmed) return null;
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const getFreshToken = async () => {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = refreshAccessToken();
  try {
    return await refreshPromise;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
};

const makeRequest = (endpoint, options, token) => {
  const isFormData = options?.body instanceof FormData;
  const headers = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': '1',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  return fetch(BaseUrl.base_url + endpoint, {
    ...options,
    headers,
  });
};

// ---- Timeouts and cancellation ----
// Every request gets a deadline; a caller's AbortSignal still cancels it. Uploads get longer.
export const DEFAULT_TIMEOUT_MS = 20_000;
export const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * Link an optional caller signal with a timeout. Returns the signal to hand to fetch, whether
 * the deadline fired, and a cleanup for the timer/listener.
 */
export const linkSignal = (callerSignal, timeoutMs) => {
  const controller = new AbortController();
  let timedOut = false;
  let timer = null;
  const onAbort = () => controller.abort(callerSignal?.reason);
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason);
    else callerSignal.addEventListener('abort', onAbort, { once: true });
  }
  if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup: () => {
      if (timer) clearTimeout(timer);
      callerSignal?.removeEventListener?.('abort', onAbort);
    },
  };
};

/** fetch() with the same deadline + AbortSignal rules, for services that call fetch directly. */
export const fetchWithTimeout = async (url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const link = linkSignal(init.signal, timeoutMs);
  try {
    return await fetch(url, { ...init, signal: link.signal });
  } catch (error) {
    if (link.timedOut()) {
      const timeoutError = new Error('Request timed out');
      timeoutError.name = 'TimeoutError';
      timeoutError.code = 'timeout';
      throw timeoutError;
    }
    throw error;
  } finally {
    link.cleanup();
  }
};

const abortedResult = () => ({ success: false, aborted: true, status: 0, message: 'Request aborted' });
const timeoutResult = () => ({ success: false, timeout: true, status: 0, message: 'Request timed out' });

// ---- Shared GET layer: one network call per identical GET burst ----
// Identical GETs (same endpoint + query, same auth identity, same headers/options) that are in
// flight share one request, and a successful response is reused for a short TTL.
// Mutations invalidate only the GET prefixes they affect (see MUTATION_RULES), before they are
// sent and again when they settle; unknown mutations invalidate everything.
// A GET that was in flight when a related mutation invalidated it is never cached, and its
// callers are re-served from a request that started after the invalidation, so an older response
// cannot overwrite data the mutation just changed.
// A change of access token (login, logout, account/patient switch) drops everything.
// Opt out per call with options.cache = false (manual refresh) or invalidateApiCache(prefix).
const GET_TTL_MS = 10_000;
const GET_CACHE_MAX = 200;
const MAX_REVALIDATIONS = 2;
const getInFlight = new Map();
const getCache = new Map();
const pendingMutations = new Set();
let cacheEpoch = 0;
let lastIdentity;
let adoptedIdentity = null;
const sessionListeners = new Set();

const cloneResult = (value) => {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
};

const pathOf = (endpoint) => String(endpoint || '').replace(/^\/+/, '').split('?')[0];

const ALL = ['*'];
/**
 * Mutation path prefix -> GET path prefixes it makes stale. First match wins (most specific
 * first). Read-only POSTs (fee quotes, coupon validation, uploads) invalidate nothing.
 */
export const MUTATION_RULES = [
  ['order/fee-quote/', []],
  ['promotions/coupons/validate/', []],
  ['user/upload/', []],
  ['notifications/push/', []],
  ['banners/events/', []],
  ['doctors/appointments/', ['doctors/appointments/', 'customers/patient/consultation/', 'customers/doctors/consultation-history/']],
  ['cart/', ['cart/', 'promotions/coupons/']],
  ['order/', ['order/', 'cart/', 'promotions/', 'customers/prescription-requests/']],
  ['customers/prescription-requests/', ['customers/prescription-requests/', 'cart/', 'order/']],
  ['promotions/', ['promotions/']],
  ['notifications/', ['notifications/']],
  ['patients/switch/', ALL],
  ['patients/diet-plans/', ['patients/diet-plans/', 'customers/suggested/diet-plans/']],
  ['patients/', ['patients/', 'customers/profile/']],
  ['customers/medical-records/', ['customers/medical-records/']],
  ['customers/address/', ['customers/address/']],
  ['customers/search/recent/', ['customers/search/recent/']],
  [
    'customers/doctors/appointments/action/',
    ['customers/doctors/', 'customers/patient/consultation/', 'doctors/appointments/', 'payments/'],
  ],
  [
    'payments/customer/consultation/',
    ['payments/', 'customers/doctors/', 'customers/patient/consultation/', 'promotions/'],
  ],
  [
    'favorites/',
    ['favorites/', 'customers/products/', 'customers/doctors/', 'customers/suggested/', 'customers/search/'],
  ],
  // Order items carry is_reviewed / is_rated: a product review must refresh the order too.
  [
    'review/',
    ['review/', 'order/', 'customers/products/', 'customers/doctors/', 'customers/patient/consultation/', 'patients/diet-plans/'],
  ],
  ['policies/', ['policies/']],
  [
    'customers/profile/',
    ['customers/profile/', 'customers/prakriti/', 'customers/dashboard/', 'customers/suggested/', 'patients/'],
  ],
  [
    'customers/questionnaires/',
    ['customers/questionnaires/', 'customers/profile/', 'customers/prakriti/', 'customers/suggested/', 'customers/dashboard/'],
  ],
  [
    'customers/initiate_onboarding/',
    ['customers/questionnaires/', 'customers/profile/', 'customers/prakriti/', 'customers/suggested/', 'customers/dashboard/'],
  ],
  [
    'customers/answer_prakriti/',
    ['customers/questionnaires/', 'customers/profile/', 'customers/prakriti/', 'customers/suggested/', 'customers/dashboard/'],
  ],
  ['packages/', ['packages/']],
  // Login, register, account recovery and anything unlisted: drop everything.
];

export const invalidationPrefixesFor = (endpoint, method = 'POST') => {
  const path = pathOf(endpoint);
  if (String(method).toUpperCase() === 'DELETE' && path.startsWith('customers/profile/')) return ALL;
  const rule = MUTATION_RULES.find(([prefix]) => path.startsWith(prefix));
  return rule ? rule[1] : ALL;
};

const matchesAny = (path, prefixes) =>
  prefixes === ALL || prefixes.includes('*') || prefixes.some((prefix) => path.startsWith(prefix));

const invalidate = (prefixes, { revalidate = false } = {}) => {
  if (!prefixes.length) return;
  if (prefixes === ALL || prefixes.includes('*')) cacheEpoch += 1;
  getCache.forEach((entry, key) => {
    if (matchesAny(entry.path, prefixes)) getCache.delete(key);
  });
  getInFlight.forEach((entry, key) => {
    if (!matchesAny(entry.path, prefixes)) return;
    entry.stale = true;
    if (revalidate) entry.revalidate = true;
    getInFlight.delete(key);
  });
};

/** Drop every cached and in-flight GET; responses already in flight are not stored. */
export const clearApiCache = () => invalidate(ALL);

/**
 * Targeted invalidation: drop cached / in-flight GETs whose path starts with any prefix
 * (e.g. 'cart/', 'customers/doctors/'). Use before a manual refresh of one screen.
 */
export const invalidateApiCache = (prefixes) => {
  const list = (Array.isArray(prefixes) ? prefixes : [prefixes])
    .map((prefix) => pathOf(prefix))
    .filter(Boolean);
  invalidate(list);
};

/** Called with (identity) whenever the signed-in account changes (login, logout, switch). */
export const subscribeApiSession = (listener) => {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
};

/** Short non-reversible fingerprint so the raw token never sits in a map key. */
const fingerprint = (token) => {
  const str = String(token);
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${(h >>> 0).toString(36)}.${str.length}`;
};

/** Current auth identity (token fingerprint, '' when signed out). Never exposes the token. */
export const currentApiIdentity = async () => {
  const token = await Utils.getData('_TOKEN');
  return token ? fingerprint(token) : '';
};

const syncIdentity = (identity) => {
  if (adoptedIdentity && identity === adoptedIdentity) {
    adoptedIdentity = null;
    lastIdentity = identity;
    return;
  }
  if (lastIdentity !== undefined && identity !== lastIdentity) {
    clearApiCache();
    lastIdentity = identity;
    sessionListeners.forEach((listener) => {
      try {
        listener(identity);
      } catch {
        // listeners must not break requests
      }
    });
    return;
  }
  lastIdentity = identity;
};

// Login / logout / account switch write the token through Utils, which fires SESSION_EVENT:
// drop the previous account's cache right away instead of waiting for the next request.
// Seed the identity from storage so the very first login/logout (before any API call) is
// still detected as an account change and notifies session listeners (cart badge, chat, ...).
Promise.resolve()
  .then(currentApiIdentity)
  .then(
    (identity) => {
      if (lastIdentity === undefined) lastIdentity = identity;
    },
    () => undefined,
  );

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('ayurmuni:session', () => {
    currentApiIdentity().then(syncIdentity, () => undefined);
  });
}

const hasPendingMutationFor = (path) => {
  for (const prefixes of pendingMutations) {
    if (matchesAny(path, prefixes)) return true;
  }
  return false;
};

const storeCached = (key, path, value) => {
  const now = Date.now();
  getCache.forEach((entry, k) => {
    if (now - entry.at >= GET_TTL_MS) getCache.delete(k);
  });
  if (getCache.size >= GET_CACHE_MAX) getCache.delete(getCache.keys().next().value);
  getCache.set(key, { at: now, path, value });
};

/** Request options other than method/signal/cache that change the response must split the key. */
const optionsSignature = ({ headers, signal: _signal, method: _method, timeoutMs: _t, ...rest }) => {
  const parts = [];
  if (headers) {
    const entries =
      typeof Headers !== 'undefined' && headers instanceof Headers
        ? [...headers.entries()]
        : Object.entries(headers);
    parts.push(
      JSON.stringify(
        entries.map(([k, v]) => [String(k).toLowerCase(), String(v)]).sort(([a], [b]) => (a < b ? -1 : 1)),
      ),
    );
  }
  const restKeys = Object.keys(rest).sort();
  if (restKeys.length) parts.push(JSON.stringify(restKeys.map((k) => [k, String(rest[k])])));
  return parts.join('|');
};

const startShared = (key, path, endpoint, fetchOptions, requireAuth, depth) => {
  const controller = new AbortController();
  const entry = {
    path,
    stale: false,
    revalidate: false,
    settled: false,
    waiters: 0,
    pinned: false,
    controller,
  };
  const epoch = cacheEpoch;
  entry.promise = apiRequest(endpoint, { ...fetchOptions, signal: controller.signal }, requireAuth)
    .then((value) => {
      entry.settled = true;
      if (getInFlight.get(key) === entry) getInFlight.delete(key);
      if (entry.revalidate && depth < MAX_REVALIDATIONS && !controller.signal.aborted) {
        // A related mutation landed while this GET was in flight: serve its callers fresh data.
        return sharedValue(key, path, endpoint, fetchOptions, requireAuth, depth + 1);
      }
      if (
        value?.success === true &&
        !entry.stale &&
        epoch === cacheEpoch &&
        !hasPendingMutationFor(path)
      ) {
        storeCached(key, path, value);
      }
      return value;
    })
    .finally(() => {
      entry.settled = true;
      if (getInFlight.get(key) === entry) getInFlight.delete(key);
    });
  getInFlight.set(key, entry);
  return entry;
};

/** Resolve with the shared value for key: cache hit, join in-flight, or start a request. */
const sharedValue = (key, path, endpoint, fetchOptions, requireAuth, depth = 0) => {
  const hit = getCache.get(key);
  if (hit && Date.now() - hit.at < GET_TTL_MS) return Promise.resolve(hit.value);
  if (hit) getCache.delete(key);
  const entry = getInFlight.get(key) || startShared(key, path, endpoint, fetchOptions, requireAuth, depth);
  entry.pinned = true;
  return entry.promise;
};

/** Join (or start) the shared request for one caller, honouring that caller's AbortSignal. */
const joinShared = (key, path, endpoint, fetchOptions, requireAuth, callerSignal) => {
  const hit = getCache.get(key);
  if (hit && Date.now() - hit.at < GET_TTL_MS) return Promise.resolve(hit.value);
  if (hit) getCache.delete(key);
  const entry = getInFlight.get(key) || startShared(key, path, endpoint, fetchOptions, requireAuth, 0);
  if (!callerSignal) {
    entry.pinned = true;
    return entry.promise;
  }
  entry.waiters += 1;
  return new Promise((resolve) => {
    let done = false;
    const onAbort = () => {
      if (done) return;
      done = true;
      entry.waiters -= 1;
      // Only cancel the network request when nobody else is still waiting for it. Wait one
      // macrotask first so an identical request issued right away (StrictMode effect replay,
      // a re-render restarting the same query) joins it instead of starting a second one.
      setTimeout(() => {
        if (entry.waiters <= 0 && !entry.pinned && !entry.settled) {
          if (getInFlight.get(key) === entry) getInFlight.delete(key);
          entry.stale = true;
          entry.controller.abort();
        }
      }, 0);
      resolve(abortedResult());
    };
    callerSignal.addEventListener('abort', onAbort, { once: true });
    entry.promise.then((value) => {
      if (done) return;
      done = true;
      callerSignal.removeEventListener('abort', onAbort);
      resolve(value);
    });
  });
};

export const apiClient = async (endpoint, options = {}, requireAuth = true) => {
  const method = String(options?.method || 'GET').toUpperCase();
  const { cache = true, ...fetchOptions } = options || {};
  const callerSignal = fetchOptions.signal;
  if (callerSignal?.aborted) return abortedResult();
  const token = await Utils.getData('_TOKEN');
  const identity = token ? fingerprint(token) : '';
  syncIdentity(identity);
  if (method !== 'GET') {
    const prefixes = invalidationPrefixesFor(endpoint, method);
    invalidate(prefixes, { revalidate: true });
    pendingMutations.add(prefixes);
    try {
      return await apiRequest(endpoint, fetchOptions, requireAuth);
    } finally {
      pendingMutations.delete(prefixes);
      invalidate(prefixes, { revalidate: true });
    }
  }
  if (cache === false || fetchOptions.body != null) {
    return apiRequest(endpoint, fetchOptions, requireAuth);
  }
  const path = pathOf(endpoint);
  const { signal: _ignored, ...sharedOptions } = fetchOptions;
  const key = `GET:${requireAuth ? `auth:${identity}` : 'anon'}:${optionsSignature(fetchOptions)}:${endpoint}`;
  const value = await joinShared(key, path, endpoint, sharedOptions, requireAuth, callerSignal);
  return cloneResult(value);
};

const apiRequest = async (
  endpoint,
  options = {},
  requireAuth = true,
) => {
  const { timeoutMs, signal: callerSignal, ...fetchOptions } = options || {};
  const isUpload = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  // Reads get a deadline. Writes (orders, payments, bookings) get none by default: a client-side
  // timeout cannot cancel a write the server already accepted, and the user's retry would
  // duplicate it. Uploads keep a long deadline (re-uploading a file creates no duplicate record).
  const isRead = String(fetchOptions.method || 'GET').toUpperCase() === 'GET';
  const deadline = timeoutMs ?? (isRead ? DEFAULT_TIMEOUT_MS : isUpload ? UPLOAD_TIMEOUT_MS : 0);
  const link = linkSignal(callerSignal, deadline);
  const requestOptions = { ...fetchOptions, signal: link.signal };
  try {
    let token = null;
    if (requireAuth) {
      token = await Utils.getData('_TOKEN');
    }

    let response = await makeRequest(endpoint, requestOptions, token);

    if (requireAuth && response.status === 401) {
      const freshToken = await getFreshToken();
      if (!freshToken) {
        return {
          success: false,
          logout: true,
          message: 'Session expired',
        };
      }
      token = freshToken;
      response = await makeRequest(endpoint, requestOptions, freshToken);
    }

    const data = await parseJsonBody(response);
    if (!data) {
      return {
        success: false,
        status: response.status,
        message: response.ok ? 'Invalid API response' : 'Something went wrong',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: data?.message || data?.detail || 'Something went wrong',
        data,
      };
    }

    return {
      success: true,
      status: response.status,
      ...(data || {}),
    };
  } catch (error) {
    if (link.timedOut()) return timeoutResult();
    if (link.signal.aborted || error?.name === 'AbortError') return abortedResult();
    return {
      success: false,
      message: error?.message || 'Network Error',
    };
  } finally {
    link.cleanup();
  }
};

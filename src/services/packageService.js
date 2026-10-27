import { normalizeApiList } from '../home/catalog';
import { apiClient, invalidateApiCache } from './apiClient';
import { getPatientList, listPatients } from './patientService';

const queryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
};

export const getPackagePlans = (params = {}) =>
  apiClient(`packages/plans/${queryString(params)}`, { method: 'GET' });

export const getPackageKinds = () => apiClient('packages/kinds/', { method: 'GET' });

export const purchasePackage = (packageId, patientId) =>
  apiClient('packages/purchase/', {
    method: 'POST',
    body: JSON.stringify({
      package_id: packageId,
      ...(patientId ? { patient_id: patientId } : {}),
    }),
  });

export const verifyPackagePayment = (payload) =>
  apiClient('packages/verify-payment/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

/**
 * verify-payment body. Like the app it always carries `razorpay_order_id` (empty for autopay
 * subscriptions); subscriptions additionally send `razorpay_subscription_id`.
 */
export const buildPackageVerifyPayload = ({ purchase, response, orderId = '', subscriptionId = '', isSubscription = false }) => ({
  purchase_id: purchase?.id,
  razorpay_order_id: String(response?.razorpay_order_id || orderId || ''),
  ...(isSubscription
    ? { razorpay_subscription_id: String(response?.razorpay_subscription_id || subscriptionId || '') }
    : {}),
  razorpay_payment_id: String(response?.razorpay_payment_id || ''),
  razorpay_signature: String(response?.razorpay_signature || ''),
});

const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const pickFirst = (row, keys) => {
  for (const key of keys) {
    const value = row?.[key] ?? row?.benefits?.[key];
    if (value != null && value !== '' && typeof value !== 'object') return value;
  }
  return null;
};

const pluralise = (n, unit) => `${n} ${unit}${Number(n) === 1 ? '' : 's'}`;

/** "30 days" / "3 months" from whichever validity field the catalog row carries. */
const durationLabel = (row) => {
  const days = Number(pickFirst(row, ['validity_days', 'duration_days', 'validity_in_days', 'valid_for_days']));
  if (Number.isFinite(days) && days > 0) {
    if (days % 365 === 0) return pluralise(days / 365, 'year');
    if (days % 30 === 0) return pluralise(days / 30, 'month');
    return pluralise(days, 'day');
  }
  const months = Number(pickFirst(row, ['validity_months', 'duration_months']));
  if (Number.isFinite(months) && months > 0) return pluralise(months, 'month');
  const text = pickFirst(row, ['validity', 'duration', 'billing_period', 'interval']);
  return text ? String(text).trim() : '';
};

const sessionCount = (row) => {
  const n = Number(
    pickFirst(row, ['total_sessions', 'sessions', 'session_count', 'consultation_count', 'number_of_consultations', 'consultations']),
  );
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const ACTIVE_STATUSES = new Set(['active', 'paid', 'success', 'successful', 'completed', 'captured', 'purchased']);

/** True when a plan row from the catalog already says the signed-in user owns it. */
const rowPurchased = (row) => {
  if (!row) return false;
  const flags = [row.is_purchased, row.purchased, row.already_purchased, row.has_purchased, row.is_active_for_user, row.is_owned];
  if (flags.some((flag) => flag === true)) return true;
  const nested = row.user_purchase || row.current_purchase || row.active_purchase || row.my_purchase;
  if (nested && typeof nested === 'object') return purchaseIsActive(nested);
  const status = String(row.purchase_status || row.user_purchase_status || '').toLowerCase();
  return ACTIVE_STATUSES.has(status);
};

function purchaseIsActive(entry) {
  if (!entry) return false;
  if (entry.is_active === false || entry.active === false) return false;
  const status = String(entry.status || entry.payment_status || '').toLowerCase();
  if (status && !ACTIVE_STATUSES.has(status)) return false;
  const until = entry.expires_at || entry.valid_till || entry.valid_until || entry.expiry_date || entry.end_date;
  if (until) {
    const time = new Date(until).getTime();
    if (Number.isFinite(time) && time < Date.now()) return false;
  }
  return true;
}
/** Plan card shape used by the packages page. Purchase vs consult follows the catalog flags. */
export const mapConsultPackage = (row) => {
  if (!row?.id) return null;
  const includes = Array.isArray(row?.benefits?.includes)
    ? row.benefits.includes.map((line) => String(line || '').trim()).filter(Boolean)
    : [];
  const tags = Array.isArray(row?.tags)
    ? row.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : [];
  const action = String(row.button_action || '').trim();
  const purchaseType = String(row.purchase_type || '').trim();
  const booksConsult =
    action === 'book_consultation' ||
    purchaseType === 'open_plan' ||
    row.available_to_all_users === true;
  const canPurchase =
    action === 'purchase_package' ||
    (!booksConsult && (row.can_be_purchased === true || purchaseType === 'prepaid_package'));
  return {
    id: String(row.id),
    name: String(row.name || '').trim() || 'Package',
    description: String(row.description || '').trim(),
    price: money(row.selling_price),
    mrp: money(row.original_price),
    group: String(row.category_name || 'Packages').trim() || 'Packages',
    categoryCode: String(row.category_code || '').trim(),
    badge: tags[0] || '',
    image: String(row.image_url || '').trim(),
    includes,
    mode: canPurchase ? 'purchase' : 'consult',
    billingMode: String(row.billing_mode || 'one_time'),
    duration: durationLabel(row),
    sessions: sessionCount(row),
    purchased: rowPurchased(row),
  };
};

export async function loadConsultPackages() {
  const collected = [];
  for (let page = 1; page <= 10; page += 1) {
    const res = await getPackagePlans({ page, page_size: 100 });
    if (!res || res.success === false || res.aborted) {
      if (page === 1) {
        const error = new Error(res?.message || 'Could not load consultation packages.');
        error.status = res?.status;
        throw error;
      }
      break;
    }
    const batch = normalizeApiList(res).map(mapConsultPackage).filter(Boolean);
    collected.push(...batch);
    if (!res?.data?.next || !batch.length) break;
  }
  return collected;
}

export async function loadPackageKinds() {
  const res = await getPackageKinds();
  if (!res || res.success === false) return [];
  return normalizeApiList(res)
    .map((kind) => ({
      id: String(kind?.id || kind?.code || kind?.name || ''),
      code: String(kind?.code || '').trim(),
      name: String(kind?.name || '').trim(),
      description: String(kind?.description || '').trim(),
      sequence: Number(kind?.sequence) || 0,
    }))
    .filter((kind) => kind.name);
}

/** One packages/my/ entry reduced to what the UI needs (catalog id via package_id, as in the app). */
export const mapMyPackagePurchase = (entry) => {
  const owned = getPurchasedPackageId(entry);
  const plan = entry?.plan ?? null;
  const planId = owned || entry?.plan_id || (plan && typeof plan === 'object' ? plan.id : plan);
  if (planId == null || planId === '' || typeof planId === 'object') return null;
  const benefit = Array.isArray(entry?.benefits)
    ? entry.benefits.find((b) => b && b.quantity_remaining != null)
    : null;
  const remaining = Number(
    entry.remaining_sessions ?? entry.sessions_remaining ?? entry.remaining ?? benefit?.quantity_remaining,
  );
  return {
    planId: String(planId),
    active: purchaseIsActive(entry),
    remaining: Number.isFinite(remaining) ? remaining : null,
    expiresAt: entry.expires_at || entry.valid_till || entry.valid_until || entry.expiry_date || entry.end_date || '',
  };
};

/**
 * Active purchases of GET packages/my/?status=active (every page), so the "owned" state on
 * Packages does not depend on active plans being on the first page of an unfiltered list.
 */
export async function loadMyPackagePurchases() {
  try {
    const collected = [];
    for (let page = 1; page <= 10; page += 1) {
      const res = await getMyPackages({ status: 'active', page });
      if (!res || res.success === false || res.aborted) {
        if (page === 1) return [];
        break;
      }
      const batch = normalizeApiList(res).map(mapMyPackagePurchase).filter(Boolean);
      collected.push(...batch);
      if (!res?.data?.next || !batch.length) break;
    }
    return collected;
  } catch {
    return [];
  }
}

const LOCAL_KEY = 'ayurmuni__PKG_PURCHASED';

const localOwner = () => {
  try {
    const token = localStorage.getItem('ayurmuni__TOKEN') || '';
    const body = token.split('.')[1];
    if (!body) return 'anon';
    const json = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    return String(json.user_id ?? json.sub ?? json.id ?? 'anon');
  } catch {
    return 'anon';
  }
};

const readLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {};
  } catch {
    return {};
  }
};

/** Plans this account has paid for in this browser (written only after verify-payment succeeds). */
export const getLocallyPurchasedIds = () => new Set(readLocal()[localOwner()] || []);

export const rememberPackagePurchased = (planId) => {
  try {
    const all = readLocal();
    const owner = localOwner();
    all[owner] = Array.from(new Set([...(all[owner] || []), String(planId)]));
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: server state still wins on next load */
  }
};

/** GET packages/my/?page=&status=&search=&id=&doctor_id= (the signed-in user's purchased plans). */
export const getMyPackages = (params = {}) =>
  apiClient(
    `packages/my/${queryString({
      page: params.page ?? 1,
      status: params.status,
      search: params.search,
      id: params.id,
      doctor_id: params.doctor_id,
    })}`,
    { method: 'GET' },
  );

/** A purchase is expired once its status says so or its expiry date has passed. */
export const isPlanExpired = (plan) => {
  if (!plan) return false;
  if (String(plan.status || '').toLowerCase() === 'expired') return true;
  if (!plan.expires_at) return false;
  const time = new Date(plan.expires_at).getTime();
  return Number.isFinite(time) && time < Date.now();
};

/** Catalog package id a purchase belongs to (packages/my/ uses `package_id`; purchase records use `package`). */
export const getPurchasedPackageId = (plan) => {
  const raw = plan?.package_id ?? plan?.package ?? plan?.package_snapshot?.id ?? '';
  return raw == null ? '' : String(raw).trim();
};

export const isSamePackage = (plan, packageId) => {
  const target = packageId == null ? '' : String(packageId).trim();
  const owned = getPurchasedPackageId(plan);
  return Boolean(target) && Boolean(owned) && owned === target;
};

/** Active patient profile id (`is_active_profile`) the purchase is made for, or null. */
export async function getActivePatientId() {
  try {
    const active = listPatients(await getPatientList()).find((item) => item?.is_active_profile);
    return active?.id ? String(active.id) : null;
  } catch {
    return null;
  }
}

const ACTIVE_PLANS_TTL_MS = 60 * 1000;
let activePlansCache = null;
let activePlansInflight = null;

/**
 * Active purchased plans, one request per minute at most; `force` bypasses the cache
 * (used right before buying so the transfer prompt is accurate).
 */
export async function fetchActivePlans(force = false) {
  if (!force && activePlansCache && Date.now() - activePlansCache.at < ACTIVE_PLANS_TTL_MS) {
    return activePlansCache.plans;
  }
  if (activePlansInflight) return activePlansInflight;
  activePlansInflight = (async () => {
    try {
      const res = await getMyPackages({ status: 'active' });
      if (!res?.success) return activePlansCache?.plans ?? [];
      const plans = normalizeApiList(res).filter((plan) => String(plan?.status || '').toLowerCase() === 'active');
      activePlansCache = { plans, at: Date.now() };
      return plans;
    } catch {
      return activePlansCache?.plans ?? [];
    } finally {
      activePlansInflight = null;
    }
  })();
  return activePlansInflight;
}

export const invalidateActivePlans = () => {
  activePlansCache = null;
};

/** Drop cached package reads so the next load reflects the new purchase. */
export const refreshPackageCache = () => {
  invalidateActivePlans();
  invalidateApiCache(['packages/']);
};

/** Plans (+ the user's purchases) with `purchased` / `remaining` resolved on every item. */
export async function loadPackagesWithStatus() {
  const [plans, mine] = await Promise.all([loadConsultPackages(), loadMyPackagePurchases()]);
  const local = getLocallyPurchasedIds();
  const activeMine = new Map(mine.filter((entry) => entry.active).map((entry) => [entry.planId, entry]));
  return plans.map((plan) => {
    const owned = activeMine.get(plan.id);
    return {
      ...plan,
      purchased: Boolean(plan.purchased || owned || local.has(plan.id)),
      remaining: owned?.remaining ?? null,
      expiresAt: owned?.expiresAt || '',
    };
  });
}

/** There is no packages/plans/:id/ endpoint (404), so the detail page reads the catalog list. */
export async function loadPackageById(id) {
  const plans = await loadPackagesWithStatus();
  return plans.find((plan) => plan.id === String(id)) || null;
}
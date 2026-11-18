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

/** POST packages/purchase/ { package_id, patient_id?, payment_gateway? (cashfree default | razorpay) }. */
export const purchasePackage = (packageId, patientId, paymentGateway) =>
  apiClient('packages/purchase/', {
    method: 'POST',
    body: JSON.stringify({
      package_id: packageId,
      ...(patientId ? { patient_id: patientId } : {}),
      ...(paymentGateway ? { payment_gateway: paymentGateway } : {}),
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
  const lines = (value) =>
    Array.isArray(value) ? value.map((line) => String(line || '').trim()).filter(Boolean) : [];
  const includes = lines(row?.benefits?.includes);
  const feeRow = row.fees && typeof row.fees === 'object' ? row.fees : null;
  const price = money(feeRow?.selling_price ?? row.selling_price);
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
    price,
    mrp: money(row.original_price),
    fees: {
      selling: price,
      gstPercent: money(feeRow?.gst_percent),
      gstAmount: money(feeRow?.gst_amount),
      platformFeePercent: money(feeRow?.platform_fee_percent),
      platformFee: money(feeRow?.platform_fee),
      totalPayable: money(feeRow?.total_payable_amount ?? price),
    },
    notIncluded: lines(row.not_included),
    disclaimer: lines(row.disclaimer),
    group: String(row.category_name || 'Packages').trim() || 'Packages',
    categoryCode: String(row.category_code || '').trim(),
    badge: tags[0] || '',
    image: String(row.image_url || '').trim(),
    includes,
    mode: canPurchase ? 'purchase' : 'consult',
    billingMode: String(row.billing_mode || 'one_time'),
    billingPeriod: String(row.billing_period || '').trim(),
    billingInterval: Number(row.billing_interval) || 1,
    purchaseType,
    canBePurchased: row.can_be_purchased === true || purchaseType === 'prepaid_package',
    buttonAction: action,
    availableToAll: row.available_to_all_users !== false,
    validityDays: Number(pickFirst(row, ['validity_days', 'duration_days', 'validity_in_days', 'valid_for_days'])) || 0,
    duration: durationLabel(row),
    sessions: sessionCount(row),
    // Catalog cards stay buyable. Ownership lives on each purchase in My Plans.
    purchased: false,
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
  const total = Number(
    entry.quantity_total ??
      entry.total_sessions ??
      entry.sessions ??
      benefit?.quantity_total ??
      benefit?.total_sessions ??
      benefit?.sessions,
  );
  return {
    planId: String(planId),
    active: purchaseIsActive(entry),
    remaining: Number.isFinite(remaining) ? remaining : null,
    total: Number.isFinite(total) && total > 0 ? total : null,
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
      page_size: params.page_size,
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

/** Every page of packages/my/ for the given filters. A failed first page throws. */
export async function loadPackagePurchasePages(params = {}) {
  const collected = [];
  for (let page = 1; page <= 10; page += 1) {
    const res = await getMyPackages({ ...params, page });
    if (!res || res.success === false || res.aborted) {
      if (page === 1) {
        const error = new Error(res?.message || 'Unable to load packages');
        error.failed = true;
        throw error;
      }
      break;
    }
    const batch = normalizeApiList(res);
    collected.push(...batch);
    if (!res?.data?.next || !batch.length) break;
  }
  return collected;
}

/**
 * Active purchased plans, one request sequence per minute at most.
 * `force` bypasses the cache. Every page is included so later purchases stay selectable.
 */
export async function fetchActivePlans(force = false) {
  if (!force && activePlansCache && Date.now() - activePlansCache.at < ACTIVE_PLANS_TTL_MS) {
    return activePlansCache.plans;
  }
  if (activePlansInflight) return activePlansInflight;
  activePlansInflight = (async () => {
    try {
      const rows = await loadPackagePurchasePages({ status: 'active' });
      const plans = rows.filter((plan) => String(plan?.status || '').toLowerCase() === 'active');
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

/**
 * Catalog plans only. Purchases are not folded onto the card: two buys of the same
 * package stay independent and the card stays buyable.
 */
export async function loadPackagesWithStatus() {
  const plans = await loadConsultPackages();
  return plans.map((plan) => ({
    ...plan,
    purchased: false,
    remaining: null,
    total: plan.sessions > 0 ? plan.sessions : null,
    expiresAt: '',
  }));
}

/** There is no packages/plans/:id/ endpoint (404), so the detail page reads the catalog list. */
export async function loadPackageById(id) {
  const plans = await loadPackagesWithStatus();
  return plans.find((plan) => plan.id === String(id)) || null;
}

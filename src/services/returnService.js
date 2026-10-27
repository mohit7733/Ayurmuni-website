// Order returns (ported from the app's ReturnService.ts, origin/development).
// Endpoints: order/{id}/return-eligibility/, order/{id}/returns/, order/returns/, order/returns/{id}/
import { apiClient } from './apiClient';
import { UploadProfilePhoto } from './profileService';
import { extractUploadUrl } from './prescriptionService';

export const RETURN_UPLOAD_DIR = 'return_files';
export const MAX_RETURN_MEDIA = 4;

// ---- Reasons ----

/** Labels for backend reason codes (`exception_reasons` on eligibility items). */
export const RETURN_REASONS = [
  { code: 'damaged_product', label: 'Product arrived damaged' },
  { code: 'incorrect_product', label: 'Received wrong / incorrect product' },
  { code: 'tampered_product', label: 'Package or seal was tampered' },
  { code: 'expired_product', label: 'Product is expired or near expiry' },
  { code: 'material_defect', label: 'Manufacturing / material defect' },
  { code: 'incorrect_fulfilment', label: 'Wrong quantity or item missing' },
  { code: 'other', label: 'Other' },
];

const humanizeCode = (code) => String(code).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Reason options for the picker: backend codes first, then "Other". */
export const buildReasonOptions = (codes = []) => {
  if (!codes.length) return RETURN_REASONS;
  const options = codes.map((code) => ({
    code,
    label: RETURN_REASONS.find((reason) => reason.code === code)?.label ?? humanizeCode(code),
  }));
  return [...options, { code: 'other', label: 'Other' }];
};

export const getReasonLabel = (code, fallback = '') =>
  RETURN_REASONS.find((reason) => reason.code === code)?.label ?? fallback;

// ---- Helpers ----

const isTrue = (value) => value === true || value === 'true' || value === 1 || value === '1';

const str = (...values) => {
  for (const value of values) {
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
};

const num = (...values) => {
  for (const value of values) {
    const n = Number(value);
    if (value != null && value !== '' && Number.isFinite(n)) return n;
  }
  return 0;
};

const unwrap = (response) => response?.data?.data ?? response?.data ?? response ?? {};

export const isCodOrder = (order) => {
  const method = str(order?.payment_method, order?.payment_type, order?.payment_mode).toLowerCase();
  return isTrue(order?.is_cod) || method === 'cod' || method.includes('cash');
};

// ---- Eligibility ----

const mapEligibilityItem = (item, orderItems) => {
  const orderItemId = str(item?.order_item_id, item?.id, item?.item_id);
  const variantId = str(item?.variant_id);
  const orderLine =
    orderItems.find((line) => str(line?.id, line?.order_item_id) === orderItemId) ??
    (variantId
      ? orderItems.find(
          (line) => str(line?.variant_id, line?.variant?.id, line?.variant?.variant_id) === variantId,
        )
      : undefined) ??
    item?.order_item ??
    {};
  const quantity = num(item?.ordered_quantity, item?.quantity, orderLine?.quantity, 1) || 1;
  const returnableQuantity = num(
    item?.available_quantity,
    item?.returnable_quantity,
    item?.eligible_quantity,
    item?.max_return_quantity,
    item?.remaining_quantity,
    quantity,
  );
  const eligible = item?.eligible != null ? isTrue(item.eligible) : isTrue(item?.is_eligible);
  return {
    orderItemId,
    name: str(
      item?.product_name,
      item?.variant_title,
      item?.variant?.variant_title,
      orderLine?.variant?.variant_title,
      orderLine?.product_name,
      orderLine?.name,
      item?.sku_code,
      'Product',
    ),
    image:
      str(
        item?.image,
        item?.image_url,
        item?.variant?.image,
        orderLine?.variant?.image,
        orderLine?.variant?.images?.[0]?.image_url,
        orderLine?.image,
        orderLine?.image_url,
        orderLine?.variant?.image_url,
      ) || undefined,
    quantity,
    returnableQuantity: eligible ? Math.max(1, Math.min(returnableQuantity, quantity)) : 0,
    price: num(item?.selling_price, item?.price, orderLine?.selling_price, orderLine?.price),
    eligible,
    reason: str(
      item?.reason,
      item?.message,
      item?.ineligible_reason,
      item?.ineligibility_reason,
      eligible ? '' : 'Not eligible for return',
    ),
    allowedReasons: Array.isArray(item?.exception_reasons)
      ? item.exception_reasons.map((code) => String(code)).filter(Boolean)
      : [],
    windowEndsAt: str(item?.window_ends_at, item?.return_window_ends_at),
    raw: item,
  };
};

export const normalizeReturnEligibility = (response, order) => {
  const data = unwrap(response);
  const orderItems = Array.isArray(order?.items) ? order.items : [];
  const rawItems = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.eligible_items)
      ? [
          ...data.eligible_items.map((item) => ({ ...item, eligible: item?.eligible ?? true })),
          ...(Array.isArray(data?.ineligible_items)
            ? data.ineligible_items.map((item) => ({ ...item, eligible: false }))
            : []),
        ]
      : [];

  const items = rawItems.map((item) => mapEligibilityItem(item, orderItems));
  const eligible = data?.eligible != null ? isTrue(data.eligible) : items.some((item) => item.eligible);
  const allowedReasons = Array.from(new Set(items.flatMap((item) => item.allowedReasons)));
  const latestWindow = items
    .map((item) => item.windowEndsAt)
    .filter(Boolean)
    .sort()
    .pop();

  return {
    eligible,
    // Envelope message ("...retrieved successfully") is not a user-facing reason.
    message: str(
      data?.message,
      data?.reason,
      !eligible && items.length ? 'None of the items in this order can be returned right now.' : '',
    ),
    isCod:
      isTrue(data?.is_cod) ||
      str(data?.payment_method, data?.payment_type).toLowerCase() === 'cod' ||
      (data?.is_cod == null && isCodOrder(order)),
    refundMode: str(data?.refund_mode, data?.refund_method),
    returnWindowEndsAt: str(
      data?.return_window_ends_at,
      data?.return_window_end,
      data?.return_deadline,
      latestWindow,
    ),
    allowedReasons,
    orderCode: str(data?.order_code, order?.order_code),
    deliveredAt: str(data?.delivered_at, order?.delivered_at),
    items,
    raw: data,
  };
};

/** GET order/{order_id}/return-eligibility/?reason_code= */
export const getReturnEligibility = async (orderId, reasonCode) => {
  const qs = reasonCode ? `?reason_code=${encodeURIComponent(reasonCode)}` : '';
  return apiClient(`order/${encodeURIComponent(String(orderId))}/return-eligibility/${qs}`, {
    method: 'GET',
  });
};

// ---- Create ----

/** POST order/{order_id}/returns/ (invalidates only `order/` GETs, see apiClient MUTATION rules). */
export const createReturnRequest = async (orderId, payload) =>
  apiClient(`order/${encodeURIComponent(String(orderId))}/returns/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

/** Builds the POST body exactly as the app does. */
export const buildReturnPayload = ({
  reasonCode,
  reasonText,
  reasonLabel,
  selected,
  mediaUrls = [],
  isCod = false,
  refundMethod = 'upi',
  upiId = '',
  holderName = '',
  accountNumber = '',
  ifsc = '',
}) => {
  const text = String(reasonText || '').trim();
  const payload = {
    reason: reasonCode === 'other' ? text : text || reasonLabel || '',
    ...(reasonCode && reasonCode !== 'other' ? { reason_code: reasonCode } : {}),
    items: Object.keys(selected || {})
      .filter((id) => selected[id] > 0)
      .map((id) => ({ order_item_id: id, quantity: selected[id] })),
    media: mediaUrls.filter(Boolean).map((url) => ({ media_url: url, media_type: 'image' })),
  };
  if (isCod && refundMethod === 'upi') {
    payload.upi_id = String(upiId).trim();
  } else if (isCod && refundMethod === 'bank') {
    payload.account_holder_name = String(holderName).trim();
    payload.account_number = String(accountNumber).trim();
    payload.ifsc_code = String(ifsc).trim().toUpperCase();
  }
  return payload;
};

/** Uploads one browser File to user/upload/ (dir return_files) and returns its URL. */
export const uploadReturnMedia = async (file) => {
  if (!file) throw new Error('Missing file');
  const body = new FormData();
  body.append('image', file, file?.name || `return_${Date.now()}.jpg`);
  body.append('dir', RETURN_UPLOAD_DIR);
  const response = await UploadProfilePhoto(body);
  const url = extractUploadUrl(response);
  if (response?.success === false || !url) {
    throw new Error(response?.message || 'Upload failed');
  }
  return url;
};

// ---- List / detail ----

export const normalizeReturnRequest = (raw) => ({
  id: str(raw?.id),
  orderId: str(raw?.order_id, raw?.order?.id),
  orderCode: str(raw?.order_code, raw?.order?.order_code),
  status: str(raw?.status, 'requested').toLowerCase(),
  reason: str(raw?.reason),
  reasonCode: str(raw?.reason_code),
  reviewNote: str(raw?.review_note),
  reviewedAt: str(raw?.reviewed_at),
  reversePickupCode: str(raw?.unicommerce_reverse_pickup_code, raw?.reverse_pickup_code),
  refundDetails: raw?.refund_details ?? {},
  refundRequest: raw?.refund_request ?? null,
  items: (Array.isArray(raw?.items) ? raw.items : []).map((item) => ({
    id: str(item?.id),
    orderItemId: str(item?.order_item_id),
    quantity: num(item?.quantity, 1),
    skuCode: str(item?.sku_code),
    variantId: str(item?.variant_id),
    sellingPrice: num(item?.selling_price),
  })),
  media: Array.isArray(raw?.media) ? raw.media : [],
  createdAt: str(raw?.created_at),
  updatedAt: str(raw?.updated_at),
  raw,
});

export const normalizeReturnList = (response) => {
  if (response?.success === false) return [];
  const data = response?.data;
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.data?.results)
        ? data.data.results
        : Array.isArray(data?.data)
          ? data.data
          : [];
  return list.map(normalizeReturnRequest);
};

export const hasMoreReturnPages = (response) => {
  const next = response?.data?.next ?? response?.data?.data?.next;
  return next != null && next !== '';
};

/** Newest first (the app sorts by createdAt desc). */
export const sortReturnsNewestFirst = (list) =>
  [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

/** GET order/{order_id}/returns/ - return requests for one order. */
export const getOrderReturns = async (orderId) =>
  apiClient(`order/${encodeURIComponent(String(orderId))}/returns/`, { method: 'GET' });

/** GET order/returns/ - every return request of the customer. */
export const getAllReturns = async (params = {}) => {
  const parts = [];
  if (params.page) parts.push(`page=${params.page}`);
  if (params.page_size) parts.push(`page_size=${params.page_size}`);
  return apiClient(`order/returns/${parts.length ? `?${parts.join('&')}` : ''}`, { method: 'GET' });
};

/** GET order/returns/{return_id}/ -> { data: normalized return | null, error: string }. */
export const getReturnById = async (returnId) => {
  const response = await apiClient(`order/returns/${encodeURIComponent(String(returnId))}/`, {
    method: 'GET',
  });
  if (response?.success === false) {
    return { data: null, error: response?.message || 'Could not load return request.' };
  }
  const data = unwrap(response);
  return {
    data: data && typeof data === 'object' && data.id ? normalizeReturnRequest(data) : null,
    error: '',
  };
};

// ---- Status display ----
// `tone` maps to the website Badge / StatusPill tones (the app uses raw colors).

export const RETURN_STATUS_META = {
  requested: { label: 'Requested', tone: 'warning', hint: 'We are reviewing your request.' },
  pending: { label: 'Under review', tone: 'warning', hint: 'We are reviewing your request.' },
  approved: { label: 'Approved', tone: 'info', hint: 'Pickup will be scheduled soon.' },
  pickup_scheduled: { label: 'Pickup scheduled', tone: 'info', hint: 'Keep the items packed for pickup.' },
  picked_up: { label: 'Picked up', tone: 'info', hint: 'Items are on their way back to us.' },
  received: { label: 'Received', tone: 'info', hint: 'Items received. Refund is being processed.' },
  refund_initiated: { label: 'Refund initiated', tone: 'success', hint: 'Refund has been initiated.' },
  refunded: { label: 'Refunded', tone: 'success', hint: 'Refund completed.' },
  completed: { label: 'Completed', tone: 'success', hint: 'Return completed.' },
  rejected: { label: 'Rejected', tone: 'danger', hint: 'Your return request was rejected.' },
  cancelled: { label: 'Cancelled', tone: 'neutral', hint: 'This return request was cancelled.' },
};

export const getReturnStatusMeta = (status) =>
  RETURN_STATUS_META[status] ?? {
    label: status
      ? String(status)
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Requested',
    tone: 'neutral',
    hint: '',
  };

/** Ordered progress steps shown on the return detail timeline. */
export const RETURN_STEPS = [
  { key: 'requested', label: 'Return requested' },
  { key: 'approved', label: 'Approved' },
  { key: 'picked_up', label: 'Picked up' },
  { key: 'received', label: 'Received at warehouse' },
  { key: 'refunded', label: 'Refund completed' },
];

const STEP_INDEX = {
  requested: 0,
  pending: 0,
  approved: 1,
  pickup_scheduled: 1,
  picked_up: 2,
  received: 3,
  refund_initiated: 3,
  refunded: 4,
  completed: 4,
};

export const getReturnStepIndex = (status) => STEP_INDEX[status] ?? 0;

export const REFUND_STAGES = ['Return approved', 'Refund initiated', 'Credited'];

/** Where the refund currently is (0 pending, 1 processing, 2 credited). */
export const getRefundStage = (returnStatus, refundStatus = '') => {
  const rs = String(refundStatus).toLowerCase();
  if (['success', 'processed', 'completed', 'refunded', 'credited'].includes(rs)) return 2;
  if (rs) return 1;
  if (returnStatus === 'refunded' || returnStatus === 'completed') return 2;
  if (returnStatus === 'refund_initiated') return 1;
  return 0;
};

// ---- History tab (filters / search) ----

export const RETURN_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'In progress' },
  { key: 'refunded', label: 'Refunded' },
  { key: 'rejected', label: 'Rejected' },
];

export const RETURN_GROUPS = {
  active: ['requested', 'pending', 'approved', 'pickup_scheduled', 'picked_up', 'received', 'refund_initiated'],
  refunded: ['refunded', 'completed'],
  rejected: ['rejected', 'cancelled'],
};

/** Orders that can carry return requests (used when the all-returns endpoint is unavailable). */
export const RETURNABLE_ORDER_STATUSES = ['delivered', 'completed', 'returned'];

export const filterReturns = (returns, filter = 'all', search = '') => {
  let list = returns;
  if (filter !== 'all' && RETURN_GROUPS[filter]) {
    list = list.filter((ret) => RETURN_GROUPS[filter].includes(ret.status));
  }
  const q = String(search || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((ret) =>
    [
      ret.orderCode,
      String(ret.orderCode || '').replace(/^ORD-/i, ''),
      ret.reason,
      getReasonLabel(ret.reasonCode),
      getReturnStatusMeta(ret.status).label,
      ret.reversePickupCode,
    ].some((value) => String(value || '').toLowerCase().includes(q)),
  );
};

export const countReturns = (returns) => {
  const counts = { all: returns.length, active: 0, refunded: 0, rejected: 0 };
  returns.forEach((ret) => {
    Object.keys(RETURN_GROUPS).forEach((key) => {
      if (RETURN_GROUPS[key].includes(ret.status)) counts[key] += 1;
    });
  });
  return counts;
};

/**
 * All of the customer's returns: GET order/returns/ first; if that endpoint fails, fall back to
 * the per-order lists of delivered / completed / returned orders (first 20), as the app does.
 */
export const loadAllReturns = async (orders = []) => {
  let list = [];
  let allOk = false;
  try {
    const res = await getAllReturns({ page_size: 50 });
    if (res?.success !== false) {
      list = normalizeReturnList(res);
      allOk = true;
    }
  } catch {
    allOk = false;
  }
  if (!allOk) {
    const candidates = orders
      .filter((order) => RETURNABLE_ORDER_STATUSES.includes(String(order?.status ?? '').toLowerCase()))
      .slice(0, 20);
    const results = await Promise.all(
      candidates.map((order) =>
        getOrderReturns(order?.raw?.id ?? order?.id)
          .then(normalizeReturnList)
          .catch(() => []),
      ),
    );
    list = results.flat();
  }
  return sortReturnsNewestFirst(list);
};

// ---- Validation ----

export const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ACCOUNT_RE = /^\d{9,18}$/;

export const maskAccount = (value) => {
  const v = String(value || '');
  return v.length > 4 ? `**** ${v.slice(-4)}` : v;
};

/** Form validation, same rules and messages as the app's ReturnRequestScreen. */
export const validateReturnForm = ({
  reasonCode,
  reasonText,
  selectedCount,
  isCod,
  refundMethod,
  upiId,
  holderName,
  accountNumber,
  confirmAccount,
  ifsc,
}) => {
  const bank = isCod && refundMethod === 'bank';
  return {
    reason: !reasonCode
      ? 'Select a reason'
      : reasonCode === 'other' && String(reasonText || '').trim().length < 5
        ? 'Describe the issue (min 5 characters)'
        : '',
    items: selectedCount === 0 ? 'Select at least one item to return' : '',
    upi:
      isCod && refundMethod === 'upi' && !UPI_RE.test(String(upiId || '').trim())
        ? 'Enter a valid UPI ID (e.g. name@bank)'
        : '',
    holder: bank && String(holderName || '').trim().length < 3 ? 'Enter account holder name' : '',
    account: bank && !ACCOUNT_RE.test(String(accountNumber || '').trim())
      ? 'Enter a valid account number (9-18 digits)'
      : '',
    confirm:
      bank && String(confirmAccount || '').trim() !== String(accountNumber || '').trim()
        ? 'Account numbers do not match'
        : '',
    ifsc: bank && !IFSC_RE.test(String(ifsc || '').trim().toUpperCase())
      ? 'Enter a valid IFSC (e.g. HDFC0001234)'
      : '',
  };
};

// ---- Refund source label (prepaid orders) ----

const SOURCE_LABELS = {
  razorpay: 'Razorpay',
  cashfree: 'Cashfree',
  icici: 'ICICI PayPhi',
  upi: 'UPI',
  card: 'Card',
  credit_card: 'Credit card',
  debit_card: 'Debit card',
  netbanking: 'Net banking',
  wallet: 'Wallet',
  online: 'Online payment',
  prepaid: 'Online payment',
};

/** Human label for where a prepaid refund goes back to, e.g. "UPI via Razorpay". */
export const getPaymentSourceLabel = (order, refundMode) => {
  const label = (value) => {
    const key = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    if (!key) return '';
    return SOURCE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
  };
  const instrument = label(
    refundMode || order?.payment_instrument || order?.payment_details?.method || order?.payment?.method,
  );
  const gateway = label(order?.payment_gateway || order?.gateway || order?.payment_method || order?.payment_type);
  if (instrument && gateway && instrument !== gateway) return `${instrument} via ${gateway}`;
  return instrument || gateway || 'Original payment method';
};

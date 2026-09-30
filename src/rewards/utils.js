import { formatRupee } from '../home/catalog';

const pickList = (response, extraKeys = []) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data;
  for (const key of ['results', 'rewards', 'items', 'coupons', ...extraKeys]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
};

const parseDateMs = (value) => {
  if (!value) return null;
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) ? null : ms;
};

const toNumberOrNull = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const isCouponCurrentlyVisible = (raw) => {
  if (!raw || typeof raw !== 'object') return false;
  if (raw.is_deleted === true || raw.deleted === true || raw.deleted_at) return false;
  if (raw.is_active === false || raw.active === false) return false;
  const status = String(raw.status || '').toLowerCase();
  if (
    status === 'inactive' ||
    status === 'deleted' ||
    status === 'expired' ||
    status === 'draft' ||
    status === 'revoked' ||
    status === 'used_up'
  ) {
    return false;
  }
  const now = Date.now();
  const starts = parseDateMs(raw.starts_at || raw.start_at || raw.valid_from);
  const expires = parseDateMs(raw.expires_at || raw.expiry || raw.valid_till || raw.valid_until);
  if (starts != null && starts > now) return false;
  if (expires != null && expires < now) return false;
  const visibility = String(raw.visibility || 'general').toLowerCase();
  if (visibility === 'private') {
    const remaining = toNumberOrNull(
      raw.remaining_uses ??
        raw.uses_remaining ??
        raw.grant?.remaining_uses ??
        raw.customer_grant?.remaining_uses,
    );
    if (remaining != null && remaining <= 0) return false;
  }
  return true;
};

const parseAppliesTo = (raw) => {
  const value = String(
    raw.applies_to || raw.applicable_on || raw.applicable_to || raw.scope || '',
  )
    .toLowerCase()
    .trim();
  if (!value || value === 'both' || value === 'all' || value === 'any' || value.includes('both')) {
    return 'both';
  }
  if (
    value === 'consult' ||
    value === 'consultation' ||
    value.includes('consult') ||
    value.includes('appointment')
  ) {
    return 'consultation';
  }
  if (
    value === 'order' ||
    value === 'orders' ||
    value === 'product' ||
    value === 'products' ||
    value.includes('order') ||
    value.includes('product')
  ) {
    return 'order';
  }
  return 'both';
};

const appliesToScope = (appliesTo) => {
  if (appliesTo === 'consultation') return 'consultation';
  if (appliesTo === 'order') return 'product';
  return 'all';
};

export const normalizeCoupon = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  if (!isCouponCurrentlyVisible(raw)) return null;
  const nested = raw.coupon && typeof raw.coupon === 'object' ? raw.coupon : null;
  const src = nested || raw;
  const code = String(src.code || src.coupon_code || src.name || '')
    .trim()
    .toUpperCase();
  if (!code) return null;
  const typeRaw = String(src.discount_type || src.type || src.offer_type || 'flat').toLowerCase();
  const discount_type =
    typeRaw.includes('percent') || typeRaw.includes('%') ? 'percent' : 'flat';
  const discount_value = Number(src.discount_value ?? src.value ?? src.amount ?? src.discount ?? 0);
  if (!Number.isFinite(discount_value) || discount_value <= 0) return null;
  const applies_to = parseAppliesTo(src);
  const max_discount = toNumberOrNull(
    src.max_discount_amount ?? src.max_discount ?? src.max_cap ?? src.max_amount,
  );
  const min_amount = toNumberOrNull(src.min_amount ?? src.min_order_amount ?? src.min_order) || 0;
  const remaining_uses = toNumberOrNull(
    raw.remaining_uses ?? raw.uses_remaining ?? raw.grant?.remaining_uses ?? src.remaining_uses,
  );
  const description = String(src.description || src.subtitle || src.details || '').trim();
  const title = String(
    src.title ||
      src.name ||
      description ||
      (discount_type === 'percent'
        ? `${discount_value}% off`
        : `Flat ${formatRupee(discount_value)} off`),
  ).trim();
  return {
    id: String(src.id || raw.id || code),
    code,
    title,
    description,
    image_url: src.image_url || src.image || src.banner_url || src.logo_url || null,
    discount_type,
    discount_value,
    min_amount,
    min_order_amount: min_amount,
    max_discount,
    applicable_on: appliesToScope(applies_to),
    applies_to,
    visibility: String(src.visibility || raw.visibility || 'general')
      .toLowerCase()
      .includes('private')
      ? 'private'
      : 'general',
    source: String(src.source || raw.source || 'campaign').toLowerCase(),
    brand_id: src.brand_id != null && src.brand_id !== '' ? String(src.brand_id) : null,
    service_category_id:
      src.service_category_id != null && src.service_category_id !== ''
        ? String(src.service_category_id)
        : null,
    starts_at: src.starts_at || src.start_at || src.valid_from || null,
    expires_at: src.expires_at || src.expiry || src.valid_till || src.valid_until || null,
    remaining_uses,
    max_uses_per_customer: toNumberOrNull(src.max_uses_per_customer),
  };
};

export const parseCouponList = (response) => {
  const seen = new Set();
  return pickList(response)
    .map(normalizeCoupon)
    .filter((item) => {
      if (!item) return false;
      const key = item.id || item.code;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const couponMatchesScope = (coupon, scope) => {
  if (!coupon) return false;
  if (scope === 'all') return true;
  const applies = coupon.applies_to;
  if (applies === 'both') return true;
  if (scope === 'product') return applies === 'order';
  if (scope === 'consultation') return applies === 'consultation';
  return false;
};

export const calcCouponDiscount = (coupon, subtotal) => {
  if (!coupon) return { ok: false, discount: 0, error: 'Enter a coupon code' };
  const amount = Number(subtotal) || 0;
  if (amount <= 0) {
    return { ok: false, discount: 0, error: 'Add items before applying a coupon' };
  }
  const minAmount = Number(coupon.min_amount || coupon.min_order_amount || 0);
  if (minAmount > 0 && amount < minAmount) {
    return {
      ok: false,
      discount: 0,
      error: `Add items worth ${formatRupee(minAmount)} or more to use this coupon`,
    };
  }
  let discount =
    coupon.discount_type === 'percent'
      ? (amount * coupon.discount_value) / 100
      : coupon.discount_value;
  if (coupon.max_discount != null && coupon.max_discount > 0) {
    discount = Math.min(discount, coupon.max_discount);
  }
  discount = Math.min(Math.max(0, Math.round(discount)), amount);
  if (discount <= 0) {
    return { ok: false, discount: 0, error: 'Coupon is not valid for this amount' };
  }
  return { ok: true, discount };
};

export const findCouponByCode = (coupons, code) => {
  const key = String(code || '').trim().toUpperCase();
  if (!key) return null;
  return (coupons || []).find((item) => item.code === key) || null;
};

export const isCheckoutSourceCoupon = (coupon) =>
  String(coupon?.source || '').toLowerCase() === 'admin';

export const couponOfferTitle = (coupon) => {
  if (coupon.discount_type === 'percent') {
    const pct = Math.round(coupon.discount_value);
    if (coupon.max_discount != null && coupon.max_discount > 0) {
      return `Tap To Apply: ${pct}% Off up to ${formatRupee(coupon.max_discount)}`;
    }
    return `Tap To Apply: ${pct}% Off`;
  }
  return `Tap To Apply: Flat ${formatRupee(coupon.discount_value)} Off`;
};

export const couponSavingsLabel = (coupon) => {
  if (coupon.discount_type === 'percent') {
    if (coupon.max_discount != null && coupon.max_discount > 0) {
      return `${coupon.discount_value}% off up to ${formatRupee(coupon.max_discount)}`;
    }
    return `${coupon.discount_value}% off`;
  }
  return `Flat ${formatRupee(coupon.discount_value)} off`;
};

export const couponMinNote = (coupon) => {
  const min = Number(coupon.min_amount || coupon.min_order_amount || 0);
  if (min <= 0) return '';
  return `Min bill ${formatRupee(min)}`;
};

export const couponMaxNote = (coupon) => {
  if (coupon.discount_type === 'percent' && coupon.max_discount != null && coupon.max_discount > 0) {
    return `Up to ${formatRupee(coupon.max_discount)}`;
  }
  return '';
};

export const couponAppliesLabel = (coupon) => {
  if (coupon.applies_to === 'order') return 'Orders';
  if (coupon.applies_to === 'consultation') return 'Consultations';
  return 'Orders & consultations';
};

export const couponExpiryLabel = (coupon) => {
  if (!coupon.expires_at) return '';
  const date = new Date(coupon.expires_at);
  if (Number.isNaN(date.getTime())) return '';
  return `Valid till ${date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
};

export const couponSourceLabel = (source) => {
  const key = String(source || '').toLowerCase();
  if (key === 'referral') return 'Referral';
  if (key === 'reward') return 'Reward';
  if (key === 'loyalty') return 'Loyalty';
  if (key === 'admin') return 'Special';
  if (key === 'campaign') return 'Campaign';
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Offer';
};

export const normalizeReward = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const coupon = normalizeCoupon(raw.coupon) || null;
  const title = String(
    raw.rule_name || raw.title || raw.name || coupon?.title || coupon?.code || '',
  ).trim();
  if (!title && !coupon) return null;
  const pointsRaw = raw.points ?? raw.coins ?? raw.reward_points ?? raw.amount ?? null;
  const trigger = String(raw.trigger || '').toLowerCase();
  const source = String(raw.source || coupon?.source || trigger || 'reward').toLowerCase();
  return {
    id: String(raw.id || coupon?.id || title),
    title: title || 'Reward',
    description: String(coupon?.description || raw.description || raw.subtitle || '').trim(),
    image_url: coupon?.image_url || raw.image_url || raw.image || null,
    points: pointsRaw == null || pointsRaw === '' ? null : Number(pointsRaw) || null,
    status: String(raw.status || 'granted'),
    trigger,
    payout_type: String(raw.payout_type || (coupon ? 'coupon' : '')).toLowerCase(),
    expires_at: coupon?.expires_at || raw.expires_at || null,
    source,
    created_at: raw.created_at || null,
    coupon,
  };
};

export const parseRewardList = (response) => {
  const seen = new Set();
  return pickList(response)
    .map(normalizeReward)
    .filter((item) => {
      if (!item) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
};

export const isRewardsScreenItem = (reward) => {
  const source = String(reward.source || '').toLowerCase();
  const couponSource = String(reward.coupon?.source || '').toLowerCase();
  const trigger = String(reward.trigger || '').toLowerCase();
  return (
    source === 'referral' ||
    source === 'reward' ||
    couponSource === 'referral' ||
    couponSource === 'reward' ||
    trigger === 'referral' ||
    trigger === 'reward'
  );
};

export const couponThemeIndex = (codeOrId) => {
  const key = String(codeOrId || '')
    .trim()
    .toUpperCase();
  if (!key) return 0;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % 4;
};

export const triggerLabel = (trigger) => {
  const key = String(trigger || '').toLowerCase();
  if (key === 'referral') return 'Referral';
  if (key === 'register' || key === 'signup') return 'Welcome';
  if (key === 'order') return 'Order';
  if (key === 'loyalty') return 'Loyalty';
  return couponSourceLabel(key || 'reward');
};

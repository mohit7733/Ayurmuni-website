import { apiClient } from './apiClient';
import {
  calcCouponDiscount,
  couponMatchesScope,
  normalizeCoupon,
  parseCouponList,
} from '../rewards/utils';

const pickErrorMessage = (response) => {
  const data = response?.data ?? response ?? {};
  if (typeof data === 'string' && data.trim()) return data.trim();
  const fieldErrors = data?.errors || data?.error || data?.non_field_errors || data?.detail;
  if (Array.isArray(fieldErrors) && fieldErrors.length) return String(fieldErrors[0]);
  if (typeof fieldErrors === 'string' && fieldErrors.trim()) return fieldErrors.trim();
  if (fieldErrors && typeof fieldErrors === 'object') {
    const firstKey = Object.keys(fieldErrors)[0];
    const firstVal = firstKey ? fieldErrors[firstKey] : null;
    if (Array.isArray(firstVal) && firstVal[0]) return String(firstVal[0]);
    if (typeof firstVal === 'string') return firstVal;
  }
  return response?.message || data?.message || data?.detail || 'Invalid coupon code';
};

export const getCoupons = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    qs.set(key, String(value));
  });
  const encoded = qs.toString();
  return apiClient(encoded ? `promotions/coupons/?${encoded}` : 'promotions/coupons/', {
    method: 'GET',
  });
};

export const fetchCoupons = async (scope, extra = {}) => {
  try {
    const response = await getCoupons({
      page: 1,
      page_size: 50,
      ...(scope && scope !== 'all' ? { source: 'admin' } : {}),
      ...extra,
    });
    if (response?.success === false) return [];
    const list = parseCouponList(response);
    if (!scope || scope === 'all') return list;
    return list.filter(
      (item) =>
        String(item.source || '').toLowerCase() === 'admin' && couponMatchesScope(item, scope),
    );
  } catch {
    return [];
  }
};

export const validateCoupon = async (data) => {
  const coupon_code = String(data.coupon_code || '')
    .trim()
    .toUpperCase();
  if (!coupon_code) {
    return { ok: false, coupon: null, discount: 0, error: 'Enter a coupon code' };
  }

  try {
    const response = await apiClient('promotions/coupons/validate/', {
      method: 'POST',
      body: JSON.stringify({ coupon_code }),
    });
    if (!response || response.success === false) {
      return {
        ok: false,
        coupon: null,
        discount: 0,
        error: pickErrorMessage(response),
        response,
      };
    }

    const payload = response?.data ?? response ?? {};
    const couponRaw =
      payload.coupon ||
      payload.promotion ||
      (payload.code || payload.coupon_code || payload.discount_type ? payload : null);
    const coupon =
      normalizeCoupon(couponRaw) ||
      normalizeCoupon({
        ...(couponRaw && typeof couponRaw === 'object' ? couponRaw : {}),
        code: couponRaw?.code || couponRaw?.coupon_code || coupon_code,
      });

    const amount = Math.max(0, Math.round(Number(data.amount) || 0));
    let discount = Math.round(
      Number(
        payload.discount_amount ??
          payload.discount ??
          payload.coupon_discount ??
          payload.amount_saved ??
          payload.savings ??
          0,
      ) || 0,
    );

    if (discount <= 0 && coupon && amount > 0) {
      const local = calcCouponDiscount(coupon, amount);
      if (!local.ok) {
        return {
          ok: false,
          coupon: null,
          discount: 0,
          error: local.error || 'Coupon cannot be applied',
          response,
        };
      }
      discount = local.discount;
    } else if (coupon && amount > 0 && discount > 0) {
      const local = calcCouponDiscount(coupon, amount);
      if (!local.ok) {
        return {
          ok: false,
          coupon: null,
          discount: 0,
          error: local.error || 'Coupon cannot be applied',
          response,
        };
      }
      discount = Math.min(discount, local.discount);
    }

    if (!coupon && discount <= 0) {
      return {
        ok: false,
        coupon: null,
        discount: 0,
        error: pickErrorMessage(response),
        response,
      };
    }

    return {
      ok: true,
      coupon:
        coupon || {
          id: coupon_code,
          code: coupon_code,
          title: coupon_code,
          description: '',
          image_url: null,
          discount_type: 'flat',
          discount_value: discount,
          min_amount: 0,
          min_order_amount: 0,
          max_discount: null,
          applicable_on: data.scope || 'all',
          applies_to:
            data.scope === 'consultation'
              ? 'consultation'
              : data.scope === 'product'
                ? 'order'
                : 'both',
          visibility: 'general',
          source: 'campaign',
          brand_id: null,
          service_category_id: null,
          starts_at: null,
          expires_at: null,
          remaining_uses: null,
          max_uses_per_customer: null,
        },
      discount: Math.max(0, discount),
      response,
    };
  } catch (error) {
    return {
      ok: false,
      coupon: null,
      discount: 0,
      error: error?.message || 'Could not validate coupon',
    };
  }
};

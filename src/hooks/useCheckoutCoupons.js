import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCoupons, validateCoupon } from '../services/couponService';
import {
  calcCouponDiscount,
  couponMatchesScope,
  findCouponByCode,
  isCheckoutSourceCoupon,
} from '../rewards/utils';

export const filterEligibleCoupons = (list, scope, subtotal) =>
  list.filter((item) => couponMatchesScope(item, scope) && calcCouponDiscount(item, subtotal).ok);

const filterCheckoutCoupons = (list, scope) =>
  list.filter((item) => isCheckoutSourceCoupon(item) && couponMatchesScope(item, scope));

const resolveDiscount = (coupon, subtotal, apiDiscount) => {
  const local = calcCouponDiscount(coupon, subtotal);
  if (!local.ok) return 0;
  if (apiDiscount > 0) return Math.min(apiDiscount, local.discount);
  return local.discount;
};

export const useCheckoutCoupons = (scope, subtotal) => {
  const [allCoupons, setAllCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(null);
  const [validatedDiscount, setValidatedDiscount] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchCoupons(scope);
      setAllCoupons(filterCheckoutCoupons(list, scope));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const eligibleCoupons = useMemo(
    () => filterEligibleCoupons(allCoupons, scope, subtotal),
    [allCoupons, scope, subtotal],
  );

  const applyCode = useCallback(
    async (rawCode) => {
      const key = String(rawCode || '').trim().toUpperCase();
      if (!key) {
        const fail = { ok: false, discount: 0, coupon: null, error: 'Enter a coupon code' };
        setError(fail.error);
        return fail;
      }

      const listed = findCouponByCode(allCoupons, key);
      if (listed) {
        const localGate = calcCouponDiscount(listed, subtotal);
        if (!localGate.ok) {
          setApplied(null);
          setValidatedDiscount(null);
          const msg = localGate.error || 'Coupon cannot be applied';
          setError(msg);
          return { ok: false, discount: 0, coupon: null, error: msg };
        }
      }

      const validated = await validateCoupon({
        coupon_code: key,
        amount: subtotal,
        scope,
      });

      if (!validated.ok || !validated.coupon) {
        setApplied(null);
        setValidatedDiscount(null);
        const msg = validated.error || 'Invalid coupon code';
        setError(msg);
        return { ok: false, discount: 0, coupon: null, error: msg };
      }

      const coupon = validated.coupon;
      if (!couponMatchesScope(coupon, scope)) {
        setApplied(null);
        setValidatedDiscount(null);
        const msg =
          scope === 'consultation'
            ? 'This coupon is only valid for product orders'
            : 'This coupon is only valid for consultations';
        setError(msg);
        return { ok: false, discount: 0, coupon: null, error: msg };
      }

      if (!isCheckoutSourceCoupon(coupon)) {
        setApplied(null);
        setValidatedDiscount(null);
        const msg =
          'This coupon is not available at checkout. Check Rewards for referral and reward coupons.';
        setError(msg);
        return { ok: false, discount: 0, coupon: null, error: msg };
      }

      const localGate = calcCouponDiscount(coupon, subtotal);
      if (!localGate.ok) {
        setApplied(null);
        setValidatedDiscount(null);
        const msg = localGate.error || 'Coupon cannot be applied';
        setError(msg);
        return { ok: false, discount: 0, coupon: null, error: msg };
      }

      const discount = resolveDiscount(coupon, subtotal, validated.discount);
      if (discount <= 0) {
        setApplied(null);
        setValidatedDiscount(null);
        const msg = 'Coupon cannot be applied';
        setError(msg);
        return { ok: false, discount: 0, coupon: null, error: msg };
      }

      setApplied(coupon);
      setValidatedDiscount(discount);
      setError(null);
      if (!findCouponByCode(allCoupons, coupon.code)) {
        setAllCoupons((prev) => [coupon, ...prev]);
      }
      return { ok: true, discount, coupon };
    },
    [allCoupons, scope, subtotal],
  );

  const remove = useCallback(() => {
    setApplied(null);
    setValidatedDiscount(null);
    setError(null);
  }, []);

  const discount = useMemo(() => {
    if (!applied) return 0;
    const local = calcCouponDiscount(applied, subtotal);
    if (!local.ok) return 0;
    if (validatedDiscount != null && validatedDiscount > 0) {
      return Math.min(validatedDiscount, local.discount, Math.round(subtotal));
    }
    return local.discount;
  }, [applied, subtotal, validatedDiscount]);

  useEffect(() => {
    if (!applied) return;
    const result = calcCouponDiscount(applied, subtotal);
    if (!result.ok) {
      setApplied(null);
      setValidatedDiscount(null);
      setError(result.error || null);
      return;
    }
    if (validatedDiscount != null && validatedDiscount > 0) {
      const capped = Math.min(validatedDiscount, result.discount);
      if (capped !== validatedDiscount) setValidatedDiscount(capped);
    }
  }, [applied, subtotal, validatedDiscount]);

  return {
    coupons: allCoupons,
    eligibleCoupons,
    loading,
    applied,
    error,
    discount,
    payable: Math.max(0, Math.round(subtotal) - discount),
    applyCode,
    remove,
    reload: load,
  };
};

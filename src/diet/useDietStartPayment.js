import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearDietPaymentSettled,
  isDietPaymentSettled,
  payDietPurchase,
  rememberDietPaymentSettled,
  requestDietPurchase,
} from '../payment/dietCheckout';
import { dietPlanNeedsPurchase } from '../payment/dietPurchase';
import {
  trackMetaPurchase,
  trackMetaStartTrial,
  trackMetaSubscribe,
} from '../services/metaPixel';
import { requireAuth } from '../services/guestAuth';

/**
 * Paid diet plans: purchase -> invoice -> gateway -> verify -> start.
 * Free plans, and plans that are already running, call start directly.
 */
export default function useDietStartPayment({ plan, planId, status, startPlan, onConflict }) {
  const [review, setReview] = useState(null);
  const [settled, setSettled] = useState(() => isDietPaymentSettled(planId));
  const requestRef = useRef(0);
  const onConflictRef = useRef(onConflict);
  onConflictRef.current = onConflict;

  useEffect(() => {
    setSettled(isDietPaymentSettled(planId));
  }, [planId]);

  const finish = useCallback(
    async (options) => {
      const result = await startPlan(planId, options);
      if (result === true) {
        clearDietPaymentSettled(planId);
        setSettled(false);
        // Free diet start ≈ StartTrial (no paid checkout).
        if (!dietPlanNeedsPurchase(plan, status)) {
          trackMetaStartTrial({
            eventId: `trial_diet_${planId}`,
            contentIds: [String(planId)],
            contentName: plan?.title || plan?.name || 'diet_plan',
            value: 0,
            currency: 'INR',
          });
        }
      }
      if (result?.conflict) {
        onConflictRef.current?.({
          activeName: result.activePlan?.name || result.activePlan?.title || 'Your current plan',
          activeId: result.activePlan?.patient_diet_plan_id || '',
          activePlanId: String(result.activePlan?.diet_plan_id || result.activePlan?.id || '').trim(),
          catalogId: planId,
          waterGoal: options?.daily_water_intake_goal,
        });
      }
      return result;
    },
    [plan, planId, startPlan, status],
  );

  const quote = useCallback(
    async (item, options) => {
      const ticket = requestRef.current + 1;
      requestRef.current = ticket;
      setReview({ item, options, gateway: 'cashfree', quote: null, loading: true, paying: false, error: '' });
      const parsed = await requestDietPurchase(planId, 'cashfree', ['cashfree']);
      if (requestRef.current !== ticket) return;
      if (parsed?.cancelled) {
        setReview(null);
        return;
      }
      if (parsed?.skipGateway && !parsed?.error) {
        setReview(null);
        rememberDietPaymentSettled(planId, parsed.purchaseId);
        setSettled(true);
        await finish(options);
        return;
      }
      setReview({
        item,
        options,
        gateway: 'cashfree',
        quote: parsed?.error && !parsed?.purchaseId ? null : parsed,
        loading: false,
        paying: false,
        error: parsed?.error || '',
      });
    },
    [finish, planId],
  );

  const begin = useCallback(
    async (options) => {
      if (!dietPlanNeedsPurchase(plan, status) || isDietPaymentSettled(planId)) {
        return finish(options);
      }
      if (!(await requireAuth('Please login to start a diet plan'))) return false;
      quote(plan, options);
      return 'payment';
    },
    [plan, status, planId, finish, quote],
  );

  const pay = useCallback(async () => {
    const current = review;
    if (!current?.quote || current.quote.error || current.paying || current.loading) return;
    setReview({ ...current, paying: true, error: '' });
    const outcome = await payDietPurchase(
      {
        ...current.item,
        dietPlanId: planId,
        waterGoal: current.options?.daily_water_intake_goal ?? null,
      },
      current.quote,
    );
    if (outcome === 'redirect') return;
    if (outcome === 'verified') {
      rememberDietPaymentSettled(planId, current.quote.purchaseId);
      const purchaseId = current.quote.purchaseId || planId;
      const value =
        Number(current.quote?.totalPayable ?? current.quote?.paid_price ?? current.item?.price) ||
        undefined;
      trackMetaPurchase({
        eventId: `diet_${purchaseId}`,
        contentIds: [String(planId)],
        contentName: current.item?.title || current.item?.name,
        value,
        currency: 'INR',
        orderId: String(purchaseId),
      });
      trackMetaSubscribe({
        eventId: `subscribe_diet_${purchaseId}`,
        contentIds: [String(planId)],
        contentName: current.item?.title || current.item?.name,
        value,
        currency: 'INR',
      });
      setSettled(true);
      setReview(null);
      await finish(current.options);
      return;
    }
    setReview(null);
  }, [review, planId, finish]);

  const closeReview = useCallback(() => {
    if (review?.paying) return;
    requestRef.current += 1;
    setReview(null);
  }, [review]);

  const requiresPayment = dietPlanNeedsPurchase(plan, status) && !settled;

  return {
    begin,
    busy: Boolean(review),
    requiresPayment,
    sheet: {
      review,
      onPay: pay,
      onClose: closeReview,
    },
  };
}

import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { payPackagePurchase, requestPackagePurchase } from '../payment/packageCheckout';
import { packageGatewayChoices, resolvePackageGateway } from '../payment/packagePurchase';
import { requireAuth } from '../services/guestAuth';
import { fetchActivePlans, isSamePackage } from '../services/packageService';
import usePaymentGateways from './usePaymentGateways';

/**
 * Package buy flow shared by the packages list and detail page:
 * login -> (existing active plan? confirm credit transfer) -> packages/purchase/ (chosen gateway)
 * -> payment sheet with the server fee breakdown -> Cashfree / Razorpay -> verify -> My Plans.
 * `onPurchased(item, purchase)` runs after verify-payment succeeds (before the My Plans redirect).
 */
export default function usePackagePurchase({ onPurchased } = {}) {
  const navigate = useNavigate();
  const { gateways: enabled, gateway: preferred } = usePaymentGateways();
  const [busyId, setBusyId] = useState('');
  const [prompt, setPrompt] = useState(null);
  const [review, setReview] = useState(null);
  const requestRef = useRef(0);

  const quote = useCallback(async (item, gateway) => {
    const ticket = requestRef.current + 1;
    requestRef.current = ticket;
    setReview({ item, gateway, quote: null, loading: true, error: '' });
    const parsed = await requestPackagePurchase(item, gateway);
    if (requestRef.current !== ticket) return;
    if (parsed?.cancelled) {
      setReview(null);
      return;
    }
    setReview({ item, gateway, quote: parsed?.error && !parsed?.purchaseId ? null : parsed, loading: false, error: parsed?.error || '' });
  }, []);

  const run = useCallback(
    (item) => {
      quote(item, resolvePackageGateway(item, preferred, enabled));
    },
    [quote, preferred, enabled],
  );

  const pay = useCallback(async () => {
    const current = review;
    if (!current?.quote || current.quote.error || current.paying) return;
    setReview({ ...current, paying: true });
    setBusyId(current.item.id);
    let purchase = null;
    try {
      const outcome = await payPackagePurchase(current.item, current.quote, {
        onVerified: (verified) => {
          purchase = verified;
        },
      });
      if (outcome === 'redirect') return;
      if (outcome === 'verified') {
        setReview(null);
        await onPurchased?.(current.item, purchase);
        navigate('/profile/plans', { state: { highlightId: purchase?.id } });
        return;
      }
      // Cancelled / failed: the gateway order may be spent, so ask the server for a fresh one next time.
      setReview(null);
    } finally {
      setBusyId('');
    }
  }, [review, navigate, onPurchased]);

  const changeGateway = useCallback(
    (gateway) => {
      if (!review?.item || review.paying || gateway === review.gateway) return;
      quote(review.item, resolvePackageGateway(review.item, gateway, enabled));
    },
    [review, quote, enabled],
  );

  const closeReview = useCallback(() => {
    if (review?.paying) return;
    requestRef.current += 1;
    setReview(null);
  }, [review]);

  const start = useCallback(
    async (item) => {
      if (busyId) return;
      if (!(await requireAuth('Sign in to buy this package.'))) return;
      setBusyId(item.id);
      const active = await fetchActivePlans(true);
      setBusyId('');
      if (active.length > 0) {
        const same = active.find((plan) => isSamePackage(plan, item.id));
        setPrompt({ plan: item, samePlan: Boolean(same), currentPlan: same ?? active[0] });
        return;
      }
      run(item);
    },
    [busyId, run],
  );

  const confirm = useCallback(() => {
    const item = prompt?.plan;
    setPrompt(null);
    if (item) run(item);
  }, [prompt, run]);

  const cancel = useCallback(() => setPrompt(null), []);

  const sheet = {
    review,
    gateways: review?.item ? packageGatewayChoices(review.item, enabled) : [],
    onGateway: changeGateway,
    onPay: pay,
    onClose: closeReview,
  };

  return { start, busyId: busyId || (review?.item?.id ?? ''), prompt, confirm, cancel, sheet };
}
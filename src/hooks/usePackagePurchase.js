import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startPackageCheckout } from '../payment/packageCheckout';
import { requireAuth } from '../services/guestAuth';
import { fetchActivePlans, isSamePackage } from '../services/packageService';

/**
 * Package buy flow shared by the packages list and detail page:
 * login -> (existing active plan? confirm credit transfer) -> purchase -> Razorpay -> verify -> My Plans.
 * `onPurchased(item, purchase)` runs after verify-payment succeeds (before the My Plans redirect).
 */
export default function usePackagePurchase({ onPurchased } = {}) {
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState('');
  const [prompt, setPrompt] = useState(null);

  const run = useCallback(
    async (item) => {
      setBusyId(item.id);
      let purchase = null;
      try {
        const outcome = await startPackageCheckout(item, {
          onVerified: (verified) => {
            purchase = verified;
          },
        });
        if (outcome === 'verified') {
          await onPurchased?.(item, purchase);
          navigate('/profile/plans', { state: { highlightId: purchase?.id } });
        }
      } finally {
        setBusyId('');
      }
    },
    [navigate, onPurchased],
  );

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

  return { start, busyId, prompt, confirm, cancel };
}
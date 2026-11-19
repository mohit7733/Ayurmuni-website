import { useEffect, useMemo, useState } from 'react';
import { loadPackagePurchasePages } from '../services/packageService';
import { getConsultationFeeQuote } from '../services/consultService';
import { isAuthenticated } from '../services/guestAuth';
import { isActivePlan, readPlanFunding } from '../consult/consultPayment';

/**
 * Every active purchase + each purchase's fee-quote `package_funding` for this slot.
 * Purchases are loaded without doctor_id so multiple independent buys all appear;
 * the fee quote decides which ones can fund this consultation.
 */
export default function useConsultPlans({ doctorId, slotId }) {
  const [plans, setPlans] = useState([]);
  const [eligibility, setEligibility] = useState({});
  const doctor = String(doctorId || '').trim();

  useEffect(() => {
    let alive = true;
    // isAuthenticated() is async: it must be awaited, a bare call is always truthy.
    Promise.resolve(isAuthenticated())
      .then((signedIn) => {
        if (!alive) return null;
        if (!signedIn) {
          setPlans([]);
          return null;
        }
        return loadPackagePurchasePages({ status: 'active' }).then((rows) => {
          if (!alive) return;
          setPlans(rows.filter(isActivePlan));
        });
      })
      .catch(() => alive && setPlans([]));
    return () => {
      alive = false;
    };
  }, [doctor]);

  const planKey = plans.map((p) => p.id).join(',');

  useEffect(() => {
    if (!slotId || plans.length === 0) {
      setEligibility({});
      return undefined;
    }
    let cancelled = false;
    setEligibility(
      Object.fromEntries(
        plans.map((p) => [p.id, { loading: true, canFund: false, reason: '', payable: null, quantityRemaining: null }]),
      ),
    );
    Promise.all(
      plans.map(async (plan) => {
        try {
          const res = await getConsultationFeeQuote(slotId, undefined, plan.id);
          return [plan.id, readPlanFunding(res)];
        } catch (error) {
          return [
            plan.id,
            {
              loading: false,
              canFund: false,
              reason: error?.message || 'Unable to check this plan',
              payable: null,
              quantityRemaining: null,
            },
          ];
        }
      }),
    ).then((entries) => {
      if (!cancelled) setEligibility(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // plans is derived from planKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey, slotId]);

  const usablePlans = useMemo(() => plans.filter((p) => eligibility[p.id]?.canFund), [plans, eligibility]);

  return { plans, eligibility, usablePlans };
}
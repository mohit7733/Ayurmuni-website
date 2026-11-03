import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Button, Modal } from './ui';
import { formatRupee } from '../home/catalog';
import { formatPlanDate } from '../utils/planUtils';
import { getPlanConsultState, planRemainingLabel } from '../consult/consultPayment';
import '../design/components/consult-plan.css';

const UNUSABLE_LABEL = {
  exhausted: 'Consultation already used',
  expired: 'Plan expired',
  no_consult: 'Consultation not included',
};

/** "Which plan do you want to go with?" - reuses Modal and the booking radio rows. */
export default function ConsultPlanPicker({ open, plans, eligibility, selectedId, onSelect, onPayNormally, onClose }) {
  const [pickedId, setPickedId] = useState(selectedId ?? null);

  const rowStatus = (plan) => {
    const quote = eligibility?.[plan.id];
    if (quote) {
      if (quote.loading) return { usable: false, loading: true, label: 'Checking plan for this doctor...' };
      if (!quote.canFund) return { usable: false, loading: false, label: quote.reason };
      const left =
        quote.quantityRemaining != null
          ? `${quote.quantityRemaining} consultation${quote.quantityRemaining === 1 ? '' : 's'} left`
          : planRemainingLabel(plan, true);
      return { usable: true, loading: false, label: left };
    }
    const state = getPlanConsultState(plan);
    return state === 'usable'
      ? { usable: true, loading: false, label: planRemainingLabel(plan, true) }
      : { usable: false, loading: false, label: UNUSABLE_LABEL[state] };
  };

  const firstUsableId = plans.find((p) => rowStatus(p).usable)?.id ?? null;
  const hasUsable = firstUsableId != null;
  const checking = plans.some((p) => rowStatus(p).loading);

  useEffect(() => {
    if (open) setPickedId(selectedId ?? firstUsableId);
  }, [open, selectedId, firstUsableId]);

  const picked = plans.find((p) => p.id === pickedId && rowStatus(p).usable) ?? null;

  const description = checking && !hasUsable
    ? 'Checking which of your plans can be used for this doctor...'
    : hasUsable
      ? 'No payment needed - this consultation is covered by your plan.'
      : 'Your plans cannot be used for this consultation. You can continue with normal payment.';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Your active plans"
      description={description}
      footer={
        <>
          {hasUsable ? (
            <Button variant="secondary" onClick={onPayNormally}>
              Pay normally instead
            </Button>
          ) : null}
          <Button
            variant="primary"
            disabled={hasUsable ? !picked : checking}
            onClick={() => (hasUsable ? picked && onSelect(picked) : onPayNormally())}
          >
            {hasUsable ? 'Use this plan' : checking ? 'Checking plans...' : 'Continue with payment'}
          </Button>
        </>
      }
    >
      <div className="bk-record-list" role="radiogroup" aria-label="Which plan do you want to go with?">
        {plans.map((plan) => {
          const status = rowStatus(plan);
          const on = status.usable && plan.id === pickedId;
          const expires = formatPlanDate(plan.expires_at);
          const payable = eligibility?.[plan.id]?.payable;
          const price = Number(plan.paid_price || plan.original_price || 0);
          return (
            <label key={plan.id} className={`bk-record cp-row${on ? ' is-on' : ''}${status.usable ? '' : ' is-off'}`}>
              <input
                type="radio"
                name="consult-plan"
                checked={on}
                disabled={!status.usable}
                onChange={() => setPickedId(plan.id)}
              />
              <span className="bk-record__copy">
                <strong>
                  <Star size={13} aria-hidden /> {plan.name}
                </strong>
                <small className={status.usable ? '' : 'cp-row__off'}>{status.label}</small>
                {expires ? <small>Valid till {expires}</small> : null}
              </span>
              <span className="cp-row__price">
                {price > 0 ? <small>{formatRupee(price)}</small> : null}
                {status.usable && payable != null ? <strong>Pay {formatRupee(payable)}</strong> : null}
              </span>
            </label>
          );
        })}
      </div>
    </Modal>
  );
}
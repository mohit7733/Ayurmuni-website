import { Clock } from 'lucide-react';
import { Button, Modal } from './ui';
import { formatPlanDate } from '../utils/planUtils';
import '../design/pages/my-plans.css';

/** Shown before the purchase API when the user already has an active plan (credits move to the new plan). */
export default function PlanTransferModal({ prompt, onYes, onNo }) {
  const samePlan = Boolean(prompt?.samePlan);
  const currentName = prompt?.currentPlan?.name || 'your current plan';
  const newName = prompt?.plan?.name || 'the new package';
  const oldExpiry = formatPlanDate(prompt?.currentPlan?.expires_at);
  return (
    <Modal
      open={Boolean(prompt)}
      onClose={onNo}
      size="sm"
      title={samePlan ? 'Buy this plan again?' : 'You already have an active plan'}
      footer={
        <>
          <Button variant="secondary" onClick={onNo}>
            No
          </Button>
          <Button variant="primary" onClick={onYes}>
            {samePlan ? 'Yes, buy again' : 'Yes, buy now'}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0 }}>
        {samePlan ? (
          <>
            You already have <strong>{currentName}</strong> active. Your remaining credits will be transferred to the new
            purchase.
          </>
        ) : (
          <>
            You have <strong>{currentName}</strong> active. Your remaining credits will be transferred to{' '}
            <strong>{newName}</strong>.
          </>
        )}
      </p>
      {samePlan ? (
        <p className="mp-note" style={{ marginTop: 8 }}>
          <Clock size={14} aria-hidden />
          Transferred credits keep the validity of your previous plan
          {oldExpiry ? ` and expire on ${oldExpiry}` : ''} - not the new package&apos;s validity.
        </p>
      ) : null}
      <p style={{ margin: '8px 0 0', fontWeight: 600 }}>Do you want to continue?</p>
    </Modal>
  );
}
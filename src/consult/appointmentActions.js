// Reschedule modal validation. The app (RescheduleModal.tsx canSubmit) requires a reason for a
// patient-initiated reschedule; a doctor-proposed change (confirm_reschedule) has no reason field.

export const RESCHEDULE_REASON_REQUIRED = 'Please enter a reason for rescheduling.';

/** Inline error for the reschedule modal, or '' when the request may be sent. */
export const validateReschedule = ({ reason, isRescheduleRequest }) => {
  if (isRescheduleRequest) return '';
  return String(reason ?? '').trim() ? '' : RESCHEDULE_REASON_REQUIRED;
};
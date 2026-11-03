/** Appointment payment timeline from `payment.history` (consultation APIs). Port of app utils/paymentHistoryUtils.ts. */

const REFUND_ELIGIBLE_STATUSES = new Set(['cancelled', 'canceled', 'missed', 'expired', 'no_show', 'noshow']);

const pickHistory = (source) => {
  const list =
    source?.payment?.history ??
    source?.payment_history ??
    source?.appointment?.payment?.history ??
    source?.rawData?.payment?.history ??
    source?.rawData?.appointment?.payment?.history ??
    source?.raw?.payment?.history ??
    source?.raw?.appointment?.payment?.history;
  return Array.isArray(list) ? list : null;
};

export const getPaymentHistory = (...sources) => {
  for (const source of sources) {
    const list = pickHistory(source);
    if (!list?.length) continue;
    return list
      .map((entry) => {
        const amountNum = Number(entry?.amount);
        return {
          status: String(entry?.status || '').trim().toLowerCase(),
          amount: entry?.amount != null && entry?.amount !== '' && Number.isFinite(amountNum) ? amountNum : null,
          currency: String(entry?.currency || 'INR'),
          reason: entry?.reason ? String(entry.reason) : undefined,
          at: entry?.at ? String(entry.at) : undefined,
          gateway_refund_id: entry?.gateway_refund_id ? String(entry.gateway_refund_id) : undefined,
        };
      })
      .filter((entry) => entry.status)
      .sort((a, b) => {
        const ta = a.at ? new Date(a.at).getTime() : 0;
        const tb = b.at ? new Date(b.at).getTime() : 0;
        return ta - tb;
      });
  }
  return [];
};

/** Refund completed for a cancelled / missed appointment (list badge only). */
export const getCompletedRefund = (appointmentStatus, ...sources) => {
  const status = String(appointmentStatus || '').trim().toLowerCase();
  if (!REFUND_ELIGIBLE_STATUSES.has(status)) return null;
  const refund = [...getPaymentHistory(...sources)].reverse().find((entry) => entry.status === 'refund_paid');
  if (!refund) return null;
  return { amount: refund.amount, at: refund.at, refundId: refund.gateway_refund_id };
};

export const PAYMENT_STATUS_LABELS = {
  paid: 'Payment complete',
  pending: 'Payment pending',
  failed: 'Payment failed',
  cancelled: 'Appointment cancelled',
  canceled: 'Appointment cancelled',
  missed: 'Appointment missed',
  refund_pending: 'Refund initiated',
  refund_paid: 'Refund completed',
  refund_failed: 'Refund failed',
};

export const formatPaymentStatusLabel = (status) =>
  PAYMENT_STATUS_LABELS[status ?? ''] ||
  String(status ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Tone for the timeline dot / text. */
export const getPaymentStatusTone = (status) => {
  if (status === 'paid' || status === 'refund_paid') return 'success';
  if (status === 'refund_pending' || status === 'pending') return 'warning';
  if (['failed', 'refund_failed', 'cancelled', 'canceled', 'missed'].includes(status)) return 'danger';
  return 'neutral';
};

/** Backend reason codes like `personal_or_unforeseen_circumstance` become readable text. */
export const formatPaymentReason = (reason) => {
  if (!reason) return '';
  if (/\s/.test(reason)) return reason;
  const text = reason.replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatPaymentTimestamp = (at) => {
  if (!at) return '';
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${hours}:${minutes} ${meridiem}`;
};
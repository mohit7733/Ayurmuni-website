/** Appointment payment timeline from `payment.history` (consultation APIs). Port of app utils/paymentHistoryUtils.ts. */

const REFUND_ELIGIBLE_STATUSES = new Set(['cancelled', 'canceled', 'missed', 'expired', 'no_show', 'noshow']);

const historyLists = (source) => {
  if (!source || typeof source !== 'object') return [];
  return [
    source?.payment?.history,
    source?.payment_history,
    source?.refund?.history,
    source?.appointment?.payment?.history,
    source?.appointment?.refund?.history,
    source?.rawData?.payment?.history,
    source?.rawData?.refund?.history,
    source?.rawData?.appointment?.payment?.history,
    source?.rawData?.appointment?.refund?.history,
    source?.raw?.payment?.history,
    source?.raw?.refund?.history,
    source?.raw?.appointment?.payment?.history,
    source?.raw?.appointment?.refund?.history,
  ].filter(Array.isArray);
};

const normalizeStatus = (status) => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'success' || value === 'captured') return 'paid';
  if (value === 'refunded' || value === 'refund_processed' || value === 'refund') return 'refund_paid';
  if (value === 'refund_requested') return 'refund_pending';
  return value;
};

const mapHistoryEntry = (entry) => {
  const amountNum = Number(entry?.amount);
  return {
    status: normalizeStatus(entry?.status),
    label: entry?.label ? String(entry.label) : undefined,
    amount: entry?.amount != null && entry?.amount !== '' && Number.isFinite(amountNum) ? amountNum : null,
    currency: String(entry?.currency || 'INR'),
    reason: entry?.reason ? String(entry.reason) : undefined,
    at: entry?.at ? String(entry.at) : undefined,
    gateway_refund_id: entry?.gateway_refund_id ? String(entry.gateway_refund_id) : undefined,
  };
};

const timeOf = (at) => {
  if (!at) return Number.POSITIVE_INFINITY;
  const time = new Date(at).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

const sortHistory = (list) => [...list].sort((a, b) => timeOf(a.at) - timeOf(b.at));

const dedupeHistory = (list) => {
  const seen = new Set();
  return list.filter((entry) => {
    const key = `${entry.status}|${entry.at || ''}|${entry.amount ?? ''}|${entry.gateway_refund_id || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const getPaymentHistory = (...sources) => {
  const merged = [];
  sources.forEach((source) => {
    historyLists(source).forEach((list) => {
      list.forEach((entry) => merged.push(mapHistoryEntry(entry)));
    });
  });
  const list = sortHistory(dedupeHistory(merged.filter((entry) => entry.status)));
  return withConfirmedStep(list, sources);
};

const appointmentStateOf = (source) =>
  String(
    source?.appointment_status ||
      source?.appointment?.appointment_status ||
      source?.appointment?.status ||
      '',
  )
    .trim()
    .toLowerCase();

/** After a successful payment, continue the track to the confirmed visit. */
const withConfirmedStep = (list, sources) => {
  const state = sources.map(appointmentStateOf).find((value) => value === 'confirmed' || value === 'completed');
  if (!state) return list;
  if (!list.some((entry) => entry.status === 'paid')) return list;
  if (list.some((entry) => ['confirmed', 'completed', 'cancelled', 'canceled', 'missed'].includes(entry.status))) {
    return list;
  }
  const paid = list.find((entry) => entry.status === 'paid');
  return sortHistory([
    ...list,
    {
      status: state,
      label: state === 'completed' ? 'Appointment completed' : 'Appointment confirmed',
      amount: null,
      currency: paid?.currency || 'INR',
      at: paid?.at,
    },
  ]);
};

const LEDGER_STATUS = {
  captured: 'paid',
  refund_requested: 'refund_pending',
  refund_processed: 'refund_paid',
  refund_failed: 'refund_failed',
};

/** One row from GET payments/customer/history/ for this consultation. */
export const mapLedgerPayment = (entry) => {
  const event = String(entry?.event_type || '').trim().toLowerCase();
  const status =
    LEDGER_STATUS[event] ||
    (String(entry?.entry_type || '').toLowerCase() === 'credit' ? 'refund_paid' : 'paid');
  const amountNum = Number(entry?.amount);
  const note = entry?.note ? String(entry.note).trim() : '';
  const reason = /payment captured|payment complete/i.test(note) ? undefined : note || undefined;
  return {
    status,
    amount: Number.isFinite(amountNum) ? amountNum : null,
    currency: String(entry?.currency || 'INR'),
    reason,
    at: entry?.created_at ? String(entry.created_at) : undefined,
    gateway_refund_id: entry?.gateway_refund_id ? String(entry.gateway_refund_id) : undefined,
  };
};

const amountsMatch = (a, b) => {
  if (a == null || b == null) return true;
  return Math.abs(Number(a) - Number(b)) < 0.01;
};

const minutesApart = (a, b) => {
  if (!a || !b) return 0;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a === b ? 0 : Infinity;
  return Math.abs(ta - tb) / 60000;
};

/** Visit history and the customer ledger both describe the same capture. */
const isSamePaymentEvent = (a, b) => {
  if (a.status !== b.status) return false;
  if (a.gateway_refund_id && b.gateway_refund_id && a.gateway_refund_id !== b.gateway_refund_id) return false;
  if (!amountsMatch(a.amount, b.amount)) return false;
  if (a.status === 'paid') return true;
  return minutesApart(a.at, b.at) <= 15;
};

const fillMissing = (base, extra) => ({
  ...base,
  amount: base.amount != null ? base.amount : extra.amount,
  reason: base.reason || extra.reason,
  at: base.at || extra.at,
  gateway_refund_id: base.gateway_refund_id || extra.gateway_refund_id,
  currency: base.currency || extra.currency,
});

export const mergePaymentHistory = (embedded = [], ledger = []) => {
  const kept = [];
  sortHistory([...embedded, ...ledger].filter((entry) => entry?.status)).forEach((entry) => {
    const match = kept.find((existing) => isSamePaymentEvent(existing, entry));
    if (!match) {
      kept.push({ ...entry });
      return;
    }
    const index = kept.indexOf(match);
    kept[index] = fillMissing(match, entry);
  });
  return sortHistory(kept);
};

/** Refund completed for a cancelled / missed appointment (list badge only). */
export const getCompletedRefund = (appointmentStatus, ...sources) => {
  const status = String(appointmentStatus || '').trim().toLowerCase();
  if (!REFUND_ELIGIBLE_STATUSES.has(status)) return null;
  const refund = [...getPaymentHistory(...sources)].reverse().find((entry) => entry.status === 'refund_paid');
  if (!refund) return null;
  return { amount: refund.amount, at: refund.at, refundId: refund.gateway_refund_id };
};

/** Latest refund step from consultation `refund.history`: completed, then initiated, then failed. */
export const getRefundProgress = (appointmentStatus, ...sources) => {
  const status = String(appointmentStatus || '').trim().toLowerCase();
  if (!REFUND_ELIGIBLE_STATUSES.has(status)) return null;
  const history = getPaymentHistory(...sources);
  const paid = [...history].reverse().find((entry) => entry.status === 'refund_paid');
  if (paid) return { ...paid, title: 'Refunded' };
  const pending = [...history].reverse().find((entry) => entry.status === 'refund_pending');
  if (pending) return { ...pending, title: 'Refund initiated' };
  const failed = [...history].reverse().find((entry) => entry.status === 'refund_failed');
  if (failed) return { ...failed, title: 'Refund failed' };
  return null;
};

export const PAYMENT_STATUS_LABELS = {
  paid: 'Payment complete',
  confirmed: 'Appointment confirmed',
  completed: 'Appointment completed',
  pending: 'Payment pending',
  failed: 'Payment failed',
  refunded: 'Refunded',
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
  if (status === 'paid' || status === 'refund_paid' || status === 'confirmed' || status === 'completed') return 'success';
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
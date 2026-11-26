import { roundMoney } from '../cart/feeQuote';

const asRecord = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null;

const text = (value) => {
  const trimmed = String(value ?? '').trim();
  return trimmed || '';
};

const BLOCKED_STATUS = new Set([
  'cancelled',
  'canceled',
  'failed',
  'missed',
  'expired',
  'no_show',
  'noshow',
]);

const finiteRupees = (value) => {
  if (value == null || value === '') return undefined;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  return roundMoney(amount);
};

/**
 * Rupees actually charged for this visit.
 * A payable of 0 (coupon or plan) stays 0. The listed consultation fee is only
 * used when nothing else says what was paid.
 */
const paidCandidates = (layer) => {
  if (!layer) return [];
  const summary = asRecord(layer.summary) || {};
  const booking = asRecord(layer.booking) || {};
  return [
    booking.paid_amount,
    layer.paid_amount,
    summary.total_payable_amount,
    layer.total_payable_amount,
    summary.payable_amount,
    layer.payable_amount,
    layer.amount,
    layer.total_amount,
  ];
};

const listedFeeCandidates = (layer) => {
  if (!layer) return [];
  const summary = asRecord(layer.summary) || {};
  const booking = asRecord(layer.booking) || {};
  return [layer.consultation_fee, summary.consultation_fee, booking.consultation_fee];
};

export const readPaidConsultationRupees = (source, fallback) => {
  const root = asRecord(source) || {};
  const nested = asRecord(root.data);
  const candidates = [
    ...paidCandidates(root),
    ...paidCandidates(nested),
    fallback,
    ...listedFeeCandidates(root),
    ...listedFeeCandidates(nested),
  ];
  for (const value of candidates) {
    const amount = finiteRupees(value);
    if (amount != null) return amount;
  }
  return undefined;
};

/** Stable id for one confirmed visit. Same id on refresh, new id on the next booking. */
export const consultationConversionId = (detail) => {
  const root = asRecord(detail) || {};
  const booking = asRecord(root.booking) || {};
  const slot = asRecord(root.slot) || {};
  return (
    text(root.appointment_id) ||
    text(root.consultation_id) ||
    text(booking.appointment_id) ||
    text(booking.consultation_id) ||
    text(booking.id) ||
    text(root.booking_id) ||
    text(root.payment_id) ||
    text(root.id) ||
    text(slot.id)
  );
};

const conversionStatus = (detail) => {
  const root = asRecord(detail) || {};
  const booking = asRecord(root.booking) || {};
  return text(
    root.appointment_status || booking.appointment_status || booking.status || root.status,
  ).toLowerCase();
};

/** Confirmed visit with a known paid amount. Cancelled and failed visits are excluded. */
export const canTrackConsultationConversion = (detail) => {
  if (!consultationConversionId(detail)) return false;
  if (readPaidConsultationRupees(detail) == null) return false;
  const status = conversionStatus(detail);
  if (status && BLOCKED_STATUS.has(status)) return false;
  return true;
};

/**
 * Pixel eventIDs. A server Conversions API call must send these same ids
 * (`schedule_<bookingId>`, `purchase_<bookingId>`) or the ids it stored as
 * `meta_schedule_event_id` / `meta_purchase_event_id` / `meta_event_id`.
 */
export const consultationConversionEventIds = (detail, bookingId) => {
  const root = asRecord(detail) || {};
  const booking = asRecord(root.booking) || {};
  const schedule = text(root.meta_schedule_event_id || booking.meta_schedule_event_id);
  const purchase = text(root.meta_purchase_event_id || booking.meta_purchase_event_id);
  const shared = text(root.meta_event_id || booking.meta_event_id || root.fb_event_id || booking.fb_event_id);
  return {
    schedule: schedule || shared || `schedule_${bookingId}`,
    purchase: purchase || shared || `purchase_${bookingId}`,
  };
};

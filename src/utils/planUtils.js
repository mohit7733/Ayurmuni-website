import { isPlanExpired } from '../services/packageService';

export const PLAN_STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Expired', value: 'expired' },
];

export const PLAN_STATUS = {
  active: { label: 'Active', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  expired: { label: 'Expired', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export const humanize = (value) =>
  value ? String(value).charAt(0).toUpperCase() + String(value).slice(1).replace(/_/g, ' ') : '';

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatPlanDate = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
};

export const formatPlanTime = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;
};

export const daysLeft = (expiresAt, now = Date.now()) => {
  const date = toDate(expiresAt);
  if (!date) return null;
  const ms = date.getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 86400000);
};

/** Status shown on a card: an elapsed expiry wins over the stored status. */
export const getPlanStatusKey = (plan) => (isPlanExpired(plan) ? 'expired' : String(plan?.status || '').toLowerCase());

export const getPlanStatus = (plan) => {
  const key = getPlanStatusKey(plan);
  return PLAN_STATUS[key] ?? { label: humanize(plan?.status), tone: 'neutral' };
};

/** Money headline of a purchase: amount paid, or the plan amount while payment is pending. */
export const getPlanAmounts = (plan) => {
  const paid = Number(plan?.paid_price) || 0;
  const original = Number(plan?.original_price) || 0;
  return {
    amount: paid > 0 ? paid : original,
    saved: paid > 0 && original > paid ? original - paid : 0,
    original,
  };
};

/** { purchaseId: planName } so a shifted benefit can show which plan it came from. */
export const buildPlanNameMap = (plans) => {
  const map = {};
  (plans || []).forEach((plan) => {
    if (plan?.id) map[plan.id] = plan.name;
  });
  return map;
};

/** Normalizes a packages/my/ page: { list, next } for an array or paginated body. */
export const readPlanPage = (res) => {
  const data = res?.data;
  if (Array.isArray(data?.results)) return { list: data.results, next: data.next ?? null };
  if (Array.isArray(data)) return { list: data, next: null };
  if (Array.isArray(res?.results)) return { list: res.results, next: res.next ?? null };
  return { list: [], next: null };
};

export const planBenefitIcon = (label) => {
  const key = String(label || '').toLowerCase();
  if (key.includes('consult') || key.includes('doctor')) return 'consult';
  if (key.includes('diet') || key.includes('nutri')) return 'diet';
  if (key.includes('yoga') || key.includes('exercise')) return 'yoga';
  if (key.includes('prakriti') || key.includes('assessment')) return 'assessment';
  if (key.includes('lab') || key.includes('test')) return 'lab';
  return 'leaf';
};
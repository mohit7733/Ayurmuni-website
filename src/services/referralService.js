import { apiClient } from './apiClient';

const EMPTY_HISTORY = {
  total_referrals: 0,
  successful_referrals: 0,
  total_earnings: 0,
  history: [],
};

const unwrap = (response, fallback) => ({
  success: Boolean(response?.success),
  message: response?.message || '',
  data: response?.success ? response?.data ?? fallback : fallback,
});

/**
 * Backend routes (promotions/urls): promotions/referral/ (customer-referral) and
 * promotions/referral/apply/ (customer-referral-apply). The old referral/info|generate|history
 * paths do not exist. The app has no referral screen, so the response shape is read
 * defensively: code + stats may sit at the top of data or under data.stats / data.history.
 */
const fetchReferral = () => apiClient('promotions/referral/', { method: 'GET' });

/** Referral code for the logged-in user (GET promotions/referral/). */
export const getReferralInfo = async () => {
  const res = unwrap(await fetchReferral(), null);
  const d = res.data;
  return {
    ...res,
    data: d
      ? { ...d, referral_code: d.referral_code ?? d.code ?? d.referral?.code ?? d.referral?.referral_code ?? '' }
      : null,
  };
};

/** Referral counts and earnings, from the same GET promotions/referral/. */
export const getReferralHistory = async () => {
  const res = unwrap(await fetchReferral(), EMPTY_HISTORY);
  const d = res.data || {};
  const stats = d.stats || d.summary || d;
  const history = Array.isArray(d.history) ? d.history : Array.isArray(d.referrals) ? d.referrals : [];
  return {
    ...res,
    data: {
      total_referrals: Number(stats.total_referrals ?? history.length ?? 0) || 0,
      successful_referrals: Number(stats.successful_referrals ?? 0) || 0,
      total_earnings: Number(stats.total_earnings ?? 0) || 0,
      history,
    },
  };
};

/** Applies a friend's referral code (POST promotions/referral/apply/). */
export const applyReferralCode = async (code) => {
  const response = await apiClient('promotions/referral/apply/', {
    method: 'POST',
    body: JSON.stringify({ referral_code: String(code || '').trim().toUpperCase() }),
  });
  return {
    ...unwrap(response, null),
    message: response?.message || (response?.success ? 'Referral code applied successfully' : 'Invalid referral code'),
  };
};

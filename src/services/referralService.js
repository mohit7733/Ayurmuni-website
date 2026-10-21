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

/** Referral code and link for the logged-in user. */
export const getReferralInfo = async () =>
  unwrap(await apiClient('referral/info/', { method: 'GET' }), null);

/** Generates a referral code if the user does not have one yet. */
export const generateReferralCode = async () =>
  unwrap(await apiClient('referral/generate/', { method: 'POST' }), null);

/** Referral counts, earnings and history. */
export const getReferralHistory = async () =>
  unwrap(await apiClient('referral/history/', { method: 'GET' }), EMPTY_HISTORY);

/** Applies a friend's referral code to the current account. */
export const applyReferralCode = async (code) => {
  const response = await apiClient('referral/apply/', {
    method: 'POST',
    body: JSON.stringify({ referral_code: code }),
  });
  return {
    ...unwrap(response, null),
    message: response?.message || (response?.success ? 'Referral code applied successfully' : 'Invalid referral code'),
  };
};

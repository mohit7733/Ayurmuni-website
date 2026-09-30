import { apiClient } from './apiClient';

/**
 * Get user's referral code and stats
 */
export async function getReferralInfo() {
  try {
    const response = await apiClient.get('/api/referral/info');
    return {
      success: true,
      data: response.data?.data || response.data || {},
    };
  } catch (error) {
    console.error('Get referral info error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch referral info',
      data: null,
    };
  }
}

/**
 * Generate a new referral code (if not exists)
 */
export async function generateReferralCode() {
  try {
    const response = await apiClient.post('/api/referral/generate');
    return {
      success: true,
      data: response.data?.data || response.data || {},
    };
  } catch (error) {
    console.error('Generate referral code error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to generate referral code',
      data: null,
    };
  }
}

/**
 * Get referral history/stats
 */
export async function getReferralHistory() {
  try {
    const response = await apiClient.get('/api/referral/history');
    return {
      success: true,
      data: response.data?.data || response.data || {
        total_referrals: 0,
        successful_referrals: 0,
        total_earnings: 0,
        history: [],
      },
    };
  } catch (error) {
    console.error('Get referral history error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch referral history',
      data: {
        total_referrals: 0,
        successful_referrals: 0,
        total_earnings: 0,
        history: [],
      },
    };
  }
}

/**
 * Apply referral code when signing up
 */
export async function applyReferralCode(code) {
  try {
    const response = await apiClient.post('/api/referral/apply', {
      referral_code: code,
    });
    return {
      success: true,
      data: response.data?.data || response.data || {},
      message: response.data?.message || 'Referral code applied successfully',
    };
  } catch (error) {
    console.error('Apply referral code error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Invalid referral code',
      data: null,
    };
  }
}

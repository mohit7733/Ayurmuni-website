import { apiClient } from './apiClient';
import { parseRewardList } from '../rewards/utils';

export const getRewards = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    qs.set(key, String(value));
  });
  const encoded = qs.toString();
  return apiClient(`promotions/rewards/${encoded ? `?${encoded}` : ''}`, {
    method: 'GET',
  });
};

export const fetchRewards = async () => {
  const response = await getRewards({ page: 1, page_size: 50 });
  if (response?.success === false) return [];
  return parseRewardList(response);
};

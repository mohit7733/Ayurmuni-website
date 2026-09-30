import { apiClient } from './apiClient';

const toQuery = (payload = {}) =>
  new URLSearchParams(
    Object.fromEntries(
      Object.entries(payload)
        .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
        .map(([key, value]) => [key, String(value)]),
    ),
  ).toString();

export const getNotification = async (payload = {}) => {
  const qs = toQuery(payload);
  return apiClient(qs ? `notifications/?${qs}` : 'notifications/', { method: 'GET' });
};

export const manageNotification = async (payload = {}) => {
  const qs = toQuery(payload);
  return apiClient(qs ? `notifications/?${qs}` : 'notifications/', { method: 'POST' });
};

import { apiClient } from './apiClient';

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && String(value).trim() !== '',
    ),
  );

export const getYogaSession = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(cleanParams(params)).forEach(([key, value]) => {
    query.set(key, String(value));
  });
  const qs = query.toString();
  return apiClient(qs ? `yoga/sessions/?${qs}` : 'yoga/sessions/', { method: 'GET' });
};

export const getYogaSessionDetail = async (id) => {
  const sid = String(id ?? '').trim();
  if (!sid) return { success: false, data: null };
  const byPath = await apiClient(`yoga/sessions/${sid}/`, { method: 'GET' });
  if (byPath?.success !== false) return byPath;
  return apiClient(`yoga/sessions/?id=${encodeURIComponent(sid)}`, { method: 'GET' });
};

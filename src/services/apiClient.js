import { Utils } from '../common/utils';
import { BaseUrl } from '../config/key';

let isRefreshing = false;
let refreshPromise = null;

const refreshAccessToken = async () => {
  try {
    const refreshToken = await Utils.getData('_REFRESH_TOKEN');
    if (!refreshToken) return null;

    const response = await fetch(`${BaseUrl.base_url}user/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    const data = await parseJsonBody(response);
    if (!data || !response.ok || !data?.success) {
      return null;
    }

    const accessToken = data?.data?.access;
    const newRefreshToken = data?.data?.refresh;
    if (!accessToken) return null;

    await Utils.storeData('_TOKEN', accessToken);
    if (newRefreshToken) {
      await Utils.storeData('_REFRESH_TOKEN', newRefreshToken);
    }

    return accessToken;
  } catch {
    return null;
  }
};

const parseJsonBody = async (response) => {
  try {
    const rawText = await response.text();
    const trimmed = rawText.trim();
    if (!trimmed) return null;
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const getFreshToken = async () => {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = refreshAccessToken();
  try {
    return await refreshPromise;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
};

const makeRequest = (endpoint, options, token) => {
  const isFormData = options?.body instanceof FormData;
  const headers = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': '1',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  return fetch(BaseUrl.base_url + endpoint, {
    ...options,
    headers,
  });
};

export const apiClient = async (
  endpoint,
  options = {},
  requireAuth = true,
) => {
  try {
    let token = null;
    if (requireAuth) {
      token = await Utils.getData('_TOKEN');
    }

    let response = await makeRequest(endpoint, options, token);

    if (requireAuth && response.status === 401) {
      const freshToken = await getFreshToken();
      if (!freshToken) {
        return {
          success: false,
          logout: true,
          message: 'Session expired',
        };
      }
      token = freshToken;
      response = await makeRequest(endpoint, options, freshToken);
    }

    const data = await parseJsonBody(response);
    if (!data) {
      return {
        success: false,
        status: response.status,
        message: response.ok ? 'Invalid API response' : 'Something went wrong',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: data?.message || data?.detail || 'Something went wrong',
        data,
      };
    }

    return {
      success: true,
      status: response.status,
      ...(data || {}),
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || 'Network Error',
    };
  }
};

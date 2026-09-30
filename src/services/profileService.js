import { apiClient } from './apiClient';

export const user_profile = async () => {
  return apiClient('customers/profile/', {
    method: 'GET',
  });
};

export const UploadProfilePhoto = async (data) => {
  return apiClient('user/upload/', {
    method: 'POST',
    body: data,
  });
};

export const get_prakriti_info = async () => {
  return apiClient('customers/prakriti/info/', {
    method: 'GET',
  });
};

export const update_Profile = async (data) => {
  return apiClient('customers/profile/', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteAccount = async () =>
  apiClient('customers/profile/', { method: 'DELETE' });

export const getAddresses = async () =>
  apiClient('customers/address/', { method: 'GET' });

export const addAddress = async (data) =>
  apiClient('customers/address/', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateAddress = async (addressId, data) =>
  apiClient(`customers/address/?id=${encodeURIComponent(String(addressId))}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteAddress = async (addressId) =>
  apiClient(`customers/address/?id=${encodeURIComponent(String(addressId))}`, {
    method: 'DELETE',
  });

export const listAddresses = (response) => {
  const data = response?.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  if (Array.isArray(response?.results)) return response.results;
  return [];
};

export const recoverAccount = async (payload) => {
  return apiClient(
    'user/customer/account/recover/',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    false,
  );
};

export const parseDeletedAccountInfo = (response) => {
  const data = response?.data ?? response ?? {};
  const code = String(
    response?.code || data?.code || response?.error_code || '',
  ).toLowerCase();
  const status = String(data?.account_status || data?.status || '').toLowerCase();
  const message = String(response?.message || data?.message || '').toLowerCase();

  const flagged =
    data?.is_deleted === true ||
    data?.account_deleted === true ||
    data?.can_recover === true ||
    data?.is_account_deleted === true ||
    status === 'deleted' ||
    status === 'scheduled_for_deletion' ||
    code.includes('deleted') ||
    code.includes('recover') ||
    message.includes('deleted') ||
    message.includes('recover');

  if (!flagged) return null;

  const daysRaw =
    data?.retention_days ??
    data?.backup_days ??
    data?.recovery_days ??
    response?.retention_days ??
    response?.backup_days ??
    30;
  const days = Number(daysRaw);
  return {
    retentionDays: Number.isFinite(days) && days > 0 ? days : 30,
    phoneNumber: data?.phone_number || data?.phone || null,
    message:
      response?.message ||
      data?.message ||
      'This number was used for a deleted account.',
  };
};

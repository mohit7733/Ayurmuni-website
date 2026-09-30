import { apiClient } from './apiClient';

export const send_otp = async (data) => {
  return apiClient(
    'user/send-otp/',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    false,
  );
};

export const verify_otp_login = async (data) => {
  return apiClient(
    'user/customer/login/',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    false,
  );
};

export const onBoarding = async (data) => {
  return apiClient('customers/profile/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const verify_otp = async (data) => {
  return apiClient(
    'user/customer/register/',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    false,
  );
};

const API_BASE_URL = String(import.meta.env.VITE_API_BASE || 'https://scarce-derby-voice.ngrok-free.dev/').replace(
  /\/*$/,
  '/',
);

export const BaseUrl = {
  base_url: API_BASE_URL,
};

export const Method = {
  GET: 'GET',
  POST: 'POST',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  PUT: 'PUT',
};

/** Backend success copy must not use the red warning toast. */
export const toastTone = (message, fallback = 'error') => {
  const text = String(message || '').toLowerCase();
  if (/verified successfully|payment successful|activated successfully|confirmed successfully/.test(text)) {
    return 'success';
  }
  return fallback;
};

export const showSuccessToast = (message, type = 'success') => {
  window.dispatchEvent(
    new CustomEvent('ayurmuni-toast', {
      detail: { message, type: toastTone(message, type) },
    }),
  );
};

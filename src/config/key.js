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

export const showSuccessToast = (message, type = 'success') => {
  window.dispatchEvent(
    new CustomEvent('ayurmuni-toast', {
      detail: { message, type },
    }),
  );
};

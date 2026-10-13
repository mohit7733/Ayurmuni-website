export const BaseUrl = {
  base_url: "https://ranged-reimburse-pentagram.ngrok-free.dev/"
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

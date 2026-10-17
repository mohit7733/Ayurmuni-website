export const BaseUrl = {
  base_url: "https://ayurmuni.aimantra.info/"
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

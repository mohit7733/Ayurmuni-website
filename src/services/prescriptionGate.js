export const PRESCRIPTION_REQUIRED_MESSAGE =
  'This medicine needs a valid prescription before it can be added to cart.';

let listener = null;

export const showPrescriptionRequired = ({ message, variantId, productName } = {}) => {
  const id = String(variantId || '').trim();
  const name = String(productName || '').trim();
  listener?.({
    message: message || PRESCRIPTION_REQUIRED_MESSAGE,
    variantId: id,
    productName: name,
  });
};

export const subscribePrescriptionRequired = (fn) => {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
};

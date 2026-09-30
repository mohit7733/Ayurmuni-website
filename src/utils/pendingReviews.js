let pendingProduct = null;
let pendingDiet = null;

export const setPendingProductReview = (payload) => {
  pendingProduct = payload;
};

export const consumePendingProductReview = () => {
  const next = pendingProduct;
  pendingProduct = null;
  return next;
};

export const setPendingDietPlanReview = (payload) => {
  pendingDiet = payload;
};

export const consumePendingDietPlanReview = () => {
  const next = pendingDiet;
  pendingDiet = null;
  return next;
};

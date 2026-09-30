import { apiClient } from './apiClient';
import { buildReviewEndpoint } from '../utils/reviewUtils';

export const createReview = async ({
  entityType,
  appointmentId,
  variantId,
  orderId,
  patientDietPlanId,
  reviewData,
}) => {
  const normalizedType = String(entityType).toLowerCase();
  const endpoint = buildReviewEndpoint(normalizedType);
  const payload = {
    rating: reviewData.rating,
    review: reviewData.review,
  };
  if (reviewData.image_urls?.length) payload.image_urls = reviewData.image_urls;

  if (normalizedType === 'doctor') {
    const appointment_id =
      appointmentId || reviewData.appointment_id || reviewData.appointment;
    if (!appointment_id) throw new Error('appointment_id is required for doctor reviews');
    payload.appointment_id = appointment_id;
  }
  if (normalizedType === 'product') {
    const variant_id = variantId || reviewData.variant_id;
    const order_id = orderId || reviewData.order_id;
    if (!variant_id) throw new Error('variant_id is required for product reviews');
    if (!order_id) throw new Error('order_id is required for product reviews');
    payload.variant_id = variant_id;
    payload.order_id = order_id;
  }
  if (normalizedType === 'diet_plan') {
    const patient_diet_plan_id = patientDietPlanId || reviewData.patient_diet_plan_id;
    if (!patient_diet_plan_id) {
      throw new Error('patient_diet_plan_id is required for diet plan reviews');
    }
    payload.patient_diet_plan_id = patient_diet_plan_id;
  }
  if (reviewData.tags?.length) payload.tags = reviewData.tags;

  return apiClient(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

/**
 * Submit a product review with images
 * @param {FormData} formData - FormData containing review data and images
 * @returns {Promise} API response
 */
export const submitReview = async (formData) => {
  try {
    // Extract data from FormData
    const productId = formData.get('product_id');
    const variantId = formData.get('variant_id');
    const rating = formData.get('rating');
    const title = formData.get('title');
    const comment = formData.get('comment');
    
    // For now, send as JSON (image upload will need separate endpoint or multipart support)
    const endpoint = '/reviews/product/';
    const payload = {
      product_id: productId,
      variant_id: variantId,
      rating: Number(rating),
      title: title,
      review: comment,
      comment: comment,
    };

    return await apiClient(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Review submission error:', error);
    return { success: false, message: error.message || 'Failed to submit review' };
  }
};

/**
 * Get reviews for a product
 */
export const getProductReviews = async (variantId, page = 1, pageSize = 10) => {
  return apiClient(`/reviews/product/?variant_id=${variantId}&page=${page}&page_size=${pageSize}`);
};

/**
 * Get user's own reviews
 */
export const getUserReviews = async () => {
  return apiClient('/reviews/user/');
};

/**
 * Update a review
 */
export const updateReview = async (reviewId, data) => {
  return apiClient(`/reviews/${reviewId}/`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * Delete a review
 */
export const deleteReview = async (reviewId) => {
  return apiClient(`/reviews/${reviewId}/`, {
    method: 'DELETE',
  });
};

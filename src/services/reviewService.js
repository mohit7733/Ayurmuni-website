import { apiClient } from './apiClient';
import { extractOrderDetail, getOrderById, getOrders, normalizeOrdersList } from './orderService';
import {
  buildReviewEndpoint,
  isOrderItemRated,
  resolveOrderItemVariantId,
} from '../utils/reviewUtils';

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

const REVIEWABLE_ORDER_STATUSES = ['delivered', 'completed'];

/**
 * Product reviews must reference a delivered order containing the variant.
 * Resolves `{ orderId, variantId, alreadyReviewed }` or null when the user never received it.
 */
export const findReviewableProductOrder = async (variantIds) => {
  const wanted = new Set((variantIds || []).map((id) => String(id ?? '').trim()).filter(Boolean));
  if (!wanted.size) return null;

  const orders = normalizeOrdersList(await getOrders({ page_size: 50 })).filter((order) =>
    REVIEWABLE_ORDER_STATUSES.includes(String(order?.order_status || order?.status || '').toLowerCase()),
  );

  let reviewedMatch = null;
  for (const order of orders) {
    let items = Array.isArray(order?.items) ? order.items : null;
    if (!items && order?.id) {
      items = extractOrderDetail(await getOrderById(order.id))?.items || [];
    }
    const match = (items || []).find((item) => wanted.has(resolveOrderItemVariantId(item)));
    if (!match) continue;
    const result = {
      orderId: String(order.id),
      variantId: resolveOrderItemVariantId(match),
      alreadyReviewed: isOrderItemRated(match),
    };
    if (!result.alreadyReviewed) return result;
    reviewedMatch ??= result;
  }
  return reviewedMatch;
};

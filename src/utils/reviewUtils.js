import { UploadProfilePhoto } from '../services/profileService';
import { extractUploadUrl } from '../services/prescriptionService';

export const REVIEW_UPLOAD_DIR = 'review_files';

export const buildReviewSubmitPayload = ({
  rating,
  review = '',
  imageUrls = [],
  entityType,
  appointmentId,
  orderId,
  variantId,
  patientDietPlanId,
  tags,
}) => {
  const payload = {
    rating,
    review: String(review || '').trim(),
  };
  const cleanedUrls = (imageUrls || []).filter(Boolean);
  if (cleanedUrls.length) payload.image_urls = cleanedUrls;
  if (entityType === 'doctor' && appointmentId) payload.appointment_id = appointmentId;
  if (entityType === 'product') {
    if (orderId) payload.order_id = orderId;
    if (variantId) payload.variant_id = variantId;
  }
  if (entityType === 'diet_plan' && patientDietPlanId) {
    payload.patient_diet_plan_id = patientDietPlanId;
  }
  if (tags?.length) payload.tags = tags;
  return payload;
};

export const extractReviewsList = (response) => {
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.reviews)) return data.reviews;
  if (Array.isArray(response?.results)) return response.results;
  return [];
};

export const uploadReviewAsset = async (file, entityType = 'product') => {
  const body = new FormData();
  body.append('image', file, file?.name || `review_${Date.now()}.jpg`);
  body.append('dir', REVIEW_UPLOAD_DIR);
  const response = await UploadProfilePhoto(body);
  const uploadedUrl = extractUploadUrl(response);
  if (response?.success === false || !uploadedUrl) {
    throw new Error(response?.message || 'Upload failed');
  }
  return uploadedUrl;
};

export const isTruthyReviewFlag = (value) => {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
};

export const resolveOrderItemVariantId = (item) =>
  String(
    item?.variant?.variant_id ??
      item?.variant_id ??
      item?.product_variant_id ??
      item?.variant?.id ??
      item?.product?.variant_id ??
      '',
  );

export const isOrderItemRated = (item) =>
  isTruthyReviewFlag(item?.variant?.is_reviewed) ||
  isTruthyReviewFlag(item?.variant?.is_rated) ||
  isTruthyReviewFlag(item?.is_reviewed) ||
  isTruthyReviewFlag(item?.is_rated) ||
  isTruthyReviewFlag(item?.review?.is_reviewed) ||
  isTruthyReviewFlag(item?.review?.is_rated) ||
  Number(item?.review?.rating) > 0;

export const buildReviewEndpoint = (entityType) => {
  const normalizedType = String(entityType || '').toLowerCase();
  if (normalizedType === 'doctor') return 'review/?entity_type=doctor';
  if (normalizedType === 'product') return 'review/?entity_type=product';
  if (normalizedType === 'diet_plan') return 'review/?entity_type=diet_plan';
  throw new Error('Unsupported review entity type');
};

const pushMediaUrl = (urls, value) => {
  if (typeof value === 'string' && value.trim()) urls.push(value.trim());
};

export const normalizeReviewMediaUrls = (review) => {
  const urls = [];
  const push = (value) => {
    if (typeof value === 'string' && value.trim()) {
      urls.push(value.trim());
      return;
    }
    if (value && typeof value === 'object') {
      const candidate =
        value.url || value.image_urls || value.file_url || value.media_url || value.uri || value.image;
      pushMediaUrl(urls, candidate);
    }
  };
  (Array.isArray(review?.image_urls) ? review.image_urls : []).forEach(push);
  (Array.isArray(review?.attachments) ? review.attachments : []).forEach(push);
  push(review?.media_url);
  push(review?.image);
  return Array.from(new Set(urls));
};

export const collectReviewImageUrls = (reviews) =>
  Array.isArray(reviews) ? reviews.flatMap(normalizeReviewMediaUrls) : [];

export const normalizeReviewsForDisplay = (reviews) => {
  if (!Array.isArray(reviews)) return [];
  return reviews.map((review) => ({
    ...review,
    image_urls: normalizeReviewMediaUrls(review),
    patient_name:
      review?.patient_name || review?.reviewer_name || review?.name || 'Patient',
    reviewer_name:
      review?.reviewer_name || review?.patient_name || review?.name || 'Patient',
  }));
};

export const isReviewVideoUrl = (url) =>
  Boolean(url) && /\.(mp4|mov|m4v|webm)(\?|$)/i.test(String(url));

export const getAverageRating = (reviews) => {
  if (!Array.isArray(reviews) || reviews.length === 0) return 0;
  const total = reviews.reduce((sum, item) => sum + Number(item?.rating ?? 0), 0);
  return Math.round((total / reviews.length) * 10) / 10;
};


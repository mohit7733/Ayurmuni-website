import { getDietPlanCoverUrl } from '../diet/utils';

export const normalizeApiList = (response) => {
  if (response?.success === false) return [];
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const key of [
      'results',
      'products',
      'medicines',
      'suggested',
      'suggested_products',
      'suggested_medicines',
      'categories',
      'product_categories',
      'health_categories',
      'items',
      'diet_plans',
      'plans',
      'sessions',
      'yoga_sessions',
      'subcategories',
      'children',
    ]) {
      if (Array.isArray(data[key])) return data[key];
    }
  }
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response)) return response;
  const numericKeys = Object.keys(response || {})
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b));
  if (numericKeys.length) {
    return numericKeys.map((key) => response[key]).filter(Boolean);
  }
  return [];
};

export const resolveImageUrl = (item) => {
  if (!item || typeof item !== 'object') return '';
  const candidates = [
    item?.cover_image?.media_url,
    item?.image_url,
    item?.thumbnail_url,
    item?.profile_image,
    item?.image,
    item?.icon_url,
    item?.media_url,
    item?.banner_image,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim() && !/example\.com|placeholder/i.test(value)) {
      return value.trim();
    }
  }
  return '';
};

export const mapCatalogProductItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const nestedProduct =
    item.product && typeof item.product === 'object' ? item.product : null;
  const variants = Array.isArray(item.variants)
    ? item.variants
    : Array.isArray(nestedProduct?.variants)
      ? nestedProduct.variants
      : [];
  const def =
    variants.find((v) => v?.is_default) ||
    variants[0] ||
    item.variant ||
    nestedProduct ||
    {};
  const variantId =
    item.variant_id ?? def.variant_id ?? def.id ?? nestedProduct?.variant_id ?? null;
  const productId =
    item.id ?? item.product_id ?? nestedProduct?.id ?? def.product_id;
  const name = String(
    item.name ||
      item.product_name ||
      item.title ||
      nestedProduct?.name ||
      def.name ||
      '',
  ).trim();
  if (!variantId && !productId) return null;
  return {
    ...nestedProduct,
    ...def,
    ...item,
    id: productId ?? variantId,
    variant_id: variantId ?? productId,
    name: name || 'Product',
    selling_price:
      def.selling_price ?? item.selling_price ?? item.price ?? nestedProduct?.selling_price,
    mrp: def.mrp ?? item.mrp ?? nestedProduct?.mrp,
    image_url: resolveImageUrl(def) || resolveImageUrl(item) || resolveImageUrl(nestedProduct),
  };
};

export const mapProductCategory = (item) => ({
  id: String(
    item?.id ??
      item?.health_disease_id ??
      item?.product_category_id ??
      item?.category_id ??
      item?.health_category_id ??
      '',
  ),
  name: String(
    item?.name ??
      item?.disease_name ??
      item?.category_name ??
      item?.title ??
      'Category',
  ),
  image_url: resolveImageUrl(item),
});

export const mapDietPlanForHome = (item) => ({
  ...item,
  id: String(item?.id ?? ''),
  title: String(item?.name ?? 'Diet Plan'),
  name: String(item?.name ?? 'Diet Plan'),
  short_description: String(item?.season || item?.subtitle || item?.short_description || '').trim(),
  thumbnail_url: getDietPlanCoverUrl(item) || item?.thumbnail_url || item?.image_url || '',
  type: 'diet',
});

export {
  mapYogaSessionForList,
  normalizeYogaSessionList,
} from '../yoga/utils';

export const formatRupee = (value, options) => {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const decimals = options?.decimals;
  if (typeof decimals === 'number') {
    return `₹${n.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

export const doctorDisplayName = (item) =>
  String(
    item?.doctor_name ||
      item?.full_name ||
      item?.name ||
      [item?.first_name, item?.last_name].filter(Boolean).join(' ') ||
      'Doctor',
  ).trim() || 'Doctor';

export const doctorFeeLabel = (item) => {
  const fee = Number(
    item?.consultation_fee ?? item?.global_fee ?? item?.fee ?? item?.consult_fee,
  );
  if (!Number.isFinite(fee) || fee < 0) return '';
  return formatRupee(fee);
};

export const getBannerImageUri = (item) => {
  if (typeof item === 'string' && /^https?:\/\//i.test(item.trim())) return item.trim();
  const uri =
    item?.media_url ||
    item?.image_url ||
    item?.banner_image ||
    (typeof item?.image === 'string' ? item.image : '') ||
    item?.url ||
    item?.cover_image?.media_url ||
    '';
  return String(uri || '').trim();
};

export const isBannerActive = (item) => {
  const visible = item?.is_active ?? item?.visible ?? item?.is_visible;
  return !(visible === false || visible === 0 || visible === '0');
};

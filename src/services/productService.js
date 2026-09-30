import { apiClient } from './apiClient';

const appendQueryParam = (query, key, value) => {
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    query.append(key, String(value));
  }
};

export const getProducts = async (params = {}) => {
  const query = new URLSearchParams();
  [
    'id',
    'section',
    'page',
    'page_size',
    'service_category_id',
    'search',
    'product_subcategory_id',
    'health_category_id',
    'health_disease_id',
    'brand_name_id',
    'variant_id',
  ].forEach((key) => appendQueryParam(query, key, params[key]));
  const qs = query.toString();
  return apiClient(
    qs ? `customers/products/?${qs}` : 'customers/products/',
    { method: 'GET' },
  );
};

export const getHealthCategories = async (options = {}) => {
  const query = new URLSearchParams();
  appendQueryParam(query, 'id', options.id);
  appendQueryParam(query, 'service_category_id', options.service_category_id);
  const qs = query.toString();
  const response = await apiClient(
    qs
      ? `customers/health-categories/?${qs}`
      : 'customers/health-categories/',
    { method: 'GET' },
  );
  if (response?.success !== false) return response;
  const legacyId = options.id || options.service_category_id;
  const legacyQuery = legacyId
    ? `user/health-categories/?category_id=${encodeURIComponent(String(legacyId))}`
    : 'user/health-categories/';
  return apiClient(legacyQuery, { method: 'GET' }, false);
};

export const getHealthDiseases = async (params = {}) => {
  const query = new URLSearchParams();
  const categoryId = String(params?.category_id ?? '').trim();
  if (categoryId) query.set('category_id', categoryId);
  const qs = query.toString();
  return apiClient(
    qs ? `user/health-diseases/?${qs}` : 'user/health-diseases/',
    { method: 'GET' },
  );
};

export const PRODUCT_PAGE_SIZE = 20;

export const hasMoreProductPages = (response, resultsLength, pageSize = PRODUCT_PAGE_SIZE) => {
  const data = response?.data;
  if (data && typeof data === 'object' && data.next != null && data.next !== '') {
    return true;
  }
  if (
    data &&
    typeof data === 'object' &&
    typeof data.count === 'number' &&
    typeof data.page === 'number'
  ) {
    return data.page * pageSize < data.count;
  }
  return resultsLength >= pageSize;
};

export const getProductCategories = async (parentId, serviceCategoryId) => {
  const query = new URLSearchParams();
  if (parentId) query.set('id', String(parentId));
  if (serviceCategoryId) query.set('service_category_id', String(serviceCategoryId));
  const qs = query.toString();
  return apiClient(
    qs ? `customers/product-categories/?${qs}` : 'customers/product-categories/',
    { method: 'GET' },
  );
};

export const getProductByVariant = async (variantId) =>
  apiClient(`customers/products/?variant_id=${encodeURIComponent(String(variantId))}`, {
    method: 'GET',
  });

export const PRODUCT_SECTION_LABELS = {
  home: 'For you',
  featured: 'Featured',
  personalized: 'Picked for you',
  trending: 'Trending',
  best_sellers: 'Best sellers',
  new_arrivals: 'New arrivals',
  related: 'Customers also bought',
  similar: 'Similar products',
  recently_viewed: 'Recently viewed',
};

export const getProductDiscovery = async ({
  section,
  productId,
  page = 1,
  page_size = 12,
} = {}) => {
  const query = new URLSearchParams();
  appendQueryParam(query, 'section', section);
  appendQueryParam(query, 'product_id', productId);
  appendQueryParam(query, 'page', page);
  appendQueryParam(query, 'page_size', page_size);
  const qs = query.toString();
  return apiClient(
    qs ? `customers/products/discovery/?${qs}` : 'customers/products/discovery/',
    { method: 'GET' },
  );
};

export const getReviews = async (payload = {}) => {
  const query = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  return apiClient(qs ? `review/?${qs}` : 'review/', { method: 'GET' });
};

export const toggleWishlistProduct = async (variantId) =>
  apiClient(`favorites/products/?variant_id=${encodeURIComponent(String(variantId))}`, {
    method: 'POST',
  });

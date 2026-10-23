import { apiClient } from './apiClient';

// Port of the app's services/HomeServices.tsx (same endpoints and query params).
const appendParam = (query, key, value) => {
  if (value == null) return;
  const text = String(value).trim();
  if (!text) return;
  query.set(key, text);
};

const withQuery = (base, query) => {
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
};

export const getHomeCategory = async () =>
  apiClient('customers/dashboard/categories/', { method: 'GET' }, false);

/** GET customers/doctors/?suggested=true[&health_disease_id] */
export const getSuggestedDoctor = async (options) => {
  const query = new URLSearchParams();
  query.set('suggested', 'true');
  appendParam(query, 'health_disease_id', options?.health_disease_id);
  return apiClient(`customers/doctors/?${query.toString()}`, { method: 'GET' });
};

/** GET customers/doctors/?page_size=12[&health_disease_id] */
export const getDoctorsBrowse = async (options) => {
  const query = new URLSearchParams();
  query.set('page_size', String(options?.page_size ?? 12));
  appendParam(query, 'health_disease_id', options?.health_disease_id);
  return apiClient(`customers/doctors/?${query.toString()}`, { method: 'GET' });
};

export const getSuggestedProducts = async (options) => {
  const query = new URLSearchParams();
  appendParam(query, 'health_disease_id', options?.health_disease_id);
  return apiClient(withQuery('customers/suggested/products/', query), { method: 'GET' });
};

export const getSuggestedMedicines = async (options) => {
  const query = new URLSearchParams();
  appendParam(query, 'health_disease_id', options?.health_disease_id);
  return apiClient(withQuery('customers/suggested/medicines/', query), { method: 'GET' });
};

/** GET customers/products/?page&page_size[&service_category_id][&health_disease_id] */
export const getHomeProducts = async (options) => {
  const query = new URLSearchParams();
  query.set('page', String(options?.page ?? 1));
  query.set('page_size', String(options?.page_size ?? 12));
  appendParam(query, 'service_category_id', options?.service_category_id);
  appendParam(query, 'health_disease_id', options?.health_disease_id);
  return apiClient(`customers/products/?${query.toString()}`, { method: 'GET' });
};

export const getSuggestedDietPlans = async (options) => {
  const query = new URLSearchParams();
  appendParam(query, 'health_disease_id', options?.health_disease_id);
  return apiClient(withQuery('customers/suggested/diet-plans/', query), { method: 'GET' });
};

/** GET patients/diet-plans/?page_size=12[&health_disease_id] */
export const getDietPlansBrowse = async (options) => {
  const query = new URLSearchParams();
  query.set('page_size', String(options?.page_size ?? 12));
  appendParam(query, 'health_disease_id', options?.health_disease_id);
  return apiClient(`patients/diet-plans/?${query.toString()}`, { method: 'GET' });
};

export const getBanners = async () =>
  apiClient('customers/banners/', { method: 'GET' });

/** App YogaServices.getYogaSession: optional health_category_id / health_disease_id / search. */
export const getYogaSession = async (params) => {
  const query = new URLSearchParams();
  appendParam(query, 'health_category_id', params?.health_category_id);
  appendParam(query, 'health_disease_id', params?.health_disease_id);
  appendParam(query, 'search', params?.search);
  return apiClient(withQuery('yoga/sessions/', query), { method: 'GET' });
};

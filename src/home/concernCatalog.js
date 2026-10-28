import { getServiceCategoryId, normalizeServiceCategories } from './serviceCategories';

/** Items shown per concern rail (suggested and general). */
export const CONCERN_RAIL_SIZE = 12;

const text = (value) => String(value ?? '').trim();

/**
 * Health concern -> service categories (Doctor / Products / Medicine).
 * The ids come from GET customers/dashboard/categories/; nothing is hard-coded.
 * Returns { consult, products, medicine }, each { id, name } (id is null when the
 * backend does not expose that service category).
 */
export const resolveConcernServices = (categories) => {
  const list = normalizeServiceCategories(categories);
  const pick = (key) => {
    const id = getServiceCategoryId(list, key);
    if (!id) return { id: null, name: '' };
    const match = list.find(
      (item) => text(item?.id ?? item?.service_category_id ?? item?.category_id) === id,
    );
    return { id, name: text(match?.name ?? match?.category_name ?? match?.title) };
  };
  return { consult: pick('consult'), products: pick('products'), medicine: pick('medicine') };
};

/**
 * customers/products/ filter for items linked to a health concern through one service
 * category: health_category_id (+ health_disease_id when a condition is picked) AND
 * service_category_id. Empty when either side is unknown so nothing unscoped is requested.
 */
export const buildConcernFilter = ({ concernId, diseaseId, serviceId } = {}) => {
  const concern = text(concernId);
  const service = text(serviceId);
  if (!concern || !service) return {};
  const disease = text(diseaseId);
  return {
    health_category_id: concern,
    ...(disease ? { health_disease_id: disease } : {}),
    service_category_id: service,
  };
};

/** customers/products/ filter for the general (not concern-linked) list of one service category. */
export const buildServiceFilter = (serviceId) => {
  const service = text(serviceId);
  return service ? { service_category_id: service } : {};
};

/** Case-insensitive match of a typed query against any of the given text values. */
export const matchesQuery = (values, query) => {
  const needle = text(query).toLowerCase();
  if (!needle) return true;
  return (Array.isArray(values) ? values : [values]).some((value) =>
    text(value).toLowerCase().includes(needle),
  );
};

export const productSearchValues = (item) => [
  item?.name,
  item?.title,
  item?.product_name,
  item?.brand_name,
  item?.variant_title,
];

/** Narrow an already loaded, concern-scoped list by a typed query (no extra request). */
export const filterItemsByQuery = (items, query, pickValues = productSearchValues) => {
  const list = Array.isArray(items) ? items : [];
  if (!text(query)) return list;
  return list.filter((item) => matchesQuery(pickValues(item), query));
};

const withName = (params, name) => {
  const label = text(name);
  if (label) params.set('name', label);
  return params;
};

/** "View all" for a concern + service category: the health-mode catalog, same API filters. */
export const concernCatalogPath = ({ concernId, serviceId, name } = {}) => {
  const params = new URLSearchParams({ mode: 'health' });
  if (text(concernId)) params.set('category', text(concernId));
  if (text(serviceId)) params.set('service', text(serviceId));
  return `/products/category?${withName(params, name).toString()}`;
};

/** "View all" for suggested doctors (same params the doctors list page reads). */
export const concernDoctorsPath = ({ concernId, diseaseId, name } = {}) => {
  const params = new URLSearchParams();
  if (text(diseaseId)) params.set('disease', text(diseaseId));
  else if (text(concernId)) params.set('category', text(concernId));
  return `/consult/doctors?${withName(params, name).toString()}`;
};
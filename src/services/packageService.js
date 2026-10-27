import { normalizeApiList } from '../home/catalog';
import { apiClient } from './apiClient';

const queryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
};

export const getPackagePlans = (params = {}) =>
  apiClient(`packages/plans/${queryString(params)}`, { method: 'GET' });

export const getPackageKinds = () => apiClient('packages/kinds/', { method: 'GET' });

export const purchasePackage = (packageId, patientId) =>
  apiClient('packages/purchase/', {
    method: 'POST',
    body: JSON.stringify({
      package_id: packageId,
      ...(patientId ? { patient_id: patientId } : {}),
    }),
  });

export const verifyPackagePayment = (payload) =>
  apiClient('packages/verify-payment/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Plan card shape used by the packages page. Purchase vs consult follows the catalog flags. */
export const mapConsultPackage = (row) => {
  if (!row?.id) return null;
  const includes = Array.isArray(row?.benefits?.includes)
    ? row.benefits.includes.map((line) => String(line || '').trim()).filter(Boolean)
    : [];
  const tags = Array.isArray(row?.tags)
    ? row.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : [];
  const action = String(row.button_action || '').trim();
  const purchaseType = String(row.purchase_type || '').trim();
  const booksConsult =
    action === 'book_consultation' ||
    purchaseType === 'open_plan' ||
    row.available_to_all_users === true;
  const canPurchase =
    action === 'purchase_package' ||
    (!booksConsult && (row.can_be_purchased === true || purchaseType === 'prepaid_package'));
  return {
    id: String(row.id),
    name: String(row.name || '').trim() || 'Package',
    description: String(row.description || '').trim(),
    price: money(row.selling_price),
    mrp: money(row.original_price),
    group: String(row.category_name || 'Packages').trim() || 'Packages',
    categoryCode: String(row.category_code || '').trim(),
    badge: tags[0] || '',
    image: String(row.image_url || '').trim(),
    includes,
    mode: canPurchase ? 'purchase' : 'consult',
    billingMode: String(row.billing_mode || 'one_time'),
  };
};

export async function loadConsultPackages() {
  const collected = [];
  for (let page = 1; page <= 10; page += 1) {
    const res = await getPackagePlans({ page, page_size: 100 });
    if (!res || res.success === false || res.aborted) {
      if (page === 1) {
        const error = new Error(res?.message || 'Could not load consultation packages.');
        error.status = res?.status;
        throw error;
      }
      break;
    }
    const batch = normalizeApiList(res).map(mapConsultPackage).filter(Boolean);
    collected.push(...batch);
    if (!res?.data?.next || !batch.length) break;
  }
  return collected;
}

export async function loadPackageKinds() {
  const res = await getPackageKinds();
  if (!res || res.success === false) return [];
  return normalizeApiList(res)
    .map((kind) => ({
      id: String(kind?.id || kind?.code || kind?.name || ''),
      code: String(kind?.code || '').trim(),
      name: String(kind?.name || '').trim(),
      description: String(kind?.description || '').trim(),
      sequence: Number(kind?.sequence) || 0,
    }))
    .filter((kind) => kind.name);
}

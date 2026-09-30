import { apiClient } from './apiClient';

export const createPrescriptionRequest = async (payload) =>
  apiClient('customers/prescription-requests/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getPrescriptionRequests = async (query = {}) => {
  const params = new URLSearchParams();
  if (query.id) params.set('id', String(query.id));
  if (query.status) params.set('status', String(query.status));
  const qs = params.toString();
  return apiClient(
    qs ? `customers/prescription-requests/?${qs}` : 'customers/prescription-requests/',
    { method: 'GET' },
  );
};

export const normalizePrescriptionRequestList = (response) => {
  const root = response?.data ?? response;
  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.results)) return root.results;
  if (Array.isArray(root?.data)) return root.data;
  if (root && typeof root === 'object' && (root.id || root.file_url)) return [root];
  return [];
};

export const extractPrescriptionRequest = (response) => {
  const list = normalizePrescriptionRequestList(response);
  if (list.length) return list[0];
  const root = response?.data ?? response;
  if (root && typeof root === 'object' && (root.id || root.file_url)) return root;
  return null;
};

export const extractUploadUrl = (response) => {
  const root = response?.data ?? response;
  const nested = root?.data ?? root;
  return String(
    nested?.url || root?.url || nested?.image || root?.image || '',
  ).trim();
};

export const getPrescriptionStatus = (item) =>
  String(item?.status || item?.request_status || item?.review_status || '')
    .trim()
    .toLowerCase();

export const isPrescriptionPending = (item) => getPrescriptionStatus(item) === 'pending_review';
export const isPrescriptionApproved = (item) => getPrescriptionStatus(item) === 'approved';
export const isPrescriptionRejected = (item) => getPrescriptionStatus(item) === 'rejected';

export const getStatusLabel = (item) => {
  const status = getPrescriptionStatus(item);
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'pending_review') return 'Waiting for approval';
  if (!status) return 'Submitted';
  return status.replace(/_/g, ' ');
};

export const getRequestedVariants = (item) => {
  const list =
    Array.isArray(item?.requested_variants) && item.requested_variants.length
      ? item.requested_variants
      : Array.isArray(item?.items)
        ? item.items
        : [];
  return list.map((row, index) => {
    const variant = row?.variant || row || {};
    const price = row?.price ?? row?.item_total ?? variant?.selling_price ?? variant?.price ?? null;
    return {
      id: String(row?.id || variant?.variant_id || `requested-${index}`),
      name: String(variant?.variant_title || variant?.name || variant?.product_name || 'Requested item'),
      brand: String(variant?.brand_name || '').trim(),
      size: String(variant?.size || '').trim(),
      image: variant?.image_url || variant?.image || null,
      price: price == null || price === '' ? null : Number(price),
      quantity: Math.max(1, Number(row?.quantity) || 1),
      outOfStock: Boolean(variant?.out_of_stock),
      variant_id: String(variant?.variant_id || row?.variant_id || ''),
    };
  });
};

export const getPrescribedItems = (item) => {
  if (!item) return [];
  const candidates = [
    item.requested_variants,
    item.prescribed_items,
    item.prescribed_products,
    item.items,
    item.medicines,
    item.products,
    item.variants,
    item.matched_items,
  ];
  for (const list of candidates) {
    if (Array.isArray(list) && list.length > 0) return list;
  }
  return [];
};

export const mapPrescribedItem = (raw, index = 0) => {
  const variant = raw?.variant && typeof raw.variant === 'object' ? raw.variant : raw;
  const name =
    variant?.variant_title ||
    variant?.name ||
    raw?.name ||
    raw?.product_name ||
    raw?.title ||
    raw?.medicine_name ||
    `Prescribed item ${index + 1}`;
  const dosage =
    [
      variant?.size || raw?.strength || raw?.dosage || raw?.pack_size,
      raw?.quantity != null
        ? `${raw.quantity} ${raw?.unit || raw?.form || ''}`.trim()
        : raw?.pack_label,
    ]
      .filter(Boolean)
      .join(' • ') || 'From your prescription';
  const image =
    variant?.image_url ||
    raw?.image_url ||
    raw?.image ||
    raw?.thumbnail_url ||
    raw?.cover_image?.media_url ||
    raw?.product_image ||
    null;
  const price =
    variant?.selling_price ??
    raw?.price ??
    raw?.selling_price ??
    raw?.mrp ??
    null;
  const variantId = String(
    variant?.variant_id || raw?.variant_id || raw?.id || raw?.product_variant_id || '',
  );
  return {
    id: variantId || `rx-item-${index}`,
    name: String(name),
    desc: String(dosage),
    price,
    image,
    notes: String(raw?.notes || raw?.instruction || '').trim(),
    variant_id: variantId || undefined,
  };
};

export const getPrescriptionFiles = (item) => {
  const type = String(item?.file_type || 'image');
  const raw = [...(Array.isArray(item?.file_urls) ? item.file_urls : []), item?.file_url];
  const seen = new Set();
  return raw
    .map((value) => String(value || '').trim())
    .filter((uri) => {
      if (!uri || seen.has(uri)) return false;
      seen.add(uri);
      return true;
    })
    .map((uri) => ({ uri, fileType: /\.pdf(\?|$)/i.test(uri) ? 'pdf' : type }));
};

export const formatPrescriptionDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

import { apiClient } from './apiClient';

export const addUpdateCart = async ({ variant_id, quantity, cart_item_id }) => {
  const safeVariantId = String(variant_id ?? '').trim();
  const safeCartItemId = String(cart_item_id ?? '').trim();
  const safeQty = Number(quantity);
  if (!safeVariantId) throw new Error('Missing variant id');
  if (!Number.isFinite(safeQty)) throw new Error('Invalid quantity');

  const query = new URLSearchParams();
  query.set('variant_id', safeVariantId);
  query.set('quantity', String(Math.floor(safeQty)));
  if (safeCartItemId) query.set('cart_item_id', safeCartItemId);

  return apiClient(`cart/?${query.toString()}`, { method: 'POST' });
};

export const getAllCart = async () => apiClient('cart/', { method: 'GET' });

export const getVariantIdFromItem = (item) =>
  String(
    item?.variant_id ??
      item?.variant?.variant_id ??
      item?.variant?.id ??
      '',
  ).trim();

export const getCartLineId = (item) =>
  String(item?.id ?? item?.cart_item_id ?? '').trim();

export const cartMetrics = (data) => {
  const variantQuantities = {};
  let itemCount = 0;

  const add = (item) => {
    const id = getVariantIdFromItem(item);
    const qty = Number(item?.quantity) || 0;
    if (!id || qty <= 0) return;
    variantQuantities[id] = (variantQuantities[id] || 0) + qty;
    itemCount += qty;
  };

  const root = data?.data ?? data ?? {};
  (root?.my_cart?.items || []).forEach(add);
  (root?.prescription_cart?.items || []).forEach((group) => {
    const rows = Array.isArray(group?.items) ? group.items : [group];
    rows.forEach(add);
  });
  if (!itemCount && Array.isArray(root?.items)) root.items.forEach(add);

  return { variantQuantities, itemCount, cartData: root };
};

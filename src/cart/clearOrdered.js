import { getCartLineId, getVariantIdFromItem } from '../services/cartService';

/** Every line in a cart response (my cart + prescription groups), flat. */
export const flattenCartLines = (cartData) => {
  const root = cartData?.data ?? cartData ?? {};
  const lines = [...(Array.isArray(root?.my_cart?.items) ? root.my_cart.items : [])];
  (Array.isArray(root?.prescription_cart?.items) ? root.prescription_cart.items : []).forEach((group) => {
    const rows = Array.isArray(group?.items) ? group.items : [group];
    rows.forEach((row) => lines.push({ ...row, source: row?.source || 'prescribed' }));
  });
  if (!lines.length && Array.isArray(root?.items)) lines.push(...root.items);
  return lines.filter((line) => line && Number(line.quantity) > 0);
};

/**
 * Lines still in the cart that belong to a just-placed order. Matches by cart line id first;
 * by variant id only for ordered items that carried no line id. Other cart lines are kept.
 */
export const pickOrderedCartLines = (cartData, orderedItems = []) => {
  const ordered = Array.isArray(orderedItems) ? orderedItems : [];
  const lineIds = new Set(
    ordered.map((item) => String(item?.cart_item_id ?? item?.id ?? '').trim()).filter(Boolean),
  );
  const variantIds = new Set(
    ordered
      .filter((item) => !String(item?.cart_item_id ?? item?.id ?? '').trim())
      .map((item) => getVariantIdFromItem(item))
      .filter(Boolean),
  );
  return flattenCartLines(cartData).filter((line) => {
    const lineId = getCartLineId(line);
    if (lineId && lineIds.has(lineId)) return true;
    const variantId = getVariantIdFromItem(line);
    return Boolean(variantId) && variantIds.has(variantId);
  });
};
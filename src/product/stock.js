const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const isPrescriptionRequired = (item) => {
  if (!item || typeof item !== 'object') return false;
  const raw =
    item.prescription_required ??
    item.variant?.prescription_required ??
    item.product?.prescription_required;
  return raw === true || raw === 1 || raw === '1' || raw === 'true';
};

export const getProductStockQty = (item) => {
  if (!item || typeof item !== 'object') return null;
  const top = toNumber(item.quantity);
  if (top !== null) return top;
  if (item.variant && typeof item.variant === 'object') {
    const nested = toNumber(item.variant.quantity);
    if (nested !== null) return nested;
  }
  return null;
};

export const getCartInventoryQty = (item) => {
  if (!item || typeof item !== 'object') return null;
  const flagged =
    item.out_of_stock ??
    item.is_out_of_stock ??
    item.variant?.out_of_stock ??
    item.in_stock === false;
  if (flagged === true || flagged === 1 || flagged === 'true') return 0;
  const fromFields =
    toNumber(item.available_quantity) ??
    toNumber(item.stock_quantity) ??
    toNumber(item.variant?.available_quantity) ??
    toNumber(item.variant?.quantity) ??
    toNumber(item.product?.quantity);
  if (fromFields !== null) return fromFields;
  if (item.variant && (item.cart_item_id || item.id)) {
    return toNumber(item.variant.quantity);
  }
  return null;
};

export const isProductOutOfStock = (item) => {
  if (!item || typeof item !== 'object') return true;
  if (
    item.in_stock === false ||
    item.is_available === false ||
    item.available === false
  ) {
    return true;
  }
  const stockQty = getProductStockQty(item);
  if (stockQty === null) return true;
  return stockQty <= 0;
};

export const getAddQtyBlockMessage = (item, nextQty, options = {}) => {
  if (nextQty <= 0) return null;
  if (options.cartLine) {
    const stock = getCartInventoryQty(item);
    if (item?._isOutOfStock || stock === 0) return 'This product is not available';
    if (stock == null) return null;
    if (nextQty > stock) {
      return stock === 1 ? 'Only 1 item available.' : `Only ${stock} items available.`;
    }
    return null;
  }
  if (isProductOutOfStock(item)) return 'This product is not available';
  const stockQty = getProductStockQty(item);
  if (stockQty === null || stockQty <= 0) return 'This product is not available';
  if (nextQty > stockQty) {
    return stockQty === 1 ? 'Only 1 item available.' : `Only ${stockQty} items available.`;
  }
  return null;
};

export const formatOrderStockError = (message) => {
  const text = String(message || '').trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  if (
    lower.includes('out of stock') ||
    lower.includes('out_of_stock') ||
    lower.includes('insufficient stock') ||
    lower.includes('not available') ||
    lower.includes('no stock')
  ) {
    return 'Some items are out of stock. Please update your cart and try again.';
  }
  return null;
};

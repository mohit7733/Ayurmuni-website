import { isProductOutOfStock } from '../product/stock';
import { getCatalogPrice, getCatalogRating } from '../utils/productSearchUtils';

const discountPercent = (item) => {
  const mrp = Number(item?.mrp ?? 0);
  const price = getCatalogPrice(item);
  if (mrp <= price || mrp <= 0) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
};

/** Same comparators the listing pages already use for the selected sort. */
export const compareListedProducts = (sortBy) => {
  switch (sortBy) {
    case 'price_low':
      return (a, b) => getCatalogPrice(a) - getCatalogPrice(b);
    case 'price_high':
      return (a, b) => getCatalogPrice(b) - getCatalogPrice(a);
    case 'rating':
      return (a, b) => getCatalogRating(b) - getCatalogRating(a);
    case 'name':
      return (a, b) => String(a?.name || '').localeCompare(String(b?.name || ''));
    case 'discount':
      return (a, b) => discountPercent(b) - discountPercent(a);
    default:
      return null;
  }
};

/**
 * In-stock products first, out-of-stock last.
 * Applies the selected sort (price, rating, name, discount) within each group.
 * When no sort is selected, keeps the incoming/API order within a group.
 * Ties keep their original relative order (stable).
 *
 * Stock uses the same `isProductOutOfStock` predicate as product cards.
 * Price uses `getCatalogPrice` (`selling_price` ?? `price`).
 */
export const orderListedProducts = (items, options = {}) => {
  const list = Array.isArray(items) ? items : [];
  const sortBy = typeof options === 'string' ? options : options?.sortBy;
  const compare =
    (options && typeof options === 'object' && options.compare) ||
    compareListedProducts(sortBy);

  return list
    .map((item, index) => ({ item, index, out: isProductOutOfStock(item) ? 1 : 0 }))
    .sort((a, b) => {
      if (a.out !== b.out) return a.out - b.out;
      if (compare) {
        const diff = compare(a.item, b.item);
        if (diff) return diff;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.item);
};

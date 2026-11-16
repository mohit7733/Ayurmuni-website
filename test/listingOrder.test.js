import { describe, expect, it } from 'vitest';
import { isProductOutOfStock } from '../src/product/stock';
import { orderListedProducts } from '../src/products/listingOrder';

const p = (id, { quantity, price, selling_price, name, rating, mrp, ...rest } = {}) => ({
  id,
  name: name ?? `P${id}`,
  quantity,
  selling_price,
  price,
  mrp,
  avg_rating: rating,
  ...rest,
});

const ids = (list) => list.map((item) => item.id);

describe('orderListedProducts', () => {
  it('puts in-stock products first and out-of-stock last, keeping API order when no sort is selected', () => {
    const list = [
      p(1, { quantity: 0, price: 100 }),
      p(2, { quantity: 5, price: 300 }),
      p(3, { quantity: 0, price: 50 }),
      p(4, { quantity: 2, price: 10 }),
    ];
    expect(ids(orderListedProducts(list))).toEqual([2, 4, 1, 3]);
    expect(ids(orderListedProducts(list, { sortBy: 'relevance' }))).toEqual([2, 4, 1, 3]);
    expect(orderListedProducts(list, { sortBy: 'relevance' }).map(isProductOutOfStock)).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it('applies price low-to-high and high-to-low within each stock group', () => {
    const list = [
      p(1, { quantity: 0, selling_price: 100 }),
      p(2, { quantity: 5, selling_price: 300 }),
      p(3, { quantity: 0, selling_price: 50 }),
      p(4, { quantity: 2, selling_price: 10 }),
    ];
    expect(ids(orderListedProducts(list, { sortBy: 'price_low' }))).toEqual([4, 2, 3, 1]);
    expect(ids(orderListedProducts(list, { sortBy: 'price_high' }))).toEqual([2, 4, 1, 3]);
  });

  it('keeps a stable order when prices are tied, and treats missing stock as out of stock', () => {
    const list = [
      p('a', { quantity: 3, selling_price: 50 }),
      p('b', { quantity: 8, selling_price: 50 }),
      p('c', { selling_price: 20 }),
      p('d', { quantity: 0, selling_price: 20 }),
      p('e', { in_stock: false, selling_price: 10 }),
    ];
    expect(isProductOutOfStock(list[2])).toBe(true);
    expect(ids(orderListedProducts(list, { sortBy: 'price_low' }))).toEqual(['a', 'b', 'e', 'c', 'd']);
    expect(ids(orderListedProducts(list))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('uses selling_price over price, treats a missing price as 0, and returns a new array', () => {
    const list = [
      p(1, { quantity: 1, price: 999, selling_price: 30 }),
      p(2, { quantity: 1 }),
      p(3, { quantity: 0, selling_price: 5 }),
    ];
    const ordered = orderListedProducts(list, { sortBy: 'price_low' });
    expect(ids(ordered)).toEqual([2, 1, 3]);
    expect(ordered).not.toBe(list);
    expect(ids(list)).toEqual([1, 2, 3]);
    expect(orderListedProducts(null)).toEqual([]);
    expect(orderListedProducts(undefined, { sortBy: 'price_high' })).toEqual([]);
  });
});

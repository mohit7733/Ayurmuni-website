import { describe, expect, it } from 'vitest';
import { pickOrderedCartLines } from '../src/cart/clearOrdered';

const cart = {
  data: {
    my_cart: { items: [
      { id: 'c1', variant_id: 'v1', quantity: 2 },
      { id: 'c2', variant_id: 'v2', quantity: 1 },
      { id: 'c3', variant_id: 'v3', quantity: 0 },
    ] },
    prescription_cart: { items: [{ items: [{ id: 'p1', variant_id: 'v9', quantity: 1 }] }] },
  },
};

describe('pickOrderedCartLines', () => {
  it('returns only the ordered lines by cart line id', () => {
    const out = pickOrderedCartLines(cart, [{ cart_item_id: 'c1', variant_id: 'v1' }, { id: 'p1' }]);
    expect(out.map((l) => l.id)).toEqual(['c1', 'p1']);
  });
  it('falls back to variant id when the ordered item has no line id', () => {
    expect(pickOrderedCartLines(cart, [{ variant_id: 'v2' }]).map((l) => l.id)).toEqual(['c2']);
  });
  it('keeps everything when nothing matches, and handles an already-empty cart', () => {
    expect(pickOrderedCartLines(cart, [{ cart_item_id: 'zz' }])).toEqual([]);
    expect(pickOrderedCartLines({ data: {} }, [{ cart_item_id: 'c1' }])).toEqual([]);
    expect(pickOrderedCartLines(cart, null)).toEqual([]);
  });
});
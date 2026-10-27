import { describe, expect, it } from 'vitest';
import { calculateOrderFees, parseFeeQuoteConfig } from '../src/cart/feeQuote';

const baseQuote = (extra = {}) => ({
  items: [{ product_id: 1, quantity: 2, selling_price: 100, gst_percent: 0 }],
  summary: { item_total: 200, items_after_discount: 200, platform_fee: 0 },
  configurations: { gst: { flat: 10 }, platform_fee: { flat: 5 } },
  ...extra,
});

describe('fee quote coupon handling', () => {
  it('reads coupon code, validity and message from the response', () => {
    const q = parseFeeQuoteConfig(
      baseQuote({ coupon: { code: 'SAVE10', valid: true, discount: 20, message: 'Applied' } }),
      200,
    );
    expect(q.quotedCouponCode).toBe('SAVE10');
    expect(q.couponValid).toBe(true);
    expect(q.couponDiscount).toBe(20);
    expect(q.couponMessage).toBe('Applied');
  });

  it('treats an invalid coupon as zero discount', () => {
    const q = parseFeeQuoteConfig(
      baseQuote({ coupon_code: 'BAD', coupon: { valid: false, discount: 50, message: 'Expired' } }),
      200,
    );
    expect(q.couponValid).toBe(false);
    expect(q.couponDiscount).toBe(0);
  });

  it('uses the API summary when the quote was priced with the requested coupon', () => {
    const quote = parseFeeQuoteConfig(
      baseQuote({
        coupon_code: 'SAVE10',
        summary: { item_total: 200, items_after_discount: 180, coupon_discount: 20 },
      }),
      200,
    );
    const fees = calculateOrderFees({ quote, fallbackSubtotal: 200, localDiscount: 99, couponCode: 'SAVE10' });
    expect(fees.discount).toBe(20);
    expect(fees.itemsAfterDiscount).toBe(180);
    expect(fees.baseAmount).toBe(200);
  });

  it('applies the local discount when the quote did not carry the coupon', () => {
    const quote = parseFeeQuoteConfig(baseQuote(), 200);
    const fees = calculateOrderFees({ quote, fallbackSubtotal: 200, localDiscount: 30, couponCode: 'LOCAL' });
    expect(fees.discount).toBe(30);
    expect(fees.itemsAfterDiscount).toBe(170);
  });

  it('keeps the plain total when no coupon is requested', () => {
    const quote = parseFeeQuoteConfig(baseQuote(), 200);
    const fees = calculateOrderFees({ quote, fallbackSubtotal: 200, localDiscount: 0 });
    expect(fees.discount).toBe(0);
    expect(fees.itemsAfterDiscount).toBe(200);
  });
});
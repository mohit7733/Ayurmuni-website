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

  it('charges the server payable and does not add item GST the quote excluded', () => {
    const quote = parseFeeQuoteConfig(
      {
        items: [
          {
            selling_price: 1896,
            quantity: 2,
            unicommerce_gst_class: { tax_percentage: 5 },
          },
        ],
        summary: {
          item_total: 3792,
          items_after_discount: 3792,
          platform_fee: 40,
          product_gst: 0,
          delivery_amount: 0,
          free_delivery_applicable: true,
          total_payable_amount: 3832,
        },
        configurations: {
          gst: { percent: 5 },
          platform_fee: { flat: 40 },
        },
      },
      3096,
    );
    const fees = calculateOrderFees({ quote, fallbackSubtotal: 3096 });
    expect(fees.baseAmount).toBe(3792);
    expect(fees.gst).toBe(0);
    expect(fees.platformFee).toBe(40);
    expect(fees.shipping).toBe(0);
    expect(fees.total).toBe(3832);
  });

  it('keeps server GST when the payable amount includes it', () => {
    const quote = parseFeeQuoteConfig(
      {
        items: [{ selling_price: 1000, quantity: 1, unicommerce_gst_class: { tax_percentage: 5 } }],
        summary: {
          item_total: 1000,
          items_after_discount: 1000,
          platform_fee: 40,
          product_gst: 50,
          delivery_amount: 0,
          total_payable_amount: 1090,
        },
      },
      1000,
    );
    const fees = calculateOrderFees({ quote, fallbackSubtotal: 1000 });
    expect(fees.gst).toBe(50);
    expect(fees.total).toBe(1090);
  });
});
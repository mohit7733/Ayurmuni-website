import { describe, expect, it } from 'vitest';
import {
  buildConsultationReceiptBillRows,
  mergeReceiptPayment,
  parseConsultationReceiptBreakdown,
  receiptBreakdownIsIncomplete,
  rupeesToPaise,
} from '../src/utils/consultationReceiptUtils';

const labels = (receiptOrBreakdown) =>
  buildConsultationReceiptBillRows(
    receiptOrBreakdown && Object.prototype.hasOwnProperty.call(receiptOrBreakdown, 'consultationFee')
      ? receiptOrBreakdown
      : parseConsultationReceiptBreakdown(receiptOrBreakdown),
  ).map((row) => [row.label, row.effect, row.amount]);

describe('parseConsultationReceiptBreakdown', () => {
  it('maps fees, GST percent and a coupon from payment notes or top-level fields', () => {
    const fromNotes = parseConsultationReceiptBreakdown({
      consultation_fees: 499,
      amount: 619,
      payment_information: {
        payload: {
          payment: {
            entity: {
              notes: { listed_amount: 499, platform_fee: 80, gst_amount: 40, gst_percent: 18 },
            },
          },
        },
      },
    });
    expect(fromNotes.consultationFee).toBe(499);
    expect(fromNotes.platformFee).toBe(80);
    expect(fromNotes.gstAmount).toBe(40);
    expect(fromNotes.gstPercent).toBe(18);
    expect(fromNotes.totalPaid).toBe(619);
    expect(fromNotes.totalsMatch).toBe(true);
    expect(labels({ consultation_fees: 499, platform_fee: 80, gst_amount: 40, gst_percent: 18, amount: 619, coupon_discount: 0 })).toEqual([
      ['Consultation fee', 'add', 499],
      ['Platform fee', 'add', 80],
      ['GST (18%)', 'add', 40],
    ]);

    const discounted = parseConsultationReceiptBreakdown({
      consultation_fee: 499,
      coupon_discount: 50,
      coupon_code: 'WELL50',
      platform_fee: 80,
      gst_amount: 40,
      amount: 569,
    });
    expect(discounted.discount).toBe(50);
    expect(discounted.totalsMatch).toBe(true);
    expect(labels({
      consultation_fee: 499,
      coupon_discount: 50,
      coupon_code: 'WELL50',
      platform_fee: 80,
      gst_amount: 40,
      amount: 569,
    })).toEqual([
      ['Consultation fee', 'add', 499],
      ['Coupon discount (WELL50)', 'subtract', 50],
      ['Platform fee', 'add', 80],
      ['GST', 'add', 40],
    ]);
  });

  it('shows the gateway when the receipt has no card or UPI method', () => {
    expect(parseConsultationReceiptBreakdown({
      consultation_fees: 499,
      amount: 499,
      payment_status: 'success',
      payment_gateway: 'cashfree',
    }).paymentMethod).toBe('Cashfree');

    expect(parseConsultationReceiptBreakdown({
      consultation_fees: 499,
      amount: 499,
      payment_information: {
        payload: { payment: { entity: { method: 'upi' } } },
      },
    }).paymentMethod).toBe('UPI');

    expect(parseConsultationReceiptBreakdown({
      amount: 0,
      payment_information: { source: 'package_entitlement' },
    }).paymentMethod).toBe('Package');
  });

  it('shows ₹0 paid when a package covers the listed consultation fee', () => {
    const parsed = parseConsultationReceiptBreakdown({
      consultation_fees: 499,
      amount: 0,
      payment_method: 'package',
      payment_status: 'success',
      payment_information: { source: 'package_entitlement', listed_amount: '499' },
    });
    expect(parsed.paymentMethod).toBe('Package');
    expect(parsed.consultationFee).toBe(499);
    expect(parsed.totalPaid).toBe(0);
    expect(parsed.packageFunded).toBe(true);
    expect(parsed.packageName).toBe('');
    expect(parsed.packageId).toBe('');
    expect(receiptBreakdownIsIncomplete(parsed)).toBe(false);
    expect(labels(parsed)).toEqual([
      ['Consultation fee', 'add', 499],
      ['Covered by package', 'subtract', 499],
    ]);
  });

  it('reads the package name and purchase id from the receipt', () => {
    const parsed = parseConsultationReceiptBreakdown({
      consultation_fees: 499,
      amount: 0,
      payment_method: 'package',
      package: {
        name: 'Wellness Journey',
        package_purchase_id: 'db13249e-74e7-4ab8-a44e-e689eaf96694',
        package_id: '12bdbc61-57cb-4cae-809c-56956e40a180',
      },
      payment_information: {
        source: 'package_entitlement',
        package_purchase_id: 'db13249e-74e7-4ab8-a44e-e689eaf96694',
      },
    });
    expect(parsed.packageName).toBe('Wellness Journey');
    expect(parsed.packageId).toBe('db13249e-74e7-4ab8-a44e-e689eaf96694');
  });

  it('hides zero lines when only the base fee was charged, and flags a missing breakdown', () => {
    const baseOnly = parseConsultationReceiptBreakdown({
      consultation_fees: 499,
      platform_fee: 0,
      gst_amount: 0,
      amount: 499,
    });
    expect(labels(baseOnly)).toEqual([['Consultation fee', 'add', 499]]);
    expect(baseOnly.totalsMatch).toBe(true);
    expect(receiptBreakdownIsIncomplete(baseOnly)).toBe(false);

    const incomplete = parseConsultationReceiptBreakdown({
      consultation_fees: 499,
      amount: 619,
      payment_type: 'Wallet',
    });
    expect(labels(incomplete)).toEqual([['Consultation fee', 'add', 499]]);
    expect(incomplete.totalPaid).toBe(619);
    expect(incomplete.totalsMatch).toBe(false);
    expect(receiptBreakdownIsIncomplete(incomplete)).toBe(true);
  });

  it('reads the appointment payment summary and skips a second fetch once those lines exist', () => {
    const receipt = { consultation_fees: 499, amount: 619, payment_status: 'paid' };
    expect(receiptBreakdownIsIncomplete(parseConsultationReceiptBreakdown(receipt))).toBe(true);
    const merged = mergeReceiptPayment(receipt, {
      status: 'paid',
      amount: 619,
      gst_percent: 18,
      platform_fee_percent: 10,
      summary: {
        consultation_fee: '499.00',
        coupon_discount: '0.00',
        platform_fee: '80.00',
        gst: '40.00',
        total_payable_amount: '619.00',
        lines: [
          { key: 'consultation_fee', label: 'Consultation fee', effect: 'add', amount: '499.00' },
          { key: 'coupon_discount', label: 'Coupon discount', effect: 'subtract', amount: '0.00' },
          { key: 'platform_fee', label: 'Platform fee', effect: 'add', amount: '80.00' },
          { key: 'gst', label: 'GST', effect: 'add', amount: '40.00' },
        ],
      },
    });
    const parsed = parseConsultationReceiptBreakdown(merged);
    expect(receiptBreakdownIsIncomplete(parsed)).toBe(false);
    expect(parsed.totalsMatch).toBe(true);
    expect(labels(parsed)).toEqual([
      ['Consultation fee', 'add', 499],
      ['Platform fee (10%)', 'add', 80],
      ['GST (18%)', 'add', 40],
    ]);
  });

  it('keeps fractional paise (₹0.99 + ₹0.18 = ₹1.17) and still shows GST of ₹0.18', () => {
    expect(rupeesToPaise(0.99) + rupeesToPaise(0.18)).toBe(rupeesToPaise(1.17));
    const parsed = parseConsultationReceiptBreakdown({
      consultation_fee: 0.99,
      gst_amount: 0.18,
      gst_percent: 18,
      amount: 1.17,
    });
    expect(parsed.consultationFee).toBe(0.99);
    expect(parsed.gstAmount).toBe(0.18);
    expect(parsed.totalPaid).toBe(1.17);
    expect(parsed.totalsMatch).toBe(true);
    expect(receiptBreakdownIsIncomplete(parsed)).toBe(false);
    expect(labels(parsed)).toEqual([
      ['Consultation fee', 'add', 0.99],
      ['GST (18%)', 'add', 0.18],
    ]);

    const fromStrings = parseConsultationReceiptBreakdown({
      consultation_fee: '0.99',
      gst_amount: '0.18',
      gst_percent: '18',
      amount: '1.17',
    });
    expect(fromStrings.totalsMatch).toBe(true);
    expect(labels(fromStrings)).toEqual([
      ['Consultation fee', 'add', 0.99],
      ['GST (18%)', 'add', 0.18],
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { buildDietInvoiceDocument, collectDietBreakup } from '../src/documents/dietInvoice.js';

const quote = {
  diet_plan_id: '17d8bc55-de69-4878-bb6c-827104f2e1fb',
  diet_plan_name: 'Gut-Brain Harmony & Anxiety Calming Diet Plan',
  currency: 'INR',
  fees: {
    gst_amount: '90.00',
    gst_percent: '18.00',
    listed_price: '500.00',
    platform_fee: '0.00',
    platform_fee_percent: '0.00',
    selling_price: '500.00',
    total_payable_amount: '590.00',
  },
  summary: {
    lines: [
      { amount: 500, effect: 'add', key: 'listed_price', label: 'Diet plan price' },
      { amount: 0, effect: 'add', key: 'platform_fee', label: 'Platform fee' },
      { amount: 90, effect: 'add', key: 'gst', label: 'GST' },
    ],
    total_payable_amount: 590,
  },
  total_payable_amount: '590.00',
};

describe('diet invoice breakup', () => {
  it('keeps every server line, including a zero platform fee, and labels GST', () => {
    const { lines, total } = collectDietBreakup(quote);
    expect(lines.map((line) => line.label)).toEqual(['Diet plan price', 'Platform fee', 'GST (18%)']);
    expect(lines.map((line) => line.amount)).toEqual([500, 0, 90]);
    expect(total).toBe(590);
  });

  it('adds discount and GST from fees when the quote has no summary lines', () => {
    const { lines, total } = collectDietBreakup({
      fees: {
        selling_price: '499.00',
        discount_amount: '50.00',
        gst_percent: '18.00',
        gst_amount: '80.82',
        platform_fee: '0.00',
        total_payable_amount: '529.82',
      },
    });
    expect(lines.map((line) => [line.label, line.effect, line.amount])).toEqual([
      ['Diet plan price', 'add', 499],
      ['Discount', 'subtract', 50],
      ['Platform fee', 'add', 0],
      ['GST (18%)', 'add', 80.82],
    ]);
    expect(total).toBe(529.82);
  });

  it('prints the breakup and the paid total on the invoice', () => {
    const doc = buildDietInvoiceDocument({
      quote,
      plan: { id: quote.diet_plan_id, name: quote.diet_plan_name, started_at: '2026-03-01T10:00:00.000Z' },
      profile: { first_name: 'Mohit', last_name: 'Beniwal', phone_number: '9999999999' },
      patients: [],
    });
    expect(doc.documentHeading).toBe('TAX INVOICE');
    expect(doc.variant).toBe('invoice');
    expect(doc.from.title).toBe('Sender:');
    expect(doc.billTo.lines[0]).toBe('Mohit Beniwal');
    expect(doc.lineItems.map((row) => row.description)).toEqual([
      'Gut-Brain Harmony & Anxiety Calming Diet Plan — Diet plan price',
      'Platform fee',
      'GST (18%)',
    ]);
    expect(doc.totals.map((row) => row.value)).toEqual(['1', '-', '500.00', '90.00', '590.00']);
    expect(doc.sections[0].lines).toEqual([
      'Diet plan price: 500.00',
      'Platform fee: 0.00',
      'GST (18%): 90.00',
      'Total payable: 590.00',
    ]);
    expect(doc.rightMeta[0]).toEqual({ label: 'Payment Status', value: 'Paid' });
  });
});

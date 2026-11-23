import { describe, expect, it } from 'vitest';
import { renderDocumentHtml } from '../src/documents/documentHtml.js';
import { buildOrderInvoiceDocument, orderItemName } from '../src/documents/orderInvoice.js';

describe('product invoice', () => {
  it('prints the product name instead of a blank description', () => {
    const item = {
      quantity: 1,
      selling_price: 1199,
      unicommerce_gst_class: { tax_percentage: 5 },
      variant: { variant_title: 'Ashwagandha Capsules' },
    };
    expect(orderItemName(item, 0)).toBe('Ashwagandha Capsules');
    const doc = buildOrderInvoiceDocument({
      id: '10',
      order_code: 'ORD-20261112-000010',
      created_at: '2026-11-12T10:00:00.000Z',
      invoice_date: '2026-11-23T10:00:00.000Z',
      invoice_code: 'INS0050',
      total_amount: 1199,
      customer_name: 'Mohit Beniwal',
      items: [item],
    });
    expect(doc.lineItems[0].description).toBe('Ashwagandha Capsules');
    expect(doc.lineItems[0].rate).toBe('1141.90');
    expect(doc.lineItems[0].taxableValue).toBe('1141.90');
    expect(doc.lineItems[0].tax).toBe('57.10\n(5.0%)');
    expect(doc.lineItems[0].total).toBe('1199.00');
    expect(doc.totals.map((row) => row.value)).toEqual(['1', '', '1141.90', '57.10', '1199.00']);

    const html = renderDocumentHtml(doc, 'Invoice');
    expect(html).toContain('Ashwagandha Capsules');
    expect(html).not.toContain('<td>-</td><td class="num">1</td>');
    expect(html).toContain('Amount (INR)');
    expect(html).toContain('Sender:');
    expect(html).toContain('Invoice Code');
    expect(html).toContain('INS0050');
    expect(html).toContain('ORD-20261112-000010');
    expect(html).toContain('This is a computer generated Invoice');
  });

  it('reads a product name from any of the order fields', () => {
    expect(orderItemName({ product_name: 'Triphala' }, 0)).toBe('Triphala');
    expect(orderItemName({ name: 'Chyawanprash' }, 1)).toBe('Chyawanprash');
    expect(orderItemName({ product: { name: 'Brahmi' } }, 2)).toBe('Brahmi');
    expect(orderItemName({}, 3)).toBe('Product 4');
  });

  it('adds a discount row when a discount was given and keeps the paid total', () => {
    const doc = buildOrderInvoiceDocument({
      order_code: 'ORD-1',
      created_at: '2026-11-12',
      total_amount: 945,
      total_discount: 100,
      coupon_code: 'SAVE100',
      items: [
        {
          product_name: 'Ashwagandha Capsules',
          quantity: 1,
          selling_price: 1000,
          unicommerce_gst_class: { tax_percentage: 5 },
        },
      ],
    });
    expect(doc.lineItems.map((row) => row.description)).toEqual([
      'Ashwagandha Capsules',
      'Discount (SAVE100)',
    ]);
    expect(doc.lineItems[1].taxableValue).toBe('-100.00');
    expect(doc.lineItems[1].total).toBe('-100.00');
    expect(doc.totals[4].value).toBe('945.00');
    const html = renderDocumentHtml(doc);
    expect(html).toContain('Ashwagandha Capsules');
    expect(html).toContain('Discount (SAVE100)');
  });

  it('uses the same invoice layout for a name that only exists on the variant', () => {
    const html = renderDocumentHtml(
      buildOrderInvoiceDocument({
        order_code: 'ORD-2',
        total_amount: 200,
        items: [{ variant: { variant_title: 'Neem Tablets' }, quantity: 2, selling_price: 100 }],
      }),
    );
    expect(html).toContain('Neem Tablets');
    expect(html).toContain('Bill To:');
    expect(html).toContain('E. &amp; OE.');
    expect(html).toContain('Tax Payable on reverse charge basis:');
  });
});

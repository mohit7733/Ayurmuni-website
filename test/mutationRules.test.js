import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/common/utils', () => ({ Utils: { getData: async () => null, storeData: async () => {} } }));
vi.mock('../src/config/key', () => ({ BaseUrl: { base_url: 'https://api.test/' } }));

const { invalidationPrefixesFor } = await import('../src/services/apiClient.js');

describe('targeted invalidation for returns and plans', () => {
  it('creating a return only refreshes order GETs (not cart / promotions)', () => {
    expect(invalidationPrefixesFor('order/abc-1/returns/', 'POST')).toEqual(['order/']);
    expect(invalidationPrefixesFor('order/abc-1/returns', 'POST')).toEqual(['order/']);
  });

  it('other order mutations keep their wider rule', () => {
    expect(invalidationPrefixesFor('order/place/', 'POST')).toContain('cart/');
  });

  it('plan-funded consult payments also refresh plans', () => {
    const prefixes = invalidationPrefixesFor('payments/customer/consultation/payment/book-slot/', 'POST');
    expect(prefixes).toContain('packages/');
    expect(prefixes).toContain('customers/patient/consultation/');
  });

  it('plan verify / purchase invalidate packages only', () => {
    expect(invalidationPrefixesFor('packages/verify-payment/', 'POST')).toEqual(['packages/']);
  });
});
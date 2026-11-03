import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClient = vi.fn();
vi.mock('../src/services/apiClient', () => ({
  apiClient: (...args) => apiClient(...args),
  invalidateApiCache: vi.fn(),
}));

const svc = await import('../src/services/packageService.js');

beforeEach(() => {
  apiClient.mockReset();
});

describe('buildPackageVerifyPayload', () => {
  const purchase = { id: 'pp1' };

  it('order checkout sends order id, payment id and signature', () => {
    expect(
      svc.buildPackageVerifyPayload({
        purchase,
        orderId: 'order_x',
        response: { razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' },
      }),
    ).toEqual({
      purchase_id: 'pp1',
      razorpay_order_id: 'order_x',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig',
    });
  });

  it('prefers the order id returned by Razorpay', () => {
    const payload = svc.buildPackageVerifyPayload({
      purchase,
      orderId: 'order_x',
      response: { razorpay_order_id: 'order_y', razorpay_payment_id: 'p', razorpay_signature: 's' },
    });
    expect(payload.razorpay_order_id).toBe('order_y');
    expect(payload).not.toHaveProperty('razorpay_subscription_id');
  });

  it('subscription checkout keeps razorpay_order_id (empty) and adds the subscription id', () => {
    expect(
      svc.buildPackageVerifyPayload({
        purchase,
        isSubscription: true,
        subscriptionId: 'sub_1',
        response: { razorpay_payment_id: 'pay_2', razorpay_signature: 'sig2' },
      }),
    ).toEqual({
      purchase_id: 'pp1',
      razorpay_order_id: '',
      razorpay_subscription_id: 'sub_1',
      razorpay_payment_id: 'pay_2',
      razorpay_signature: 'sig2',
    });
  });
});

describe('mapMyPackagePurchase', () => {
  it('uses package_id as the catalog id and reads remaining from the consult benefit', () => {
    const mapped = svc.mapMyPackagePurchase({
      id: 'purchase-1',
      package_id: 'pkg-9',
      status: 'active',
      expires_at: '2999-01-01T00:00:00Z',
      benefits: [{ quantity_remaining: 3 }],
    });
    expect(mapped).toMatchObject({ planId: 'pkg-9', active: true, remaining: 3 });
  });

  it('does not treat the purchase id as a package id and flags expired purchases inactive', () => {
    expect(svc.mapMyPackagePurchase({ id: 'purchase-1', status: 'active' })).toBeNull();
    expect(svc.mapMyPackagePurchase({ package_id: 'p', status: 'expired' }).active).toBe(false);
    expect(svc.mapMyPackagePurchase({ package_id: 'p', status: 'active', remaining_sessions: 0 }).remaining).toBe(0);
  });
});

describe('loadMyPackagePurchases', () => {
  it('requests status=active and follows pagination', async () => {
    apiClient
      .mockResolvedValueOnce({ success: true, data: { results: [{ package_id: 'a', status: 'active' }], next: 'x' } })
      .mockResolvedValueOnce({ success: true, data: { results: [{ package_id: 'b', status: 'active' }], next: null } });
    const rows = await svc.loadMyPackagePurchases();
    expect(apiClient.mock.calls.map((c) => c[0])).toEqual([
      'packages/my/?page=1&status=active',
      'packages/my/?page=2&status=active',
    ]);
    expect(rows.map((r) => r.planId)).toEqual(['a', 'b']);
  });

  it('returns [] on failure', async () => {
    apiClient.mockResolvedValue({ success: false });
    expect(await svc.loadMyPackagePurchases()).toEqual([]);
    apiClient.mockRejectedValue(new Error('x'));
    expect(await svc.loadMyPackagePurchases()).toEqual([]);
  });
});
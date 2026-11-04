import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/apiClient', () => ({ apiClient: vi.fn(), invalidateApiCache: vi.fn() }));

const pp = await import('../src/payment/packagePurchase.js');

const fees = {
  selling_price: '2999.00',
  gst_percent: '18.00',
  gst_amount: '539.82',
  platform_fee_percent: '0.00',
  platform_fee: '0.00',
  total_payable_amount: '3538.82',
};
const cashfreeResponse = {
  success: true,
  message: 'Cashfree order created successfully.',
  data: {
    purchase: { id: 'pur-1', paid_price: '3538.82', payment_gateway: 'cashfree', status: 'pending', fees },
    checkout: {
      type: 'order',
      payment_gateway: 'cashfree',
      gateway_order_id: 'cf_order_9',
      amount: '3538.82',
      fees,
      payment_session_id: 'session_abc',
      cashfree_order_id: 'cf_order_9',
    },
  },
};

describe('purchase payload + gateway selection', () => {
  const oneTime = { id: 'pkg-1', billingMode: 'one_time' };
  const autopay = { id: 'pkg-2', billingMode: 'monthly' };
  it('defaults to cashfree and omits empty patient', () => {
    expect(pp.buildPackagePurchasePayload({ item: oneTime })).toEqual({ package_id: 'pkg-1', payment_gateway: 'cashfree' });
  });
  it('sends patient and razorpay when chosen', () => {
    expect(pp.buildPackagePurchasePayload({ item: oneTime, patientId: 'pt', gateway: 'razorpay' })).toEqual({
      package_id: 'pkg-1', patient_id: 'pt', payment_gateway: 'razorpay',
    });
  });
  it('never sends icici on the web', () => {
    expect(pp.resolvePackageGateway(oneTime, 'icici')).toBe('cashfree');
  });
  it('autopay forces razorpay even when cashfree is picked', () => {
    expect(pp.isAutopayPackage(autopay)).toBe(true);
    expect(pp.packageGatewayChoices(autopay, ['cashfree', 'razorpay'])).toEqual(['razorpay']);
    expect(pp.buildPackagePurchasePayload({ item: autopay, gateway: 'cashfree' }).payment_gateway).toBe('razorpay');
    expect(pp.isAutopayPackage({ purchaseType: 'autopay_subscription' })).toBe(true);
  });
});

describe('fee mapping', () => {
  it('maps server strings without recomputing', () => {
    const mapped = pp.mapPackageFees(fees);
    expect(mapped.rows.map((r) => r.label)).toEqual(['Package price', 'GST (18%)', 'Platform fee']);
    expect(mapped.rows[1].value).toContain('539.82');
    expect(mapped.total).toContain('3,538.82');
    expect(mapped.totalRaw).toBe('3538.82');
  });
  it('uses the server percent, not a hardcoded 18', () => {
    expect(pp.mapPackageFees({ ...fees, gst_percent: '5.00', gst_amount: '149.95', total_payable_amount: '3148.95' }).rows[1].label).toBe('GST (5%)');
  });
  it('returns null without a total', () => {
    expect(pp.mapPackageFees({ selling_price: '1' })).toBeNull();
  });
});

describe('parsePackagePurchase', () => {
  it('cashfree: session + gateway order id + server amount', () => {
    const p = pp.parsePackagePurchase(cashfreeResponse, 'cashfree');
    expect(p.error).toBe('');
    expect(p.gateway).toBe('cashfree');
    expect(p.sessionId).toBe('session_abc');
    expect(p.gatewayOrderId).toBe('cf_order_9');
    expect(p.amountPaise).toBe(353882);
  });
  it('rejects a mismatch between paid_price and checkout.amount', () => {
    const bad = structuredClone(cashfreeResponse);
    bad.data.checkout.amount = '2999.00';
    expect(pp.parsePackagePurchase(bad).error).toMatch(/mismatch/);
  });
  it('razorpay order needs key + gateway order id', () => {
    const r = structuredClone(cashfreeResponse);
    r.data.checkout.payment_gateway = 'razorpay';
    r.data.checkout.gateway_order_id = 'order_R1';
    expect(pp.parsePackagePurchase(r).error).not.toBe('');
    r.data.razorpay_key = 'rzp_test';
    const p = pp.parsePackagePurchase(r);
    expect(p.error).toBe('');
    expect(p.gatewayOrderId).toBe('order_R1');
  });
  it('autopay subscription uses razorpay_subscription_id', () => {
    const r = structuredClone(cashfreeResponse);
    r.data.razorpay_key = 'rzp_test';
    Object.assign(r.data.checkout, { type: 'subscription', payment_gateway: 'razorpay', gateway_order_id: '', razorpay_subscription_id: 'sub_1' });
    const p = pp.parsePackagePurchase(r);
    expect(p.isSubscription).toBe(true);
    expect(p.error).toBe('');
    expect(p.subscriptionId).toBe('sub_1');
  });
});

describe('verify payload', () => {
  it('cashfree sends purchase id + gateway order id', () => {
    const p = pp.parsePackagePurchase(cashfreeResponse);
    expect(pp.buildPackageGatewayVerifyPayload(p, {})).toEqual({
      purchase_id: 'pur-1', payment_gateway: 'cashfree', gateway_order_id: 'cf_order_9',
    });
    expect(pp.buildPackageGatewayVerifyPayload(p, { gateway_payment_id: 'cfp' }).gateway_payment_id).toBe('cfp');
  });
  it('razorpay order uses the app field names', () => {
    const p = { gateway: 'razorpay', purchaseId: 'pur-1', gatewayOrderId: 'order_R1', isSubscription: false };
    expect(pp.buildPackageGatewayVerifyPayload(p, { razorpay_payment_id: 'pay', razorpay_signature: 'sig' })).toEqual({
      purchase_id: 'pur-1', razorpay_order_id: 'order_R1', razorpay_payment_id: 'pay', razorpay_signature: 'sig',
    });
  });
  it('razorpay subscription adds the subscription id', () => {
    const p = { gateway: 'razorpay', purchaseId: 'pur-1', gatewayOrderId: '', subscriptionId: 'sub_1', isSubscription: true };
    expect(pp.buildPackageGatewayVerifyPayload(p, { razorpay_payment_id: 'pay', razorpay_signature: 'sig' })).toMatchObject({
      purchase_id: 'pur-1', razorpay_order_id: '', razorpay_subscription_id: 'sub_1',
    });
  });
});
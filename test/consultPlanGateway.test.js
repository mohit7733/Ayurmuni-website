import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClient = vi.fn();
vi.mock('../src/services/apiClient', () => ({ apiClient: (...args) => apiClient(...args) }));
vi.mock('../src/config/key', () => ({ showSuccessToast: vi.fn(), BaseUrl: 'http://x/' }));
vi.mock('../src/common/utils', () => ({ Utils: {} }));

const consult = await import('../src/services/consultService.js');
const orders = await import('../src/services/orderService.js');
const gw = await import('../src/payment/gateways.js');
const cp = await import('../src/consult/consultPayment.js');
const ov = await import('../src/payment/orderVerify.js');
const rz = await import('../src/payment/razorpayCheckout.js');

beforeEach(() => {
  apiClient.mockReset();
  apiClient.mockResolvedValue({ success: true });
});

describe('consultService plan + gateway plumbing', () => {
  it('fee-quote sends package_purchase_id and coupon', async () => {
    await consult.getConsultationFeeQuote('s1', 'SAVE', 'pp1');
    const url = apiClient.mock.calls[0][0];
    expect(url).toContain('slot_id=s1');
    expect(url).toContain('coupon_code=SAVE');
    expect(url).toContain('package_purchase_id=pp1');
  });

  it('fee-quote omits package_purchase_id when not given', async () => {
    await consult.getConsultationFeeQuote('s1');
    expect(apiClient.mock.calls[0][0]).not.toContain('package_purchase_id');
  });

  it('book-slot sends package_purchase_id and normalises payment_gateway', async () => {
    await consult.createConsultationPayment({ slot_id: 's1', package_purchase_id: 'pp1', payment_gateway: 'RAZORPAY', coupon_code: '' });
    const [url, init] = apiClient.mock.calls[0];
    expect(url).toBe('payments/customer/consultation/payment/book-slot/');
    expect(JSON.parse(init.body)).toEqual({ slot_id: 's1', package_purchase_id: 'pp1', payment_gateway: 'razorpay' });
  });

  it('book-slot maps unknown gateways to cashfree', async () => {
    await consult.createConsultationPayment({ slot_id: 's1', payment_gateway: 'payphi' });
    expect(JSON.parse(apiClient.mock.calls[0][1].body).payment_gateway).toBe('cashfree');
  });

  it('retry adds payment_gateway to query and body only when given', async () => {
    await consult.retryConsultationPayment('a1', 'razorpay');
    expect(apiClient.mock.calls[0][0]).toBe(
      'payments/customer/consultation/payment/retry/?appointment_id=a1&payment_gateway=razorpay',
    );
    expect(JSON.parse(apiClient.mock.calls[0][1].body)).toEqual({ payment_gateway: 'razorpay' });
    await consult.retryConsultationPayment('a1');
    expect(apiClient.mock.calls[1][0]).toBe('payments/customer/consultation/payment/retry/?appointment_id=a1');
    expect(JSON.parse(apiClient.mock.calls[1][1].body)).toEqual({});
  });

  it('verify keeps the four keys and adds payment_gateway only when set', async () => {
    await consult.verifyConsultationPayment({
      payment_id: 'p', gateway_order_id: 'o', gateway_payment_id: 'g', gateway_signature: 's', payment_gateway: 'razorpay', extra: 1,
    });
    expect(JSON.parse(apiClient.mock.calls[0][1].body)).toEqual({
      payment_id: 'p', gateway_order_id: 'o', gateway_payment_id: 'g', gateway_signature: 's', payment_gateway: 'razorpay',
    });
    await consult.verifyConsultationPayment({ payment_id: 'p', gateway_order_id: 'o', gateway_payment_id: 'g', gateway_signature: 's' });
    expect(JSON.parse(apiClient.mock.calls[1][1].body)).not.toHaveProperty('payment_gateway');
  });
});

describe('order payload gateway', () => {
  it('defaults prepaid to cashfree and honours razorpay', () => {
    expect(orders.buildOrderPayload({ mode: 'prepaid', cartItems: [] }).payment_gateway).toBe('cashfree');
    expect(orders.buildOrderPayload({ mode: 'prepaid', cartItems: [], payment_gateway: 'razorpay' }).payment_gateway).toBe('razorpay');
    expect(orders.buildOrderPayload({ mode: 'cod', cartItems: [] })).not.toHaveProperty('payment_gateway');
  });
});

describe('gateways helpers', () => {
  it('parses and normalises gateway ids', () => {
    expect(gw.parsePaymentGateway(' Razorpay ')).toBe('razorpay');
    expect(gw.parsePaymentGateway('icici')).toBeNull();
    expect(gw.toApiPaymentGateway('nope')).toBe('cashfree');
  });

  it('resolves enabled gateways from array, map and flags', () => {
    expect(gw.resolveEnabledGateways(null)).toEqual(['cashfree', 'razorpay']);
    expect(gw.resolveEnabledGateways({ payment_gateways: ['razorpay'] })).toEqual(['razorpay']);
    expect(gw.resolveEnabledGateways({ payment_gateways: { cashfree: false, razorpay: true } })).toEqual(['razorpay']);
    expect(gw.resolveEnabledGateways({ cashfree_enabled: 'false' })).toEqual(['razorpay']);
    expect(gw.resolveEnabledGateways({ cashfree_enabled: false, razorpay_enabled: 0 })).toEqual(['cashfree']);
    expect(gw.resolveEnabledGateways({ payment_gateways: ['icici'] })).toEqual(['cashfree']);
  });

  it('defaults to cashfree, then razorpay', () => {
    expect(gw.resolveDefaultGateway({}, ['cashfree', 'razorpay'])).toBe('cashfree');
    expect(gw.resolveDefaultGateway({}, ['razorpay'])).toBe('razorpay');
  });

  it('reads gateway order ids and detects a gateway order', () => {
    expect(gw.getGatewayOrderId({ razorpay_order_id: 'order_1' }, 'razorpay')).toBe('order_1');
    expect(gw.getGatewayOrderId({ cashfree_order_id: 'cf1' }, 'cashfree')).toBe('cf1');
    expect(gw.getGatewayOrderId({ payment_session_id: 's', order_id: 'o9' }, 'cashfree')).toBe('o9');
    expect(gw.hasGatewayOrder({})).toBe(false);
    expect(gw.hasGatewayOrder({ payment_session_id: 's' })).toBe(true);
  });
});

describe('consultPayment helpers', () => {
  it('detects bookings that need no gateway', () => {
    expect(cp.isBookingAlreadyPaid({ status: 'CONFIRMED' })).toBe(true);
    expect(cp.isBookingAlreadyPaid({ funded_by_package: true })).toBe(true);
    expect(cp.isBookingAlreadyPaid({ package_purchase_id: 'x' })).toBe(true);
    expect(cp.isBookingAlreadyPaid({ status: 'CONFIRMED', razorpay_order_id: 'order_1' })).toBe(false);
    expect(cp.isBookingAlreadyPaid({ status: 'pending' })).toBe(false);
  });

  it('detects duplicate gateway orders', () => {
    expect(cp.isDuplicateGatewayOrder({ data: { errors: { error_code: 'duplicate_request' } } })).toBe(true);
    expect(cp.isDuplicateGatewayOrder({ errors: { error_message: 'Duplicate merchant reference' } })).toBe(true);
    expect(cp.isDuplicateGatewayOrder({ data: {} })).toBe(false);
  });

  it('picks razorpay key and order id (never a UUID)', () => {
    expect(cp.pickConsultRazorpayKey({ key_id: ' rzp_1 ' })).toBe('rzp_1');
    expect(cp.pickConsultRazorpayOrderId({ gateway_order_id: 'order_abc' })).toBe('order_abc');
    expect(cp.pickConsultRazorpayOrderId({ gateway_order_id: '0b9a1a52-1f4e-4a47-9c25-5d7a8c9bd0aa' })).toBe('');
  });

  it('reads package_funding from the plan fee-quote', () => {
    const ok = cp.readPlanFunding({
      success: true,
      data: { package_funding: { can_fund: true, total_payable_amount: '118.00', quantity_remaining: 2 } },
    });
    expect(ok).toMatchObject({ canFund: true, payable: 118, quantityRemaining: 2, reason: '' });
    const no = cp.readPlanFunding({ success: true, data: { package_funding: { can_fund: false, ineligible_reason: 'Wrong doctor' } } });
    expect(no).toMatchObject({ canFund: false, reason: 'Wrong doctor', payable: null });
    expect(cp.readPlanFunding({ success: false, message: 'boom' }).reason).toBe('boom');
    expect(cp.readPlanFunding({ success: false }).reason).toBe(cp.PLAN_NOT_ELIGIBLE);
    expect(cp.readPlanFunding({ success: true, data: { package_funding: { can_fund: true }, summary: {} } }).payable).toBe(0);
  });

  it('derives plan consult state from benefits and expiry', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const plan = (benefits, expires_at) => ({ benefits, expires_at });
    expect(cp.getPlanConsultState(plan([{ label: 'Doctor Consultation', quantity_remaining: 1 }]), now)).toBe('usable');
    expect(cp.getPlanConsultState(plan([{ label: 'Doctor Consultation', quantity_remaining: 0 }]), now)).toBe('exhausted');
    expect(cp.getPlanConsultState(plan([{ label: 'Doctor Consultation', status: 'used' }]), now)).toBe('exhausted');
    expect(cp.getPlanConsultState(plan([{ label: 'Diet chart' }]), now)).toBe('no_consult');
    expect(cp.getPlanConsultState(plan([{ label: 'Doctor Consultation' }], '2025-12-31T00:00:00Z'), now)).toBe('expired');
  });

  it('prefers the doctor consultation benefit and labels remaining counts', () => {
    const plan = { benefits: [{ label: 'Diet consultation', quantity_remaining: 9 }, { label: 'Doctor Consultation', quantity_remaining: 1, quantity_total: 3 }] };
    expect(cp.getConsultBenefit(plan).label).toBe('Doctor Consultation');
    expect(cp.planRemainingLabel(plan, true)).toBe('1 of 3 consultation left');
    expect(cp.planRemainingLabel({ benefits: [{ label: 'Consultation' }] })).toBe('Unlimited consultations');
  });
});

describe('prepaid verify helpers', () => {
  it('builds the razorpay order verify body', () => {
    const body = ov.buildRazorpayOrderVerifyPayload({
      paymentId: 'p1', orderId: 'order_1', result: { razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' },
    });
    expect(body).toMatchObject({
      payment_id: 'p1', razorpay_order_id: 'order_1', gateway_order_id: 'order_1',
      razorpay_payment_id: 'pay_1', gateway_payment_id: 'pay_1', gateway_signature: 'sig', payment_gateway: 'razorpay',
    });
  });

  it('accepts a paid razorpay result unless it is a hard failure or stock rejection', () => {
    const paid = { razorpay_payment_id: 'pay_1' };
    expect(ov.isPrepaidVerifyAcceptable({ success: true }, paid)).toBe(true);
    expect(ov.isPrepaidVerifyAcceptable({ success: false, message: 'Unicommerce sync error' }, paid)).toBe(true);
    expect(ov.isPrepaidVerifyAcceptable({ success: false, message: 'Invalid signature' }, paid)).toBe(false);
    expect(ov.isPrepaidVerifyAcceptable({ success: false, message: 'Item out of stock' }, paid)).toBe(false);
    expect(ov.isPrepaidVerifyAcceptable({ success: false, message: 'oops' }, {})).toBe(false);
  });

  it('converts rupees to paise', () => {
    expect(rz.toRazorpayPaise(118.5)).toBe(11850);
    expect(rz.toRazorpayPaise(undefined, 10)).toBe(1000);
    expect(rz.toRazorpayPaise(0, 0)).toBe(0);
  });
});
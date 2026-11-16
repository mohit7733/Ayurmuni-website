import { describe, expect, it } from 'vitest';
import {
  buildDietPurchasePayload,
  buildDietVerifyPayload,
  dietPlanNeedsPurchase,
  isDietAlreadyPurchasedMessage,
  isDietPaymentVerified,
  mapDietFees,
  parseDietPurchase,
  resolveDietGateway,
} from '../src/payment/dietPurchase.js';

const fees = {
  selling_price: '499.00',
  discount_amount: '50.00',
  gst_percent: '18.00',
  gst_amount: '80.82',
  platform_fee_percent: '0.00',
  platform_fee: '0.00',
  total_payable_amount: '529.82',
};

const cashfreeResponse = {
  success: true,
  message: 'Cashfree order created successfully.',
  data: {
    purchase: {
      id: 'pur-1',
      paid_price: '529.82',
      payment_gateway: 'cashfree',
      status: 'pending',
      invoice_no: 'INV-19',
      created_at: '2026-03-01T10:00:00.000Z',
      fees,
    },
    checkout: {
      payment_gateway: 'cashfree',
      gateway_order_id: 'cf_order_9',
      amount: '529.82',
      fees,
      payment_session_id: 'session_abc',
      cashfree_order_id: 'cf_order_9',
    },
  },
};

describe('diet purchase payload', () => {
  it('defaults to cashfree and omits an empty patient', () => {
    expect(buildDietPurchasePayload({ dietPlanId: 'plan-1' })).toEqual({
      diet_plan_id: 'plan-1',
      payment_gateway: 'cashfree',
    });
  });

  it('always sends cashfree, even if another gateway is requested', () => {
    expect(
      buildDietPurchasePayload({
        dietPlanId: 'plan-1',
        patientId: 'pt-1',
        gateway: 'razorpay',
        enabled: ['cashfree', 'razorpay'],
      }),
    ).toEqual({
      diet_plan_id: 'plan-1',
      patient_id: 'pt-1',
      payment_gateway: 'cashfree',
    });
    expect(resolveDietGateway('razorpay')).toBe('cashfree');
    expect(resolveDietGateway('icici')).toBe('cashfree');
  });
});

describe('who pays before start', () => {
  it('charges a priced plan that has not started', () => {
    expect(dietPlanNeedsPurchase({ is_paid: true, price: 499 }, 'not_started')).toBe(true);
    expect(dietPlanNeedsPurchase({ price: 499 }, 'not_started')).toBe(true);
  });

  it('starts free plans directly', () => {
    expect(dietPlanNeedsPurchase({ is_paid: false, price: 499 }, 'not_started')).toBe(false);
    expect(dietPlanNeedsPurchase({ is_paid: true, price: 0 }, 'not_started')).toBe(false);
    expect(dietPlanNeedsPurchase({ price: 0 }, 'not_started')).toBe(false);
  });

  it('does not charge resume, repeat, or start-again', () => {
    const paid = { is_paid: true, price: 499 };
    expect(dietPlanNeedsPurchase(paid, 'paused')).toBe(false);
    expect(dietPlanNeedsPurchase(paid, 'completed')).toBe(false);
    expect(dietPlanNeedsPurchase(paid, 'stopped')).toBe(false);
    expect(dietPlanNeedsPurchase(paid, 'active')).toBe(false);
  });
});

describe('invoice rows', () => {
  it('maps the server breakdown without recomputing', () => {
    const mapped = mapDietFees(fees);
    expect(mapped.rows.map((row) => row.label)).toEqual([
      'Diet plan',
      'Discount',
      'GST (18%)',
      'Platform fee',
    ]);
    expect(mapped.rows[1].value).toContain('50');
    expect(mapped.rows[1].deduct).toBe(true);
    expect(mapped.total).toContain('529.82');
    expect(mapped.totalRaw).toBe('529.82');
  });
});

describe('parseDietPurchase', () => {
  it('reads the cashfree session, order, and invoice', () => {
    const parsed = parseDietPurchase(cashfreeResponse, 'cashfree');
    expect(parsed.error).toBe('');
    expect(parsed.skipGateway).toBe(false);
    expect(parsed.purchaseId).toBe('pur-1');
    expect(parsed.sessionId).toBe('session_abc');
    expect(parsed.gatewayOrderId).toBe('cf_order_9');
    expect(parsed.amountPaise).toBe(52982);
    expect(parsed.invoiceNo).toBe('INV-19');
    expect(parsed.fees.total).toContain('529.82');
  });

  it('refuses a non-cashfree checkout', () => {
    const response = {
      success: true,
      data: {
        purchase: { id: 'pur-2', paid_price: '499.00', payment_gateway: 'razorpay', status: 'pending' },
        checkout: {
          payment_gateway: 'razorpay',
          gateway_order_id: 'order_rz_1',
          amount: '499.00',
        },
        razorpay_key: 'rzp_test_key',
      },
    };
    expect(parseDietPurchase(response, 'cashfree').error).toMatch(/cashfree/i);
  });

  it('shows a diet plan row when the server only sent a total', () => {
    const mapped = mapDietFees({ total_payable_amount: '500.00' });
    expect(mapped.rows.map((row) => row.label)).toEqual(['Diet plan']);
    expect(mapped.total).toContain('500');
  });

  it('rejects a mismatch between paid_price and checkout.amount', () => {
    const bad = structuredClone(cashfreeResponse);
    bad.data.checkout.amount = '1.00';
    expect(parseDietPurchase(bad, 'cashfree').error).toMatch(/mismatch/i);
  });

  it('skips the gateway when the purchase is already paid', () => {
    const paid = structuredClone(cashfreeResponse);
    paid.data.purchase.status = 'paid';
    const parsed = parseDietPurchase(paid, 'cashfree');
    expect(parsed.skipGateway).toBe(true);
    expect(parsed.error).toBe('');
  });

  it('recognises an already-purchased message', () => {
    expect(isDietAlreadyPurchasedMessage('Plan already purchased')).toBe(true);
    expect(isDietAlreadyPurchasedMessage('Gateway timeout')).toBe(false);
  });
});

describe('verify payload', () => {
  const parsed = { purchaseId: 'pur-1', gatewayOrderId: 'cf_order_9', gateway: 'cashfree' };

  it('sends cashfree purchase id and order id', () => {
    expect(buildDietVerifyPayload(parsed, { gateway_payment_id: 'cfpay_1' })).toEqual({
      purchase_id: 'pur-1',
      gateway_order_id: 'cf_order_9',
      gateway_payment_id: 'cfpay_1',
      cf_payment_id: 'cfpay_1',
      cashfree_order_id: 'cf_order_9',
    });
  });

  it('sends the razorpay signature fields', () => {
    expect(
      buildDietVerifyPayload(
        { ...parsed, gateway: 'razorpay', gatewayOrderId: 'order_rz_1' },
        { razorpay_order_id: 'order_rz_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' },
      ),
    ).toEqual({
      purchase_id: 'pur-1',
      gateway_order_id: 'order_rz_1',
      gateway_payment_id: 'pay_1',
      gateway_signature: 'sig',
      razorpay_order_id: 'order_rz_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig',
    });
  });
});

describe('verify result', () => {
  it('accepts a successful verify and rejects a pending one', () => {
    expect(isDietPaymentVerified({ success: true, data: { status: 'paid' } })).toBe(true);
    expect(isDietPaymentVerified({ success: true, data: { status: 'pending' } })).toBe(false);
    expect(isDietPaymentVerified({ success: false, message: 'Payment failed' })).toBe(false);
  });
});

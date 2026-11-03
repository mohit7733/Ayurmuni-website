import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClient = vi.fn();
vi.mock('../src/services/apiClient', () => ({ apiClient: (...args) => apiClient(...args) }));

const svc = await import('../src/services/returnService.js');

beforeEach(() => {
  apiClient.mockReset();
});

describe('returnService endpoints', () => {
  it('getReturnEligibility hits return-eligibility with an optional reason_code', async () => {
    apiClient.mockResolvedValue({ success: true });
    await svc.getReturnEligibility('o1');
    await svc.getReturnEligibility('o1', 'damaged product');
    expect(apiClient.mock.calls[0]).toEqual(['order/o1/return-eligibility/', { method: 'GET' }]);
    expect(apiClient.mock.calls[1][0]).toBe('order/o1/return-eligibility/?reason_code=damaged%20product');
  });

  it('createReturnRequest POSTs JSON to order/{id}/returns/', async () => {
    apiClient.mockResolvedValue({ success: true });
    await svc.createReturnRequest('o1', { reason: 'x' });
    expect(apiClient).toHaveBeenCalledWith('order/o1/returns/', { method: 'POST', body: '{"reason":"x"}' });
  });

  it('list endpoints', async () => {
    apiClient.mockResolvedValue({ success: true, data: [] });
    await svc.getOrderReturns('o1');
    await svc.getAllReturns({ page: 2, page_size: 50 });
    await svc.getAllReturns();
    expect(apiClient.mock.calls.map((c) => c[0])).toEqual([
      'order/o1/returns/',
      'order/returns/?page=2&page_size=50',
      'order/returns/',
    ]);
  });

  it('getReturnById returns normalized data or an error', async () => {
    apiClient.mockResolvedValueOnce({ success: true, data: { id: 'r1', status: 'APPROVED' } });
    expect((await svc.getReturnById('r1')).data.status).toBe('approved');
    apiClient.mockResolvedValueOnce({ success: false, message: 'nope' });
    expect(await svc.getReturnById('r1')).toEqual({ data: null, error: 'nope' });
    apiClient.mockResolvedValueOnce({ success: true, data: {} });
    expect((await svc.getReturnById('r1')).data).toBeNull();
  });
});

describe('normalizeReturnEligibility', () => {
  const order = { items: [{ id: 'i1', variant: { variant_title: 'Ashwagandha' }, quantity: 3 }], payment_method: 'COD' };

  it('maps items, reasons, window and COD from the order', () => {
    const res = {
      success: true,
      data: {
        items: [
          {
            order_item_id: 'i1',
            eligible: true,
            available_quantity: 2,
            exception_reasons: ['damaged_product'],
            window_ends_at: '2026-11-01',
            selling_price: 100,
          },
          { order_item_id: 'i2', eligible: false, message: 'Window closed' },
        ],
      },
    };
    const out = svc.normalizeReturnEligibility(res, order);
    expect(out.eligible).toBe(true);
    expect(out.isCod).toBe(true);
    expect(out.items[0]).toMatchObject({ name: 'Ashwagandha', quantity: 3, returnableQuantity: 2, price: 100 });
    expect(out.items[1]).toMatchObject({ eligible: false, returnableQuantity: 0, reason: 'Window closed' });
    expect(out.allowedReasons).toEqual(['damaged_product']);
    expect(out.returnWindowEndsAt).toBe('2026-11-01');
  });

  it('supports eligible_items / ineligible_items and explains a fully ineligible order', () => {
    const out = svc.normalizeReturnEligibility(
      { data: { eligible_items: [], ineligible_items: [{ id: 'x', quantity: 1 }] } },
      {},
    );
    expect(out.eligible).toBe(false);
    expect(out.items).toHaveLength(1);
    expect(out.message).toMatch(/None of the items/);
  });

  it('buildReasonOptions puts backend codes first and Other last', () => {
    expect(svc.buildReasonOptions([])).toBe(svc.RETURN_REASONS);
    const opts = svc.buildReasonOptions(['damaged_product', 'weird_code']);
    expect(opts.map((o) => o.code)).toEqual(['damaged_product', 'weird_code', 'other']);
    expect(opts[1].label).toBe('Weird code');
  });
});

describe('payload + validation', () => {
  it('prepaid payload has no refund details; reason_code omitted for other', () => {
    const p = svc.buildReturnPayload({
      reasonCode: 'damaged_product',
      reasonText: '',
      reasonLabel: 'Product arrived damaged',
      selected: { a: 2, b: 0 },
      mediaUrls: ['u1', ''],
    });
    expect(p).toEqual({
      reason: 'Product arrived damaged',
      reason_code: 'damaged_product',
      items: [{ order_item_id: 'a', quantity: 2 }],
      media: [{ media_url: 'u1', media_type: 'image' }],
    });
    const other = svc.buildReturnPayload({ reasonCode: 'other', reasonText: ' broken seal ', selected: { a: 1 } });
    expect(other.reason).toBe('broken seal');
    expect(other.reason_code).toBeUndefined();
  });

  it('COD payload carries UPI or bank details', () => {
    const upi = svc.buildReturnPayload({ reasonCode: 'other', reasonText: 'abcde', selected: { a: 1 }, isCod: true, upiId: ' a@b ' });
    expect(upi.upi_id).toBe('a@b');
    const bank = svc.buildReturnPayload({
      reasonCode: 'other',
      reasonText: 'abcde',
      selected: { a: 1 },
      isCod: true,
      refundMethod: 'bank',
      holderName: ' Ravi ',
      accountNumber: '123456789',
      ifsc: 'hdfc0001234',
    });
    expect(bank).toMatchObject({ account_holder_name: 'Ravi', account_number: '123456789', ifsc_code: 'HDFC0001234' });
    expect(bank.upi_id).toBeUndefined();
  });

  it('validateReturnForm mirrors the app rules', () => {
    const base = { reasonCode: 'damaged_product', reasonText: '', selectedCount: 1, isCod: false };
    expect(Object.values(svc.validateReturnForm(base)).some(Boolean)).toBe(false);
    expect(svc.validateReturnForm({ ...base, reasonCode: '' }).reason).toBe('Select a reason');
    expect(svc.validateReturnForm({ ...base, reasonCode: 'other', reasonText: 'abc' }).reason).toMatch(/min 5/);
    expect(svc.validateReturnForm({ ...base, selectedCount: 0 }).items).toMatch(/at least one/);
    const cod = { ...base, isCod: true, refundMethod: 'upi', upiId: 'bad' };
    expect(svc.validateReturnForm(cod).upi).toMatch(/valid UPI/);
    expect(svc.validateReturnForm({ ...cod, upiId: 'ravi@okbank' }).upi).toBe('');
    const bank = { ...base, isCod: true, refundMethod: 'bank', holderName: 'Ra', accountNumber: '12', confirmAccount: '13', ifsc: 'x' };
    const e = svc.validateReturnForm(bank);
    expect([e.holder, e.account, e.confirm, e.ifsc].every(Boolean)).toBe(true);
  });
});

describe('status, steps and refund stage', () => {
  it('status meta and steps', () => {
    expect(svc.getReturnStatusMeta('pickup_scheduled').label).toBe('Pickup scheduled');
    expect(svc.getReturnStatusMeta('weird_status').label).toBe('Weird Status');
    expect(svc.getReturnStepIndex('refund_initiated')).toBe(3);
    expect(svc.getReturnStepIndex('nope')).toBe(0);
  });

  it('getRefundStage prefers refund_request.status then return status', () => {
    expect(svc.getRefundStage('approved', 'processed')).toBe(2);
    expect(svc.getRefundStage('approved', 'pending')).toBe(1);
    expect(svc.getRefundStage('refunded')).toBe(2);
    expect(svc.getRefundStage('refund_initiated')).toBe(1);
    expect(svc.getRefundStage('requested')).toBe(0);
  });

  it('maskAccount and payment source label', () => {
    expect(svc.maskAccount('123456789012')).toBe('**** 9012');
    expect(svc.getPaymentSourceLabel({ payment_gateway: 'razorpay' }, 'upi')).toBe('UPI via Razorpay');
    expect(svc.getPaymentSourceLabel({})).toBe('Original payment method');
  });
});

describe('list handling', () => {
  const mk = (id, status, createdAt, extra = {}) => ({ id, status, created_at: createdAt, order_code: `ORD-${id}`, ...extra });

  it('normalizeReturnList accepts arrays, results and failures', () => {
    expect(svc.normalizeReturnList({ success: false })).toEqual([]);
    expect(svc.normalizeReturnList({ data: [mk('1', 'requested', 'a')] })).toHaveLength(1);
    expect(svc.normalizeReturnList({ data: { results: [mk('1', 'requested', 'a')] } })).toHaveLength(1);
    expect(svc.hasMoreReturnPages({ data: { next: 'http://x' } })).toBe(true);
    expect(svc.hasMoreReturnPages({ data: { next: null } })).toBe(false);
  });

  it('filters, counts and sorts', () => {
    const list = ['requested', 'approved', 'refunded', 'rejected', 'cancelled'].map((s, i) =>
      svc.normalizeReturnRequest(mk(String(i), s, `2026-01-0${i + 1}`, { reason: i === 2 ? 'Torn box' : '' })),
    );
    expect(svc.countReturns(list)).toEqual({ all: 5, active: 2, refunded: 1, rejected: 2 });
    expect(svc.filterReturns(list, 'rejected').map((r) => r.id)).toEqual(['3', '4']);
    expect(svc.filterReturns(list, 'all', 'torn').map((r) => r.id)).toEqual(['2']);
    expect(svc.sortReturnsNewestFirst(list)[0].id).toBe('4');
  });

  it('loadAllReturns falls back to per-order lists when order/returns/ fails', async () => {
    apiClient.mockImplementation(async (url) => {
            if (url.startsWith('order/returns/')) return { success: false };
      if (url === 'order/o1/returns/') return { success: true, data: [mk('r1', 'requested', '2026-01-01')] };
      return { success: true, data: [] };
    });
    const out = await svc.loadAllReturns([
      { id: 'o1', status: 'delivered' },
      { id: 'o2', status: 'pending' },
    ]);
    expect(out.map((r) => r.id)).toEqual(['r1']);
    expect(apiClient.mock.calls.map((c) => c[0])).not.toContain('order/o2/returns/');
  });

  it('uploadReturnMedia posts to user/upload/ with dir return_files', async () => {
    apiClient.mockResolvedValue({ success: true, data: { url: 'https://cdn/x.jpg' } });
    const file = new Blob(['x'], { type: 'image/jpeg' });
    file.name = 'a.jpg';
    expect(await svc.uploadReturnMedia(file)).toBe('https://cdn/x.jpg');
    const [url, init] = apiClient.mock.calls[0];
    expect(url).toBe('user/upload/');
    expect(init.body.get('dir')).toBe('return_files');
    apiClient.mockResolvedValue({ success: false, message: 'bad' });
    await expect(svc.uploadReturnMedia(file)).rejects.toThrow('bad');
  });
});

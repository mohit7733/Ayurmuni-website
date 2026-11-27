import { describe, expect, it } from 'vitest';
import {
  getRefundInfo,
  getReturnableOrderItems,
  isReturnPickerItemAllowed,
} from '../src/utils/orderDetailUtils.js';

const deliveredOrder = (item, deliveredAt) => ({
  delivered_at: deliveredAt,
  items: [item],
});

const line = (overrides) => ({
  id: 'line-1',
  quantity: 1,
  variant: {
    variant_id: 'v1',
    variant_title: 'Returnable malt',
    is_returnable: true,
    returnable_days: 7,
    ...overrides,
  },
});

describe('getRefundInfo', () => {
  it('keeps refund status history in order and exposes the latest status', () => {
    const info = getRefundInfo({
      refund: {
        id: '4099ff73-eee2-4b2c-be48-8f545f983fa0',
        amount: '358.00',
        status_history: [
          { status: 'refund approved', created_at: '2026-11-27T12:26:49.076692+05:30' },
          { status: 'request initiated', created_at: '2026-11-27T12:13:01.604564+05:30' },
        ],
      },
    });
    expect(info.amount).toBe(358);
    expect(info.history.map((entry) => entry.status)).toEqual(['request initiated', 'refund approved']);
    expect(info.latestStatus).toBe('refund approved');
  });
});

describe('getReturnableOrderItems', () => {
  it('hides an item that is not returnable, even on a delivered order', () => {
    const order = deliveredOrder(
      {
        id: 'db559b7e-4dd3-46a8-a879-cb9b863a80a6',
        variant: {
          variant_title: 'StreeSanjivani Hormonal Care Malt - 400 g',
          is_returnable: false,
          returnable_days: 0,
        },
      },
      '2026-11-23T12:20:57.190608+05:30',
    );
    expect(getReturnableOrderItems(order)).toEqual([]);
  });

  it('keeps an item only while the order is inside returnable_days', () => {
    const recent = deliveredOrder(line(), new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString());
    const expired = deliveredOrder(line(), new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString());
    const notFlagged = deliveredOrder(
      line({ is_returnable: false }),
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    );
    expect(getReturnableOrderItems(recent)).toHaveLength(1);
    expect(getReturnableOrderItems(expired)).toEqual([]);
    expect(getReturnableOrderItems(notFlagged)).toEqual([]);
  });

  it('lets the return picker keep only the returnable lines', () => {
    const order = {
      delivered_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      items: [
        line(),
        {
          id: 'line-2',
          variant: { variant_id: 'v2', is_returnable: false, returnable_days: 7 },
        },
      ],
    };
    const allowed = getReturnableOrderItems(order);
    expect(
      isReturnPickerItemAllowed({ orderItemId: 'other', orderLineId: 'line-1', raw: {} }, allowed),
    ).toBe(true);
    expect(isReturnPickerItemAllowed({ orderItemId: 'line-2', raw: {} }, allowed)).toBe(false);
  });
});

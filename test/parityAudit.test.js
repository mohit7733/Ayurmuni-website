import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { toggleWishlistProduct, sessionListeners } = vi.hoisted(() => ({
  toggleWishlistProduct: vi.fn(),
  sessionListeners: [],
}));

vi.mock('../src/services/apiClient', () => ({
  apiClient: vi.fn(),
  subscribeApiSession: (listener) => {
    sessionListeners.push(listener);
    return () => {};
  },
}));
vi.mock('../src/services/productService', () => ({
  toggleWishlistProduct: (...a) => toggleWishlistProduct(...a),
}));
vi.mock('../src/config/key', () => ({ showSuccessToast: vi.fn(), BaseUrl: 'http://x/' }));

import {
  applyWishlistCache,
  isItemWishlisted,
  readWishlistFlag,
  resetWishlistCache,
  resolveVariantId,
  seedWishlistCacheFromList,
  subscribeWishlist,
  toggleWishlistItem,
} from '../src/product/wishlistSync';
import {
  formatPaymentReason,
  formatPaymentStatusLabel,
  getCompletedRefund,
  getPaymentHistory,
  getPaymentStatusTone,
} from '../src/utils/paymentHistoryUtils';
import {
  canOfferCancel,
  canOfferReschedule,
  canRescheduleAppointment,
  canShowConsultationReceipt,
  hasAlreadyRescheduled,
} from '../src/consult/appointmentUtils';
import {
  flattenDoctorSpecializations,
  formatDoctorSpecialization,
  getDoctorAvailabilityLabel,
} from '../src/consult/doctors';
import {
  buildPrescriptionDownloadText,
  getGynaecologicalLines,
  getHistoryLines,
  getMedicineMrp,
  getMedicinePrice,
  getMedicineQuantity,
  getMedicineUnitPrice,
  getPersonalHistoryLines,
  mergeMedicineItems,
  parseAmount,
} from '../src/utils/prescriptionDetailUtils';

describe('wishlistSync', () => {
  beforeEach(() => {
    resetWishlistCache();
    toggleWishlistProduct.mockReset();
  });

  it('coerces wishlist flags', () => {
    expect(readWishlistFlag(1)).toBe(true);
    expect(readWishlistFlag('true')).toBe(true);
    expect(readWishlistFlag('0')).toBe(false);
    expect(readWishlistFlag(undefined)).toBe(false);
  });

  it('resolves variant ids and applies cache over list flags', () => {
    expect(resolveVariantId({ variant_id: 7 })).toBe('7');
    expect(resolveVariantId({ id: 3 })).toBe('3');
    seedWishlistCacheFromList([{ variant_id: 1, is_wishlist_item: true }]);
    expect(isItemWishlisted({ variant_id: 1, is_wishlist_item: false })).toBe(true);
    const out = applyWishlistCache([{ variant_id: 1, is_wishlist_item: false }, { variant_id: 2, is_wishlist_item: 1 }]);
    expect(out[0].is_wishlist_item).toBe(true);
    expect(readWishlistFlag(out[1].is_wishlist_item)).toBe(true);
  });

  it('toggles optimistically and broadcasts', async () => {
    toggleWishlistProduct.mockResolvedValue({ success: true });
    const seen = [];
    const off = subscribeWishlist((e) => seen.push(e));
    const result = await toggleWishlistItem({ variant_id: 5, is_wishlist_item: false });
    off();
    expect(result).toBe('ok');
    expect(toggleWishlistProduct).toHaveBeenCalledWith('5');
    expect(seen[0]).toEqual({ variantId: '5', isWishlisted: true });
    expect(isItemWishlisted({ variant_id: 5 })).toBe(true);
  });

  it('rolls back when the API fails', async () => {
    toggleWishlistProduct.mockResolvedValue({ success: false, message: 'nope' });
    const seen = [];
    const off = subscribeWishlist((e) => seen.push(e));
    const result = await toggleWishlistItem({ variant_id: 9, is_wishlist_item: true });
    off();
    expect(result).toBe('error');
    expect(seen.map((e) => e.isWishlisted)).toEqual([false, true]);
    expect(isItemWishlisted({ variant_id: 9 })).toBe(true);
  });

  it('returns error without a variant id and clears on session change', async () => {
    expect(await toggleWishlistItem({})).toBe('error');
    seedWishlistCacheFromList([{ variant_id: 4, is_wishlist_item: true }]);
    sessionListeners.forEach((l) => l());
    expect(isItemWishlisted({ variant_id: 4 })).toBe(false);
  });
});

describe('paymentHistoryUtils', () => {
  const history = [
    { status: 'refund_paid', amount: '300', at: '2026-10-02T10:00:00Z', gateway_refund_id: 'r1' },
    { status: 'paid', amount: 300, at: '2026-10-01T10:00:00Z' },
    { status: '' },
  ];

  it('sorts oldest first and drops entries without a status', () => {
    const list = getPaymentHistory({ payment: { history } });
    expect(list.map((e) => e.status)).toEqual(['paid', 'refund_paid']);
    expect(list[1].amount).toBe(300);
  });

  it('falls through sources and nested raw payloads', () => {
    expect(getPaymentHistory({}, { raw: { payment: { history } } })).toHaveLength(2);
    expect(getPaymentHistory(null, {})).toEqual([]);
  });

  it('reports a refund only for cancelled-like statuses', () => {
    const src = { payment: { history } };
    expect(getCompletedRefund('cancelled', src)).toEqual({ amount: 300, at: '2026-10-02T10:00:00Z', refundId: 'r1' });
    expect(getCompletedRefund('confirmed', src)).toBeNull();
    expect(getCompletedRefund('missed', { payment: { history: [{ status: 'paid' }] } })).toBeNull();
  });

  it('labels, tones and reasons', () => {
    expect(formatPaymentStatusLabel('refund_paid')).toBe('Refund completed');
    expect(formatPaymentStatusLabel('some_state')).toBe('Some State');
    expect(getPaymentStatusTone('paid')).toBe('success');
    expect(getPaymentStatusTone('refund_pending')).toBe('warning');
    expect(getPaymentStatusTone('failed')).toBe('danger');
    expect(getPaymentStatusTone('x')).toBe('neutral');
    expect(formatPaymentReason('personal_or_unforeseen_circumstance')).toBe('Personal or unforeseen circumstance');
    expect(formatPaymentReason('Already readable')).toBe('Already readable');
  });
});

describe('appointment gating', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 27, 10, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows reschedule and cancel outside the 3h window', () => {
    expect(canOfferReschedule('confirmed', '2026-10-28', '10:00')).toBe(true);
    expect(canOfferCancel('confirmed', '2026-10-28', '10:00')).toBe(true);
  });

  it('blocks both inside the window and for past times', () => {
    expect(canOfferReschedule('confirmed', '2026-10-27', '11:00')).toBe(false);
    expect(canOfferCancel('confirmed', '2026-10-27', '11:00')).toBe(false);
    expect(canOfferCancel('confirmed', '2026-10-26', '10:00')).toBe(false);
  });

  it('keeps cancel but hides reschedule after a reschedule', () => {
    expect(canOfferReschedule('rescheduled', '2026-10-28', '10:00')).toBe(false);
    expect(canOfferCancel('rescheduled', '2026-10-28', '10:00')).toBe(true);
    const item = { previous_appointment_date: '2026-10-25' };
    expect(hasAlreadyRescheduled(item)).toBe(true);
    expect(canOfferReschedule('confirmed', '2026-10-28', '10:00', item)).toBe(false);
    expect(canOfferCancel('confirmed', '2026-10-28', '10:00')).toBe(true);
  });

  it('rejects terminal statuses', () => {
    ['completed', 'cancelled', 'canceled', 'missed', 'rejected'].forEach((s) => {
      expect(canRescheduleAppointment(s)).toBe(false);
      expect(canOfferCancel(s, '2026-10-28', '10:00')).toBe(false);
    });
    expect(canRescheduleAppointment('')).toBe(false);
  });

  it('shows receipt when a consultation id exists or the status is terminal', () => {
    expect(canShowConsultationReceipt('confirmed', 12)).toBe(true);
    expect(canShowConsultationReceipt('completed', null)).toBe(true);
    expect(canShowConsultationReceipt('confirmed', '')).toBe(false);
  });
});

describe('doctor card helpers', () => {
  it('flattens and de-duplicates specializations from every source', () => {
    const doctor = {
      doctor_specialization: ['Ayurveda', { name: 'Panchakarma' }],
      specialization: 'ayurveda, Yoga',
      health_diseases: ['Diabetes'],
    };
    expect(flattenDoctorSpecializations(doctor)).toEqual(['Ayurveda', 'Panchakarma', 'Yoga', 'Diabetes']);
    expect(formatDoctorSpecialization(doctor)).toBe('Ayurveda, Panchakarma, Yoga, Diabetes');
    expect(flattenDoctorSpecializations(null)).toEqual([]);
  });

  it('never shows admin approval strings as availability', () => {
    expect(getDoctorAvailabilityLabel({ has_availability: true })).toBe('Available');
    expect(getDoctorAvailabilityLabel({ availability_status: 'approved' })).toBe('Unavailable');
    expect(getDoctorAvailabilityLabel({ availability_status: 'Few slots left' })).toBe('Limited slots');
    expect(getDoctorAvailabilityLabel({})).toBe('Unavailable');
    expect(getDoctorAvailabilityLabel({}, true)).toBe('Available');
  });
});

describe('prescription pricing and history', () => {
  it('parses amounts', () => {
    expect(parseAmount('Rs 1,299.50')).toBe(1299.5);
    expect(parseAmount(199)).toBe(199);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(true)).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });

  it('reads unit price, MRP and quantity (nested keys, MRP fallback)', () => {
    const med = { variant: { selling_price: '90', mrp: '120' }, quantity: '2 strips' };
    expect(getMedicineUnitPrice(med)).toBe(90);
    expect(getMedicineMrp(med)).toBe(120);
    expect(getMedicineQuantity(med)).toBe(2);
    expect(getMedicineUnitPrice({ mrp: 50 })).toBe(50);
    expect(getMedicinePrice({ price: '75' })).toBe(75);
    expect(getMedicinePrice({})).toBeNull();
    expect(getMedicineQuantity({})).toBe(1);
  });

  it('merges download items with screen items without losing prices', () => {
    const merged = mergeMedicineItems(
      [{ id: 1, name: 'A', price: '' }],
      [{ id: 1, name: 'A', price: 40, mrp: 55 }],
    );
    expect(merged[0].price).toBe(40);
    expect(merged[0].mrp).toBe(55);
    expect(mergeMedicineItems([], [{ id: 2 }])).toEqual([{ id: 2 }]);
    expect(mergeMedicineItems([{ id: 2 }], [])).toEqual([{ id: 2 }]);
  });

  it('turns history payloads into readable lines', () => {
    expect(getHistoryLines({ diet: 'Veg', sleep_pattern: ['Good', 'Late'], empty: '' })).toEqual([
      'Diet: Veg',
      'Sleep pattern: Good, Late',
    ]);
    expect(getHistoryLines(true)).toEqual(['Yes']);
    expect(getHistoryLines([])).toEqual([]);
    expect(getPersonalHistoryLines({ personal_history: 'Smoker' })).toEqual(['Smoker']);
    expect(getGynaecologicalLines({ gynecological_history: { cycle: 'Regular' } })).toEqual(['Cycle: Regular']);
    expect(getGynaecologicalLines({})).toEqual([]);
  });

  it('prints price, total and history sections in the download text', () => {
    const text = buildPrescriptionDownloadText({
      doctor: { name: 'Dr A' },
      patient: { name: 'P' },
      prescription: {
        prescription_code: 'RX1',
        personal_history: { diet: 'Veg' },
        gynaecological: 'Regular',
        items: [{ medicine_name: 'Tab', selling_price: 90, mrp: 120, quantity: 2 }],
      },
    });
    expect(text).toContain('Personal history');
    expect(text).toContain('Diet: Veg');
    expect(text).toContain('Gynaecological history');
    expect(text).toContain('Price: Rs 90.00 x 2 = Rs 180.00 (MRP Rs 120.00)');
    expect(text).toContain('Total amount: Rs 180.00');
  });
});
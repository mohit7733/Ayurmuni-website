import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canTrackConsultationConversion,
  consultationConversionEventIds,
  readPaidConsultationRupees,
} from '../src/consult/consultationConversion.js';

describe('readPaidConsultationRupees', () => {
  it('uses the payable total instead of the listed consultation fee', () => {
    expect(
      readPaidConsultationRupees({
        consultation_fee: 500,
        summary: { total_payable_amount: 590 },
      }),
    ).toBe(590);
  });

  it('keeps a zero amount when the visit was covered', () => {
    expect(readPaidConsultationRupees({ paid_amount: 0, consultation_fee: 500 }, 590)).toBe(0);
  });

  it('uses the quoted charge when the response only has the listed fee', () => {
    expect(readPaidConsultationRupees({ consultation_fee: 500 }, 590)).toBe(590);
  });

  it('reads a nested payload and still prefers the amount stored for the confirmation page', () => {
    expect(readPaidConsultationRupees({ data: { booking: { paid_amount: 499 } } })).toBe(499);
    expect(
      readPaidConsultationRupees({
        paid_amount: 590,
        data: { amount: 0, consultation_fee: 500 },
      }),
    ).toBe(590);
  });
});

describe('canTrackConsultationConversion', () => {
  it('allows a confirmed visit and skips a failed one', () => {
    const paid = { appointment_id: 'apt-1', paid_amount: 590 };
    expect(canTrackConsultationConversion({ ...paid, appointment_status: 'confirmed' })).toBe(true);
    expect(canTrackConsultationConversion({ ...paid, appointment_status: 'failed' })).toBe(false);
    expect(canTrackConsultationConversion({ paid_amount: 590, appointment_status: 'confirmed' })).toBe(false);
  });
});

describe('consultationConversionEventIds', () => {
  it('builds stable ids and prefers ids supplied for the Conversions API', () => {
    expect(consultationConversionEventIds({ appointment_id: 'apt-1' }, 'apt-1')).toEqual({
      schedule: 'schedule_apt-1',
      purchase: 'purchase_apt-1',
    });
    expect(
      consultationConversionEventIds(
        { meta_schedule_event_id: 'srv_s', meta_purchase_event_id: 'srv_p' },
        'apt-1',
      ),
    ).toEqual({ schedule: 'srv_s', purchase: 'srv_p' });
    expect(consultationConversionEventIds({ meta_event_id: 'srv' }, 'apt-1')).toEqual({
      schedule: 'srv',
      purchase: 'srv',
    });
  });
});

describe('trackMetaConsultationBooked', () => {
  const calls = [];
  const store = new Map();
  const detail = {
    appointment_id: 'apt-1',
    appointment_status: 'confirmed',
    paid_amount: 590,
  };
  const tracks = () => calls.filter((args) => args[0] === 'track');

  beforeEach(() => {
    calls.length = 0;
    store.clear();
    vi.resetModules();
    globalThis.window = {
      fbq: (...args) => {
        calls.push(args);
      },
    };
    globalThis.sessionStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
    };
  });

  it('fires Schedule and Purchase once with the amount paid', async () => {
    const { trackMetaConsultationBooked } = await import('../src/services/metaPixel.js');
    expect(trackMetaConsultationBooked(detail)).toBe(true);
    expect(trackMetaConsultationBooked(detail)).toBe(false);
    await vi.waitFor(() => expect(tracks()).toHaveLength(2));
    expect(tracks()).toEqual([
      ['track', 'Schedule', { value: 590, currency: 'INR' }, { eventID: 'schedule_apt-1' }],
      ['track', 'Purchase', { value: 590, currency: 'INR' }, { eventID: 'purchase_apt-1' }],
    ]);
  });

  it('does not fire again when the confirmation page is opened again', async () => {
    const first = await import('../src/services/metaPixel.js');
    expect(first.trackMetaConsultationBooked(detail)).toBe(true);
    await vi.waitFor(() => expect(tracks()).toHaveLength(2));
    vi.resetModules();
    const second = await import('../src/services/metaPixel.js');
    expect(second.trackMetaConsultationBooked(detail)).toBe(false);
    await Promise.resolve();
    expect(tracks()).toHaveLength(2);
  });

  it('does not fire for a failed visit', async () => {
    const { trackMetaConsultationBooked } = await import('../src/services/metaPixel.js');
    expect(trackMetaConsultationBooked({ ...detail, appointment_status: 'failed' })).toBe(false);
    await Promise.resolve();
    expect(tracks()).toHaveLength(0);
  });
});

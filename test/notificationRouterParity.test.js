import { describe, it, expect, vi } from 'vitest';
import { handleNotificationNavigation } from '../src/notifications/router';

const go = (data) => {
  const navigate = vi.fn();
  handleNotificationNavigation(navigate, data);
  return navigate.mock.calls[0]?.[0];
};

describe('notification router (app parity)', () => {
  it('opens the appointment for an appointment reminder', () => {
    expect(go({ type: 'appointment_reminder', appointment_id: 42 })).toBe('/profile/appointments/42');
  });
  it('reads appointment id from nested data / additionalData', () => {
    expect(go({ type: 'appointment', data: { appointment_id: 7 } })).toBe('/profile/appointments/7');
    expect(go({ type: 'appointment', additionalData: { consultationId: 'c9' } })).toBe('/profile/appointments/c9');
  });
  it('uses a generic id only for appointment payloads', () => {
    expect(go({ type: 'appointment', id: 5 })).toBe('/profile/appointments/5');
    expect(go({ type: 'wishlist', id: 5 })).toBe('/profile/wishlist');
  });
});
import { describe, expect, it } from 'vitest';
import { buildViewAppointmentPayload, getNotificationDetailRows } from '../src/notifications/utils.js';

describe('notification detail sheet helpers', () => {
  it('lists only the detail rows that have values', () => {
    expect(
      getNotificationDetailRows({ patientName: 'Asha', doctorName: '', rawData: { data: { reason: 'Fever' } } }),
    ).toEqual([
      { label: 'Patient', value: 'Asha' },
      { label: 'Reason', value: 'Fever' },
    ]);
    expect(getNotificationDetailRows({})).toEqual([]);
  });

  it('builds the View Appointment payload from nested data', () => {
    const payload = buildViewAppointmentPayload({
      appointmentId: 'a-1',
      rawData: { id: 3, data: { appointment_id: 'a-7' } },
    });
    expect(payload.route).toBe('AppointmentDetails');
    expect(payload.appointment_id).toBe('a-7');
    expect(buildViewAppointmentPayload({ appointmentId: 'a-1', rawData: {} }).appointment_id).toBe('a-1');
  });
});

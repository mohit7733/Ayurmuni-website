import { describe, expect, it } from 'vitest';
import { RESCHEDULE_REASON_REQUIRED, validateReschedule } from '../src/consult/appointmentActions.js';

describe('validateReschedule', () => {
  it('blocks an empty or whitespace-only reason', () => {
    expect(validateReschedule({ reason: '' })).toBe(RESCHEDULE_REASON_REQUIRED);
    expect(validateReschedule({ reason: '   \n ' })).toBe(RESCHEDULE_REASON_REQUIRED);
    expect(validateReschedule({})).toBe(RESCHEDULE_REASON_REQUIRED);
  });
  it('allows a real reason', () => {
    expect(validateReschedule({ reason: 'Travelling' })).toBe('');
  });
  it('does not require a reason when confirming a doctor-proposed change', () => {
    expect(validateReschedule({ reason: '', isRescheduleRequest: true })).toBe('');
  });
});
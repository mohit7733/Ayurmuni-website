import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildVideoCallNavParams,
  getAppointmentSlotMs,
  getCallTimeStage,
  getJoinableAppointment,
  getMsUntilJoinWindowChange,
  isActiveAppointmentStatus,
  isAppointmentJoinable,
  resolveAppointmentSlot,
} from '../src/consult/appointmentUtils';
import { getDoctorRoleLabel, isDietitian } from '../src/consult/doctors';

const NOW = new Date(2026, 9, 27, 10, 0, 0); // local 27 Oct 2026 10:00
const slot = (startHm, endHm, extra = {}) => ({
  date: '2026-10-27',
  time: `${startHm}:00`,
  endTime: endHm ? `${endHm}:00` : '',
  status: 'confirmed',
  call_status: '',
  ...extra,
});

describe('join window', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens 5 minutes before start and closes at end_time', () => {
    expect(isAppointmentJoinable(slot('10:10', '10:30'))).toBe(false);
    expect(isAppointmentJoinable(slot('10:04', '10:30'))).toBe(true);
    expect(isAppointmentJoinable(slot('09:30', '10:00'))).toBe(false);
  });

  it('uses start + 15 min when end_time is missing', () => {
    expect(isAppointmentJoinable(slot('09:50', ''))).toBe(true);
    expect(isAppointmentJoinable(slot('09:40', ''))).toBe(false);
  });

  it('is closed for ended / cancelled calls and inactive statuses, but a patient who left can rejoin', () => {
    expect(isAppointmentJoinable(slot('10:00', '10:30', { call_status: 'ended' }))).toBe(false);
    expect(isAppointmentJoinable(slot('10:00', '10:30', { call_status: 'left' }))).toBe(true);
    expect(isAppointmentJoinable(slot('10:00', '10:30', { status: 'cancelled' }))).toBe(false);
    expect(isAppointmentJoinable(slot('10:00', '10:30', { status: 'completed', call_status: 'in_progress' }))).toBe(true);
  });

  it('reports ms until the window opens, then until it closes', () => {
    expect(getMsUntilJoinWindowChange(slot('10:30', '10:50'))).toBe(25 * 60 * 1000);
    expect(getMsUntilJoinWindowChange(slot('10:03', '10:20'))).toBe(20 * 60 * 1000);
    expect(getMsUntilJoinWindowChange(slot('09:00', '09:30'))).toBeNull();
  });

  it('banner stays after a call ends or is left and only a cancelled call removes it', () => {
    expect(getJoinableAppointment([slot('10:00', '10:30', { call_status: 'left' })], 5)).not.toBeNull();
    expect(getJoinableAppointment([slot('10:00', '10:30', { call_status: 'ended' })], 5)).not.toBeNull();
    expect(getJoinableAppointment([slot('10:00', '10:30', { call_status: 'cancelled' })], 5)).toBeNull();
    expect(getJoinableAppointment([slot('11:00', '11:30')], 5)).toBeNull();
  });

  it('active statuses match the app list', () => {
    expect(isActiveAppointmentStatus('Confirmed')).toBe(true);
    expect(isActiveAppointmentStatus('re-scheduled')).toBe(true);
    expect(isActiveAppointmentStatus('completed')).toBe(false);
  });
});

describe('slot helpers and call-time stage', () => {
  it('resolveAppointmentSlot reads list items and raw detail payloads', () => {
    expect(resolveAppointmentSlot({ date: '2026-10-27', time: '10:00:00', endTime: '10:30:00' })).toEqual({
      date: '2026-10-27',
      startTime: '10:00:00',
      endTime: '10:30:00',
    });
    expect(
      resolveAppointmentSlot({ appointment: { appointment_date: '2026-10-28', start_time: '11:00', end_time: '11:20' } }),
    ).toEqual({ date: '2026-10-28', startTime: '11:00', endTime: '11:20' });
    expect(resolveAppointmentSlot(null)).toEqual({});
  });

  it('getAppointmentSlotMs rejects an end before the start', () => {
    const ok = getAppointmentSlotMs('2026-10-27', '10:00:00', '10:30:00');
    expect(ok.endMs - ok.startMs).toBe(30 * 60 * 1000);
    expect(getAppointmentSlotMs('2026-10-27', '10:00:00', '09:00:00').endMs).toBeNull();
    expect(getAppointmentSlotMs('2026-10-27', '10:00:00', '').endMs).toBeNull();
  });

  it('buildVideoCallNavParams carries the slot for the call-time warning', () => {
    const params = buildVideoCallNavParams(
      { appointmentId: 'a1', consultationId: 'c1', date: '2026-10-27', time: '10:00:00', endTime: '10:30:00' },
      { role: 'patient' },
    );
    expect(params).toMatchObject({
      appointmentId: 'a1',
      consultationId: 'c1',
      appointmentDate: '2026-10-27',
      startTime: '10:00:00',
      endTime: '10:30:00',
      role: 'patient',
    });
  });

  it('getCallTimeStage shows from 10 min, escalates at 5 and flags over', () => {
    const end = 1_000_000_000;
    expect(getCallTimeStage(null, end)).toBeNull();
    expect(getCallTimeStage(end, end - 11 * 60000)).toBeNull();
    expect(getCallTimeStage(end, end - 8 * 60000)).toEqual({ minutesLeft: 8, stage: '10', isOver: false });
    expect(getCallTimeStage(end, end - 4 * 60000).stage).toBe('5');
    expect(getCallTimeStage(end, end + 1000)).toMatchObject({ stage: 'over', isOver: true });
  });
});

describe('dietitian flag', () => {
  it('reads is_dietitian from top level and nested doctor payloads', () => {
    expect(isDietitian({ is_dietitian: true })).toBe(true);
    expect(isDietitian({ is_dietitian: 'true' })).toBe(true);
    expect(isDietitian({ is_dietitian: 1 })).toBe(true);
    expect(isDietitian({ doctor: { is_dietitian: true } })).toBe(true);
    expect(isDietitian({ doctor_details: { is_dietitian: '1' } })).toBe(true);
    expect(isDietitian({ raw: { doctor: { is_dietitian: true } } })).toBe(true);
    expect(isDietitian({ is_dietitian: false })).toBe(false);
    expect(isDietitian({ is_dietitian: 'false' })).toBe(false);
    expect(isDietitian(null)).toBe(false);
  });

  it('role label', () => {
    expect(getDoctorRoleLabel({ is_dietitian: true })).toBe('Dietitian');
    expect(getDoctorRoleLabel({})).toBe('Doctor');
  });
});
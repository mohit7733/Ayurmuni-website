import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClient = vi.fn(async () => ({ success: true, data: {} }));
vi.mock('../src/services/apiClient', () => ({ apiClient }));

const { apiEndCall, apiPostCallEvent, shouldPostLeftOnDisconnect } = await import('../src/services/videoCallApi.js');

beforeEach(() => apiClient.mockClear());

describe('videoCallApi', () => {
  it('apiEndCall POSTs call/left/ (same as the app, not call/end/)', async () => {
    await apiEndCall('abc');
    expect(apiClient).toHaveBeenCalledTimes(1);
    const [url, init] = apiClient.mock.calls[0];
    expect(url).toBe('doctors/appointments/abc/call/left/');
    expect(init).toMatchObject({ method: 'POST', body: '{}' });
  });

  it('apiPostCallEvent posts event_type/session_id/metadata to call/events/', async () => {
    await apiPostCallEvent('abc', 'left', 's1');
    const [url, init] = apiClient.mock.calls[0];
    expect(url).toBe('doctors/appointments/abc/call/events/');
    expect(JSON.parse(init.body)).toEqual({
      event_type: 'left',
      session_id: 's1',
      metadata: { source: 'agora_sdk' },
    });
  });
});

describe('shouldPostLeftOnDisconnect (app onLeaveChannel parity)', () => {
  const base = { current: 'DISCONNECTED', reason: 'NETWORK_ERROR', endedByUser: false, appointmentId: 'a1' };
  it('reports an unexpected disconnect', () => {
    expect(shouldPostLeftOnDisconnect(base)).toBe(true);
    expect(shouldPostLeftOnDisconnect({ ...base, reason: 'SERVER_ERROR' })).toBe(true);
  });
  it('ignores our own leave, ended calls, other states and missing appointments', () => {
    expect(shouldPostLeftOnDisconnect({ ...base, reason: 'LEAVE' })).toBe(false);
    expect(shouldPostLeftOnDisconnect({ ...base, endedByUser: true })).toBe(false);
    expect(shouldPostLeftOnDisconnect({ ...base, current: 'RECONNECTING' })).toBe(false);
    expect(shouldPostLeftOnDisconnect({ ...base, appointmentId: null })).toBe(false);
  });
});

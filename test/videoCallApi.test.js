import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClient = vi.fn(async () => ({ success: true, data: {} }));
vi.mock('../src/services/apiClient', () => ({ apiClient }));

const {
  apiEndCall,
  apiPostCallEvent,
  clearJoinedDeliveryState,
  reportJoinedEvent,
  shouldPostLeftOnDisconnect,
} = await import('../src/services/videoCallApi.js');

beforeEach(() => {
  apiClient.mockClear();
  apiClient.mockImplementation(async () => ({ success: true, data: {} }));
  clearJoinedDeliveryState();
});

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

  it('reportJoinedEvent posts joined only while call is in_progress', async () => {
    apiClient.mockImplementation(async (url) => {
      if (String(url).includes('/status/')) {
        return {
          success: true,
          data: {
            call_status: 'in_progress',
            presence_sync: {
              should_report_joined: true,
              can_report_presence: true,
              joined_event_max_retry_seconds: 180,
            },
          },
        };
      }
      return { success: true, data: { joined_at_recorded: true } };
    });

    await reportJoinedEvent('appt-1', 'sess-1');

    const eventCalls = apiClient.mock.calls.filter(([url]) =>
      String(url).includes('/events/'),
    );
    expect(eventCalls).toHaveLength(1);
    expect(JSON.parse(eventCalls[0][1].body)).toEqual({
      event_type: 'joined',
      session_id: 'sess-1',
      metadata: { source: 'agora_sdk' },
    });
  });

  it('reportJoinedEvent skips duplicate delivery after success', async () => {
    apiClient.mockImplementation(async (url) => {
      if (String(url).includes('/status/')) {
        return {
          success: true,
          data: {
            call_status: 'in_progress',
            presence_sync: {
              should_report_joined: true,
              can_report_presence: true,
            },
          },
        };
      }
      return { success: true, data: { joined_at_recorded: true } };
    });

    await reportJoinedEvent('appt-2', 's1');
    await reportJoinedEvent('appt-2', 's1');

    const eventCalls = apiClient.mock.calls.filter(([url]) =>
      String(url).includes('/events/'),
    );
    expect(eventCalls).toHaveLength(1);
  });

  it('reportJoinedEvent does not post when presence is not allowed', async () => {
    apiClient.mockImplementation(async () => ({
      success: true,
      data: {
        call_status: 'not_started',
        presence_sync: {
          should_report_joined: true,
          can_report_presence: false,
        },
      },
    }));

    const result = await reportJoinedEvent('appt-3', 's1');
    expect(result.stopped).toBe(true);

    const eventCalls = apiClient.mock.calls.filter(([url]) =>
      String(url).includes('/events/'),
    );
    expect(eventCalls).toHaveLength(0);
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

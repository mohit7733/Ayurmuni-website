import { apiClient } from './apiClient';

export const FALLBACK_APP_ID = 'b717053bd3f14a819ffd0c7b6490f169';

export async function apiGetCallStatus(appointmentId) {
  const res = await apiClient(`doctors/appointments/${appointmentId}/call/status/`, {
    method: 'GET',
  });
  if (!res.success) throw res;
  return res.data;
}

export async function apiStartCall(appointmentId) {
  const res = await apiClient(`doctors/appointments/${appointmentId}/call/start/`, {
    method: 'POST',
    body: '{}',
  });
  if (!res.success) {
    if (res.data?.call_status === 'in_progress' || res.status === 409) {
      return res.data;
    }
    throw res;
  }
  return res.data;
}

export async function apiGetCallToken(appointmentId) {
  const res = await apiClient(`doctors/appointments/${appointmentId}/call/token/`, {
    method: 'POST',
    body: '{}',
  });
  if (!res.success) throw res;
  return res.data;
}

const joinedAttemptStartByAppointment = new Map();
const joinedDeliveryPromises = new Map();
const joinedDeliveredSuccessfully = new Set();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableJoinedError(error) {
  const status = error?.status ?? error?.response?.status;
  if (status == null || status === 0) return true;
  return status >= 500;
}

function shouldStopJoinedRetry(status, appointmentId) {
  const sync = status?.presence_sync;
  if (!sync) {
    return status?.call_status !== 'in_progress';
  }
  if (!sync.should_report_joined) return true;
  if (!sync.can_report_presence) return true;
  if (sync.slot_ends_at && Date.now() >= new Date(sync.slot_ends_at).getTime()) {
    return true;
  }

  const maxRetrySeconds = sync.joined_event_max_retry_seconds ?? 180;
  const startedAt = joinedAttemptStartByAppointment.get(appointmentId);
  if (
    startedAt &&
    maxRetrySeconds > 0 &&
    (Date.now() - startedAt) / 1000 >= maxRetrySeconds
  ) {
    return true;
  }

  return false;
}

async function postCallEvent(appointmentId, event, sessionId) {
  const res = await apiClient(`doctors/appointments/${appointmentId}/call/events/`, {
    method: 'POST',
    body: JSON.stringify({
      event_type: event,
      session_id: sessionId ?? null,
      metadata: { source: 'agora_sdk' },
    }),
  });

  if (!res?.success) {
    const error = new Error(res?.message || `Failed to report call event (${event})`);
    error.status = res?.status;
    error.code = res?.data?.code ?? res?.code;
    error.data = res?.data;
    throw error;
  }

  return res.data;
}

/** Soft wrapper for left/misc events — logs failures without throwing. */
export async function apiPostCallEvent(appointmentId, event, sessionId) {
  try {
    return await postCallEvent(appointmentId, event, sessionId);
  } catch (e) {
    console.log(`[API] events(${event}) failed:`, e);
    return null;
  }
}

export function clearJoinedDeliveryState(appointmentId) {
  if (appointmentId) {
    joinedAttemptStartByAppointment.delete(appointmentId);
    joinedDeliveryPromises.delete(appointmentId);
    joinedDeliveredSuccessfully.delete(appointmentId);
    return;
  }
  joinedAttemptStartByAppointment.clear();
  joinedDeliveryPromises.clear();
  joinedDeliveredSuccessfully.clear();
}

/**
 * Deliver `joined` only after Agora channel join succeeded.
 * Retries on network/5xx; stops when presence_sync says not needed.
 * Dedupes concurrent/reconnect attempts.
 */
export async function reportJoinedEvent(appointmentId, sessionId) {
  if (!appointmentId) {
    return { stopped: true, reason: 'missing_appointment' };
  }

  if (joinedDeliveredSuccessfully.has(appointmentId)) {
    return { stopped: true, reason: 'already_delivered' };
  }

  const inFlight = joinedDeliveryPromises.get(appointmentId);
  if (inFlight) {
    return inFlight;
  }

  const delivery = (async () => {
    if (!joinedAttemptStartByAppointment.has(appointmentId)) {
      joinedAttemptStartByAppointment.set(appointmentId, Date.now());
    }

    let delayMs = 1000;
    const maxDelayMs = 30000;

    while (true) {
      let status;
      try {
        status = await apiGetCallStatus(appointmentId);
        if (shouldStopJoinedRetry(status, appointmentId)) {
          if (status?.presence_sync && !status.presence_sync.should_report_joined) {
            joinedDeliveredSuccessfully.add(appointmentId);
          }
          joinedAttemptStartByAppointment.delete(appointmentId);
          return { stopped: true, status };
        }
      } catch (statusError) {
        console.log('[API] joined status check failed:', statusError);
      }

      try {
        const data = await postCallEvent(appointmentId, 'joined', sessionId);
        joinedDeliveredSuccessfully.add(appointmentId);
        joinedAttemptStartByAppointment.delete(appointmentId);
        return data;
      } catch (error) {
        console.log('[API] joined event delivery failed:', error);
        if (!isRetryableJoinedError(error)) {
          joinedAttemptStartByAppointment.delete(appointmentId);
          throw error;
        }
        await sleep(delayMs);
        delayMs = Math.min(delayMs * 2, maxDelayMs);
      }
    }
  })();

  joinedDeliveryPromises.set(appointmentId, delivery);
  try {
    return await delivery;
  } finally {
    joinedDeliveryPromises.delete(appointmentId);
  }
}

/**
 * Web equivalent of the app's Agora onLeaveChannel: the client reached DISCONNECTED for any reason
 * other than our own client.leave() (reason 'LEAVE'), so the server should still get a 'left' event.
 */
export function shouldPostLeftOnDisconnect({ current, reason, endedByUser, appointmentId }) {
  if (current !== 'DISCONNECTED') return false;
  if (reason === 'LEAVE') return false;
  if (endedByUser) return false;
  return Boolean(appointmentId);
}

export async function apiEndCall(appointmentId) {
  await apiClient(`doctors/appointments/${appointmentId}/call/left/`, {
    method: 'POST',
    body: '{}',
  });
}

export async function requestCallPermissions() {
  if (!navigator?.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

export function buildTokenInfo(tokenRes) {
  const now = Date.now();
  let expiresAtMs;
  if (typeof tokenRes.expires_at === 'number') {
    expiresAtMs = tokenRes.expires_at * 1000;
  } else if (tokenRes.expires_at) {
    expiresAtMs = new Date(tokenRes.expires_at).getTime();
  } else {
    expiresAtMs = now + 23 * 60 * 60 * 1000;
  }

  return {
    token: tokenRes.token,
    channelName: tokenRes.channel,
    uid: tokenRes.uid ?? 0,
    appId: tokenRes.app_id || FALLBACK_APP_ID,
    expiresAt: expiresAtMs,
  };
}

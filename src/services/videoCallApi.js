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

export async function apiPostCallEvent(appointmentId, event, sessionId) {
  try {
    await apiClient(`doctors/appointments/${appointmentId}/call/events/`, {
      method: 'POST',
      body: JSON.stringify({
        event_type: event,
        session_id: sessionId ?? null,
        metadata: { source: 'agora_sdk' },
      }),
    });
  } catch (e) {
    console.log(`[API] events(${event}) failed:`, e);
  }
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

import { normalizeChatRole } from './messageUtils';

const isTrueFlag = (value) =>
  value === true || value === 'true' || value === 1 || value === '1' || value === 'online';

const isFalseFlag = (value) =>
  value === false || value === 'false' || value === 0 || value === '0' || value === 'offline';

/** Flatten nested chat.connected / presence payloads. */
const flattenPresencePayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const nested = payload.data && typeof payload.data === 'object' ? payload.data : null;
  return nested ? { ...payload, ...nested } : { ...payload };
};

/**
 * Resolve whether the *other* chat participant is online.
 * Returns true / false when the payload is explicit, otherwise null (unknown).
 */
export function resolvePeerOnline(payload, myRole) {
  const data = flattenPresencePayload(payload);
  if (!data) return null;

  const selfRole = normalizeChatRole(myRole);
  const peerRole = selfRole === 'doctor' ? 'patient' : 'doctor';

  if ('doctor_online' in data && selfRole === 'patient') return isTrueFlag(data.doctor_online);
  if ('patient_online' in data && selfRole === 'doctor') return isTrueFlag(data.patient_online);

  for (const key of ['peer_online', 'other_online', 'is_peer_online', 'counterpart_online']) {
    if (key in data) {
      if (isTrueFlag(data[key])) return true;
      if (isFalseFlag(data[key])) return false;
    }
  }

  if ('status' in data && (data.type === 'chat.presence' || data.type === 'presence' || data.user_id || data.role)) {
    const statusRole = normalizeChatRole(data.role || data.sender_role || data.participant_role);
    if (!statusRole || statusRole === peerRole) {
      if (isTrueFlag(data.status) || data.status === 'online' || data.status === 'connected') return true;
      if (isFalseFlag(data.status) || data.status === 'offline' || data.status === 'disconnected') return false;
    }
  }

  const participants = data.participants || data.online_participants || data.online_users || data.active_users;
  if (Array.isArray(participants) && participants.length) {
    if (participants.every((item) => typeof item === 'string')) {
      return participants.some((item) => normalizeChatRole(item) === peerRole);
    }
    const peer = participants.find((item) => {
      if (!item || typeof item !== 'object') return false;
      return normalizeChatRole(item.role || item.sender_role || item.participant_role) === peerRole;
    });
    if (peer) {
      if ('is_online' in peer) return isTrueFlag(peer.is_online);
      if ('online' in peer) return isTrueFlag(peer.online);
      if ('connected' in peer) return isTrueFlag(peer.connected);
      if ('status' in peer) {
        if (isTrueFlag(peer.status) || peer.status === 'online') return true;
        if (isFalseFlag(peer.status) || peer.status === 'offline') return false;
      }
      return true;
    }
    return false;
  }

  if ('is_online' in data && !('sender_role' in data) && !('text' in data)) {
    return isTrueFlag(data.is_online);
  }
  if ('online' in data && typeof data.online === 'boolean') return data.online;

  return null;
}

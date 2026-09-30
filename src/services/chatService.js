import { Utils } from '../common/utils';
import { extractUploadUrl } from './prescriptionService';
import { API_BASE } from '../chat/api';
import { parseApiError } from '../chat/apiError';

const MESSAGE_KEYS = ['messages', 'results', 'items', 'message_list', 'history'];

const looksLikeMessage = (value) =>
  !!value &&
  typeof value === 'object' &&
  ('id' in value || 'text' in value || 'sender_role' in value);

const findMessagesInPayload = (value, depth = 0) => {
  if (!value || typeof value !== 'object' || depth > 5) return null;
  for (const key of MESSAGE_KEYS) {
    const candidate = value[key];
    if (!Array.isArray(candidate)) continue;
    if (candidate.length === 0 || looksLikeMessage(candidate[0])) return candidate;
  }
  if (value.data) return findMessagesInPayload(value.data, depth + 1);
  return null;
};

const findChatAccessInPayload = (value, depth = 0) => {
  if (!value || typeof value !== 'object' || depth > 5) return null;
  if (value.chat_access && typeof value.chat_access === 'object') return value.chat_access;
  if (value.data) return findChatAccessInPayload(value.data, depth + 1);
  return null;
};

const collapseNearDuplicates = (messages) => {
  const result = [];
  for (const msg of messages) {
    const idx = result.findIndex((existing) => {
      if (existing.id && msg.id && existing.id === msg.id) return true;
      if (existing.sender_role !== msg.sender_role) return false;
      if ((existing.text || '').trim() !== (msg.text || '').trim()) return false;
      const ta = new Date(existing.created_at).getTime();
      const tb = new Date(msg.created_at).getTime();
      if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
      return Math.abs(ta - tb) < 2500;
    });
    if (idx === -1) result.push(msg);
    else if (msg.is_seen && !result[idx].is_seen) result[idx] = msg;
  }
  return result;
};

const normalizeMessagesResponse = (body, sendBlocked = false) => {
  const messages = collapseNearDuplicates(findMessagesInPayload(body) ?? []);
  return {
    messages,
    chat_access: findChatAccessInPayload(body),
    sendBlocked,
  };
};

const outboundPostInFlight = new Map();
let lastOutboundPost = null;
let syncPostLock = false;

const extractSentMessage = (body) => {
  if (!body || typeof body !== 'object') return null;
  const data = body.data && typeof body.data === 'object' ? body.data : body;
  if (data.message && typeof data.message === 'object') return data.message;
  if (looksLikeMessage(data)) return data;
  return null;
};

const authHeader = async () => {
  const token = await Utils.getData('_TOKEN');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const chatService = {
  getMessages: async (appointmentId, markRead) => {
    let url = `${API_BASE}/communication/appointments/${appointmentId}/messages/`;
    if (markRead !== undefined) {
      const value = markRead === true ? 'true' : markRead;
      url += `?mark_read=${value}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeader()),
      },
    });

    let body = {};
    try {
      body = await response.json();
    } catch {
      body = {};
    }

    if (response.ok) return normalizeMessagesResponse(body, false);

    if (response.status === 403) {
      const partial = normalizeMessagesResponse(body, true);
      if (partial.messages.length > 0 || partial.chat_access) {
        return {
          ...partial,
          chat_access: partial.chat_access
            ? {
                ...partial.chat_access,
                can_send: false,
                can_read: partial.chat_access.can_read ?? true,
              }
            : { can_send: false, can_read: true },
          sendBlocked: true,
        };
      }
      if (markRead !== undefined) {
        return chatService.getMessages(appointmentId);
      }
      return {
        messages: [],
        chat_access: { can_send: false, can_read: true },
        sendBlocked: true,
      };
    }

    const message =
      (typeof body.message === 'string' && body.message) ||
      `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.httpStatus = response.status;
    error.code = typeof body.code === 'string' ? body.code : undefined;
    throw error;
  },

  sendMessage: async (appointmentId, payload) => {
    if (syncPostLock || outboundPostInFlight.has(appointmentId)) {
      const err = new Error('Send already in progress');
      err.code = 'DUPLICATE_SEND';
      throw err;
    }

    const fingerprint = `${appointmentId}|${JSON.stringify(payload)}`;
    const now = Date.now();
    if (
      lastOutboundPost &&
      lastOutboundPost.fingerprint === fingerprint &&
      now - lastOutboundPost.at < 5000
    ) {
      const err = new Error('Duplicate send blocked');
      err.code = 'DUPLICATE_SEND';
      throw err;
    }

    syncPostLock = true;
    lastOutboundPost = { fingerprint, at: now };

    const request = (async () => {
      const response = await fetch(
        `${API_BASE}/communication/appointments/${appointmentId}/messages/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await authHeader()),
          },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw await parseApiError(response);
      const body = await response.json();
      const message = extractSentMessage(body);
      if (!message) throw new Error('Invalid send response');
      return { message };
    })();

    outboundPostInFlight.set(appointmentId, request);
    try {
      return await request;
    } finally {
      outboundPostInFlight.delete(appointmentId);
      syncPostLock = false;
    }
  },

  uploadAttachment: async (file, fileName, dir = 'consultation-chat') => {
    const formData = new FormData();
    formData.append('image', file, fileName || file?.name || 'image.jpg');
    formData.append('dir', dir);
    const response = await fetch(`${API_BASE}/user/upload/`, {
      method: 'POST',
      headers: {
        ...(await authHeader()),
      },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
    const data = await response.json();
    const url = extractUploadUrl(data) || data?.data?.url;
    if (!url) throw new Error('Upload failed');
    return url;
  },
};

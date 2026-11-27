const TEMP_ID_PREFIX = 'temp-';
const NEAR_DUPLICATE_MS = 8000;

export function isTempMessage(message) {
  return Boolean(message._pending) || String(message.id || '').startsWith(TEMP_ID_PREFIX);
}

/** Lowercase patient|doctor when the API uses mixed case or aliases. */
export function normalizeChatRole(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return '';
  if (raw.includes('doc')) return 'doctor';
  if (raw.includes('pat') || raw === 'user' || raw === 'customer' || raw === 'client') return 'patient';
  return raw;
}

const firstString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

/**
 * Normalize REST / WebSocket chat payloads so the UI always has `text` + `sender_role`.
 * Doctor messages often arrive with `message` / `role` instead of `text` / `sender_role`.
 */
export function normalizeChatMessage(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const sender = raw.sender && typeof raw.sender === 'object' ? raw.sender : null;
  let role = normalizeChatRole(
    raw.sender_role ?? raw.sender_type ?? raw.role ?? raw.from_role ?? sender?.role ?? sender?.sender_role,
  );
  if (!role && raw.is_doctor === true) role = 'doctor';
  if (!role && raw.is_patient === true) role = 'patient';

  const text = firstString(
    raw.text,
    typeof raw.message === 'string' ? raw.message : '',
    raw.message_text,
    raw.message_body,
    raw.body,
    raw.content,
    typeof raw.message === 'object' ? raw.message?.text : '',
  );

  const sender_name = firstString(
    raw.sender_name,
    sender?.name,
    sender?.full_name,
    sender?.doctor_name,
    sender?.patient_name,
    raw.doctor_name,
    raw.patient_name,
  );

  const created_at = raw.created_at || raw.timestamp || raw.sent_at || raw.createdAt || new Date().toISOString();

  return {
    ...raw,
    text,
    sender_role: role || normalizeChatRole(raw.sender_role) || '',
    sender_name: sender_name || raw.sender_name || '',
    created_at,
    is_seen: Boolean(raw.is_seen ?? raw.seen ?? raw.read),
  };
}

/** Pull the message object out of chat.receive / REST envelopes. */
export function unwrapChatSocketPayload(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.message && typeof data.message === 'object') return normalizeChatMessage(data.message);
  if (data.data?.message && typeof data.data.message === 'object') {
    return normalizeChatMessage(data.data.message);
  }
  const nested = data.data && typeof data.data === 'object' ? data.data : null;
  if (nested && (nested.text || nested.message || nested.sender_role || nested.id)) {
    return normalizeChatMessage(nested);
  }
  if (data.text || data.message || data.sender_role || data.id) {
    return normalizeChatMessage(data);
  }
  return null;
}

const attachmentKey = (attachments) =>
  (attachments || [])
    .map((a) => `${a.file_type}:${a.file_url}`)
    .sort()
    .join('|');

const isNearDuplicate = (a, b) => {
  if (a.id && b.id && a.id === b.id) return true;
  if (a.sender_role !== b.sender_role) return false;
  if ((a.text || '').trim() !== (b.text || '').trim()) return false;
  if (attachmentKey(a.attachments) !== attachmentKey(b.attachments)) return false;
  const ta = new Date(a.created_at).getTime();
  const tb = new Date(b.created_at).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return true;
  return Math.abs(ta - tb) < NEAR_DUPLICATE_MS;
};

const preferMessage = (a, b) => {
  const aTemp = isTempMessage(a);
  const bTemp = isTempMessage(b);
  if (aTemp && !bTemp) return b;
  if (!aTemp && bTemp) return a;
  if (a.is_seen && !b.is_seen) return a;
  if (!a.is_seen && b.is_seen) return b;
  return a;
};

export function dedupeMessages(messages) {
  const result = [];
  for (const msg of messages) {
    const normalized = normalizeChatMessage(msg);
    if (!normalized) continue;
    const idx = result.findIndex((existing) => isNearDuplicate(existing, normalized));
    if (idx === -1) {
      result.push(normalized);
      continue;
    }
    result[idx] = preferMessage(result[idx], normalized);
  }
  return result.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

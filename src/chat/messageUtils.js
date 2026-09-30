const TEMP_ID_PREFIX = 'temp-';
const NEAR_DUPLICATE_MS = 8000;

export function isTempMessage(message) {
  return Boolean(message._pending) || String(message.id || '').startsWith(TEMP_ID_PREFIX);
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
    const idx = result.findIndex((existing) => isNearDuplicate(existing, msg));
    if (idx === -1) {
      result.push(msg);
      continue;
    }
    result[idx] = preferMessage(result[idx], msg);
  }
  return result.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

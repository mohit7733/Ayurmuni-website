const PREFIX_RE = /^[A-Z]{2,4}-/i;

export function formatDisplayId(prefix, rawId) {
  if (rawId == null) return '-';
  const raw = String(rawId).trim();
  if (!raw) return '-';
  if (PREFIX_RE.test(raw)) {
    const upper = raw.toUpperCase();
    const dash = upper.indexOf('-');
    return `${upper.slice(0, dash + 1)}${upper.slice(dash + 1)}`;
  }
  const alphanumeric = raw.replace(/[^a-zA-Z0-9]/g, '');
  const suffix = alphanumeric.slice(-5).toUpperCase();
  if (!suffix) return '-';
  return `${prefix}-${suffix}`;
}

export const formatPrescriptionId = (rawId) => formatDisplayId('PRX', rawId);
export const formatOrderId = (rawId) => formatDisplayId('ORD', rawId);
export const formatReceiptId = (rawId) => formatDisplayId('RCP', rawId);
export const formatConsultationId = (rawId) => formatDisplayId('CON', rawId);
export const formatAppointmentId = (rawId) => formatDisplayId('APT', rawId);

export const formatDisplayIdHash = (prefix, rawId) => {
  const formatted = formatDisplayId(prefix, rawId);
  return formatted === '-' ? '-' : `#${formatted}`;
};

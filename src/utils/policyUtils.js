export const parsePolicyAcceptedCustomer = (payload) => {
  const map =
    payload?.policy_accepted ??
    payload?.data?.policy_accepted ??
    payload?.data?.data?.policy_accepted;
  if (!map || typeof map !== 'object') return false;
  return map.customer === true;
};

export const getPolicyDoc = (entry) => entry?.policy ?? entry ?? null;

const POLICY_ICON_FALLBACKS = ['file', 'shield', 'lock', 'receipt', 'list', 'world'];

export const policyIconName = (entry, index = 0) => {
  const doc = getPolicyDoc(entry);
  const key = `${doc?.policy_type || ''} ${doc?.title || ''} ${doc?.name || ''}`.toLowerCase();
  if (key.includes('privacy')) return '🔒';
  if (key.includes('term') || key.includes('license')) return '📋';
  if (key.includes('refund')) return '↩️';
  if (key.includes('return')) return '🔄';
  if (key.includes('ship') || key.includes('deliver')) return '🚚';
  if (key.includes('cancel')) return '⚠️';
  if (key.includes('cookie')) return '⚙️';
  if (key.includes('payment') || key.includes('billing')) return '💳';
  if (key.includes('consent')) return '🛡️';
  if (key.includes('medical') || key.includes('disclaimer') || key.includes('health')) {
    return '🩺';
  }
  return ['📄', '🛡️', '🔒', '🧾', '📋', '🌐'][index % POLICY_ICON_FALLBACKS.length];
};

export const getPolicyVersion = (entry) => {
  const doc = getPolicyDoc(entry);
  const n = Number(doc?.version);
  return Number.isFinite(n) ? n : null;
};

export const getAcceptedVersion = (entry) => {
  const n = Number(entry?.accepted_version);
  return Number.isFinite(n) ? n : null;
};

export const isPolicyVersionUpdated = (entry) => {
  if (!entry || typeof entry !== 'object') return false;
  const current = getPolicyVersion(entry);
  const accepted = getAcceptedVersion(entry);
  if (current == null || accepted == null) return false;
  return accepted !== current;
};

export const isPolicyAccepted = (entry) => entry?.is_accepted === false;

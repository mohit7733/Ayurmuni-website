import { apiClient } from './apiClient';
import { readAuthenticated } from './guestAuth';

export const getRequiredPolicies = async (policyType) => {
  const endpoint = policyType
    ? `policies/customer/required/?policy_type=${encodeURIComponent(policyType)}`
    : 'policies/customer/required/';

  return apiClient(endpoint, {
    method: 'GET',
  });
};

/**
 * GET policies/legal/required/ — public (no token), as the app's getLegalRequiredPolicies
 * (PolicyServices.ts) used before auth. policy_type: terms_and_conditions | privacy_policy.
 */
export const getLegalRequiredPolicies = async (policyType) => {
  const endpoint = policyType
    ? `policies/legal/required/?policy_type=${encodeURIComponent(policyType)}`
    : 'policies/legal/required/';
  return apiClient(endpoint, { method: 'GET' }, false);
};

/** Logged-out visitors read the public legal set; signed-in users their required set. */
export const getPoliciesForViewer = (policyType) =>
  readAuthenticated() ? getRequiredPolicies(policyType) : getLegalRequiredPolicies(policyType);

export const acceptPolicies = async (body) => {
  return apiClient(
    'policies/legal/accept/',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    true,
  );
};

/** Port of the app's getPoliciesList: parse required / legal responses (flexible shapes). */
export const getPoliciesList = (response) => {
  if (!response) return [];
  const candidates = [
    response?.data?.policies,
    response?.policies,
    response?.data?.data?.policies,
    response?.data,
    response?.results,
    response?.data?.results,
  ];
  for (const item of candidates) {
    if (
      Array.isArray(item) &&
      (item.length === 0 ||
        item[0]?.policy != null ||
        item[0]?.policy_type != null ||
        item[0]?.title != null ||
        item[0]?.content != null ||
        item[0]?.name != null)
    ) {
      return item;
    }
  }
  const single =
    response?.data?.policy ??
    response?.policy ??
    (response?.data && (response.data.policy_type || response.data.content || response.data.title)
      ? response.data
      : null);
  return single ? [single] : [];
};

export const getPolicyDocument = (entry) => {
  if (!entry) return null;
  const doc = entry?.policy ?? entry;
  if (!doc || typeof doc !== 'object') return null;
  return doc;
};

export const normalizePolicyContent = (content) => {
  if (Array.isArray(content)) return content;
  if (typeof content === 'string' && content.trim()) {
    return [{ type: 'paragraph', text: content.trim() }];
  }
  return [];
};

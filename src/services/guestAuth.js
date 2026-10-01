import { Utils } from '../common/utils';
import { showSuccessToast } from '../config/key';
import { navigate } from '../navigation/nav';
import * as ProfileServices from './profileService';

export const ACCESS_KEYS = {
  TOKEN: '_TOKEN',
  REFRESH: '_REFRESH_TOKEN',
  IS_GUEST: '_IS_GUEST',
  USER_INFO: '_USER_INFO',
  USER_ID: '_USER_ID',
};

const truthy = (v) => v === true || v === 'true' || v === 1 || v === '1';
const falsy = (v) => v === false || v === 'false' || v === 0 || v === '0';

const profileCreatedFlag = (profile) =>
  profile?.is_customer_profile_created ??
  profile?.customer_created ??
  profile?.is_profile;

const hasCustomerIdentity = (profile) =>
  Boolean(
    profile &&
      String(profile.first_name ?? '').trim() &&
      (profile.customer_id || profile.id),
  );

export function readAuthenticated() {
  try {
    const raw = localStorage.getItem(`ayurmuni_${ACCESS_KEYS.TOKEN}`);
    if (raw == null) return false;
    return !!JSON.parse(raw);
  } catch {
    return false;
  }
}

export async function isAuthenticated() {
  const token = await Utils.getData(ACCESS_KEYS.TOKEN);
  return !!token;
}

export async function isGuestUser() {
  if (!(await isAuthenticated())) return false;
  const flag = await Utils.getData(ACCESS_KEYS.IS_GUEST);
  return flag === true || flag === 'true';
}

export async function getAccessLevel() {
  if (!(await isAuthenticated())) return 'logged_out';
  if (await isGuestUser()) return 'guest';
  return 'full';
}

export async function markAsGuest() {
  await Utils.storeData(ACCESS_KEYS.IS_GUEST, true);
}

export async function promoteToFullUser() {
  await Utils.removeData(ACCESS_KEYS.IS_GUEST);
}

export function isProfileComplete(profile) {
  if (!profile) return false;
  if (truthy(profileCreatedFlag(profile))) return true;
  if (profile.is_onboarded === true) return true;
  if (Number(profile.prakriti_progress) >= 100) return true;
  if (hasCustomerIdentity(profile)) return true;
  return false;
}

export async function syncAccessFromProfile(profile) {
  if (!(await isAuthenticated())) return 'logged_out';

  if (isProfileComplete(profile)) {
    await promoteToFullUser();
    return 'full';
  }

  if (
    profile &&
    falsy(profileCreatedFlag(profile)) &&
    !hasCustomerIdentity(profile)
  ) {
    await markAsGuest();
    return 'guest';
  }

  if (await isGuestUser()) {
    return 'guest';
  }

  await markAsGuest();
  return 'guest';
}

export async function persistProfileAndSyncAccess(profile) {
  if (profile && typeof profile === 'object') {
    const prev = (await Utils.getData(ACCESS_KEYS.USER_INFO)) || {};
    const merged = { ...prev, ...profile };
    await Utils.storeData(ACCESS_KEYS.USER_INFO, merged);
    return syncAccessFromProfile(merged);
  }
  return syncAccessFromProfile(profile);
}

export function navigateToLogin(message) {
  if (message) showSuccessToast(message, 'error');
  navigate('/login');
}

export function navigateToCompleteDetails(message) {
  navigate('/complete-details', {
    reason:
      message ||
      'Complete your profile and prakriti assessment to continue.',
  });
}

export async function requireAuth(
  message = 'Complete your details to proceed',
) {
  if (!(await isAuthenticated())) {
    navigateToLogin('Please verify OTP to continue');
    return false;
  }

  if (await isGuestUser()) {
    const { isComplete } = await resolveAccessLikeProfile();
    if (isComplete) return true;

    const guestMessage =
      !message || /login/i.test(message)
        ? 'Complete your profile and prakriti assessment to continue.'
        : message;
    navigateToCompleteDetails(guestMessage);
    return false;
  }

  return true;
}

export async function resolveAccessLikeProfile() {
  if (!(await isAuthenticated())) {
    return { level: 'logged_out', profile: null, isComplete: false };
  }

  const cached = (await Utils.getData(ACCESS_KEYS.USER_INFO)) || null;
  let profile = cached;

  try {
    const res = await ProfileServices.user_profile();
    if (res?.data) {
      profile = { ...(cached || {}), ...res.data };
      await Utils.storeData(ACCESS_KEYS.USER_INFO, profile);
    }
  } catch {
    // cached profile
  }

  if (isProfileComplete(profile)) {
    await promoteToFullUser();
    return { level: 'full', profile, isComplete: true };
  }

  const level = await syncAccessFromProfile(profile);
  if (level === 'full' || isProfileComplete(profile)) {
    await promoteToFullUser();
    return { level: 'full', profile, isComplete: true };
  }

  return { level, profile, isComplete: false };
}

export async function getOnboardingEntryScreen() {
  const info = await Utils.getData(ACCESS_KEYS.USER_INFO);
  const hasProfile = !!(info?.first_name || info?.customer_id || info?.id);
  return hasProfile ? '/assessment' : '/onboarding';
}

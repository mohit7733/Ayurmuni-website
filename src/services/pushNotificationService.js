import { apiClient } from './apiClient';

/**
 * Web port of the app's services/pushNotificationService.ts.
 *
 * The app uses OneSignal: OneSignal.login(user_id) links the device to the user through the
 * External ID, then POST notifications/push/welcome/. There is no token-registration endpoint;
 * the backend finds the subscription in OneSignal by External ID. The web does the same with
 * the OneSignal Web SDK (v16).
 *
 * Config needed (nothing is invented here):
 * - VITE_ONESIGNAL_APP_ID: the OneSignal app id with the Web platform enabled for this site's origin.
 * - public/OneSignalSDKWorker.js served from the site root (added).
 * VITE_ONESIGNAL_APP_ID overrides DEFAULT_APP_ID below.
 */
// Public client id (same as the app's ONE_SIGNAL_APP_ID); env overrides, default keeps Vercel builds working.
const DEFAULT_APP_ID = '5c79696d-81e8-46a7-922d-b0b08eef4e57';
const APP_ID = String(import.meta.env.VITE_ONESIGNAL_APP_ID || DEFAULT_APP_ID).trim();
const SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

let sdkPromise = null;
const PROMPT_DECLINED_KEY = 'ayurmuni__PUSH_PROMPT_DECLINED';
let sessionSyncedFor = null;

export const isPushConfigured = () => Boolean(APP_ID) && typeof window !== 'undefined' && 'Notification' in window;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Load + init OneSignal once. Does not request permission (app: initializeOneSignal). */
export const initializeOneSignal = () => {
  if (!isPushConfigured()) return Promise.resolve(null);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({ appId: APP_ID, serviceWorkerPath: '/OneSignalSDKWorker.js', allowLocalhostAsSecureOrigin: true });
        resolve(OneSignal);
      } catch (error) {
        // e.g. "Can only be used on: <origin>" when the dashboard's Web site URL doesn't match.
        console.warn('[push] OneSignal init failed:', error?.message || error);
        resolve(null);
      }
    });
    if (!document.querySelector(`script[src="${SDK_URL}"]`)) {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.defer = true;
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    }
  });
  return sdkPromise;
};

/** Browser permission (app: requestNotificationPermission — only after OTP or from Settings). */
export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  const OneSignal = await initializeOneSignal();
  try {
    if (OneSignal) {
      if (!OneSignal.Notifications.permission) await OneSignal.Notifications.requestPermission();
      return Boolean(OneSignal.Notifications.permission);
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
};

/** Same readiness gate as the app: opted in + subscription id + token + External ID === userId. */
export const getPushAssociationStatus = async (userId) => {
  const OneSignal = await initializeOneSignal();
  const sub = OneSignal?.User?.PushSubscription;
  const externalId = OneSignal?.User?.externalId ?? null;
  const status = {
    optedIn: Boolean(sub?.optedIn),
    subscriptionId: sub?.id || null,
    token: sub?.token || null,
    externalId,
    expectedUserId: userId != null ? String(userId) : null,
  };
  status.associated = Boolean(status.expectedUserId && externalId === status.expectedUserId);
  status.subscribedLocally = Boolean(status.optedIn && status.subscriptionId && status.token);
  status.readyForWelcome = status.associated && status.subscribedLocally;
  return status;
};

const waitFor = async (check, { timeoutMs, intervalMs }) => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check()) return true;
    await wait(intervalMs);
  }
  return false;
};

/** app: loginOneSignalUser — OneSignal.login(user_id) + optIn. */
export const loginOneSignalUser = async (userId) => {
  if (!userId) return null;
  const OneSignal = await initializeOneSignal();
  if (!OneSignal) return null;
  try {
    await OneSignal.login(String(userId));
    await OneSignal.User.PushSubscription.optIn();
    const associated = await waitFor(async () => (await getPushAssociationStatus(userId)).associated, {
      timeoutMs: 15000,
      intervalMs: 500,
    });
    const status = await getPushAssociationStatus(userId);
    return { ...status, associated };
  } catch {
    return null;
  }
};

/** POST notifications/push/welcome/ (auth). */
export const welcome_notification = () => apiClient('notifications/push/welcome/', { method: 'POST' }, true);

const welcomeNeedsRetry = (response) =>
  /subscrib|onesignal|external|not found|no device/i.test(String(response?.message || response?.error || ''));

/**
 * app: completeWelcomePushFlow — permission → login(user_id) → wait for subscription →
 * settle → re-assert login → welcome API, retrying once when the backend can't find the user yet.
 */
export const completeWelcomePushFlow = async (userId) => {
  const WELCOME_SETTLE_MS = 8000;
  if (!isPushConfigured()) return { success: false, reason: 'push_not_configured' };
  const OneSignal = await initializeOneSignal();
  if (!OneSignal) return { success: false, reason: 'onesignal_unavailable' };
  if (!(await requestNotificationPermission())) return { success: false, reason: 'permission_denied' };
  const login = await loginOneSignalUser(userId);
  if (!login) return { success: false, reason: 'onesignal_login_failed' };
  if (!login.associated) return { success: false, reason: 'external_id_not_associated' };
  const ready = await waitFor(async () => (await getPushAssociationStatus(userId)).subscribedLocally, {
    timeoutMs: 45000,
    intervalMs: 500,
  });
  if (!ready) return { success: false, reason: 'still_unsubscribed_before_settle' };
  await wait(WELCOME_SETTLE_MS);
  try {
    await OneSignal.login(String(userId));
  } catch {
    // ignore
  }
  const statusBefore = await getPushAssociationStatus(userId);
  if (!statusBefore.readyForWelcome) {
    return {
      success: false,
      reason: statusBefore.associated ? 'subscription_incomplete_before_api' : 'external_id_missing_before_api',
      statusBefore,
    };
  }
  let response = await welcome_notification();
  if (response?.success === false && welcomeNeedsRetry(response)) {
    try {
      await OneSignal.login(String(userId));
      await OneSignal.User.PushSubscription.optIn();
    } catch {
      // ignore
    }
    await wait(WELCOME_SETTLE_MS);
    const gate = await getPushAssociationStatus(userId);
    if (!gate.readyForWelcome) return { success: false, reason: 'still_not_ready_on_retry', response, statusBefore };
    response = await welcome_notification();
  }
  return { success: response?.success !== false, response, statusBefore };
};

/** Settings push toggle (app: pushSubscription.optIn / optOut). */
export const setPushOptIn = async (enabled, userId) => {
  const OneSignal = await initializeOneSignal();
  if (!OneSignal) return false;
  try {
    if (enabled && userId) {
      localStorage.removeItem(PROMPT_DECLINED_KEY);
      await loginOneSignalUser(userId);
    }
    if (enabled) await OneSignal.User.PushSubscription.optIn();
    else await OneSignal.User.PushSubscription.optOut();
    return true;
  } catch {
    return false;
  }
};

/** app: logoutOneSignalUser — on sign-out. Loads the SDK if needed, since the External ID
 * persists in the browser across reloads. */
export const logoutOneSignalUser = () => {
  sessionSyncedFor = null;
  if (!isPushConfigured()) return;
  initializeOneSignal().then((OneSignal) => OneSignal?.logout?.()).catch(() => undefined);
};

/**
 * Logged-in session sync (users who logged in before push existed never subscribed):
 * init OneSignal, ask once when permission is 'default' (a decline is remembered, no nagging),
 * and when granted: login(String(user_id)) — same External ID format as the app — then optIn.
 * Callers pass only full (non-guest) users with notifications not disabled.
 */
export const syncPushForSession = async (userId) => {
  if (!userId || !isPushConfigured()) return null;
  const id = String(userId);
  if (sessionSyncedFor === id) return null;
  sessionSyncedFor = id;
  const OneSignal = await initializeOneSignal();
  if (!OneSignal) return null;
  try {
    let granted = Boolean(OneSignal.Notifications.permission);
    if (!granted && Notification.permission === 'default' && !localStorage.getItem(PROMPT_DECLINED_KEY)) {
      await OneSignal.Notifications.requestPermission();
      granted = Boolean(OneSignal.Notifications.permission);
      if (!granted) localStorage.setItem(PROMPT_DECLINED_KEY, '1');
    }
    if (!granted) return { granted: false };
    return { granted: true, ...(await loginOneSignalUser(id)) };
  } catch (error) {
    console.warn('[push] session sync failed:', error?.message || error);
    return null;
  }
};

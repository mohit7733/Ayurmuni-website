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
 * Without VITE_ONESIGNAL_APP_ID every call here is a safe no-op and the welcome API is skipped,
 * matching the app, which only calls it once the device is subscribed.
 */
const APP_ID = String(import.meta.env.VITE_ONESIGNAL_APP_ID || '').trim();
const SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

let sdkPromise = null;

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
      } catch {
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
export const setPushOptIn = async (enabled) => {
  const OneSignal = await initializeOneSignal();
  if (!OneSignal) return false;
  try {
    if (enabled) await OneSignal.User.PushSubscription.optIn();
    else await OneSignal.User.PushSubscription.optOut();
    return true;
  } catch {
    return false;
  }
};

/** app: logoutOneSignalUser — on sign-out. Never loads the SDK just to log out. */
export const logoutOneSignalUser = () => {
  if (!sdkPromise) return;
  sdkPromise.then((OneSignal) => OneSignal?.logout?.()).catch(() => undefined);
};

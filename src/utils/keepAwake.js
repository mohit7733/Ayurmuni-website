/**
 * Keep the screen on during a video call. Web port of the app's utils/keepAwake
 * using the Screen Wake Lock API; silently does nothing where it is unsupported.
 */
let sentinel = null;
let wanted = false;
let listening = false;

const supported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;

const request = async () => {
  if (!wanted || sentinel || !supported()) return;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (!wanted) {
      lock.release().catch(() => {});
      return;
    }
    sentinel = lock;
    lock.addEventListener?.('release', () => {
      if (sentinel === lock) sentinel = null;
    });
  } catch {
    sentinel = null;
  }
};

// Browsers drop the lock when the tab is hidden; take it again when it is visible.
const onVisibility = () => {
  if (document.visibilityState === 'visible') request();
};

export const activateKeepAwake = () => {
  wanted = true;
  if (typeof document !== 'undefined' && !listening) {
    document.addEventListener('visibilitychange', onVisibility);
    listening = true;
  }
  return request();
};

export const deactivateKeepAwake = () => {
  wanted = false;
  if (typeof document !== 'undefined' && listening) {
    document.removeEventListener('visibilitychange', onVisibility);
    listening = false;
  }
  const lock = sentinel;
  sentinel = null;
  if (lock) lock.release().catch(() => {});
};
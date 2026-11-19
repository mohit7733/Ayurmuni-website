/**
 * Meta (Facebook) Pixel — minimum PageView setup.
 * Env: VITE_META_PIXEL_ID overrides DEFAULT_PIXEL_ID.
 */
const DEFAULT_PIXEL_ID = '1885952172892397';
const PIXEL_ID = String(import.meta.env.VITE_META_PIXEL_ID || DEFAULT_PIXEL_ID).trim();
const SDK_URL = 'https://connect.facebook.net/en_US/fbevents.js';

let initPromise = null;

export const isMetaPixelConfigured = () => Boolean(PIXEL_ID) && typeof window !== 'undefined';

/** Load fbevents.js once and call fbq('init', …). Safe to call repeatedly. */
export const initMetaPixel = () => {
  if (!isMetaPixelConfigured()) return Promise.resolve(null);
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    const f = window;
    if (f.fbq) {
      try {
        f.fbq('init', PIXEL_ID);
      } catch {
        /* already inited */
      }
      resolve(f.fbq);
      return;
    }

    const n = (f.fbq = function (...args) {
      if (n.callMethod) n.callMethod(...args);
      else n.queue.push(args);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];

    const script = document.createElement('script');
    script.async = true;
    script.src = SDK_URL;
    script.onload = () => {
      try {
        f.fbq('init', PIXEL_ID);
        resolve(f.fbq);
      } catch (error) {
        console.warn('[meta-pixel] init failed:', error?.message || error);
        resolve(null);
      }
    };
    script.onerror = () => {
      console.warn('[meta-pixel] failed to load SDK');
      resolve(null);
    };
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);
  });

  return initPromise;
};

/** Standard PageView event (call on first load and on SPA navigations). */
export const trackMetaPageView = () => {
  if (!isMetaPixelConfigured()) return;
  initMetaPixel().then((fbq) => {
    if (!fbq) return;
    try {
      fbq('track', 'PageView');
    } catch (error) {
      console.warn('[meta-pixel] PageView failed:', error?.message || error);
    }
  });
};

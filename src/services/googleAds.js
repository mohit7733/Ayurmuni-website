/**
 * Google Ads (gtag.js) — base tag + Website Lead conversion.
 * Env: VITE_GOOGLE_ADS_ID overrides DEFAULT_ADS_ID.
 */
const DEFAULT_ADS_ID = 'AW-18528339266';
const DEFAULT_LEAD_SEND_TO = 'AW-18528339266/Ryu5CPe63bodEMKKgINF';

const ADS_ID = String(import.meta.env.VITE_GOOGLE_ADS_ID || DEFAULT_ADS_ID).trim();
const LEAD_SEND_TO = String(
  import.meta.env.VITE_GOOGLE_ADS_LEAD_SEND_TO || DEFAULT_LEAD_SEND_TO,
).trim();
const SDK_URL = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ADS_ID)}`;

let initPromise = null;

export const isGoogleAdsConfigured = () => Boolean(ADS_ID) && typeof window !== 'undefined';

const ensureDataLayer = () => {
  const w = window;
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== 'function') {
    w.gtag = function gtag(...args) {
      w.dataLayer.push(args);
    };
  }
  return w.gtag;
};

/** Load gtag.js once and call gtag('config', …). Safe to call repeatedly. */
export const initGoogleAds = () => {
  if (!isGoogleAdsConfigured()) return Promise.resolve(null);
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    const gtag = ensureDataLayer();

    if (window.__ayurmuniGoogleAdsReady) {
      try {
        gtag('config', ADS_ID);
      } catch {
        /* already configured */
      }
      resolve(gtag);
      return;
    }

    gtag('js', new Date());
    gtag('config', ADS_ID);

    const existing = document.querySelector(`script[src="${SDK_URL}"]`);
    if (existing) {
      window.__ayurmuniGoogleAdsReady = true;
      resolve(gtag);
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = SDK_URL;
    script.onload = () => {
      window.__ayurmuniGoogleAdsReady = true;
      resolve(gtag);
    };
    script.onerror = () => {
      console.warn('[google-ads] failed to load gtag.js');
      initPromise = null;
      resolve(null);
    };
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);
  });

  return initPromise;
};

/** Ensure the Google tag is active (call on first load and SPA navigations). */
export const trackGoogleAdsPageView = () => {
  if (!isGoogleAdsConfigured()) return;
  initGoogleAds().then((gtag) => {
    if (!gtag) return;
    try {
      gtag('config', ADS_ID);
    } catch (error) {
      console.warn('[google-ads] config failed:', error?.message || error);
    }
  });
};

/**
 * Event snippet: Ayurmuni - Website Lead (generate_lead).
 * Fires once per booking id (session) to avoid double-counting refreshes.
 */
export const trackGoogleAdsLeadConversion = (dedupeKey = '') => {
  if (!isGoogleAdsConfigured() || !LEAD_SEND_TO) return;
  const key = `gads_lead_${String(dedupeKey || 'default').trim()}`;
  try {
    if (sessionStorage.getItem(key) === '1') return;
  } catch {
    /* private mode */
  }

  initGoogleAds().then((gtag) => {
    if (!gtag) return;
    try {
      gtag('event', 'conversion', { send_to: LEAD_SEND_TO });
      try {
        sessionStorage.setItem(key, '1');
      } catch {
        /* ignore */
      }
    } catch (error) {
      console.warn('[google-ads] lead conversion failed:', error?.message || error);
    }
  });
};

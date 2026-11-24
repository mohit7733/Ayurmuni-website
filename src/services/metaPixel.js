/**
 * Meta (Facebook) Pixel — PageView + Phase 2 funnel events.
 * Env: VITE_META_PIXEL_ID overrides DEFAULT_PIXEL_ID.
 */
const DEFAULT_PIXEL_ID = '1885952172892398';
const PIXEL_ID = String(import.meta.env.VITE_META_PIXEL_ID || DEFAULT_PIXEL_ID).trim();
const SDK_URL = 'https://connect.facebook.net/en_US/fbevents.js';

let initPromise = null;

export const isMetaPixelConfigured = () => Boolean(PIXEL_ID) && typeof window !== 'undefined';

const asNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const asIdList = (value) => {
  if (value == null || value === '') return undefined;
  if (Array.isArray(value)) {
    const ids = value.map((v) => String(v).trim()).filter(Boolean);
    return ids.length ? ids : undefined;
  }
  return [String(value).trim()].filter(Boolean);
};

/** Stable-ish client event id for optional Pixel ↔ CAPI dedup later. */
export const createMetaEventId = (prefix = 'web') =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

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

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );

const track = (eventName, params = {}) => {
  if (!isMetaPixelConfigured() || !eventName) return;
  initMetaPixel().then((fbq) => {
    if (!fbq) return;
    try {
      const cleaned = cleanParams(params);
      if (Object.keys(cleaned).length) fbq('track', eventName, cleaned);
      else fbq('track', eventName);
    } catch (error) {
      console.warn(`[meta-pixel] ${eventName} failed:`, error?.message || error);
    }
  });
};

/** Custom events (e.g. PrakritiTestComplete) — Meta uses trackCustom. */
const trackCustom = (eventName, params = {}) => {
  if (!isMetaPixelConfigured() || !eventName) return;
  initMetaPixel().then((fbq) => {
    if (!fbq) return;
    try {
      const cleaned = cleanParams(params);
      if (Object.keys(cleaned).length) fbq('trackCustom', eventName, cleaned);
      else fbq('trackCustom', eventName);
    } catch (error) {
      console.warn(`[meta-pixel] custom ${eventName} failed:`, error?.message || error);
    }
  });
};

/** Standard PageView event (call on first load and on SPA navigations). */
export const trackMetaPageView = () => track('PageView');

/**
 * Build common ecommerce params for Meta standard events.
 * @param {{ contentIds?: unknown, contentType?: string, contentName?: string, value?: unknown, currency?: string, numItems?: unknown, searchString?: string, orderId?: string, eventId?: string }} input
 */
export const buildMetaCommerceParams = ({
  contentIds,
  contentType = 'product',
  contentName,
  value,
  currency = 'INR',
  numItems,
  searchString,
  orderId,
  eventId,
} = {}) => {
  const params = {
    content_type: contentType,
    content_ids: asIdList(contentIds),
    content_name: contentName ? String(contentName) : undefined,
    value: asNumber(value),
    currency: currency || 'INR',
    num_items: asNumber(numItems),
    search_string: searchString ? String(searchString) : undefined,
    order_id: orderId ? String(orderId) : undefined,
    eventID: eventId || undefined,
  };
  return params;
};

export const trackMetaViewContent = (input = {}) =>
  track('ViewContent', buildMetaCommerceParams(input));

export const trackMetaAddToCart = (input = {}) =>
  track('AddToCart', buildMetaCommerceParams(input));

export const trackMetaInitiateCheckout = (input = {}) =>
  track(
    'InitiateCheckout',
    buildMetaCommerceParams({
      eventId: input.eventId || createMetaEventId('checkout'),
      ...input,
    }),
  );

export const trackMetaSearch = (searchString, input = {}) => {
  const q = String(searchString || '').trim();
  if (!q) return;
  track(
    'Search',
    buildMetaCommerceParams({
      searchString: q,
      contentType: input.contentType || 'product',
      contentIds: input.contentIds,
      value: input.value,
      currency: input.currency,
      eventId: input.eventId || createMetaEventId('search'),
    }),
  );
};

/** Phase 3 — standard conversion events (mirror backend CAPI where possible). */
export const trackMetaCompleteRegistration = (input = {}) =>
  track(
    'CompleteRegistration',
    buildMetaCommerceParams({
      eventId: input.eventId || createMetaEventId('register'),
      currency: input.currency || 'INR',
      value: input.value,
      contentName: input.contentName || 'customer_register',
    }),
  );

export const trackMetaSchedule = (input = {}) =>
  track(
    'Schedule',
    buildMetaCommerceParams({
      eventId: input.eventId || createMetaEventId('schedule'),
      contentIds: input.contentIds,
      contentName: input.contentName,
      value: input.value,
      currency: input.currency || 'INR',
    }),
  );

export const trackMetaSubscribe = (input = {}) =>
  track(
    'Subscribe',
    buildMetaCommerceParams({
      eventId: input.eventId || createMetaEventId('subscribe'),
      contentIds: input.contentIds,
      contentName: input.contentName,
      value: input.value,
      currency: input.currency || 'INR',
    }),
  );

export const trackMetaPurchase = (input = {}) =>
  track(
    'Purchase',
    buildMetaCommerceParams({
      eventId: input.eventId || createMetaEventId('purchase'),
      contentIds: input.contentIds,
      contentType: input.contentType || 'product',
      contentName: input.contentName,
      value: input.value,
      currency: input.currency || 'INR',
      numItems: input.numItems,
      orderId: input.orderId,
    }),
  );

export const trackMetaPrakritiTestComplete = (input = {}) =>
  trackCustom(
    'PrakritiTestComplete',
    buildMetaCommerceParams({
      eventId: input.eventId || createMetaEventId('prakriti'),
      contentName: input.contentName || input.result || 'prakriti',
      currency: input.currency || 'INR',
      value: input.value,
    }),
  );

/** Landing survey lives outside this app — helper kept for future use. */
export const trackMetaSurveyQuizComplete = (input = {}) =>
  trackCustom(
    'SurveyQuizComplete',
    buildMetaCommerceParams({
      eventId: input.eventId || createMetaEventId('survey'),
      contentName: input.contentName || 'landing_survey',
      currency: input.currency || 'INR',
      value: input.value,
    }),
  );

export const trackMetaAddToWishlist = (input = {}) =>
  track(
    'AddToWishlist',
    buildMetaCommerceParams({
      eventId: input.eventId || createMetaEventId('wishlist'),
      contentIds: input.contentIds,
      contentType: input.contentType || 'product',
      contentName: input.contentName,
      value: input.value,
      currency: input.currency || 'INR',
    }),
  );

export const trackMetaAddPaymentInfo = (input = {}) =>
  track(
    'AddPaymentInfo',
    buildMetaCommerceParams({
      eventId: input.eventId || createMetaEventId('payinfo'),
      contentIds: input.contentIds,
      contentType: input.contentType || 'product',
      contentName: input.contentName,
      value: input.value,
      currency: input.currency || 'INR',
      orderId: input.orderId,
    }),
  );

export const trackMetaContact = (input = {}) =>
  track('Contact', {
    eventID: input.eventId || createMetaEventId('contact'),
    content_name: input.contentName || input.method || 'contact',
    status: input.method || undefined,
  });

export const trackMetaStartTrial = (input = {}) =>
  track(
    'StartTrial',
    buildMetaCommerceParams({
      eventId: input.eventId || createMetaEventId('trial'),
      contentIds: input.contentIds,
      contentName: input.contentName,
      value: input.value ?? 0,
      currency: input.currency || 'INR',
    }),
  );

export const trackMetaFindLocation = (input = {}) =>
  track('FindLocation', {
    eventID: input.eventId || createMetaEventId('location'),
    content_name: input.contentName || input.locationName || 'location',
    content_ids: asIdList(input.contentIds),
  });

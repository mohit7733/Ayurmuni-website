import { apiClient } from './apiClient';
import { getBannerImageUri, isBannerActive } from '../home/catalog';

const SCREEN_SERVICE_CODES = {
  home: [],
  product: ['PRODU', 'PROD', 'PRODUCT', 'PRODUCTS', 'STORE', 'SHOP'],
  consult: ['CONS', 'CONSULT', 'DOCT', 'DOCTOR', 'TELE'],
  medicine: ['MEDI', 'MEDIC', 'MEDICINE', 'PHAR', 'AYUR'],
};

const SCREEN_ALIASES = {
  home: ['home', 'home_page', 'homepage', 'home-page'],
  product: ['product', 'products', 'product_page', 'store', 'shop'],
  consult: ['consult', 'consultation', 'doctor', 'consult_page', 'doctors'],
  medicine: ['medicine', 'medicines', 'pharmacy', 'medicine_page'],
};

const SCREEN_CATEGORY_NAMES = {
  consult: ['consult', 'consultation', 'doctor', 'doctors'],
  product: ['product', 'products', 'store', 'shop'],
  medicine: ['medicine', 'medicines', 'pharmacy', 'pharma'],
};

const toList = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.banners)) return payload.banners;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  if (Array.isArray(payload?.data?.banners)) return payload.data.banners;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  const numericKeys = Object.keys(payload)
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b));
  if (numericKeys.length) {
    return numericKeys.map((key) => payload[key]).filter(Boolean);
  }
  return [];
};

const fetchActiveBannerRecords = async (attempt = 0) => {
  const response = await apiClient('customers/banners/', { method: 'GET' });
  if (response?.success === false) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
      return fetchActiveBannerRecords(attempt + 1);
    }
    return [];
  }
  const list = toList(response?.data ?? response).filter(isBannerActive);
  if (!list.length && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return fetchActiveBannerRecords(attempt + 1);
  }
  return list;
};

const bannerCategoryId = (item) =>
  String(
    item?.service_category_id ??
      item?.service_category?.id ??
      item?.service_category?.service_category_id ??
      item?.category_id ??
      (typeof item?.service_category === 'string' || typeof item?.service_category === 'number'
        ? item.service_category
        : '') ??
      '',
  ).trim();

const bannerServiceCode = (item) =>
  String(
    item?.service_category_code ??
      item?.service_category?.service_category_code ??
      item?.service_category?.code ??
      item?.category?.code ??
      '',
  )
    .trim()
    .toUpperCase();

const bannerScreenKey = (item) =>
  String(
    item?.screen ??
      item?.page ??
      item?.placement ??
      item?.banner_for ??
      item?.banner_type ??
      item?.type ??
      item?.target_screen ??
      '',
  ).toLowerCase();

const matchesServiceCodes = (item, codes) => {
  const code = bannerServiceCode(item);
  if (!code) return false;
  return codes.some((c) => code === c || code.startsWith(c) || code.includes(c));
};

const matchesCategoryName = (item, names) => {
  const name = String(
    item?.service_category?.name ??
      item?.service_category?.category_name ??
      item?.service_category_name ??
      '',
  )
    .trim()
    .toLowerCase();
  if (!name) return false;
  return names.some((alias) => name.includes(alias));
};

const matchesScreenAliases = (item, aliases) => {
  const key = bannerScreenKey(item);
  if (!key) return false;
  return aliases.some((alias) => key.includes(alias));
};

export const filterBannersForScreen = (banners, screen, serviceCategoryId) => {
  const list = (Array.isArray(banners) ? banners : []).filter(isBannerActive);
  if (!list.length) return [];
  if (screen === 'home') return list;

  const codes = SCREEN_SERVICE_CODES[screen] || [];
  const aliases = SCREEN_ALIASES[screen] || [];
  const categoryNames = SCREEN_CATEGORY_NAMES[screen] || [];

  const pick = (...groups) => {
    for (const group of groups) {
      const matches = list.filter(group);
      if (matches.length) return matches;
    }
    return [];
  };

  if (serviceCategoryId != null && String(serviceCategoryId).trim() !== '') {
    const id = String(serviceCategoryId).trim();
    const byId = pick((item) => bannerCategoryId(item) === id);
    if (byId.length) return byId;
  }

  if (codes.length) {
    const byCode = pick((item) => matchesServiceCodes(item, codes));
    if (byCode.length) return byCode;
  }

  if (categoryNames.length) {
    const byName = pick((item) => matchesCategoryName(item, categoryNames));
    if (byName.length) return byName;
  }

  if (aliases.length) {
    const byScreen = pick((item) => matchesScreenAliases(item, aliases));
    if (byScreen.length) return byScreen;
  }

  // Service pages: show active banners rather than an empty carousel when CMS tags differ.
  return list;
};

export const mapBannerCarouselItems = (banners) =>
  (Array.isArray(banners) ? banners : [])
    .map((item) => ({ ...item, image: getBannerImageUri(item) }))
    .filter((item) => item.image);

const carouselFromRecords = (records, screen, serviceCategoryId) => {
  if (!records.length) return [];
  const mapped = (scr, categoryId) =>
    mapBannerCarouselItems(filterBannersForScreen(records, scr, categoryId));
  const primary = mapped(screen, serviceCategoryId);
  if (primary.length) return primary;
  if (screen !== 'home') {
    const home = mapped('home');
    if (home.length) return home;
  }
  return mapBannerCarouselItems(records);
};

/** Carousel-ready banners for a service page (consult, medicines, …) with home fallback. */
export const loadBannerCarouselForScreen = async (screen = 'home', serviceCategoryId) => {
  try {
    let records = await fetchActiveBannerRecords();
    if (!records.length) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      records = await fetchActiveBannerRecords();
    }
    return carouselFromRecords(records, screen, serviceCategoryId);
  } catch {
    return [];
  }
};

export const getBanners = async (screen = 'home', serviceCategoryId) => {
  try {
    const records = await fetchActiveBannerRecords();
    const filtered = screen
      ? filterBannersForScreen(records, screen, serviceCategoryId)
      : records;
    const images = filtered.map(getBannerImageUri).filter(Boolean);
    return { success: true, data: filtered, images };
  } catch {
    return { success: false, data: [], images: [] };
  }
};

/**
 * Port of the app's normalizeHeroEventToBanners (BannerService.tsx): a live hero event
 * { id, title, scope, media: [{ media_url, media_type, redirect_link }], starts_at, ends_at }
 * becomes one carousel slide per image media.
 */
export const normalizeHeroEventToBanners = (event) => {
  if (event == null || event === false) return [];
  if (Array.isArray(event)) return event.filter(Boolean);
  const mediaList = Array.isArray(event?.media) ? event.media : [];
  if (mediaList.length > 0) {
    return mediaList
      .map((media, index) => {
        if (!media || typeof media !== 'object') return null;
        const mediaUrl = String(media.media_url || '').trim();
        if (!mediaUrl) return null;
        const mediaType = String(media.media_type || 'image').toLowerCase();
        if (mediaType && mediaType !== 'image') return null;
        const redirect = String(media.redirect_link || media.redirect_url || '').trim() || null;
        return {
          id: `${event.id || 'hero'}-${index}`,
          event_id: event.id,
          title: event.title,
          scope: event.scope,
          event_tags: event.event_tags,
          starts_at: event.starts_at,
          ends_at: event.ends_at,
          media_url: mediaUrl,
          image_url: mediaUrl,
          media_type: media.media_type || 'image',
          redirect_link: redirect,
          redirect_url: redirect,
          is_active: true,
        };
      })
      .filter(Boolean);
  }
  const nested = toList(event);
  if (nested.length > 0) return nested;
  if (getBannerImageUri(event)) {
    const redirect = String(event.redirect_link || event.redirect_url || '').trim() || null;
    return [{ ...event, media_url: getBannerImageUri(event), redirect_link: redirect, redirect_url: redirect, is_active: true }];
  }
  return [];
};

/**
 * Customer — current live hero (app getHeroBannerEvent).
 * GET banners/events/?mode=production&scope=hero; data: null means no live event.
 */
export const getHeroBannerEvent = async () => {
  try {
    const response = await apiClient('banners/events/?mode=production&scope=hero', { method: 'GET' }, true);
    if (response?.success === false) return { success: false, data: [], images: [] };
    const event =
      response?.data === null ? null : response?.data !== undefined ? response.data : response?.event ?? null;
    if (event == null || event === false) return { success: true, data: [], images: [] };
    const banners = normalizeHeroEventToBanners(event).filter(isBannerActive);
    return { success: true, data: banners, images: banners.map(getBannerImageUri).filter(Boolean), event };
  } catch {
    return { success: false, data: [], images: [] };
  }
};

/**
 * Homepage hero: the app's home screen uses the live hero event. When there is no live
 * event (or the call fails) the web keeps its previous customers/banners home set.
 */
export const getHomeHeroBanners = async () => {
  const hero = await getHeroBannerEvent();
  if (hero.success && hero.data.length > 0) return hero;
  return getBanners('home');
};

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

const toList = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.banners)) return payload.banners;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  if (Array.isArray(payload?.data?.banners)) return payload.data.banners;
  const numericKeys = Object.keys(payload)
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b));
  if (numericKeys.length) {
    return numericKeys.map((key) => payload[key]).filter(Boolean);
  }
  return [];
};

export const filterBannersForScreen = (banners, screen, serviceCategoryId) => {
  const list = (Array.isArray(banners) ? banners : []).filter(isBannerActive);
  if (!list.length) return [];

  if (serviceCategoryId != null && String(serviceCategoryId).trim() !== '') {
    const id = String(serviceCategoryId).trim();
    const byId = list.filter(
      (item) => String(item?.service_category_id ?? '').trim() === id,
    );
    if (byId.length) return byId;
  }

  const codes = SCREEN_SERVICE_CODES[screen] || [];
  if (codes.length) {
    const byCode = list.filter((item) => {
      const code = String(item?.service_category_code ?? '')
        .trim()
        .toUpperCase();
      if (!code) return false;
      return codes.some((c) => code === c || code.startsWith(c) || code.includes(c));
    });
    if (byCode.length) return byCode;
  }

  if (screen === 'home') return list;

  const aliases = SCREEN_ALIASES[screen] || [];
  return list.filter((item) => {
    const key = String(
      item?.screen ||
        item?.page ||
        item?.placement ||
        item?.banner_for ||
        item?.banner_type ||
        item?.type ||
        '',
    ).toLowerCase();
    if (!key) return false;
    return aliases.some((alias) => key.includes(alias));
  });
};

export const getBanners = async (screen = 'home', serviceCategoryId) => {
  try {
    const response = await apiClient('customers/banners/', { method: 'GET' });
    if (response?.success === false) {
      return { success: false, data: [], images: [] };
    }
    const raw = toList(response?.data ?? response);
    const filtered = screen
      ? filterBannersForScreen(raw, screen, serviceCategoryId)
      : raw.filter(isBannerActive);
    const images = filtered.map(getBannerImageUri).filter(Boolean);
    return { success: true, data: filtered, images };
  } catch {
    return { success: false, data: [], images: [] };
  }
};

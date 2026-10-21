import { useCallback, useEffect, useMemo, useState } from 'react';
import * as HomeServices from '../services/homeService';
import * as ProductServices from '../services/productService';
import * as ProfileServices from '../services/profileService';
import { getBanners } from '../services/bannerService';
import { isAuthenticated, isGuestUser } from '../services/guestAuth';
import {
  mapCatalogProductItem,
  mapDietPlanForHome,
  mapProductCategory,
  normalizeApiList,
  normalizeYogaSessionList,
} from '../home/catalog';
import {
  FALLBACK_SERVICE_CATEGORIES,
  getServiceCategoryId,
  mapServiceCategory,
  normalizeServiceCategories,
} from '../home/serviceCategories';

const SECTION_LABELS = {
  featured: 'Featured Products',
  trending: 'Trending Now',
  recently_viewed: 'Recently Viewed',
};

const flights = new Map();
const once = (key, fn) => {
  if (!flights.has(key)) {
    flights.set(
      key,
      Promise.resolve()
        .then(fn)
        .finally(() => flights.delete(key)),
    );
  }
  return flights.get(key);
};

const safe = async (fn, fallback) => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

const loadSuggestedCatalog = async (kind) => {
  const res =
    kind === 'medicines'
      ? await HomeServices.getSuggestedMedicines()
      : await HomeServices.getSuggestedProducts();
  if (!res || res.success === false) return [];
  return normalizeApiList(res).map(mapCatalogProductItem).filter(Boolean);
};

// Recently viewed is per-user: only the discovery endpoint supports it
// (GET customers/products/discovery/?section=recently_viewed, auth required).
// The generic products list (customers/products/) is not a per-user history.
const loadRecentlyViewed = async () => {
  if (!(await isAuthenticated()) || (await isGuestUser())) return [];
  const res = await ProductServices.getProductDiscovery({
    section: 'recently_viewed',
    page: 1,
    page_size: 12,
  });
  if (!res || res.success === false) return [];
  return normalizeApiList(res).map(mapCatalogProductItem).filter(Boolean);
};

const loadSectionProducts = async (section) => {
  const res = await ProductServices.getProducts({ section, page_size: 12 });
  if (!res || res.success === false) return [];
  return normalizeApiList(res).map(mapCatalogProductItem).filter(Boolean);
};

export default function useHomeData() {
  const [categories, setCategories] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [storeProducts, setStoreProducts] = useState([]);
  const [medicineProducts, setMedicineProducts] = useState([]);
  const [yogaSessions, setYogaSessions] = useState([]);
  const [dietProducts, setDietProducts] = useState([]);
  const [customerData, setCustomerData] = useState(null);
  const [banners, setBanners] = useState([]);
  const [healthConcerns, setHealthConcerns] = useState([]);
  const [sections, setSections] = useState({
    featured: [],
    trending: [],
    recently_viewed: [],
  });
  const [loading, setLoading] = useState(true);
  // Second wave (yoga, diet, product sections, concerns) loads after the first.
  const [loadingMore, setLoadingMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(true);

  const medicineCategoryId = useMemo(
    () => getServiceCategoryId(categories, 'medicine'),
    [categories],
  );

  const fetchCustomerData = useCallback(async () => {
    if (!(await isAuthenticated()) || (await isGuestUser())) {
      setCustomerData(null);
      setLoadingCustomer(false);
      return null;
    }
    setLoadingCustomer(true);
    try {
      const res = await ProfileServices.user_profile();
      if (!res || res.success === false) {
        setCustomerData(null);
        return null;
      }
      const data =
        res.data && typeof res.data === 'object' && !Array.isArray(res.data)
          ? res.data
          : res;
      const profile =
        data &&
        (data.first_name ||
          data.id ||
          data.customer_id ||
          data.prakriti_progress != null)
          ? data
          : null;
      setCustomerData(profile);
      return profile;
    } catch {
      setCustomerData(null);
      return null;
    } finally {
      setLoadingCustomer(false);
    }
  }, []);

  const loadAll = useCallback(async (isRefresh = false, isCancelled = () => false) => {
    if (isRefresh) setRefreshing(true);
    else {
      setLoading(true);
      setLoadingMore(true);
    }

    const load = (key, fn) => (isRefresh ? fn() : once(key, fn));
    const asBanners = (bannerRes) =>
      Array.isArray(bannerRes?.data)
        ? bannerRes.data
        : Array.isArray(bannerRes)
          ? bannerRes
          : [];

    const catsPromise = load('cats', async () => {
      const res = await HomeServices.getHomeCategory();
      const list = normalizeServiceCategories(res?.data ?? res)
        .map(mapServiceCategory)
        .filter((item) => item.id)
        .sort((a, b) => a.sequence - b.sequence);
      return list.length ? list : FALLBACK_SERVICE_CATEGORIES;
    });
    const doctorsPromise = load('doctors', async () => {
      const res = await HomeServices.getSuggestedDoctor();
      return normalizeApiList(res).filter(
        (item) =>
          item &&
          (item.id || item.doctor_id) &&
          String(item.full_name || item.name || item.doctor_name || '').trim(),
      );
    });
    const medicinesPromise = load('medicines', () => loadSuggestedCatalog('medicines'));
    const productsPromise = load('products', () => loadSuggestedCatalog('products'));
    const bannersPromise = load('banners', () => getBanners('home'));

    const apply = (promise, setter) =>
      promise.then((value) => {
        if (!isCancelled()) setter(value);
      });

    catsPromise.then((next) => {
      if (!isCancelled() && next) setCategories(next);
    });

    let cats = FALLBACK_SERVICE_CATEGORIES;
    try {
      const [nextCategories] = await Promise.all([
        safe(() => catsPromise, FALLBACK_SERVICE_CATEGORIES),
        apply(safe(() => doctorsPromise, []), setDoctors),
        apply(safe(() => medicinesPromise, []), setMedicineProducts),
        apply(safe(() => productsPromise, []), setStoreProducts),
        apply(safe(() => bannersPromise, { data: [] }), (bannerRes) =>
          setBanners(asBanners(bannerRes)),
        ),
      ]);
      cats = nextCategories || FALLBACK_SERVICE_CATEGORIES;
    } finally {
      if (!isCancelled()) {
        if (cats) setCategories(cats);
        setLoading(false);
      }
    }

    if (isCancelled()) return;

    const medicineId = getServiceCategoryId(cats, 'medicine');
    await Promise.all([
      apply(
        safe(
          () =>
            load('yoga', async () => {
              const res = await HomeServices.getYogaSession();
              return normalizeYogaSessionList(res);
            }),
          [],
        ),
        setYogaSessions,
      ),
      apply(
        safe(
          () =>
            load('diet', async () => {
              const res = await HomeServices.getSuggestedDietPlans();
              if (res?.success === false) return [];
              return normalizeApiList(res)
                .map(mapDietPlanForHome)
                .filter((item) => item.id);
            }),
          [],
        ),
        setDietProducts,
      ),
      apply(safe(() => load('featured', () => loadSectionProducts('featured')), []), (featured) =>
        setSections((prev) => ({ ...prev, featured })),
      ),
      apply(safe(() => load('trending', () => loadSectionProducts('trending')), []), (trending) =>
        setSections((prev) => ({ ...prev, trending })),
      ),
      apply(
        safe(() => load('recent', loadRecentlyViewed), []),
        (recentlyViewed) =>
          setSections((prev) => ({ ...prev, recently_viewed: recentlyViewed })),
      ),
      apply(
        safe(
          () =>
            load('concerns', async () => {
              const res = await ProductServices.getHealthCategories(
                medicineId ? { service_category_id: medicineId } : undefined,
              );
              if (res?.success === false) return [];
              return normalizeApiList(res)
                .map(mapProductCategory)
                .filter((item) => item.id);
            }),
          [],
        ),
        setHealthConcerns,
      ),
      fetchCustomerData(),
    ]);
    if (!isCancelled()) {
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [fetchCustomerData]);

  useEffect(() => {
    let cancelled = false;
    loadAll(false, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  return {
    categories,
    doctors,
    storeProducts,
    medicineProducts,
    yogaSessions,
    dietProducts,
    customerData,
    banners,
    healthConcerns,
    sections,
    sectionLabels: SECTION_LABELS,
    loading,
    loadingMore,
    refreshing,
    loadingCustomer,
    medicineCategoryId,
    refreshHomeData: () => loadAll(true),
    fetchCustomerData,
  };
}

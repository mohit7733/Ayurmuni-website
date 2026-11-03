import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as HomeServices from '../services/homeService';
import * as ProductServices from '../services/productService';
import * as ProfileServices from '../services/profileService';
import { getHomeHeroBanners } from '../services/bannerService';
import { clearApiCache } from '../services/apiClient';
import { isAuthenticated, isGuestUser } from '../services/guestAuth';
import { normalizeDietPlanList } from '../diet/utils';
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
    const pending = Promise.resolve()
      .then(fn)
      .finally(() => {
        if (flights.get(key) === pending) flights.delete(key);
      });
    flights.set(key, pending);
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

// ---- Port of app store/slices/homeSlice.ts loaders (disease-driven rails) ----
const parseHomeProducts = (res) => {
  if (!res || res.success === false) return [];
  return normalizeApiList(res).map(mapCatalogProductItem).filter(Boolean);
};

/** app resolveHealthDiseaseIds */
export const resolveHealthDiseaseIds = (customer) => {
  if (!customer || typeof customer !== 'object') return [];
  const fromIds = Array.isArray(customer.health_disease_ids) ? customer.health_disease_ids : [];
  const fromObjects = Array.isArray(customer.health_diseases) ? customer.health_diseases : [];
  const ids = [
    ...fromIds.map((id) => String(id ?? '').trim()),
    ...fromObjects.map((item) => String(item?.id ?? item?.health_disease_id ?? '').trim()),
  ].filter(Boolean);
  return Array.from(new Set(ids));
};

/** First disease id only: these APIs accept a single health_disease_id (comma lists return 400). */
const firstDiseaseId = (diseaseIds) => (Array.isArray(diseaseIds) && diseaseIds.length ? diseaseIds[0] : null);

const HOME_PRODUCTS_LIMIT = 12;

/** Identical customers/products/ queries in flight (medicines + products rails) share one request. */
const fetchHomeProducts = (params) => {
  const key = `home-products:${params.service_category_id || ''}:${params.health_disease_id || ''}`;
  return once(key, async () =>
    parseHomeProducts(
      await HomeServices.getHomeProducts({ ...params, page: 1, page_size: HOME_PRODUCTS_LIMIT }),
    ),
  );
};

/** Lean fallback: per category at most 2 product calls. One request with the primary
 *  (first) health concern; only if that is empty, one request with the category alone.
 *  Without a category, the same two steps run unfiltered. Disease ids are never comma-joined. */
const loadCatalogFallback = async (kind, categories, diseaseIds) => {
  const serviceCategoryId = getServiceCategoryId(categories, kind === 'medicines' ? 'medicine' : 'products');
  const primaryId = firstDiseaseId(diseaseIds);
  const attempts = [];
  if (primaryId) attempts.push({ service_category_id: serviceCategoryId, health_disease_id: primaryId });
  attempts.push(serviceCategoryId ? { service_category_id: serviceCategoryId } : {});
  for (const attempt of attempts) {
    try {
      const list = await fetchHomeProducts(attempt);
      if (list.length > 0) return list;
    } catch {
      // try next attempt
    }
  }
  return [];
};
/** app loadSuggestedCatalog: disease -> suggested API (+first id); none -> unfiltered browse. */
const loadSuggestedCatalog = async (kind, categories, diseaseIds) => {
  const firstId = firstDiseaseId(diseaseIds);
  try {
    if (!firstId) return await loadCatalogFallback(kind, categories, null);
    const opts = { health_disease_id: firstId };
    const suggested = parseHomeProducts(
      kind === 'medicines'
        ? await HomeServices.getSuggestedMedicines(opts)
        : await HomeServices.getSuggestedProducts(opts),
    );
    if (suggested.length > 0) return suggested;
    return await loadCatalogFallback(kind, categories, diseaseIds);
  } catch {
    return safe(() => loadCatalogFallback(kind, categories, diseaseIds), []);
  }
};
const parseDoctorList = (res) =>
  normalizeApiList(res).filter(
    (item) =>
      item &&
      (item.id || item.doctor_id) &&
      String(item.full_name || item.name || item.doctor_name || '').trim(),
  );

/** app loadHomeDoctors */
const loadHomeDoctors = async (healthDiseaseId) => {
  if (healthDiseaseId) {
    const suggested = parseDoctorList(
      await HomeServices.getSuggestedDoctor({ health_disease_id: healthDiseaseId }),
    );
    if (suggested.length > 0) return suggested;
    return parseDoctorList(await HomeServices.getDoctorsBrowse({ health_disease_id: healthDiseaseId }));
  }
  return parseDoctorList(await HomeServices.getDoctorsBrowse());
};

/** app loadDietPlansForHome */
const loadDietPlansForHome = async (healthDiseaseId) => {
  const toCards = (r) => normalizeDietPlanList(r).map(mapDietPlanForHome).filter((item) => item.id);
  try {
    const res = healthDiseaseId
      ? await HomeServices.getSuggestedDietPlans({ health_disease_id: healthDiseaseId })
      : await HomeServices.getDietPlansBrowse();
    if (res?.success === false) {
      if (healthDiseaseId) {
        return toCards(await HomeServices.getDietPlansBrowse({ health_disease_id: healthDiseaseId }));
      }
      return [];
    }
    return toCards(res);
  } catch {
    return [];
  }
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

const LAZY_SECTIONS = ['banners', 'concerns', 'doctors', 'products', 'yoga', 'diet'];

const createDeferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

/**
 * Home data, loaded top to bottom:
 *  1. critical: profile + service categories (hero, services row)
 *  2. the rest via loadSection(key), called by Home's ordered section queue
 *     (concerns, doctors, products, wellness). Each section loads once.
 */
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
  const [bannersLoading, setBannersLoading] = useState(true);
  const [sectionStatus, setSectionStatus] = useState(() =>
    Object.fromEntries(LAZY_SECTIONS.map((key) => [key, 'idle'])),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  // Shared context (categories + disease ids) that lazy sections wait for.
  const ctxRef = useRef(createDeferred());
  const requestedRef = useRef(new Set());
  const aliveRef = useRef(true);

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

  const runSection = useCallback(async (key, isRefresh = false) => {
    const load = (k, fn) => (isRefresh ? fn() : once(k, fn));
    const apply = (promise, setter) =>
      promise.then((value) => {
        if (aliveRef.current) setter(value);
      });
    setSectionStatus((prev) => (prev[key] === 'done' && isRefresh ? prev : { ...prev, [key]: 'loading' }));
    const { cats, diseasePromise } = await ctxRef.current.promise;
    const diseaseId = async () => firstDiseaseId(await diseasePromise);
    const jobs = [];
    if (key === 'banners') {
      const bannerRes = await safe(() => load('banners', () => getHomeHeroBanners()), { data: [] });
      if (aliveRef.current) {
        setBanners(
          Array.isArray(bannerRes?.data) ? bannerRes.data : Array.isArray(bannerRes) ? bannerRes : [],
        );
        setBannersLoading(false);
      }
    } else if (key === 'concerns') {
      const medicineId = getServiceCategoryId(cats, 'medicine');
      jobs.push(
        apply(
          safe(
            () =>
              load('concerns', async () => {
                const res = await ProductServices.getHealthCategories(
                  medicineId ? { service_category_id: medicineId } : undefined,
                );
                if (res?.success === false) return [];
                return normalizeApiList(res).map(mapProductCategory).filter((item) => item.id);
              }),
            [],
          ),
          setHealthConcerns,
        ),
      );
    } else if (key === 'doctors') {
      jobs.push(
        apply(safe(() => load('doctors', async () => loadHomeDoctors(await diseaseId())), []), setDoctors),
      );
    } else if (key === 'products') {
      // Visual order inside the product grid: medicines, products, recently viewed, trending, featured.
      jobs.push(
        apply(
          safe(() => load('medicines', async () => loadSuggestedCatalog('medicines', cats, await diseasePromise)), []),
          setMedicineProducts,
        ),
        apply(
          safe(() => load('products', async () => loadSuggestedCatalog('products', cats, await diseasePromise)), []),
          setStoreProducts,
        ),
        apply(safe(() => load('recent', loadRecentlyViewed), []), (recentlyViewed) =>
          setSections((prev) => ({ ...prev, recently_viewed: recentlyViewed })),
        ),
        apply(safe(() => load('trending', () => loadSectionProducts('trending')), []), (trending) =>
          setSections((prev) => ({ ...prev, trending })),
        ),
        apply(safe(() => load('featured', () => loadSectionProducts('featured')), []), (featured) =>
          setSections((prev) => ({ ...prev, featured })),
        ),
      );
    } else if (key === 'yoga') {
      jobs.push(
        apply(
          safe(
            () =>
              load('yoga', async () => {
                const id = await diseaseId();
                const res = await HomeServices.getYogaSession(id ? { health_disease_id: id } : undefined);
                return normalizeYogaSessionList(res);
              }),
            [],
          ),
          setYogaSessions,
        ),
      );
    } else if (key === 'diet') {
      jobs.push(
        apply(
          safe(
            () =>
              load('diet', async () => {
                // Diet endpoints need a token: skip logged-out visitors only.
                if (!(await isAuthenticated())) return [];
                return loadDietPlansForHome(await diseaseId());
              }),
            [],
          ),
          setDietProducts,
        ),
      );
    }
    await Promise.all(jobs);
    if (aliveRef.current) setSectionStatus((prev) => ({ ...prev, [key]: 'done' }));
  }, []);

  /** Called by Home when a below-the-fold section nears the viewport. Loads once. */
  const loadSection = useCallback(
    (key) => {
      if (!LAZY_SECTIONS.includes(key) || requestedRef.current.has(key)) return;
      requestedRef.current.add(key);
      runSection(key);
    },
    [runSection],
  );

  const loadAll = useCallback(async (isRefresh = false, isCancelled = () => false) => {
    if (isRefresh) {
      // User-triggered refresh: drop the shared GET cache and any in-flight work.
      clearApiCache();
      flights.clear();
      setRefreshing(true);
    } else {
      setLoading(true);
      setBannersLoading(true);
    }

    const load = (key, fn) => (isRefresh ? fn() : once(key, fn));

    // 1. Critical: profile (hero) + service categories (services row).
    const catsPromise = load('cats', async () => {
      const res = await HomeServices.getHomeCategory();
      const list = normalizeServiceCategories(res?.data ?? res)
        .map(mapServiceCategory)
        .filter((item) => item.id)
        .sort((a, b) => a.sequence - b.sequence);
      return list.length ? list : FALLBACK_SERVICE_CATEGORIES;
    });
    const customerPromise = fetchCustomerData();
    const diseasePromise = customerPromise.then(async (customer) => {
      let source = customer;
      // App fetches the profile for guest tokens too; only a logged-out visitor has none.
      if (!source && (await isAuthenticated())) {
        const res = await safe(() => ProfileServices.user_profile(), null);
        source = res && res.success !== false ? res.data ?? null : null;
      }
      const ids = resolveHealthDiseaseIds(source);
      return ids.length > 0 ? ids : null;
    });

    let cats = FALLBACK_SERVICE_CATEGORIES;
    try {
      const [nextCategories] = await Promise.all([
        safe(() => catsPromise, FALLBACK_SERVICE_CATEGORIES),
        customerPromise,
      ]);
      cats = nextCategories || FALLBACK_SERVICE_CATEGORIES;
    } finally {
      if (!isCancelled()) {
        setCategories(cats);
        setLoading(false);
      }
    }

    if (isRefresh) ctxRef.current = createDeferred();
    ctxRef.current.resolve({ cats, diseasePromise });
    if (isCancelled()) return;

    // 2. Refresh: reload sections the user has already reached.
    if (isRefresh) {
      await Promise.all(Array.from(requestedRef.current).map((key) => runSection(key, true)));
      if (!isCancelled()) setRefreshing(false);
    }
  }, [fetchCustomerData, runSection]);

  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;
    loadAll(false, () => cancelled);
    return () => {
      cancelled = true;
      aliveRef.current = false;
    };
  }, [loadAll]);

  const isSectionDone = useCallback((key) => sectionStatus[key] === 'done', [sectionStatus]);
  const allSectionsDone = LAZY_SECTIONS.every((key) => sectionStatus[key] === 'done');

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
    bannersLoading,
    loadingMore: !allSectionsDone,
    allSectionsDone,
    isSectionDone,
    loadSection,
    refreshing,
    loadingCustomer,
    medicineCategoryId,
    refreshHomeData: () => loadAll(true),
    fetchCustomerData,
  };
}
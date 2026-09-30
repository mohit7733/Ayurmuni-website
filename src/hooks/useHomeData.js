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
import { getServiceCategoryId, normalizeServiceCategories } from '../home/serviceCategories';

const SECTION_LABELS = {
  featured: 'Featured Products',
  trending: 'Trending Now',
  recently_viewed: 'Recently Viewed',
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

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const cats = await safe(async () => {
      const res = await HomeServices.getHomeCategory();
      return normalizeServiceCategories(res?.data ?? res)
        .map((item) => ({
          ...item,
          id: String(item?.id ?? item?.service_category_id ?? ''),
          name: String(item?.name ?? item?.category_name ?? item?.title ?? ''),
          image_url: item?.image_url || item?.image || item?.icon_url || '',
        }))
        .filter((item) => item.id);
    }, []);
    setCategories(cats);
    const medicineId = getServiceCategoryId(cats, 'medicine');

    const [
      doctorList,
      medicines,
      products,
      yoga,
      diet,
      bannerRes,
      featured,
      trending,
      recentlyViewed,
      concernsRes,
    ] = await Promise.all([
      safe(async () => {
        const res = await HomeServices.getSuggestedDoctor();
        return normalizeApiList(res).filter(
          (item) =>
            item &&
            (item.id || item.doctor_id) &&
            String(item.full_name || item.name || item.doctor_name || '').trim(),
        );
      }, []),
      safe(() => loadSuggestedCatalog('medicines'), []),
      safe(() => loadSuggestedCatalog('products'), []),
      safe(async () => {
        const res = await HomeServices.getYogaSession();
        return normalizeYogaSessionList(res);
      }, []),
      safe(async () => {
        const res = await HomeServices.getSuggestedDietPlans();
        if (res?.success === false) return [];
        return normalizeApiList(res)
          .map(mapDietPlanForHome)
          .filter((item) => item.id);
      }, []),
      safe(() => getBanners('home'), { data: [] }),
      safe(() => loadSectionProducts('featured'), []),
      safe(() => loadSectionProducts('trending'), []),
      safe(() => loadSectionProducts('recently_viewed'), []),
      safe(async () => {
        const res = await ProductServices.getHealthCategories(
          medicineId ? { service_category_id: medicineId } : undefined,
        );
        if (res?.success === false) return [];
        return normalizeApiList(res)
          .map(mapProductCategory)
          .filter((item) => item.id);
      }, []),
    ]);

    setDoctors(doctorList);
    setMedicineProducts(medicines);
    setStoreProducts(products);
    setYogaSessions(yoga);
    setDietProducts(diet);
    setBanners(Array.isArray(bannerRes?.data) ? bannerRes.data : []);
    setSections({
      featured,
      trending,
      recently_viewed: recentlyViewed,
    });
    setHealthConcerns(concernsRes);
    await fetchCustomerData();
    setLoading(false);
    setRefreshing(false);
  }, [fetchCustomerData]);

  useEffect(() => {
    loadAll(false);
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
    refreshing,
    loadingCustomer,
    medicineCategoryId,
    refreshHomeData: () => loadAll(true),
    fetchCustomerData,
  };
}

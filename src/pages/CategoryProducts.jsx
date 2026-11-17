import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import FilterPriceControls from '../components/FilterPriceControls';
import FilterRatingChoices from '../components/FilterRatingChoices';
import AppShell from '../components/AppShell';
import ProductCard from '../components/ProductCard';
import useProductCategories from '../hooks/useProductCategories';
import useCategoryProducts from '../hooks/useCategoryProducts';
import useDashboardCategories from '../hooks/useDashboardCategories';
import { mapProductCategory, normalizeApiList, resolveImageUrl } from '../home/catalog';
import { getServiceCategoryId, resolveServiceCategoryKey } from '../home/serviceCategories';
import { getHealthCategories } from '../services/productService';
import { isPrescriptionRequired, isProductOutOfStock } from '../product/stock';
import {
  Button,
  EmptyState,
  Modal,
  PageBar,
  SearchField,
  searchSuggestions,
  SkeletonGrid,
} from '../components/ui';
import useBrands from '../hooks/useBrands';
import {
  applyProductFilters,
  brandOptionsFromProducts,
  DOSHA_OPTIONS,
  toProductApiSort,
} from '../utils/productSearchUtils';
import { orderListedProducts } from '../products/listingOrder';
import { STORE_COPY as T } from '../content/store';
import '../design/pages/store.css';
import '../design/pages/products.css';
import '../design/brand.css';
import '../design/product-card-home.css';
import '../design/pages/category-products.css';

const normalizeBrand = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const itemServiceId = (item) =>
  String(
    item?.service_category_id ??
      item?.service_category?.id ??
      item?.serviceCategoryId ??
      '',
  );

export default function CategoryProducts() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setSearchParams] = useSearchParams();
  const brandId = params.get('brand') || '';
  // Featured brands (View all and a brand tile) open mode=both: products and medicines together.
  const isBothMode = params.get('mode') === 'both';
  const isBrandMix = isBothMode || Boolean(brandId);
  const isMedicine = !isBrandMix && location.pathname.startsWith('/medicines');
  const shellTab = isMedicine ? 'medicines' : 'products';
  const detailBase = isMedicine ? '/medicines' : '/products';
  // On the mixed brands page, category vs concern lives in `facet` so `mode` stays `both`.
  const mode = isBothMode
    ? params.get('facet') === 'health'
      ? 'health'
      : 'product'
    : params.get('mode') === 'health'
      ? 'health'
      : 'product';
  // Brand browse is always mixed — ignore service so products + medicines both load.
  // The medicines route always uses the live Medicine service, even if the link carries a stale id.
  const urlService = params.get('service') || null;
  const initialCategory = params.get('category') || 'all';
  const title =
    params.get('name') ||
    (brandId ? 'Brand' : mode === 'health' ? 'Shop by concern' : 'Shop by category');

  const brandTitleKey = brandId ? normalizeBrand(params.get('name')) : '';
  const { categories: dashboardCategories, loading: dashboardLoading } =
    useDashboardCategories();
  const medicineCategoryId = useMemo(
    () => getServiceCategoryId(dashboardCategories, 'medicine'),
    [dashboardCategories],
  );
  const productsCategoryId = useMemo(
    () => getServiceCategoryId(dashboardCategories, 'products'),
    [dashboardCategories],
  );
  const serviceCategoryId = isBrandMix
    ? null
    : isMedicine
      ? medicineCategoryId || null
      : urlService;

  useEffect(() => {
    if (!isMedicine || !medicineCategoryId) return;
    if (params.get('service') === String(medicineCategoryId)) return;
    const next = new URLSearchParams(params);
    next.set('service', String(medicineCategoryId));
    setSearchParams(next, { replace: true });
  }, [isMedicine, medicineCategoryId, params, setSearchParams]);

  // Older brand links used mode=product. Keep them on the mixed catalog.
  useEffect(() => {
    if (params.get('mode') === 'both' || params.get('mode') === 'health') return;
    if (params.get('name') !== 'Brands') return;
    if (params.get('category') || params.get('service')) return;
    const next = new URLSearchParams(params);
    next.set('mode', 'both');
    setSearchParams(next, { replace: true });
  }, [params, setSearchParams]);

  const brandReady = isBrandMix && !dashboardLoading;
  const canSplitBrand =
    brandReady && Boolean(productsCategoryId) && Boolean(medicineCategoryId);

  const patchParams = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next);
  };

  const resolveCatalogKind = (item) => {
    if (item?.catalog_kind === 'medicine' || item?.catalog_kind === 'product') {
      return item.catalog_kind;
    }
    const sid = itemServiceId(item);
    if (medicineCategoryId && sid === String(medicineCategoryId)) return 'medicine';
    if (productsCategoryId && sid === String(productsCategoryId)) return 'product';
    const key = resolveServiceCategoryKey(
      item?.service_category || {
        id: sid,
        name: item?.service_category_name || item?.service_category?.name,
        service_category_code: item?.service_category_code,
      },
    );
    if (key === 'medicine') return 'medicine';
    if (key === 'products') return 'product';
    if (isPrescriptionRequired(item)) return 'medicine';
    return 'product';
  };

  const resolveDetailBase = (item) => {
    if (!isBrandMix) return detailBase;
    return resolveCatalogKind(item) === 'medicine' ? '/medicines' : '/products';
  };

  // '/' focuses the collection search (ignored while typing in a field).
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = String(event.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || event.target?.isContentEditable) return;
      const input = document.querySelector('.cp-hero__search input');
      if (!input) return;
      event.preventDefault();
      input.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategory);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(null);
  const activeCategoryId = selectedCategoryId === 'all' ? null : selectedCategoryId;
  const [healthCategories, setHealthCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [minRating, setMinRating] = useState(0);
  const [dosha, setDosha] = useState('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [brandIds, setBrandIds] = useState(brandId ? [brandId] : []);
  const [brandNames, setBrandNames] = useState([]);
  const [catalogKind, setCatalogKind] = useState('all');
  const [openFilterPanel, setOpenFilterPanel] = useState(() =>
    brandId ? 'brand' : mode === 'health' ? 'concern' : 'brand',
  );
  const { brands: brandRecords } = useBrands();

  const toggleFilterPanel = (panel) => {
    setOpenFilterPanel((prev) => (prev === panel ? null : panel));
  };

  // Page search filters this page in place (debounced while typing; Search/Enter applies now).
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const urlCategory = params.get('category') || 'all';
  // Keep local category selection aligned with the URL (brand / category / concern).
  useEffect(() => {
    setSelectedCategoryId(urlCategory);
    setSelectedSubcategoryId(null);
  }, [urlCategory, mode, brandId]);

  useEffect(() => {
    setBrandIds(brandId ? [brandId] : []);
    if (brandId) setBrandNames([]);
  }, [brandId]);

  const productCategoryServiceId = isBrandMix
    ? productsCategoryId
    : mode === 'product'
      ? serviceCategoryId
      : productsCategoryId;

  const categoryCatalog =
    isBrandMix && params.get('catalog') === 'medicine' ? 'medicine' : 'product';
  const { categories: topCategories } = useProductCategories(
    null,
    productCategoryServiceId || null,
  );
  const { categories: medicineCategories } = useProductCategories(
    null,
    medicineCategoryId || null,
    isBrandMix && Boolean(medicineCategoryId),
    false,
  );
  const subcategoryServiceId = isBrandMix
    ? categoryCatalog === 'medicine'
      ? medicineCategoryId
      : productsCategoryId
    : productCategoryServiceId;
  const { categories: subcategories } = useProductCategories(
    mode === 'product' ? activeCategoryId : null,
    subcategoryServiceId || null,
  );
  const visibleSubs = mode === 'product' && activeCategoryId ? subcategories : [];

  // Always load concerns so this page can filter medicines + products globally.
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await getHealthCategories(
        !isBrandMix && serviceCategoryId
          ? { service_category_id: serviceCategoryId }
          : undefined,
      );
      if (!alive) return;
      setHealthCategories(
        normalizeApiList(res)
          .map(mapProductCategory)
          .filter((item) => item.id),
      );
    })();
    return () => {
      alive = false;
    };
  }, [isBrandMix, serviceCategoryId]);

  const productFilter = useMemo(() => {
    if (brandId) {
      return { brand_name_id: brandId };
    }
    // `service` is the catalog (medicines vs products). Keep it on "All", not only after a category is picked.
    const serviceScope = serviceCategoryId ? { service_category_id: serviceCategoryId } : {};
    if (mode === 'health') {
      return {
        ...(activeCategoryId ? { health_category_id: activeCategoryId } : {}),
        ...(selectedSubcategoryId ? { health_disease_id: selectedSubcategoryId } : {}),
        ...serviceScope,
      };
    }
    return {
      ...(activeCategoryId ? { id: activeCategoryId } : {}),
      ...(selectedSubcategoryId ? { product_subcategory_id: selectedSubcategoryId } : {}),
      ...serviceScope,
    };
  }, [brandId, mode, activeCategoryId, selectedSubcategoryId, serviceCategoryId]);

  // Price / rating / dosha / sort are also sent to the API (same params as the app); the
  // client-side pass below keeps results exact for rows the API leaves unrated.
  const sharedExtras = useMemo(
    () => ({
      min_price: priceRange[0] > 0 ? priceRange[0] : null,
      max_price: priceRange[1] < 10000 ? priceRange[1] : null,
      min_rating: minRating > 0 ? minRating : null,
      dosha_type: dosha === 'all' ? null : dosha,
      sort: toProductApiSort(sortBy),
      search: query || null,
    }),
    [priceRange, minRating, dosha, sortBy, query],
  );

  const requestFilter = useMemo(
    () => ({
      ...productFilter,
      ...sharedExtras,
    }),
    [productFilter, sharedExtras],
  );

  const concernFacet = useMemo(() => {
    if (mode !== 'health' || !activeCategoryId) return {};
    return {
      health_category_id: activeCategoryId,
      ...(selectedSubcategoryId ? { health_disease_id: selectedSubcategoryId } : {}),
    };
  }, [mode, activeCategoryId, selectedSubcategoryId]);

  const productCategoryFacet = useMemo(() => {
    if (!activeCategoryId || mode === 'health') return {};
    if (isBrandMix && categoryCatalog === 'medicine') return {};
    return {
      id: activeCategoryId,
      ...(selectedSubcategoryId ? { product_subcategory_id: selectedSubcategoryId } : {}),
    };
  }, [activeCategoryId, selectedSubcategoryId, mode, isBrandMix, categoryCatalog]);

  const medicineCategoryFacet = useMemo(() => {
    if (!activeCategoryId || mode === 'health') return {};
    if (!(isBrandMix && categoryCatalog === 'medicine')) return {};
    return {
      id: activeCategoryId,
      ...(selectedSubcategoryId ? { product_subcategory_id: selectedSubcategoryId } : {}),
    };
  }, [activeCategoryId, selectedSubcategoryId, mode, isBrandMix, categoryCatalog]);

  const brandCategoryFacet = mode === 'health' ? concernFacet : productCategoryFacet;

  const brandProductFilter = useMemo(
    () => ({
      ...(brandId ? { brand_name_id: brandId } : {}),
      ...(productsCategoryId ? { service_category_id: productsCategoryId } : {}),
      ...(mode === 'health' ? concernFacet : productCategoryFacet),
      ...sharedExtras,
    }),
    [brandId, productsCategoryId, mode, concernFacet, productCategoryFacet, sharedExtras],
  );

  const brandMedicineFilter = useMemo(
    () => ({
      ...(brandId ? { brand_name_id: brandId } : {}),
      ...(medicineCategoryId ? { service_category_id: medicineCategoryId } : {}),
      ...(mode === 'health' ? concernFacet : medicineCategoryFacet),
      ...sharedExtras,
    }),
    [brandId, medicineCategoryId, mode, concernFacet, medicineCategoryFacet, sharedExtras],
  );

  const brandUnscopedFilter = useMemo(
    () => ({
      ...(brandId ? { brand_name_id: brandId } : {}),
      ...brandCategoryFacet,
      ...sharedExtras,
    }),
    [brandId, brandCategoryFacet, sharedExtras],
  );

  // A product category does not apply to medicines, and a medicine category does not apply to products.
  const productCategoryLocksMedicines =
    isBrandMix && mode === 'product' && categoryCatalog === 'product' && Boolean(activeCategoryId);
  const medicineCategoryLocksProducts =
    isBrandMix && mode === 'product' && categoryCatalog === 'medicine' && Boolean(activeCategoryId);

  const regularCatalog = useCategoryProducts(requestFilter, [], {
    enabled: !isBrandMix && (!isMedicine || Boolean(medicineCategoryId)),
  });
  const brandProductCatalog = useCategoryProducts(brandProductFilter, [], {
    enabled: canSplitBrand,
  });
  const brandMedicineCatalog = useCategoryProducts(brandMedicineFilter, [], {
    enabled: canSplitBrand,
  });
  const brandUnscopedCatalog = useCategoryProducts(brandUnscopedFilter, [], {
    enabled: brandReady && !canSplitBrand,
  });

  const products = useMemo(() => {
    if (!isBrandMix) return regularCatalog.products;
    if (!canSplitBrand) {
      return brandUnscopedCatalog.products
        .map((item) => ({
          ...item,
          catalog_kind: resolveCatalogKind(item),
        }))
        .filter((item) => {
          if (productCategoryLocksMedicines && item.catalog_kind === 'medicine') return false;
          if (medicineCategoryLocksProducts && item.catalog_kind === 'product') return false;
          return true;
        });
    }
    const seen = new Set();
    const merged = [];
    if (!medicineCategoryLocksProducts) {
      brandProductCatalog.products.forEach((item) => {
        const key = String(item.variant_id ?? item.id ?? '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push({ ...item, catalog_kind: 'product' });
      });
    }
    if (!productCategoryLocksMedicines) {
      brandMedicineCatalog.products.forEach((item) => {
        const key = String(item.variant_id ?? item.id ?? '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push({ ...item, catalog_kind: 'medicine' });
      });
    }
    return merged;
  }, [
    isBrandMix,
    canSplitBrand,
    productCategoryLocksMedicines,
    medicineCategoryLocksProducts,
    regularCatalog.products,
    brandUnscopedCatalog.products,
    brandProductCatalog.products,
    brandMedicineCatalog.products,
    medicineCategoryId,
    productsCategoryId,
  ]);

  const loading = isBrandMix
    ? dashboardLoading ||
      (canSplitBrand
        ? brandProductCatalog.loading || brandMedicineCatalog.loading
        : brandUnscopedCatalog.loading)
    : regularCatalog.loading;
  const loadingMore = isBrandMix
    ? canSplitBrand
      ? brandProductCatalog.loadingMore || brandMedicineCatalog.loadingMore
      : brandUnscopedCatalog.loadingMore
    : regularCatalog.loadingMore;
  const refreshing = isBrandMix
    ? canSplitBrand
      ? brandProductCatalog.refreshing || brandMedicineCatalog.refreshing
      : brandUnscopedCatalog.refreshing
    : regularCatalog.refreshing;
  const hasMore = isBrandMix
    ? canSplitBrand
      ? brandProductCatalog.hasMore || brandMedicineCatalog.hasMore
      : brandUnscopedCatalog.hasMore
    : regularCatalog.hasMore;

  const loadMore = () => {
    if (!isBrandMix) {
      regularCatalog.loadMore();
      return;
    }
    if (canSplitBrand) {
      if (brandProductCatalog.hasMore) brandProductCatalog.loadMore();
      if (brandMedicineCatalog.hasMore) brandMedicineCatalog.loadMore();
      return;
    }
    brandUnscopedCatalog.loadMore();
  };

  const brandOptions = useMemo(() => {
    if (brandRecords.length > 0) return brandRecords;
    return brandOptionsFromProducts(products);
  }, [brandRecords, products]);

  // Apply client-side filters and sorting
  const filteredAndSortedProducts = useMemo(() => {
    const catalogSort = ['price_low', 'price_high', 'discount'].includes(sortBy)
      ? sortBy
      : 'relevance';
    // Brand page: keep only items the API tags with this brand (by id, or by the brand name in
    // the URL). Never fall back to an unfiltered list when the backend ignores brand_name_id.
    const inService = (product) => {
      if (!isMedicine || !serviceCategoryId) return true;
      const sid = itemServiceId(product);
      if (sid) return sid === String(serviceCategoryId);
      return product?.catalog_kind !== 'product';
    };
    const brandMatched = brandId
      ? products.filter((product) => {
          const ids = [
            product?.brand_name_id,
            product?.brand_id,
            product?.brand?.id,
            typeof product?.brand_name === 'object' ? product?.brand_name?.id : null,
          ]
            .filter((v) => v !== undefined && v !== null && v !== '')
            .map(String);
          if (ids.includes(String(brandId))) return true;
          const name = normalizeBrand(
            typeof product?.brand_name === 'object'
              ? product?.brand_name?.name || product?.brand_name?.brand_name
              : product?.brand_name || product?.brand?.name,
          );
          return Boolean(brandTitleKey) && name === brandTitleKey;
        })
      : products;
    const scoped = brandMatched.filter(inService);
    let filtered = applyProductFilters({
      products: scoped,
      sortBy: catalogSort,
      brandIds: !brandId && brandIds.length > 0 ? brandIds : null,
      brandNames: brandNames.length > 0 ? brandNames : null,
      priceRange: 'all',
    });

    if (isBrandMix && catalogKind !== 'all') {
      filtered = filtered.filter((product) => resolveCatalogKind(product) === catalogKind);
    }

    filtered = filtered.filter((product) => {
      const price = Number(product.price || product.selling_price || 0);
      return price >= priceRange[0] && price <= priceRange[1];
    });

    if (minRating > 0) {
      filtered = filtered.filter((product) => {
        const rating = Number(product.rating || product.average_rating || 0);
        return rating >= minRating;
      });
    }

    if (inStockOnly) {
      filtered = filtered.filter((product) => {
        const stock = Number(product.stock || product.in_stock || 0);
        return stock > 0;
      });
    }

    return orderListedProducts(filtered, { sortBy });

  }, [
    products,
    priceRange,
    minRating,
    inStockOnly,
    sortBy,
    brandIds,
    brandNames,
    brandId,
    brandTitleKey,
    isBrandMix,
    isMedicine,
    serviceCategoryId,
    catalogKind,
    medicineCategoryId,
    productsCategoryId,
  ]);

  const categoryList = [
    { id: 'all', name: T.all, image_url: '', catalog: 'product' },
    ...(isBrandMix
      ? [
          ...topCategories.map((item) => ({ ...item, catalog: 'product' })),
          ...medicineCategories.map((item) => ({ ...item, catalog: 'medicine' })),
        ]
      : topCategories.map((item) => ({ ...item, catalog: 'product' }))),
  ];
  const concernList = [
    { id: 'all', name: T.all, image_url: '' },
    ...healthCategories,
  ];

  const hasBrandFilter = brandId
    ? false
    : brandIds.length > 0 || brandNames.length > 0;

  const hasActiveFilters =
    priceRange[0] !== 0 ||
    priceRange[1] !== 10000 ||
    minRating > 0 ||
    dosha !== 'all' ||
    inStockOnly ||
    sortBy !== 'relevance' ||
    hasBrandFilter ||
    (isBrandMix && catalogKind !== 'all') ||
    Boolean(activeCategoryId) ||
    Boolean(query);

  const clearFilters = () => {
    setPriceRange([0, 10000]);
    setMinRating(0);
    setDosha('all');
    setInStockOnly(false);
    setSortBy('relevance');
    setBrandIds(brandId ? [brandId] : []);
    setBrandNames([]);
    setCatalogKind('all');
    setSearch('');
    setQuery('');
    if (activeCategoryId || params.get('facet')) {
      patchParams({
        category: null,
        facet: null,
        catalog: null,
        mode: isBothMode ? 'both' : brandId || isMedicine ? mode : 'product',
        name: brandId
          ? brandOptions.find((b) => String(b.id) === String(brandId))?.name ||
            params.get('name') ||
            null
          : isBothMode
            ? params.get('name') || 'Brands'
            : null,
      });
    }
  };

  const countLabel = (() => {
    const n = filteredAndSortedProducts.length;
    if (isBrandMix) {
      if (catalogKind === 'medicine') return n === 1 ? 'medicine' : 'medicines';
      if (catalogKind === 'product') return n === 1 ? 'product' : 'products';
      return n === 1 ? 'item' : 'items';
    }
    if (isMedicine) return n === 1 ? 'medicine' : 'medicines';
    return n === 1 ? 'product' : 'products';
  })();

  const goSearch = (value) => setQuery(String(value ?? search).trim());

  const currentBrandName =
    brandOptions.find((b) => String(b.id) === String(brandId))?.name ||
    params.get('name') ||
    '';

  const mixedPageName = isBothMode ? params.get('name') || 'Brands' : null;

  const selectBrand = (brand) => {
    if (!brand) {
      const keepCategory = activeCategoryId || null;
      const keepName =
        mode === 'health'
          ? healthCategories.find((c) => c.id === keepCategory)?.name
          : topCategories.find((c) => c.id === keepCategory)?.name;
      patchParams({
        brand: null,
        name: isBothMode ? mixedPageName : keepName || null,
        mode: isBothMode ? 'both' : keepCategory ? mode : params.get('mode') || 'product',
        facet: isBothMode && keepCategory && mode === 'health' ? 'health' : null,
      });
      return;
    }
    if (String(brand.id) === String(brandId)) return;
    patchParams({
      brand: brand.id,
      name: brand.name,
      mode: isBothMode ? 'both' : params.get('mode') || 'product',
    });
    setCatalogKind('all');
  };

  const selectCategory = (id, name, catalog = 'product') => {
    setSelectedSubcategoryId(null);
    const medicinePick = isBothMode && catalog === 'medicine' && id && id !== 'all';
    if (!id || id === 'all') {
      patchParams({
        category: null,
        catalog: null,
        facet: null,
        mode: isBothMode ? 'both' : 'product',
        name: brandId ? currentBrandName || null : isBothMode ? mixedPageName : null,
      });
      setSelectedCategoryId('all');
      return;
    }
    patchParams({
      category: id,
      catalog: medicinePick ? 'medicine' : null,
      facet: null,
      mode: isBothMode ? 'both' : 'product',
      name: brandId ? currentBrandName || name || null : isBothMode ? mixedPageName : name || null,
    });
    setSelectedCategoryId(id);
  };

  const selectConcern = (id, name) => {
    setSelectedSubcategoryId(null);
    if (!id || id === 'all') {
      patchParams({
        category: null,
        catalog: null,
        facet: null,
        mode: isBothMode ? 'both' : 'product',
        name: brandId ? currentBrandName || null : isBothMode ? mixedPageName : null,
      });
      setSelectedCategoryId('all');
      return;
    }
    patchParams({
      category: id,
      catalog: null,
      facet: isBothMode ? 'health' : null,
      mode: isBothMode ? 'both' : 'health',
      name: brandId ? currentBrandName || name || null : isBothMode ? mixedPageName : name || null,
    });
    setSelectedCategoryId(id);
  };

  const isCategoryChipSelected = (id, catalog = 'product') => {
    if (id === 'all') return mode !== 'product' || !activeCategoryId;
    if (mode !== 'product' || String(selectedCategoryId) !== String(id)) return false;
    if (!isBrandMix) return true;
    return categoryCatalog === catalog;
  };

  const isConcernChipSelected = (id) => {
    if (id === 'all') return mode !== 'health' || !activeCategoryId;
    return mode === 'health' && selectedCategoryId === id;
  };

  const searchPlaceholder = isBrandMix
    ? 'Search products & medicines'
    : isMedicine
      ? 'Search medicines'
      : T.searchCollection;

  const searchBar = (
    <PageBar className="am-page-bar--slot" title={title}>
      <SearchField
        value={search}
        onChange={setSearch}
        onSubmit={goSearch}
        placeholder={searchPlaceholder}
        label={searchPlaceholder}
        suggestions={searchSuggestions(products)}
      />
    </PageBar>
  );

  const filterMark = (item) => {
    const image = item?.image_url || resolveImageUrl(item);
    const initial = String(item?.name || '?').trim().charAt(0).toUpperCase() || '?';
    return { image, initial };
  };

  return (
    <AppShell tab={shellTab}>
      <div className="st-page st-page--products cp-page">
        <section className="st-section st-panel" aria-labelledby="cp-catalog-title">
          <header className="cp-hero cp-hero--compact">
            <div className="cp-hero__row">
              <button type="button" className="cp-back" onClick={() => navigate(-1)} aria-label="Go back">
                <ArrowLeft size={18} aria-hidden />
              </button>
              <div className="cp-hero__copy">
                <p className="cp-hero__eyebrow">
                  {brandId ? 'Brand' : isBothMode ? 'Brands' : mode === 'health' ? 'Health concern' : 'Collection'}
                </p>
                <h1 id="cp-catalog-title" className="cp-hero__title">
                  {title}
                </h1>
              </div>
            </div>
          </header>

          <div className="st-catalog">
            <nav className="st-cat-col" aria-label="Catalog filters">
              <p className="st-cat-col__eyebrow">Filter</p>

              {brandOptions.length > 0 ? (
                <div className={`cp-aside-group${openFilterPanel === 'brand' ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="cp-aside-toggle"
                    id="cp-brands-title"
                    aria-expanded={openFilterPanel === 'brand'}
                    aria-controls="cp-brands-panel"
                    onClick={() => toggleFilterPanel('brand')}
                  >
                    <span className="cp-aside-toggle__copy">
                      <strong>Brand</strong>
                      <em>{currentBrandName || 'All brands'}</em>
                    </span>
                    <ChevronDown size={16} aria-hidden className="cp-aside-toggle__icon" />
                  </button>
                  <div
                    id="cp-brands-panel"
                    className="cp-aside-panel"
                    role="region"
                    aria-labelledby="cp-brands-title"
                    hidden={openFilterPanel !== 'brand'}
                  >
                    <ul className="st-cat-filter">
                      <li>
                        <button
                          type="button"
                          className={!brandId ? 'is-on' : ''}
                          aria-pressed={!brandId}
                          onClick={() => selectBrand(null)}
                        >
                          <span className="st-cat-filter__mark" aria-hidden>
                            All
                          </span>
                          <span className="st-cat-filter__copy">
                            <strong>All brands</strong>
                            <em>Full catalogue</em>
                          </span>
                        </button>
                      </li>
                      {brandOptions.map((brand) => {
                        const on = String(brandId) === String(brand.id);
                        const { image, initial } = filterMark(brand);
                        return (
                          <li key={brand.id}>
                            <button
                              type="button"
                              className={on ? 'is-on' : ''}
                              aria-pressed={on}
                              onClick={() => selectBrand(brand)}
                            >
                              <span className="st-cat-filter__mark" aria-hidden>
                                {image ? <img src={image} alt="" /> : initial}
                              </span>
                              <span className="st-cat-filter__copy">
                                <strong>{brand.name}</strong>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              ) : null}

              {isBrandMix ? (
                <div className={`cp-aside-group${openFilterPanel === 'type' ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="cp-aside-toggle"
                    id="cp-type-title"
                    aria-expanded={openFilterPanel === 'type'}
                    aria-controls="cp-type-panel"
                    onClick={() => toggleFilterPanel('type')}
                  >
                    <span className="cp-aside-toggle__copy">
                      <strong>Type</strong>
                      <em>
                        {catalogKind === 'medicine'
                          ? 'Medicines'
                          : catalogKind === 'product'
                            ? 'Products'
                            : 'All'}
                      </em>
                    </span>
                    <ChevronDown size={16} aria-hidden className="cp-aside-toggle__icon" />
                  </button>
                  <div
                    id="cp-type-panel"
                    className="cp-aside-panel"
                    role="region"
                    aria-labelledby="cp-type-title"
                    hidden={openFilterPanel !== 'type'}
                  >
                    <ul className="st-cat-filter">
                      {[
                        { id: 'all', name: 'All', em: 'Products & medicines' },
                        { id: 'product', name: 'Products', em: 'Wellness products' },
                        { id: 'medicine', name: 'Medicines', em: 'Ayurvedic medicines' },
                      ].map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={catalogKind === item.id ? 'is-on' : ''}
                            aria-pressed={catalogKind === item.id}
                            onClick={() => setCatalogKind(item.id)}
                          >
                            <span className="st-cat-filter__mark" aria-hidden>
                              {item.name.charAt(0)}
                            </span>
                            <span className="st-cat-filter__copy">
                              <strong>{item.name}</strong>
                              <em>{item.em}</em>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {categoryList.length > 1 ? (
                <div className={`cp-aside-group${openFilterPanel === 'category' ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="cp-aside-toggle"
                    id="cp-cats-title"
                    aria-expanded={openFilterPanel === 'category'}
                    aria-controls="cp-cats-panel"
                    onClick={() => toggleFilterPanel('category')}
                  >
                    <span className="cp-aside-toggle__copy">
                      <strong>Category</strong>
                      <em>
                        {mode === 'product' && activeCategoryId
                          ? [...topCategories, ...medicineCategories].find(
                              (c) => String(c.id) === String(activeCategoryId),
                            )?.name || 'Selected'
                          : 'All categories'}
                      </em>
                    </span>
                    <ChevronDown size={16} aria-hidden className="cp-aside-toggle__icon" />
                  </button>
                  <div
                    id="cp-cats-panel"
                    className="cp-aside-panel"
                    role="region"
                    aria-labelledby="cp-cats-title"
                    hidden={openFilterPanel !== 'category'}
                  >
                    <ul className="st-cat-filter">
                      {categoryList.map((item, index) => {
                        const on = isCategoryChipSelected(item.id, item.catalog);
                        const { image, initial } = filterMark(item);
                        const showProductHead =
                          isBrandMix && item.catalog === 'product' && item.id !== 'all' &&
                          categoryList[index - 1]?.id === 'all';
                        const showMedicineHead =
                          isBrandMix && item.catalog === 'medicine' &&
                          categoryList[index - 1]?.catalog !== 'medicine';
                        return (
                          <li key={`${item.catalog}-${item.id}`}>
                            {showProductHead ? <p className="cp-cat-group">Products</p> : null}
                            {showMedicineHead ? <p className="cp-cat-group">Medicines</p> : null}
                            <button
                              type="button"
                              className={on ? 'is-on' : ''}
                              aria-pressed={on}
                              onClick={() => selectCategory(item.id, item.name, item.catalog)}
                            >
                              <span className="st-cat-filter__mark" aria-hidden>
                                {item.id === 'all' ? 'All' : image ? <img src={image} alt="" /> : initial}
                              </span>
                              <span className="st-cat-filter__copy">
                                <strong>{item.id === 'all' ? 'All categories' : item.name}</strong>
                                {item.id === 'all' ? (
                                  <em>{isBrandMix ? 'Products and medicines' : 'Any category'}</em>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              ) : null}

              {concernList.length > 1 ? (
                <div className={`cp-aside-group${openFilterPanel === 'concern' ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="cp-aside-toggle"
                    id="cp-concerns-title"
                    aria-expanded={openFilterPanel === 'concern'}
                    aria-controls="cp-concerns-panel"
                    onClick={() => toggleFilterPanel('concern')}
                  >
                    <span className="cp-aside-toggle__copy">
                      <strong>Concern</strong>
                      <em>
                        {mode === 'health' && activeCategoryId
                          ? healthCategories.find((c) => c.id === activeCategoryId)?.name ||
                            'Selected'
                          : 'All concerns'}
                      </em>
                    </span>
                    <ChevronDown size={16} aria-hidden className="cp-aside-toggle__icon" />
                  </button>
                  <div
                    id="cp-concerns-panel"
                    className="cp-aside-panel"
                    role="region"
                    aria-labelledby="cp-concerns-title"
                    hidden={openFilterPanel !== 'concern'}
                  >
                    <ul className="st-cat-filter">
                      {concernList.map((item) => {
                        const on = isConcernChipSelected(item.id);
                        const { image, initial } = filterMark(item);
                        return (
                          <li key={`concern-${item.id}`}>
                            <button
                              type="button"
                              className={on ? 'is-on' : ''}
                              aria-pressed={on}
                              onClick={() => selectConcern(item.id, item.name)}
                            >
                              <span className="st-cat-filter__mark" aria-hidden>
                                {item.id === 'all' ? 'All' : image ? <img src={image} alt="" /> : initial}
                              </span>
                              <span className="st-cat-filter__copy">
                                <strong>{item.id === 'all' ? 'All concerns' : item.name}</strong>
                                {item.id === 'all' ? <em>Any concern</em> : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              ) : null}
            </nav>

            <div className="st-catalog__main">
              <div className="st-controls">
                <div className="st-controls__info">
                  <span>
                    {loading && products.length === 0
                      ? T.refreshing
                      : `${filteredAndSortedProducts.length} ${countLabel}`}
                  </span>
                  {hasActiveFilters ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      leadingIcon={<X size={14} />}
                    >
                      Clear filters
                    </Button>
                  ) : null}
                </div>
                {searchBar}
                <div className="st-controls__actions">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="st-sort-select"
                    aria-label="Sort products"
                  >
                    <option value="relevance">Sort: Relevance</option>
                    <option value="price_low">Price: Low to High</option>
                    <option value="price_high">Price: High to Low</option>
                    <option value="popularity">Popularity</option>
                    <option value="discount">Max Discount</option>
                    <option value="rating">Highest Rated</option>
                    <option value="name">Name: A-Z</option>
                  </select>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowFilters(true)}
                    leadingIcon={<SlidersHorizontal size={16} />}
                  >
                    Filters
                  </Button>
                </div>
              </div>

              {visibleSubs.length > 0 ? (
                <div className="cp-subrow" role="group" aria-label="Subcategories">
                  {visibleSubs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`cp-subchip${selectedSubcategoryId === item.id ? ' is-on' : ''}`}
                      aria-pressed={selectedSubcategoryId === item.id}
                      onClick={() =>
                        setSelectedSubcategoryId((prev) => (prev === item.id ? null : item.id))
                      }
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              ) : null}

              {loading && products.length === 0 ? (
                <SkeletonGrid count={8} className="am-product-grid" />
              ) : filteredAndSortedProducts.length === 0 ? (
                <EmptyState
                  title={
                    hasActiveFilters
                      ? isBrandMix
                        ? 'No items match filters'
                        : isMedicine
                          ? 'No medicines match filters'
                          : 'No products match filters'
                      : T.emptyCategory
                  }
                  description={hasActiveFilters ? 'Try adjusting your filters' : T.emptyCategoryText}
                  action={
                    hasActiveFilters ? (
                      <Button variant="secondary" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <ul className="am-product-grid">
                  {filteredAndSortedProducts.map((item) => (
                    <li key={`${item.catalog_kind || 'item'}-${item.variant_id || item.id}`}>
                      <ProductCard item={item} cartButton detailBase={resolveDetailBase(item)} />
                    </li>
                  ))}
                </ul>
              )}

              {hasMore ? (
                <div className="st-more">
                  <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
                    {loadingMore ? T.loadingMore : T.loadMore}
                  </Button>
                </div>
              ) : null}
              {refreshing ? <p className="am-sr-only">{T.refreshing}</p> : null}
            </div>
          </div>
        </section>
      </div>

      {/* Filter Modal */}
      <Modal
        open={showFilters}
        onClose={() => setShowFilters(false)}
        title={
          isBrandMix ? 'Filter brand items' : isMedicine ? 'Filter medicines' : 'Filter Products'
        }
        description={
          isBrandMix
            ? 'Fine-tune products and medicines from this brand.'
            : isMedicine
              ? 'Fine-tune your selection to find the right medicines.'
              : 'Fine-tune your selection to find the right products.'
        }
        size="lg"
        className="st-filter-modal"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                clearFilters();
                setShowFilters(false);
              }}
            >
              Clear All
            </Button>
            <Button variant="primary" onClick={() => setShowFilters(false)}>
              Apply Filters
            </Button>
          </>
        }
      >
        <div className="st-filter-content">
          <FilterPriceControls
            min={priceRange[0]}
            max={priceRange[1]}
            onChange={setPriceRange}
            headingId="st-filter-price-title"
          />

          <section className="st-filter-section" aria-labelledby="st-filter-rating-title">
            <div className="st-filter-section__heading">
              <h3 id="st-filter-rating-title">Customer rating</h3>
              <span>Minimum rating</span>
            </div>
            <FilterRatingChoices value={minRating} onChange={setMinRating} />
          </section>

          <section className="st-filter-section" aria-labelledby="st-filter-dosha-title">
            <div className="st-filter-section__heading">
              <h3 id="st-filter-dosha-title">Dosha type</h3>
              <span>Ayurvedic constitution</span>
            </div>
            <div className="st-filter-ratings" role="group" aria-label="Dosha type">
              {DOSHA_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setDosha(option.key)}
                  className={`st-filter-rating${dosha === option.key ? ' is-selected' : ''}`}
                  aria-pressed={dosha === option.key}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section
            className="st-filter-section st-filter-section--brands"
            aria-labelledby="st-filter-brand-title"
          >
            <div className="st-filter-section__heading">
              <h3 id="st-filter-brand-title">Brand</h3>
              {brandId ? (
                <span>Switch brand</span>
              ) : brandIds.length > 0 ? (
                <span>{brandIds.length} selected</span>
              ) : (
                <span>Choose one or more</span>
              )}
            </div>
            <div className="st-filter-brand-list">
              {brandOptions.length === 0 ? (
                <p className="st-filter-empty">No brands available</p>
              ) : (
                <>
                  {brandId ? (
                    <button
                      type="button"
                      onClick={() => {
                        selectBrand(null);
                        setShowFilters(false);
                      }}
                      className={`st-filter-brand${!brandId ? ' is-selected' : ''}`}
                      aria-pressed={!brandId}
                    >
                      <span>All brands</span>
                      <span className="st-filter-brand__check" aria-hidden="true">
                        {!brandId ? <Check size={15} /> : null}
                      </span>
                    </button>
                  ) : null}
                  {brandOptions.map((brand) => {
                    const selected = brandId
                      ? String(brandId) === String(brand.id)
                      : brandIds.includes(brand.id);
                    return (
                      <button
                        key={brand.id}
                        type="button"
                        onClick={() => {
                          if (brandId || isBrandMix) {
                            selectBrand(brand);
                            setShowFilters(false);
                            return;
                          }
                          const nextIds = selected
                            ? brandIds.filter((id) => id !== brand.id)
                            : [...brandIds, brand.id];
                          const nextNames = brandOptions
                            .filter((item) => nextIds.includes(item.id))
                            .map((item) => item.name);
                          setBrandIds(nextIds);
                          setBrandNames(nextNames);
                        }}
                        className={`st-filter-brand${selected ? ' is-selected' : ''}`}
                        aria-pressed={selected}
                      >
                        <span>{brand.name}</span>
                        <span className="st-filter-brand__check" aria-hidden="true">
                          {selected ? <Check size={15} /> : null}
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </section>

          <section className="st-filter-stock">
            <label className="st-filter-stock__label">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
              />
              <span>
                <strong>{isBrandMix ? 'In-stock items only' : 'In-stock products only'}</strong>
                <small>Hide items that are currently unavailable</small>
              </span>
            </label>
          </section>

          {hasActiveFilters ? (
            <div className="st-filter-summary" aria-live="polite">
              <strong>Active filters</strong>
              <div className="st-filter-summary__items">
                {priceRange[0] !== 0 || priceRange[1] !== 10000 ? (
                  <span>Price: ₹{priceRange[0]} – ₹{priceRange[1]}</span>
                ) : null}
                {minRating > 0 && <span>Rating: {minRating}★ and up</span>}
                {dosha !== 'all' && <span>Dosha: {dosha}</span>}
                {inStockOnly && <span>In stock only</span>}
                {brandId ? <span>Brand: {currentBrandName || 'Selected'}</span> : null}
                {!brandId && (brandIds.length > 0 || brandNames.length > 0) ? (
                  <span>
                    Brand: {brandNames.length ? brandNames.join(', ') : `${brandIds.length} selected`}
                  </span>
                ) : null}
                {mode === 'product' && activeCategoryId ? (
                  <span>
                    Category:{' '}
                    {topCategories.find((c) => c.id === activeCategoryId)?.name || 'Selected'}
                  </span>
                ) : null}
                {mode === 'health' && activeCategoryId ? (
                  <span>
                    Concern:{' '}
                    {healthCategories.find((c) => c.id === activeCategoryId)?.name || 'Selected'}
                  </span>
                ) : null}
                {isBrandMix && catalogKind !== 'all' ? (
                  <span>Type: {catalogKind === 'medicine' ? 'Medicines' : 'Products'}</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </AppShell>
  );
}

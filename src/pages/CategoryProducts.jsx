import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpDown, Check, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import AppShell from '../components/AppShell';
import ProductCard from '../components/ProductCard';
import useProductCategories from '../hooks/useProductCategories';
import useCategoryProducts from '../hooks/useCategoryProducts';
import useDashboardCategories from '../hooks/useDashboardCategories';
import { mapProductCategory, normalizeApiList } from '../home/catalog';
import { getServiceCategoryId, resolveServiceCategoryKey } from '../home/serviceCategories';
import { getHealthCategories } from '../services/productService';
import { isPrescriptionRequired, isProductOutOfStock } from '../product/stock';
import {
  Button,
  Chip,
  EmptyState,
  Modal,
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
import { STORE_COPY as T } from '../content/store';
import { filterItemsByQuery } from '../home/concernCatalog';
import '../design/pages/store.css';
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
  const [params] = useSearchParams();
  const brandId = params.get('brand') || '';
  const isBrandMix = Boolean(brandId);
  const isMedicine = !isBrandMix && location.pathname.startsWith('/medicines');
  const shellTab = isMedicine ? 'medicines' : 'products';
  const detailBase = isMedicine ? '/medicines' : '/products';
  const mode = params.get('mode') === 'health' ? 'health' : 'product';
  // Brand browse is always mixed — ignore service so products + medicines both load.
  const serviceCategoryId = isBrandMix ? null : params.get('service') || null;
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
  const brandReady = isBrandMix && !dashboardLoading;
  const canSplitBrand =
    brandReady && Boolean(productsCategoryId) && Boolean(medicineCategoryId);

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
  const activeCategoryId = selectedCategoryId === 'all' ? null : selectedCategoryId;
  const [healthCategories, setHealthCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  // Page search filters this page in place (debounced while typing; Search/Enter applies now).
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  
  // Filter & Sort States
  const [sortBy, setSortBy] = useState('relevance');
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [minRating, setMinRating] = useState(0);
  const [dosha, setDosha] = useState('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [brandIds, setBrandIds] = useState(brandId ? [brandId] : []);
  const [brandNames, setBrandNames] = useState([]);
  const [catalogKind, setCatalogKind] = useState('all');
  const { brands: brandRecords } = useBrands();

  const { categories: topCategories } = useProductCategories(
    null,
    mode === 'product' && !isBrandMix ? serviceCategoryId : null,
  );
  const { categories: subcategories } = useProductCategories(
    mode === 'product' && !brandId ? activeCategoryId : null,
    mode === 'product' && !isBrandMix ? serviceCategoryId : null,
  );
  const visibleSubs =
    mode === 'product' && !brandId && activeCategoryId ? subcategories : [];
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(null);

  useEffect(() => {
    if (mode !== 'health' || isBrandMix) return undefined;
    let alive = true;
    (async () => {
      const res = await getHealthCategories(
        serviceCategoryId ? { service_category_id: serviceCategoryId } : undefined,
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
  }, [mode, serviceCategoryId, isBrandMix]);

  const productFilter = useMemo(() => {
    if (brandId) {
      return { brand_name_id: brandId };
    }
    if (mode === 'health') {
      return {
        ...(activeCategoryId ? { health_category_id: activeCategoryId } : {}),
        ...(selectedSubcategoryId ? { health_disease_id: selectedSubcategoryId } : {}),
        ...(serviceCategoryId && (activeCategoryId || selectedSubcategoryId)
          ? { service_category_id: serviceCategoryId }
          : {}),
      };
    }
    return {
      ...(activeCategoryId ? { id: activeCategoryId } : {}),
      ...(selectedSubcategoryId ? { product_subcategory_id: selectedSubcategoryId } : {}),
      ...(serviceCategoryId && (activeCategoryId || selectedSubcategoryId)
        ? { service_category_id: serviceCategoryId }
        : {}),
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
    }),
    [priceRange, minRating, dosha, sortBy],
  );

  const requestFilter = useMemo(
    () => ({
      ...productFilter,
      ...sharedExtras,
    }),
    [productFilter, sharedExtras],
  );

  const brandProductFilter = useMemo(
    () => ({
      brand_name_id: brandId,
      ...(productsCategoryId ? { service_category_id: productsCategoryId } : {}),
      ...sharedExtras,
    }),
    [brandId, productsCategoryId, sharedExtras],
  );

  const brandMedicineFilter = useMemo(
    () => ({
      brand_name_id: brandId,
      ...(medicineCategoryId ? { service_category_id: medicineCategoryId } : {}),
      ...sharedExtras,
    }),
    [brandId, medicineCategoryId, sharedExtras],
  );

  const brandUnscopedFilter = useMemo(
    () => ({
      brand_name_id: brandId,
      ...sharedExtras,
    }),
    [brandId, sharedExtras],
  );

  const regularCatalog = useCategoryProducts(requestFilter, [], {
    enabled: !isBrandMix,
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
      return brandUnscopedCatalog.products.map((item) => ({
        ...item,
        catalog_kind: resolveCatalogKind(item),
      }));
    }
    const seen = new Set();
    const merged = [];
    brandProductCatalog.products.forEach((item) => {
      const key = String(item.variant_id ?? item.id ?? '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push({ ...item, catalog_kind: 'product' });
    });
    brandMedicineCatalog.products.forEach((item) => {
      const key = String(item.variant_id ?? item.id ?? '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push({ ...item, catalog_kind: 'medicine' });
    });
    return merged;
  }, [
    isBrandMix,
    canSplitBrand,
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

  const refresh = () => {
    if (!isBrandMix) {
      regularCatalog.refresh();
      return;
    }
    if (canSplitBrand) {
      brandProductCatalog.refresh();
      brandMedicineCatalog.refresh();
      return;
    }
    brandUnscopedCatalog.refresh();
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
    const scoped = brandId
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
    let filtered = applyProductFilters({
      products: filterItemsByQuery(scoped, query),
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

    if (sortBy === 'rating' || sortBy === 'name') {
      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'rating') {
          return (
            Number(b.rating || b.average_rating || 0) -
            Number(a.rating || a.average_rating || 0)
          );
        }
        return (a.name || '').localeCompare(b.name || '');
      });
    }

    // Keep out-of-stock items after in-stock, without changing the chosen sort within each group.
    filtered = [...filtered].sort((a, b) => {
      const aOut = isProductOutOfStock(a) ? 1 : 0;
      const bOut = isProductOutOfStock(b) ? 1 : 0;
      return aOut - bOut;
    });

    return filtered;
  }, [
    products,
    query,
    priceRange,
    minRating,
    inStockOnly,
    sortBy,
    brandIds,
    brandNames,
    brandId,
    brandTitleKey,
    isBrandMix,
    catalogKind,
    medicineCategoryId,
    productsCategoryId,
  ]);

  const categoryList = brandId
    ? []
    : [
        { id: 'all', name: T.all, image_url: '' },
        ...(mode === 'health' ? healthCategories : topCategories),
      ];

  const hasBrandFilter = brandId
    ? brandIds.length !== 1 || brandIds[0] !== brandId
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

  const selectCategory = (id) => {
    setSelectedCategoryId(id);
    setSelectedSubcategoryId(null);
  };

  return (
    <AppShell tab={shellTab}>
      <div className="st-page cp-page">
        <header className="cp-hero">
          <div className="cp-hero__row">
            <button type="button" className="cp-back" onClick={() => navigate(-1)} aria-label="Go back">
              <ArrowLeft size={18} aria-hidden />
            </button>
            <div className="cp-hero__copy">
              <p className="cp-hero__eyebrow">{brandId ? 'Brand' : mode === 'health' ? 'Health concern' : 'Collection'}</p>
              <h1 className="cp-hero__title">{title}</h1>
              <p className="cp-hero__count" aria-live="polite">
                {loading && products.length === 0
                  ? T.refreshing
                  : `${filteredAndSortedProducts.length} ${countLabel}`}
              </p>
            </div>
          </div>
          <div className="cp-hero__search">
            <SearchField
              value={search}
              onChange={setSearch}
              onSubmit={goSearch}
              placeholder={
                isBrandMix
                  ? 'Search products & medicines'
                  : isMedicine
                    ? 'Search medicines'
                    : T.searchCollection
              }
              label={
                isBrandMix
                  ? 'Search products & medicines'
                  : isMedicine
                    ? 'Search medicines'
                    : T.searchCollection
              }
              suggestions={searchSuggestions(products)}
            />
            {/* <kbd className="cp-kbd" aria-hidden>/</kbd> */}
          </div>
        </header>

        {isBrandMix ? (
          <div className="cp-chips" role="tablist" aria-label="Catalog type">
            {[
              { id: 'all', name: 'All' },
              { id: 'product', name: 'Products' },
              { id: 'medicine', name: 'Medicines' },
            ].map((item) => (
              <Chip
                key={item.id}
                selected={catalogKind === item.id}
                onClick={() => setCatalogKind(item.id)}
              >
                {item.name}
              </Chip>
            ))}
          </div>
        ) : null}

        {categoryList.length > 1 ? (
          <div className="cp-chips" role="tablist" aria-label={T.categories}>
            {categoryList.map((item) => (
              <Chip
                key={item.id}
                selected={selectedCategoryId === item.id}
                onClick={() => selectCategory(item.id)}
              >
                {item.name}
              </Chip>
            ))}
          </div>
        ) : null}

        {visibleSubs.length > 0 ? (
          <div className="cp-chips cp-chips--sub" role="group" aria-label="Subcategories">
            {visibleSubs.map((item) => (
              <Chip
                key={item.id}
                selected={selectedSubcategoryId === item.id}
                onClick={() =>
                  setSelectedSubcategoryId((prev) => (prev === item.id ? null : item.id))
                }
              >
                {item.name}
              </Chip>
            ))}
          </div>
        ) : null}

        <div className="cp-toolbar">
          <label className="cp-sort">
            <span className="am-sr-only">Sort products</span>
            <ArrowUpDown size={14} aria-hidden />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort products">
              <option value="relevance">Relevance</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="popularity">Popularity</option>
              <option value="discount">Max Discount</option>
              <option value="rating">Highest Rated</option>
              <option value="name">Name: A-Z</option>
            </select>
          </label>
          <button
            type="button"
            className={`cp-chip-btn${hasActiveFilters && sortBy === 'relevance' ? ' is-on' : ''}`}
            onClick={() => setShowFilters(true)}
          >
            <SlidersHorizontal size={14} aria-hidden />
            Filters
          </button>
          {hasActiveFilters ? (
            <button type="button" className="cp-chip-btn cp-chip-btn--ghost" onClick={clearFilters}>
              <X size={14} aria-hidden />
              Clear
            </button>
          ) : null}
          <button
            type="button"
            className="cp-chip-btn cp-chip-btn--ghost cp-toolbar__refresh"
            onClick={refresh}
            disabled={refreshing}
            aria-label={refreshing ? T.refreshing : T.refresh}
          >
            <RefreshCw size={14} aria-hidden className={refreshing ? 'is-spin' : ''} />
            <span className="cp-toolbar__refresh-label">{T.refresh}</span>
          </button>
        </div>

        {loading && products.length === 0 ? (
          <SkeletonGrid count={8} className="am-product-grid cp-grid" />
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
          <ul className="am-product-grid cp-grid">
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
          <section className="st-filter-section" aria-labelledby="st-filter-price-title">
            <div className="st-filter-section__heading">
              <h3 id="st-filter-price-title">Price range</h3>
              <span>₹{priceRange[0]} – ₹{priceRange[1]}</span>
            </div>
            <div className="st-filter-price">
              <label className="st-filter-field">
                <span>Minimum price</span>
                <input
                  type="number"
                  value={priceRange[0]}
                  onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                  min="0"
                />
              </label>
              <span className="st-filter-price__separator" aria-hidden="true">
                to
              </span>
              <label className="st-filter-field">
                <span>Maximum price</span>
                <input
                  type="number"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                  min="0"
                />
              </label>
            </div>
          </section>

          <section className="st-filter-section" aria-labelledby="st-filter-rating-title">
            <div className="st-filter-section__heading">
              <h3 id="st-filter-rating-title">Customer rating</h3>
              <span>Minimum rating</span>
            </div>
            <div className="st-filter-ratings" role="group" aria-label="Minimum rating">
              {[0, 3, 3.5, 4, 4.5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setMinRating(rating)}
                  className={`st-filter-rating${minRating === rating ? ' is-selected' : ''}`}
                  aria-pressed={minRating === rating}
                >
                  {rating === 0 ? 'Any rating' : `${rating}★ & up`}
                </button>
              ))}
            </div>
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

          {!brandId ? (
            <section
              className="st-filter-section st-filter-section--brands"
              aria-labelledby="st-filter-brand-title"
            >
              <div className="st-filter-section__heading">
                <h3 id="st-filter-brand-title">Brand</h3>
                {brandIds.length > 0 ? (
                  <span>{brandIds.length} selected</span>
                ) : (
                  <span>Choose one or more</span>
                )}
              </div>
              <div className="st-filter-brand-list">
                {brandOptions.length === 0 ? (
                  <p className="st-filter-empty">No brands available</p>
                ) : (
                  brandOptions.map((brand) => {
                    const selected = brandIds.includes(brand.id);
                    return (
                      <button
                        key={brand.id}
                        type="button"
                        onClick={() => {
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
                  })
                )}
              </div>
            </section>
          ) : null}

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
                {(brandIds.length > 0 || brandNames.length > 0) && (
                  <span>
                    Brand: {brandNames.length ? brandNames.join(', ') : `${brandIds.length} selected`}
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </AppShell>
  );
}

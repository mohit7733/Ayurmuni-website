import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Leaf, Pill, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';
import AppShell from '../components/AppShell';
import BannerCarousel from '../components/BannerCarousel';
import ProductCard from '../components/ProductCard';
import { DietPlanCard, SectionHead, ViewAll } from '../components/ServiceHome';
import { getBanners } from '../services/bannerService';
import {
  formatRupee,
  getBannerImageUri,
  mapProductCategory,
  normalizeApiList,
  resolveImageUrl,
} from '../home/catalog';
import { getServiceCategoryId, resolveBannerNavigation } from '../home/serviceCategories';
import useDashboardCategories from '../hooks/useDashboardCategories';
import useCategoryProducts from '../hooks/useCategoryProducts';
import useProductCategories from '../hooks/useProductCategories';
import { useCart } from '../hooks/useCart';
import { getHealthCategories } from '../services/productService';
import { getBrands, listBrands, mapBrandItem } from '../services/medicineService';
import { getOrders, normalizeOrdersList } from '../services/orderService';
import { mapOrdersToRecentProducts } from '../profile/map';
import {
  Button,
  ConcernCarousel,
  EmptyState,
  Modal,
  PageBar,
  Rail,
  RailItem,
  RailSkeleton,
  Reveal,
  SearchField,
  SkeletonGrid,
  Tile,
} from '../components/ui';
import { getProductStockQty } from '../product/stock';
import { HOME_COPY as H } from '../content/home';
import { STORE_COPY as T } from '../content/store';
import '../design/pages/store.css';
import '../design/pages/products.css';

const nameTokens = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 3);

export default function Medicines() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const concernId = params.get('concern') || '';
  const concernName = params.get('name') || '';
  const categoryId = params.get('category') || '';
  const categoryName = params.get('name') || '';
  const { itemCount } = useCart();
  const { categories: dashboardCategories, loading: homeLoading } = useDashboardCategories();
  const medicineCategoryId = useMemo(
    () => getServiceCategoryId(dashboardCategories, 'medicine'),
    [dashboardCategories],
  );
  const { categories: productCategories, loading: categoriesLoading } = useProductCategories(
    null,
    medicineCategoryId,
  );
  const productFilter = useMemo(() => {
    const next = {};
    if (medicineCategoryId) next.service_category_id = medicineCategoryId;
    if (categoryId) next.id = categoryId;
    return next;
  }, [medicineCategoryId, categoryId]);
  const { products, loading, loadingMore, hasMore, loadMore } = useCategoryProducts(
    productFilter,
    [],
    { enabled: Boolean(medicineCategoryId) || !homeLoading },
  );

  const [banners, setBanners] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [brands, setBrands] = useState([]);
  const [recent, setRecent] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [minRating, setMinRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [brandIds, setBrandIds] = useState([]);
  const [brandNames, setBrandNames] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const moreRef = useRef(null);

  const filteredProducts = useMemo(() => {
    let filtered = products.filter((product) => {
      const price = Number(product.selling_price ?? product.price);
      if (Number.isFinite(price) && (price < priceRange[0] || price > priceRange[1])) return false;

      if (minRating > 0) {
        const rating = Number(product.rating || product.average_rating || 0);
        if (rating < minRating) return false;
      }

      if (inStockOnly) {
        const qty = getProductStockQty(product);
        const stock = qty ?? Number(product.stock || product.in_stock || 0);
        if (!(stock > 0)) return false;
      }

      if (brandIds.length > 0 || brandNames.length > 0) {
        const id = String(product.brand_id ?? product.brand_name_id ?? product.brand?.id ?? '');
        const name = String(product.brand_name ?? product.brand?.name ?? '').trim();
        const matchesId = id !== '' && brandIds.includes(id);
        const matchesName = name !== '' && brandNames.includes(name);
        if (!matchesId && !matchesName) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      const priceA = Number(a.price || a.selling_price || 0);
      const priceB = Number(b.price || b.selling_price || 0);
      const ratingA = Number(a.rating || a.average_rating || 0);
      const ratingB = Number(b.rating || b.average_rating || 0);
      switch (sortBy) {
        case 'price_low':
          return priceA - priceB;
        case 'price_high':
          return priceB - priceA;
        case 'rating':
          return ratingB - ratingA;
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [products, priceRange, minRating, inStockOnly, sortBy, brandIds, brandNames]);

  const hasActiveFilters =
    priceRange[0] !== 0 ||
    priceRange[1] !== 10000 ||
    minRating > 0 ||
    inStockOnly ||
    sortBy !== 'relevance' ||
    brandIds.length > 0 ||
    brandNames.length > 0;

  const clearFilters = () => {
    setPriceRange([0, 10000]);
    setMinRating(0);
    setInStockOnly(false);
    setSortBy('relevance');
    setBrandIds([]);
    setBrandNames([]);
  };

  const goSearch = (value) => {
    const query = String(value || search || '').trim();
    navigate(`/search?mode=product${query ? `&q=${encodeURIComponent(query)}` : ''}`);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const [bannerRes, catRes, brandRes] = await Promise.all([
        getBanners('medicine', medicineCategoryId),
        getHealthCategories(
          medicineCategoryId ? { service_category_id: medicineCategoryId } : undefined,
        ),
        getBrands(),
      ]);
      if (!alive) return;
      setBanners(
        (bannerRes?.data || [])
          .map((item) => ({ ...item, image: getBannerImageUri(item) }))
          .filter((item) => item.image),
      );
      setConcerns(
        normalizeApiList(catRes)
          .map(mapProductCategory)
          .filter((item) => item.id),
      );
      setBrands(listBrands(brandRes).map(mapBrandItem).filter((item) => item.id));
    })();
    return () => {
      alive = false;
    };
  }, [medicineCategoryId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setOrdersLoading(true);
      try {
        const res = await getOrders({ page: 1, page_size: 5 });
        if (!alive) return;
        setRecent(mapOrdersToRecentProducts(normalizeOrdersList(res), 8));
      } catch {
        if (alive) setRecent([]);
      } finally {
        if (alive) setOrdersLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const node = moreRef.current;
    if (!node || !hasMore) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: '240px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, products.length]);

  const [catalogReady, setCatalogReady] = useState(false);
  useEffect(() => {
    if (!loading) setCatalogReady(true);
  }, [loading]);
  const showSkeleton = !catalogReady && loading && products.length === 0;
  const catalogLoading = loading && products.length === 0;

  const categoryForConcern = (item) => {
    const words = nameTokens(item?.name);
    if (!words.length) return null;
    return (
      productCategories.find((cat) => {
        const catWords = nameTokens(cat.name);
        return words.some((word) =>
          catWords.some((other) => other.startsWith(word) || word.startsWith(other)),
        );
      }) || null
    );
  };

  const selectCategory = (id, name) => {
    const next = new URLSearchParams(params);
    next.delete('concern');
    if (!id) {
      next.delete('category');
      next.delete('name');
    } else if (String(categoryId) !== String(id)) {
      next.set('category', id);
      if (name) next.set('name', name);
      else next.delete('name');
    } else {
      document.getElementById('med-all')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setParams(next);
    document.getElementById('med-all')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectConcern = (item) => {
    const match = categoryForConcern(item);
    if (match) {
      selectCategory(match.id, match.name);
      return;
    }
    const next = new URLSearchParams(params);
    next.delete('concern');
    next.delete('category');
    next.delete('name');
    setParams(next);
    document.getElementById('med-all')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const showAllMedicines = () => selectCategory('', '');

  useEffect(() => {
    if (!concernId || categoriesLoading) return;
    const match = categoryForConcern({ name: concernName });
    const next = new URLSearchParams(params);
    next.delete('concern');
    if (match) {
      next.set('category', match.id);
      next.set('name', match.name);
    } else {
      next.delete('category');
      next.delete('name');
    }
    setParams(next, { replace: true });
  }, [concernId, concernName, categoriesLoading, productCategories]);

  const activeCategoryName =
    categoryName ||
    productCategories.find((item) => String(item.id) === String(categoryId))?.name ||
    '';
  const catalogTitle = categoryId ? activeCategoryName || 'Medicines' : T.allMedicines;
  const catalogText = categoryId
    ? `Medicines in ${activeCategoryName || 'this category'}.`
    : T.allMedicinesText;

  const openBanner = (item) => {
    const target = resolveBannerNavigation(item);
    if (!target) return;
    if (target.external) {
      window.open(target.href, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(target.path);
  };

  return (
    <AppShell tab="medicines">
      <div className="hm-page svc-page">
        <div className="hm-body">
          {banners.length ? (
            <BannerCarousel
              items={banners}
              interval={6000}
              onSelect={openBanner}
              copy={{
                label: H.offersLabel,
                open: H.openOffer,
                of: H.of,
                show: H.showOffer,
                pause: H.pauseOffers,
                play: H.playOffers,
              }}
            />
          ) : null}

          <PageBar id="med-hero" title="Shop medicines">
            <SearchField
              value={search}
              onChange={setSearch}
              onSubmit={goSearch}
              placeholder={H.searchPlaceholder}
              label="Search medicines"
            />
            <Button
              variant="secondary"
              onClick={() => navigate('/cart')}
              leadingIcon={<ShoppingBag size={18} aria-hidden />}
            >
              Cart
              {itemCount ? (
                <span className="am-page-bar__count">{itemCount > 99 ? '99+' : itemCount}</span>
              ) : null}
            </Button>
          </PageBar>

          {showSkeleton ? (
            <SkeletonGrid count={8} className="svc-catalog" label="Loading medicines" />
          ) : (
            <>
              {ordersLoading || recent.length > 0 ? (
                <div className="hm-doctor-row">
                  <Reveal as="section" className="hm-section" aria-labelledby="med-recent">
                    <SectionHead
                      id="med-recent"
                      title="Recent orders"
                      description="Medicines you ordered recently."
                      action={<ViewAll label="Recent orders" onClick={() => navigate('/profile/orders')} />}
                    />
                    {ordersLoading && recent.length === 0 ? (
                      <RailSkeleton count={4} />
                    ) : (
                      <Rail label="Recent orders">
                        {recent.map((item) => (
                          <RailItem key={`${item.id}-${item.variantId}`}>
                            <DietPlanCard
                              item={{
                                title: item.name,
                                thumbnail_url: item.image,
                                season: item.lastOrdered ? `Ordered ${item.lastOrdered}` : 'Recent order',
                                prakriti: formatRupee(item.price, { decimals: 0 }),
                              }}
                              onClick={() => item.variantId && navigate(`/products/${item.variantId}`)}
                            />
                          </RailItem>
                        ))}
                      </Rail>
                    )}
                  </Reveal>
                </div>
              ) : null}

              {concerns.length > 0 ? (
                <Reveal as="section" className="hm-section hm-panel hm-concerns-panel" aria-labelledby="med-concerns">
                  <SectionHead
                    id="med-concerns"
                    title={H.concernsTitle}
                    description="Shop remedies for the concern you want to improve."
                    action={
                      concerns.length > 1 ? (
                        <ViewAll label={H.concernsTitle} onClick={showAllMedicines} />
                      ) : null
                    }
                  />
                  <ConcernCarousel label={H.concernsTitle}>
                    {concerns.map((item) => (
                      <Tile
                        cutout
                        key={item.id}
                        className={
                          categoryForConcern(item)?.id &&
                          String(categoryForConcern(item).id) === String(categoryId)
                            ? 'is-on'
                            : undefined
                        }
                        image={item.image_url}
                        icon={Pill}
                        label={item.name}
                        onClick={() => selectConcern(item)}
                      />
                    ))}
                  </ConcernCarousel>
                </Reveal>
              ) : null}

              {brands.length > 0 ? (
                <Reveal as="section" className="hm-section hm-panel hm-brands-panel" aria-labelledby="med-brands">
                  <SectionHead
                    id="med-brands"
                    eyebrow="Trusted"
                    title="Brands"
                    description="Formulas from houses we stock."
                  />
                  <ConcernCarousel label="Trusted brands">
                    {brands.map((item) => (
                      <Tile
                        key={item.id}
                        className="hm-brand-tile"
                        image={item.image_url || resolveImageUrl(item)}
                        icon={Pill}
                        label={item.name}
                        onClick={() =>
                          navigate(
                            `/products/category?mode=product&brand=${item.id}&name=${encodeURIComponent(
                              item.name,
                            )}${medicineCategoryId ? `&service=${medicineCategoryId}` : ''}`,
                          )
                        }
                      />
                    ))}
                  </ConcernCarousel>
                </Reveal>
              ) : null}

              <div className="hm-doctor-row">
                <section className="hm-section st-page--products" aria-labelledby="med-all">
                  <SectionHead
                    id="med-all"
                    title={catalogTitle}
                    description={catalogText}
                    action={
                      categoryId ? (
                        <ViewAll label={T.allMedicines} onClick={showAllMedicines} />
                      ) : null
                    }
                  />
                  <div className="st-catalog">
                    <nav className="st-cat-col" aria-labelledby="med-cats-title">
                      <p className="st-cat-col__eyebrow">Filter</p>
                      <h3 id="med-cats-title">{T.shopByCategory}</h3>
                      <ul className="st-cat-filter">
                        <li>
                          <button
                            type="button"
                            className={!categoryId ? 'is-on' : ''}
                            aria-pressed={!categoryId}
                            onClick={showAllMedicines}
                          >
                            <span className="st-cat-filter__mark" aria-hidden>
                              All
                            </span>
                            <span className="st-cat-filter__copy">
                              <strong>{T.allMedicines}</strong>
                              <em>Full catalogue</em>
                            </span>
                          </button>
                        </li>
                        {productCategories.map((item) => {
                          const image = resolveImageUrl(item);
                          const on = String(categoryId) === String(item.id);
                          const initial = String(item.name || '?').trim().charAt(0).toUpperCase();
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                className={on ? 'is-on' : ''}
                                aria-pressed={on}
                                onClick={() => selectCategory(item.id, item.name)}
                              >
                                <span className="st-cat-filter__mark" aria-hidden>
                                  {image ? <img src={image} alt="" /> : initial}
                                </span>
                                <span className="st-cat-filter__copy">
                                  <strong>{item.name}</strong>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {categoriesLoading && productCategories.length === 0 ? (
                        <p className="st-cat-col__status">Loading categories…</p>
                      ) : null}
                    </nav>
                    <div className="st-catalog__main">
                  {products.length > 0 || hasActiveFilters || categoryId ? (
                    <div className="st-controls">
                      <div className="st-controls__info">
                        <span>
                          {filteredProducts.length}{' '}
                          {filteredProducts.length === 1 ? 'medicine' : 'medicines'}
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
                      <div className="st-controls__actions">
                        <select
                          value={sortBy}
                          onChange={(event) => setSortBy(event.target.value)}
                          className="st-sort-select"
                          aria-label="Sort medicines"
                        >
                          <option value="relevance">Sort: Relevance</option>
                          <option value="price_low">Price: Low to High</option>
                          <option value="price_high">Price: High to Low</option>
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
                  ) : null}
                  {catalogLoading ? (
                    <SkeletonGrid count={8} className="svc-catalog" label="Loading medicines" />
                  ) : filteredProducts.length === 0 ? (
                    <EmptyState
                      icon={<Leaf size={28} />}
                      title={
                        hasActiveFilters
                          ? 'No medicines match filters'
                          : categoryId
                            ? 'No medicines in this category'
                            : 'No medicines available'
                      }
                      description={
                        hasActiveFilters
                          ? 'Try adjusting your filters'
                          : categoryId
                            ? 'Try another category, or view all medicines.'
                            : 'Try another category, or search by medicine name.'
                      }
                      action={
                        hasActiveFilters ? (
                          <Button variant="secondary" onClick={clearFilters}>
                            Clear filters
                          </Button>
                        ) : categoryId ? (
                          <Button variant="secondary" onClick={showAllMedicines}>
                            All medicines
                          </Button>
                        ) : null
                      }
                    />
                  ) : (
                    <ul className="svc-catalog">
                      {filteredProducts.map((item) => (
                        <li key={item.variant_id || item.id}>
                          <ProductCard item={item} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {hasMore ? (
                    <div ref={moreRef} className="svc-more" aria-live="polite">
                      {loadingMore ? 'Loading…' : ''}
                    </div>
                  ) : null}
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        open={showFilters}
        onClose={() => setShowFilters(false)}
        title="Filter medicines"
        description="Fine-tune your selection to find the right medicines."
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
          <section className="st-filter-section" aria-labelledby="med-filter-price-title">
            <div className="st-filter-section__heading">
              <h3 id="med-filter-price-title">Price range</h3>
              <span>₹{priceRange[0]} – ₹{priceRange[1]}</span>
            </div>
            <div className="st-filter-price">
              <label className="st-filter-field">
                <span>Minimum price</span>
                <input
                  type="number"
                  value={priceRange[0]}
                  onChange={(event) => setPriceRange([Number(event.target.value), priceRange[1]])}
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
                  onChange={(event) => setPriceRange([priceRange[0], Number(event.target.value)])}
                  min="0"
                />
              </label>
            </div>
          </section>

          <section className="st-filter-section" aria-labelledby="med-filter-rating-title">
            <div className="st-filter-section__heading">
              <h3 id="med-filter-rating-title">Customer rating</h3>
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

          <section className="st-filter-section st-filter-section--brands" aria-labelledby="med-filter-brand-title">
            <div className="st-filter-section__heading">
              <h3 id="med-filter-brand-title">Brand</h3>
              {brandIds.length > 0 ? (
                <span>{brandIds.length} selected</span>
              ) : (
                <span>Choose one or more</span>
              )}
            </div>
            <div className="st-filter-brand-list">
              {brands.length === 0 ? (
                <p className="st-filter-empty">No brands available</p>
              ) : (
                brands.map((brand) => {
                  const selected = brandIds.includes(brand.id);
                  return (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => {
                        const nextIds = selected
                          ? brandIds.filter((id) => id !== brand.id)
                          : [...brandIds, brand.id];
                        const nextNames = brands
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

          <section className="st-filter-stock">
            <label className="st-filter-stock__label">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(event) => setInStockOnly(event.target.checked)}
              />
              <span>
                <strong>In-stock products only</strong>
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
                {minRating > 0 ? <span>Rating: {minRating}★ and up</span> : null}
                {inStockOnly ? <span>In stock only</span> : null}
                {brandIds.length > 0 || brandNames.length > 0 ? (
                  <span>
                    Brand: {brandNames.length ? brandNames.join(', ') : `${brandIds.length} selected`}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </AppShell>
  );
}

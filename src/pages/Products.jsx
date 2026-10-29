import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, SlidersHorizontal, X } from "lucide-react";
import AppShell from "../components/AppShell";
import ProductCard from "../components/ProductCard";
import CartAddButton from "../components/CartAddButton";
import { getProductByVariant } from "../services/productService";
import { getProductStockQty, hasStockInfo } from "../product/stock";
import { getCatalogPrice, getCatalogRating } from "../utils/productSearchUtils";
import {
  formatRupee,
  resolveImageUrl,
} from "../home/catalog";
import { getServiceCategoryId } from "../home/serviceCategories";
import useDashboardCategories from "../hooks/useDashboardCategories";
import useCategoryProducts from "../hooks/useCategoryProducts";
import useProductCategories from "../hooks/useProductCategories";
import { getOrders, normalizeOrdersList } from "../services/orderService";
import { mapOrdersToRecentProducts } from "../profile/map";
import {
  Button,
  EmptyState,
  MediaCard,
  Modal,
  PageBar,
  Rail,
  RailItem,
  RailSkeleton,
  Reveal,
  SearchField,
  searchSuggestions,
  SectionHeader,
} from "../components/ui";
import { CatalogPageSkeleton } from "../components/skeletons";
import { STORE_COPY as T } from "../content/store";
import "../design/pages/store.css";
import "../design/brand.css";
import "../design/product-card-home.css";
import "../design/pages/products.css";

export default function Products() {
  const navigate = useNavigate();
  const { categories: dashboardCategories, loading: homeLoading } =
    useDashboardCategories();
  const productsCategoryId = useMemo(
    () => getServiceCategoryId(dashboardCategories, "products"),
    [dashboardCategories],
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const productFilter = useMemo(() => {
    if (!selectedCategoryId) return {};
    return {
      id: selectedCategoryId,
      ...(productsCategoryId ? { service_category_id: productsCategoryId } : {}),
    };
  }, [productsCategoryId, selectedCategoryId]);
  const { products, loading, loadingMore, refreshing, hasMore, loadMore } =
    useCategoryProducts(productFilter, [], {
      enabled: Boolean(productsCategoryId) || !homeLoading,
    });
  // The service-category filter can legitimately return nothing (the homepage
  // never uses it); fall back to the unfiltered real catalogue in that case.
  const serviceEmpty =
    Boolean(productsCategoryId) &&
    !selectedCategoryId &&
    !loading &&
    products.length === 0;
  const catalogFallback = useCategoryProducts({}, [], { enabled: serviceEmpty });
  const listProducts = serviceEmpty ? catalogFallback.products : products;
  const listLoading = serviceEmpty ? catalogFallback.loading : loading;
  const listHasMore = serviceEmpty ? catalogFallback.hasMore : hasMore;
  const listLoadingMore = serviceEmpty ? catalogFallback.loadingMore : loadingMore;
  const listLoadMore = serviceEmpty ? catalogFallback.loadMore : loadMore;
  const { categories: productCategories, loading: categoriesLoading } =
    useProductCategories(null, productsCategoryId);

  const [recentProducts, setRecentProducts] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Filter & Sort States
  const [sortBy, setSortBy] = useState("relevance");
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [minRating, setMinRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const openCategoryBrowse = (extra = {}) => {
    const query = new URLSearchParams({ mode: "product" });
    if (productsCategoryId) query.set("service", productsCategoryId);
    if (extra.category) query.set("category", extra.category);
    if (extra.name) query.set("name", extra.name);
    navigate(`/products/category?${query.toString()}`);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setOrdersLoading(true);
      try {
        const res = await getOrders({ page: 1, page_size: 5 });
        if (!alive) return;
        setRecentProducts(
          mapOrdersToRecentProducts(normalizeOrdersList(res), 8),
        );
      } catch {
        if (alive) setRecentProducts([]);
      } finally {
        if (alive) setOrdersLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Buy again: the order API carries no stock, so look each variant up with
  // the same product API the detail page uses. Unknown stock => no button.
  const [recentStock, setRecentStock] = useState({});
  useEffect(() => {
    const ids = [...new Set(recentProducts.map((r) => r.variantId).filter(Boolean))];
    if (!ids.length) return undefined;
    let alive = true;
    (async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await getProductByVariant(id);
            const raw = res?.data ?? res;
            const product = Array.isArray(raw)
              ? raw[0]
              : Array.isArray(raw?.results)
                ? raw.results[0]
                : raw;
            if (!product || product.success === false) return [id, null];
            const variants = Array.isArray(product.variants) ? product.variants : [];
            const variant =
              variants.find(
                (v) => String(v?.id) === id || String(v?.variant_id) === id,
              ) || product;
            return [id, { ...variant, prescription_required: variant.prescription_required ?? product.prescription_required }];
          } catch {
            return [id, null];
          }
        }),
      );
      if (alive) setRecentStock(Object.fromEntries(entries));
    })();
    return () => {
      alive = false;
    };
  }, [recentProducts]);

  // Apply client-side filters and sorting
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = [...listProducts];

    // Filter by price range (items without a numeric price are kept)
    filtered = filtered.filter((product) => {
      const price = getCatalogPrice(product);
      if (!Number.isFinite(price)) return true;
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Filter by rating
    if (minRating > 0) {
      filtered = filtered.filter((product) => getCatalogRating(product) >= minRating);
    }

    // Filter by stock
    if (inStockOnly) {
      filtered = filtered.filter((product) => {
        if (product.out_of_stock === true) return false;
        const qty = getProductStockQty(product);
        if (qty !== null) return qty > 0;
        const stock = Number(product.stock || product.in_stock || 0);
        return stock > 0;
      });
    }

    // Sort products
    filtered.sort((a, b) => {
      const priceA = getCatalogPrice(a);
      const priceB = getCatalogPrice(b);
      const ratingA = getCatalogRating(a);
      const ratingB = getCatalogRating(b);

      switch (sortBy) {
        case "price_low":
          return priceA - priceB;
        case "price_high":
          return priceB - priceA;
        case "rating":
          return ratingB - ratingA;
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "relevance":
        default:
          return 0;
      }
    });

    return filtered;
  }, [listProducts, priceRange, minRating, inStockOnly, sortBy]);

  const hasActiveFilters =
    priceRange[0] !== 0 ||
    priceRange[1] !== 10000 ||
    minRating > 0 ||
    inStockOnly ||
    sortBy !== "relevance" ||
    Boolean(selectedCategoryId);

  const clearFilters = () => {
    setPriceRange([0, 10000]);
    setMinRating(0);
    setInStockOnly(false);
    setSortBy("relevance");
    setSelectedCategoryId("");
  };

  const showSkeleton = listLoading && listProducts.length === 0;
  const heroRef = useRef(null);

  // "/" focuses the store search, like modern storefronts.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      const input = heroRef.current?.querySelector(".am-search__input");
      if (!input) return;
      event.preventDefault();
      input.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goSearch = (value) => {
    const query = String(value || search || "").trim();
    navigate(
      `/search?mode=product${query ? `&q=${encodeURIComponent(query)}` : ""}`,
    );
  };

  const placeBar = showSkeleton ? 'top' : 'all';
  const searchBar = (
      <PageBar className="am-page-bar--slot" ref={heroRef} id="st-products-title" title={T.productsTitle}>
        <SearchField
          value={search}
          onChange={setSearch}
          onSubmit={goSearch}
          placeholder={T.productsSearch}
          label={T.productsSearch}
          includeRecent
          suggestions={searchSuggestions(productCategories, listProducts)}
        />
      </PageBar>
  );

  return (
    <AppShell tab="products">
      <div className="st-page st-page--products">

        {showSkeleton ? (
          <CatalogPageSkeleton count={6} label="Loading products" />
        ) : (
          <>
            <section className="st-section st-panel" aria-labelledby="st-all-title">
              <SectionHeader
                id="st-all-title"
                title={T.allProducts}
                description={T.allProductsText}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openCategoryBrowse({ name: "All Products" })}
                    trailingIcon={<ArrowRight size={16} aria-hidden />}
                  >
                    {T.viewAll}
                  </Button>
                }
              />

              <div className="st-catalog">
                <nav className="st-cat-col" aria-labelledby="st-cats-title">
                  <p className="st-cat-col__eyebrow">Filter</p>
                  <h3 id="st-cats-title">{T.shopByCategory}</h3>
                  <ul className="st-cat-filter">
                    <li>
                      <button
                        type="button"
                        className={!selectedCategoryId ? "is-on" : ""}
                        aria-pressed={!selectedCategoryId}
                        onClick={() => setSelectedCategoryId("")}
                      >
                        <span className="st-cat-filter__mark" aria-hidden>
                          All
                        </span>
                        <span className="st-cat-filter__copy">
                          <strong>All products</strong>
                          <em>Full catalogue</em>
                        </span>
                      </button>
                    </li>
                    {productCategories.map((item) => {
                      const image = resolveImageUrl(item);
                      const on = selectedCategoryId === item.id;
                      const initial = String(item.name || "?").trim().charAt(0).toUpperCase();
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={on ? "is-on" : ""}
                            aria-pressed={on}
                            onClick={() => setSelectedCategoryId(item.id)}
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
              {/* Filter & Sort Controls */}
              <div className="st-controls">
                <div className="st-controls__info">
                  <span>
                    {filteredAndSortedProducts.length}{" "}
                    {filteredAndSortedProducts.length === 1
                      ? "product"
                      : "products"}
                  </span>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      leadingIcon={<X size={14} />}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
                {placeBar === 'all' ? searchBar : null}
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

              {filteredAndSortedProducts.length === 0 ? (
                <EmptyState
                  title={
                    hasActiveFilters
                      ? "No products match filters"
                      : T.noProducts
                  }
                  description={
                    hasActiveFilters
                      ? "Try adjusting your filters"
                      : T.noProductsText
                  }
                  action={
                    hasActiveFilters && (
                      <Button variant="secondary" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    )
                  }
                />
              ) : (
                <ul className="am-product-grid">
                  {filteredAndSortedProducts.map((item) => (
                    <li key={item.variant_id || item.id}>
                      <ProductCard item={item} cartButton />
                    </li>
                  ))}
                </ul>
              )}
              {listHasMore ? (
                <div className="st-more">
                  <Button
                    variant="secondary"
                    loading={listLoadingMore}
                    onClick={listLoadMore}
                  >
                    {listLoadingMore ? T.loadingMore : T.loadMore}
                  </Button>
                </div>
              ) : null}
              {refreshing ? <p className="am-sr-only">{T.refreshing}</p> : null}
                </div>
              </div>
            </section>

            {ordersLoading || recentProducts.length > 0 ? (
              <Reveal
                as="section"
                className="st-section st-panel"
                aria-labelledby="st-recent-title"
              >
                <SectionHeader
                  id="st-recent-title"
                  title={T.recentOrders}
                  description={T.recentOrdersText}
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/profile/orders")}
                      trailingIcon={<ArrowRight size={16} aria-hidden />}
                    >
                      {T.viewHistory}
                    </Button>
                  }
                />
                {ordersLoading && recentProducts.length === 0 ? (
                  <RailSkeleton count={4} size="product" />
                ) : (
                  <Rail label={T.recentOrders} className="st-recent-rail">
                    {recentProducts.map((item) => (
                      <RailItem
                        key={`${item.id}-${item.variantId}`}
                        size="product"
                      >
                        <div className="st-recent">
                          <MediaCard
                            image={item.image}
                            title={item.name}
                            subtitle={
                              item.lastOrdered
                                ? `Ordered ${item.lastOrdered}`
                                : "Recent order"
                            }
                            onClick={() =>
                              item.variantId &&
                              navigate(`/products/${item.variantId}`)
                            }
                          />
                          <div className="st-recent__foot">
                            {item.price ? (
                              <span className="st-recent__price">
                                {formatRupee(item.price)}
                              </span>
                            ) : null}
                            {hasStockInfo(recentStock[item.variantId]) ? (
                              <CartAddButton
                                className="am-cart-btn--sm"
                                item={{
                                  ...recentStock[item.variantId],
                                  variant_id: item.variantId,
                                  name: item.name,
                                }}
                              />
                            ) : null}
                          </div>
                        </div>
                      </RailItem>
                    ))}
                  </Rail>
                )}
              </Reveal>
            ) : null}

          </>
        )}
      </div>

      {/* Filter Modal */}
      <Modal
        open={showFilters}
        onClose={() => setShowFilters(false)}
        title="Filter Products"
        size="md"
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
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Price Range */}
          <div>
            <h3
              style={{
                marginBottom: "12px",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              Price Range
            </h3>
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <input
                type="number"
                value={priceRange[0]}
                onChange={(e) =>
                  setPriceRange([Number(e.target.value), priceRange[1]])
                }
                min="0"
                placeholder="Min"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "1px solid var(--am-border-color)",
                  borderRadius: "var(--am-radius-md)",
                  fontSize: "14px",
                }}
              />
              <span>to</span>
              <input
                type="number"
                value={priceRange[1]}
                onChange={(e) =>
                  setPriceRange([priceRange[0], Number(e.target.value)])
                }
                min="0"
                placeholder="Max"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "1px solid var(--am-border-color)",
                  borderRadius: "var(--am-radius-md)",
                  fontSize: "14px",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "var(--am-text-muted)",
              }}
            >
              <span>₹{priceRange[0]}</span>
              <span>₹{priceRange[1]}</span>
            </div>
          </div>

          {/* Rating Filter */}
          <div>
            <h3
              style={{
                marginBottom: "12px",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              Minimum Rating
            </h3>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {[0, 3, 3.5, 4, 4.5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setMinRating(rating)}
                  style={{
                    padding: "8px 16px",
                    border: `1px solid ${minRating === rating ? "var(--am-accent)" : "var(--am-border-color)"}`,
                    background:
                      minRating === rating
                        ? "var(--am-accent-bg)"
                        : "transparent",
                    borderRadius: "var(--am-radius-md)",
                    fontSize: "14px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {rating === 0 ? "All" : `${rating}★ & up`}
                </button>
              ))}
            </div>
          </div>

          {/* In Stock Filter */}
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <span style={{ fontSize: "14px", fontWeight: "500" }}>
                Show in-stock products only
              </span>
            </label>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div
              style={{
                padding: "12px",
                background: "var(--am-bg-subtle)",
                borderRadius: "var(--am-radius-md)",
                fontSize: "12px",
                color: "var(--am-text-muted)",
              }}
            >
              <strong style={{ display: "block", marginBottom: "4px" }}>
                Active Filters:
              </strong>
              {priceRange[0] !== 0 || priceRange[1] !== 10000 ? (
                <div>
                  Price: ₹{priceRange[0]} - ₹{priceRange[1]}
                </div>
              ) : null}
              {minRating > 0 && <div>Rating: {minRating}★ and above</div>}
              {inStockOnly && <div>In stock only</div>}
            </div>
          )}
        </div>
      </Modal>
    </AppShell>
  );
}

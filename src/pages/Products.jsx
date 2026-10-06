import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ShoppingBag, SlidersHorizontal, X } from "lucide-react";
import AppShell from "../components/AppShell";
import BannerCarousel from "../components/BannerCarousel";
import ProductCard from "../components/ProductCard";
import { getBanners } from "../services/bannerService";
import {
  formatRupee,
  getBannerImageUri,
  resolveImageUrl,
} from "../home/catalog";
import { getServiceCategoryId } from "../home/serviceCategories";
import useDashboardCategories from "../hooks/useDashboardCategories";
import useCategoryProducts from "../hooks/useCategoryProducts";
import useProductCategories from "../hooks/useProductCategories";
import { useCart } from "../hooks/useCart";
import { getOrders, normalizeOrdersList } from "../services/orderService";
import { mapOrdersToRecentProducts } from "../profile/map";
import {
  Button,
  Disclaimer,
  EmptyState,
  MediaCard,
  Modal,
  Rail,
  RailItem,
  RailSkeleton,
  Reveal,
  SearchField,
  SectionHeader,
  SkeletonGrid,
  Tile,
  TileGrid,
} from "../components/ui";
import { STORE_COPY as T } from "../content/store";
import "../design/pages/store.css";

export default function Products() {
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { categories: dashboardCategories, loading: homeLoading } =
    useDashboardCategories();
  const productsCategoryId = useMemo(
    () => getServiceCategoryId(dashboardCategories, "products"),
    [dashboardCategories],
  );
  const productFilter = useMemo(
    () =>
      productsCategoryId ? { service_category_id: productsCategoryId } : {},
    [productsCategoryId],
  );
  const { products, loading, loadingMore, refreshing, hasMore, loadMore } =
    useCategoryProducts(productFilter, [], {
      enabled: Boolean(productsCategoryId) || !homeLoading,
    });
  const { categories: productCategories, loading: categoriesLoading } =
    useProductCategories(null, productsCategoryId);

  const [banners, setBanners] = useState([]);
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
      const res = await getBanners("product", productsCategoryId);
      if (!alive) return;
      setBanners(
        (res?.data || [])
          .map((item) => ({ ...item, image: getBannerImageUri(item) }))
          .filter((item) => item.image),
      );
    })();
    return () => {
      alive = false;
    };
  }, [productsCategoryId]);

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

  // Apply client-side filters and sorting
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = [...products];

    // Filter by price range
    filtered = filtered.filter((product) => {
      const price = Number(product.price || product.selling_price || 0);
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Filter by rating
    if (minRating > 0) {
      filtered = filtered.filter((product) => {
        const rating = Number(product.rating || product.average_rating || 0);
        return rating >= minRating;
      });
    }

    // Filter by stock
    if (inStockOnly) {
      filtered = filtered.filter((product) => {
        const stock = Number(product.stock || product.in_stock || 0);
        return stock > 0;
      });
    }

    // Sort products
    filtered.sort((a, b) => {
      const priceA = Number(a.price || a.selling_price || 0);
      const priceB = Number(b.price || b.selling_price || 0);
      const ratingA = Number(a.rating || a.average_rating || 0);
      const ratingB = Number(b.rating || b.average_rating || 0);

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
  }, [products, priceRange, minRating, inStockOnly, sortBy]);

  const hasActiveFilters =
    priceRange[0] !== 0 ||
    priceRange[1] !== 10000 ||
    minRating > 0 ||
    inStockOnly ||
    sortBy !== "relevance";

  const clearFilters = () => {
    setPriceRange([0, 10000]);
    setMinRating(0);
    setInStockOnly(false);
    setSortBy("relevance");
  };

  const showSkeleton = loading && products.length === 0;

  const goSearch = (value) => {
    const query = String(value || search || "").trim();
    navigate(
      `/search?mode=product${query ? `&q=${encodeURIComponent(query)}` : ""}`,
    );
  };

  return (
    <AppShell tab="products">
      <div className="st-page">
        <section className="st-hero" aria-labelledby="st-products-title">
          <div className="st-hero__copy">
            <p className="am-eyebrow">Store</p>
            <h1 id="st-products-title">{T.productsTitle}</h1>
            <p className="st-hero__lede">{T.productsLede}</p>
          </div>
          <div className="st-hero__row">
            <SearchField
              value={search}
              onChange={setSearch}
              onSubmit={goSearch}
              placeholder={T.productsSearch}
              label={T.productsSearch}
            />
            <Button
              variant="secondary"
              onClick={() => navigate("/cart")}
              leadingIcon={<ShoppingBag size={18} aria-hidden />}
            >
              {T.cart}
              {itemCount ? ` (${itemCount})` : ""}
            </Button>
          </div>
        </section>

        {showSkeleton ? (
          <SkeletonGrid
            count={6}
            className="am-product-grid"
            label="Loading products"
          />
        ) : (
          <>
            <BannerCarousel items={banners} interval={4000} />

            <Reveal
              as="section"
              className="st-section"
              aria-labelledby="st-cats-title"
            >
              <SectionHeader
                id="st-cats-title"
                title={T.shopByCategory}
                description={T.shopByCategoryText}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      openCategoryBrowse({ name: "Shop by Category" })
                    }
                    trailingIcon={<ArrowRight size={16} aria-hidden />}
                  >
                    {T.viewAll}
                  </Button>
                }
              />
              {categoriesLoading && productCategories.length === 0 ? (
                <RailSkeleton count={6} variant="product" />
              ) : productCategories.length > 0 ? (
                <TileGrid label={T.shopByCategory}>
                  {productCategories.map((item) => (
                    <Tile
                      key={item.id}
                      image={resolveImageUrl(item)}
                      label={item.name}
                      onClick={() =>
                        openCategoryBrowse({
                          category: item.id,
                          name: item.name,
                        })
                      }
                    />
                  ))}
                </TileGrid>
              ) : (
                <EmptyState
                  compact
                  title={T.shopByCategory}
                  description="Tap View all to browse categories"
                  action={
                    <Button
                      variant="secondary"
                      onClick={() =>
                        openCategoryBrowse({ name: "Shop by Category" })
                      }
                    >
                      {T.viewAll}
                    </Button>
                  }
                />
              )}
            </Reveal>

            {ordersLoading || recentProducts.length > 0 ? (
              <Reveal
                as="section"
                className="st-section"
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
                  <RailSkeleton count={4} size="wide" />
                ) : (
                  <Rail label={T.recentOrders}>
                    {recentProducts.map((item) => (
                      <RailItem
                        key={`${item.id}-${item.variantId}`}
                        size="wide"
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
                          {item.price ? (
                            <span className="st-recent__price">
                              {formatRupee(item.price)}
                            </span>
                          ) : null}
                        </div>
                      </RailItem>
                    ))}
                  </Rail>
                )}
              </Reveal>
            ) : null}

            <section className="st-section" aria-labelledby="st-all-title">
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

              <SectionHeader
                id="st-all-title"
                title={T.allProducts}
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
                      <ProductCard item={item} />
                    </li>
                  ))}
                </ul>
              )}
              {hasMore ? (
                <div className="st-more">
                  <Button
                    variant="secondary"
                    loading={loadingMore}
                    onClick={loadMore}
                  >
                    {loadingMore ? T.loadingMore : T.loadMore}
                  </Button>
                </div>
              ) : null}
              {refreshing ? <p className="am-sr-only">{T.refreshing}</p> : null}
            </section>

            <footer className="st-foot">
              <Disclaimer variant="banner" />
            </footer>
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

import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import ProductCard from "../components/ProductCard";
import ProductSearchFilterBar from "../components/ProductSearchFilterBar";
import EnhancedSearchField from "../components/EnhancedSearchField";
import useCategoryProducts from "../hooks/useCategoryProducts";
import useDashboardCategories from "../hooks/useDashboardCategories";
import useBrands from "../hooks/useBrands";
import { getServiceCategoryId } from "../home/serviceCategories";
import { useGlobalSearch } from "../hooks/useGlobalSearch";
import {
  applyProductFilters,
  brandOptionsFromProducts,
} from "../utils/productSearchUtils";

export default function ProductSearch() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get("mode") || "all";
  const [q, setQ] = useState(params.get("q") || "");
  const [submitted, setSubmitted] = useState(q);
  const [sortBy, setSortBy] = useState("relevance");
  const [brandIds, setBrandIds] = useState([]);
  const [brandNames, setBrandNames] = useState([]);
  const [priceRange, setPriceRange] = useState("all");
  const { addToHistory } = useGlobalSearch();
  const { categories, loading: homeLoading } = useDashboardCategories();
  const { brands: brandRecords } = useBrands();
  const serviceCategoryId = useMemo(() => {
    if (mode === "health") return getServiceCategoryId(categories, "medicine");
    if (mode === "product") return getServiceCategoryId(categories, "products");
    return undefined;
  }, [categories, mode]);

  const filter = useMemo(() => {
    const search = submitted.trim();

    return {
      search,
      service_category_id: search ? undefined : serviceCategoryId,
    };
  }, [submitted, serviceCategoryId]);

  const { products, loading, loadingMore, hasMore, loadMore } =
    useCategoryProducts(filter, [], { enabled: !homeLoading });

  const brandOptions = useMemo(() => {
    if (brandRecords.length > 0) return brandRecords;
    return brandOptionsFromProducts(products);
  }, [brandRecords, products]);

  const filteredProducts = useMemo(
    () =>
      applyProductFilters({
        products,
        sortBy,
        brandIds: brandIds.length > 0 ? brandIds : null,
        brandNames: brandNames.length > 0 ? brandNames : null,
        priceRange,
      }),
    [products, sortBy, brandIds, brandNames, priceRange],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (sortBy !== "relevance") count += 1;
    if (brandIds.length > 0 || brandNames.length > 0) count += 1;
    if (priceRange !== "all") count += 1;
    return count;
  }, [sortBy, brandIds, brandNames, priceRange]);

  const clearFilters = () => {
    setSortBy("relevance");
    setBrandIds([]);
    setBrandNames([]);
    setPriceRange("all");
  };

  const onSubmit = (query) => {
    const next = (query ?? q).trim();

    setQ(next);
    setSubmitted(next);

    if (next) {
      addToHistory(next);

      navigate(
        `/search?mode=${encodeURIComponent(mode)}&q=${encodeURIComponent(next)}`,
        { replace: true },
      );
    } else {
      navigate(`/search?mode=${encodeURIComponent(mode)}`, {
        replace: true,
      });
    }
  };

  const handleSelect = (query) => {
    const next = String(query ?? "").trim();

    setQ(next);
    setSubmitted(next);

    if (next) {
      addToHistory(next);

      navigate(
        `/search?mode=${encodeURIComponent(mode)}&q=${encodeURIComponent(next)}`,
        { replace: true },
      );
    } else {
      navigate(`/search?mode=${encodeURIComponent(mode)}`, {
        replace: true,
      });
    }
  };

  const handleSearchChange = (value) => {
    setQ(value);

    if (!value.trim()) {
      // Immediately restore the unsearched catalog.
      setSubmitted("");

      // Keep the URL in sync when the search is cleared.
      navigate(`/search?mode=${encodeURIComponent(mode)}`, {
        replace: true,
      });
    }
  };

  useEffect(() => {
    const urlQuery = params.get("q") || "";
    setQ(urlQuery);
    setSubmitted(urlQuery);
  }, [params]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSubmitted(q.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [q]);

  return (
    <AppShell tab="products">
      <section className="catalog-page store-page search-page">
        <header className="catalog-head store-head">
          <div>
            <button
              type="button"
              className="text-back"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>
            <h1>Search</h1>
            <p>Doctors, medicines and products</p>
          </div>
        </header>
        <div className="search-enhanced-wrapper">
          <EnhancedSearchField
            value={q}
            onChange={handleSearchChange}
            onSubmit={onSubmit}
            onSelect={handleSelect}
            placeholder="Search doctors, medicines and products..."
            showHistory={true}
            showSuggestions={true}
            autoFocus={!submitted}
          />
        </div>
        {products.length > 0 || activeFilterCount > 0 ? (
          <ProductSearchFilterBar
            sortBy={sortBy}
            onSortChange={setSortBy}
            brandIds={brandIds}
            brandNames={brandNames}
            onBrandChange={(selected) => {
              setBrandIds(selected.map((brand) => brand.id));
              setBrandNames(selected.map((brand) => brand.name));
            }}
            priceRange={priceRange}
            onPriceRangeChange={setPriceRange}
            brands={brandOptions}
            activeFilterCount={activeFilterCount}
            onClearFilters={clearFilters}
          />
        ) : null}
        {loading && products.length === 0 ? (
          <p className="muted">Searching…</p>
        ) : filteredProducts.length === 0 ? (
          <p className="empty-copy">
            {activeFilterCount > 0
              ? "No products match these filters"
              : "No products found"}
          </p>
        ) : (
          <div className="catalog-grid">
            {filteredProducts.map((item) => (
              <ProductCard key={item.variant_id || item.id} item={item} />
            ))}
          </div>
        )}
        {hasMore ? (
          <div className="load-more-wrap">
            <button type="button" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

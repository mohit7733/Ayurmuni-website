import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getProducts,
  hasMoreProductPages,
  PRODUCT_PAGE_SIZE,
} from "../services/productService";
import { mapCatalogProductItem, normalizeApiList } from "../home/catalog";

const toQuery = (filter, page, pageSize) => {
  const query = { page_size: pageSize, page };
  if (filter.search?.trim()) {
    query.search = filter.search.trim();
    return query;
  }
  [
    "id",
    "product_subcategory_id",
    "health_category_id",
    "health_disease_id",
    "brand_name_id",
    "service_category_id",
  ].forEach((key) => {
    if (filter[key]) query[key] = filter[key];
  });
  return query;
};

export default function useCategoryProducts(
  filter,
  fallbackProducts = [],
  options = {},
) {
  const enabled = options.enabled !== false;
  const pageSize = options.pageSize ?? PRODUCT_PAGE_SIZE;
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const requestIdRef = useRef(0);
  const fallbackRef = useRef(fallbackProducts);
  const loadingLockRef = useRef(false);
  const productsLengthRef = useRef(0);

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        id: filter.id ?? "",
        product_subcategory_id: filter.product_subcategory_id ?? "",
        health_category_id: filter.health_category_id ?? "",
        health_disease_id: filter.health_disease_id ?? "",
        brand_name_id: filter.brand_name_id ?? "",
        service_category_id: filter.service_category_id ?? "",
        search: filter.search ?? "",
        pageSize,
      }),
    [
      filter.id,
      filter.product_subcategory_id,
      filter.health_category_id,
      filter.health_disease_id,
      filter.brand_name_id,
      filter.service_category_id,
      filter.search,
      pageSize,
    ],
  );

  useEffect(() => {
    fallbackRef.current = fallbackProducts;
  }, [fallbackProducts]);

  useEffect(() => {
    productsLengthRef.current = products.length;
  }, [products.length]);

  const fetchPage = useCallback(
    async (pageNumber, opts = {}) => {
      const reqId = ++requestIdRef.current;
      const append = opts.append === true;
      try {
        if (append) setLoadingMore(true);
        else if (!opts.refresh) {
          setLoading((prev) => (productsLengthRef.current > 0 ? prev : true));
        }

        const parsed = JSON.parse(filterKey);
        const size = parsed.pageSize ?? PRODUCT_PAGE_SIZE;
        const searchOnly = Boolean(parsed.search?.trim());
        const hasFilter = Boolean(
          searchOnly ||
          parsed.id ||
          parsed.product_subcategory_id ||
          parsed.health_category_id ||
          parsed.health_disease_id ||
          parsed.brand_name_id ||
          parsed.service_category_id,
        );

        const response = await getProducts(toQuery(parsed, pageNumber, size));
        if (reqId !== requestIdRef.current) return;

        const apiResults = normalizeApiList(response)
          .map(mapCatalogProductItem)
          .filter(Boolean);
        const more = hasMoreProductPages(response, apiResults.length, size);
        setHasMore(more);
        setPage(pageNumber);

        if (apiResults.length > 0) {
          setProducts((prev) => {
            if (!append) return apiResults;
            const seen = new Set(
              prev.map((p) => String(p.variant_id ?? p.id ?? "")),
            );
            const merged = [...prev];
            apiResults.forEach((item) => {
              const key = String(item.variant_id ?? item.id ?? "");
              if (!key || seen.has(key)) return;
              seen.add(key);
              merged.push(item);
            });
            return merged;
          });
        } else if (!append) {
          const fallback = Array.isArray(fallbackRef.current)
            ? fallbackRef.current
            : [];
          const serviceOnly =
            Boolean(parsed.service_category_id) &&
            !searchOnly &&
            !parsed.id &&
            !parsed.product_subcategory_id &&
            !parsed.health_category_id &&
            !parsed.health_disease_id &&
            !parsed.brand_name_id;
          if (!hasFilter || (serviceOnly && fallback.length > 0)) {
            setProducts(fallback);
          } else {
            setProducts([]);
          }
          setHasMore(false);
        } else {
          setHasMore(false);
        }
      } catch {
        if (reqId !== requestIdRef.current) return;

        if (!append) {
          const fallback = Array.isArray(fallbackRef.current)
            ? fallbackRef.current
            : [];

          const parsed = JSON.parse(filterKey);
          const isSearching = Boolean(parsed.search?.trim());

          // Never show unfiltered fallback items for a failed search.
          setProducts(isSearching ? [] : fallback);
          productsLengthRef.current = isSearching ? 0 : fallback.length;
        }

        setHasMore(false);
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
          loadingLockRef.current = false;
        }
      }
    },
    [filterKey],
  );

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1;
      setLoading(true);
      setLoadingMore(false);
      loadingLockRef.current = false;
      return;
    }

    // Reset results and pagination for every new filter/query.
    setProducts([]);
    productsLengthRef.current = 0;
    setPage(1);
    setHasMore(true);
    setLoading(true);
    setLoadingMore(false);
    setRefreshing(false);
    loadingLockRef.current = false;

    fetchPage(1);

    // Invalidate any request belonging to the previous query.
    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchPage, enabled]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    setRefreshing(true);
    setHasMore(true);
    fetchPage(1, { refresh: true });
  }, [enabled, fetchPage]);

  const loadMore = useCallback(() => {
    if (
      !enabled ||
      loading ||
      loadingMore ||
      refreshing ||
      !hasMore ||
      loadingLockRef.current
    ) {
      return;
    }
    loadingLockRef.current = true;
    fetchPage(page + 1, { append: true });
  }, [enabled, fetchPage, hasMore, loading, loadingMore, page, refreshing]);

  return {
    products,
    setProducts,
    loading: loading || !enabled,
    loadingMore,
    refreshing,
    hasMore,
    refresh,
    loadMore,
  };
}

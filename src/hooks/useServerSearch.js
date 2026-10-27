/** Port of the app's hooks/useGlobalSearch.ts (useGlobalSearch + useRecentSearches). */
import { useCallback, useEffect, useRef, useState } from "react";
import { createLatestRequest } from "../utils/latestRequest";
import {
  countGlobalSearchHits,
  emptyGrouped,
  getRecentSearches,
  globalSearch,
  mergeGlobalSearchGroups,
  DEFAULT_SEARCH_TYPES
} from "../services/globalSearchService";
const useGlobalSearch = (query, enabled = true, options) => {
  const types = options?.types || DEFAULT_SEARCH_TYPES;
  const pageSize = options?.pageSize || 10;
  const saveRecent = options?.saveRecent === true;
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(emptyGrouped());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const requestIdRef = useRef(0);
  // Aborts the previous search when the query changes or a newer page/refresh starts.
  const gateRef = useRef(null);
  if (!gateRef.current) gateRef.current = createLatestRequest();
  const load = useCallback(
    async (opts) => {
      const q = String(query || "").trim();
      if (!enabled || !q) {
        gateRef.current.cancel();
        setResults(emptyGrouped());
        setError(null);
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        setPage(1);
        setHasMore(false);
        return;
      }
      const nextPage = opts?.page || 1;
      const reqId = ++requestIdRef.current;
      const { signal } = gateRef.current.begin();
      try {
        if (opts?.isRefresh) setRefreshing(true);
        else if (opts?.append) setLoadingMore(true);
        else setLoading(true);
        setError(null);
        const { grouped, hasMore: more } = await globalSearch({
          search: q,
          types,
          include_top: true,
          exact_count: false,
          // Typing/browse recommendations never save; commit via saveRecent override
          save_recent: opts?.saveRecent !== void 0 ? opts.saveRecent : saveRecent,
          page: nextPage,
          page_size: pageSize
        }, { signal, ...(opts?.isRefresh ? { cache: false } : {}) });
        if (reqId !== requestIdRef.current || signal?.aborted) return;
        setResults(
          (prev) => opts?.append ? mergeGlobalSearchGroups(prev, grouped) : grouped
        );
        setPage(nextPage);
        setHasMore(more);
      } catch (e) {
        if (reqId !== requestIdRef.current) return;
        setError(e?.message || "Unable to search");
        if (!opts?.append) setResults(emptyGrouped());
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [query, enabled, types, pageSize, saveRecent]
  );
  useEffect(() => {
    load({ page: 1, saveRecent: false });
  }, [load]);
  useEffect(() => () => gateRef.current?.cancel(), []);
  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore || refreshing) return;
    load({ page: page + 1, append: true, saveRecent: false });
  }, [hasMore, loading, loadingMore, refreshing, load, page]);
  const commitRecentSearch = useCallback(
    async (overrideQuery) => {
      const q = String(overrideQuery || query || "").trim();
      if (!q) return;
      try {
        await globalSearch({
          search: q,
          types,
          include_top: true,
          exact_count: false,
          save_recent: true,
          page: 1,
          page_size: pageSize
        });
      } catch {
      }
    },
    [query, types, pageSize]
  );
  return {
    loading,
    loadingMore,
    refreshing,
    error,
    results,
    total: countGlobalSearchHits(results),
    hasMore,
    refresh: () => load({ isRefresh: true, page: 1, saveRecent: false }),
    reload: () => load({ page: 1, saveRecent: false }),
    loadMore,
    commitRecentSearch
  };
};
const useRecentSearches = (enabled = true) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);
  const load = useCallback(async () => {
    if (!enabled) {
      return;
    }
    const reqId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const list = await getRecentSearches(10);
      if (reqId !== requestIdRef.current) return;
      setItems(list);
    } catch (e) {
      if (reqId !== requestIdRef.current) return;
      setError(e?.message || "Unable to load recent searches");
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, [enabled]);
  useEffect(() => {
    load();
  }, [load]);
  const clearAll = useCallback(async () => {
    const {
      clearAllRecentSearches
    } = await import("../services/globalSearchService");
    await clearAllRecentSearches();
    setItems([]);
  }, []);
  const removeOne = useCallback(
    async (opts) => {
      const {
        deleteRecentSearches
      } = await import("../services/globalSearchService");
      await deleteRecentSearches(opts);
      setItems(
        (prev) => prev.filter((item) => {
          if (opts.id && item.id === opts.id) return false;
          if (opts.query && item.query.toLowerCase() === opts.query.toLowerCase()) {
            return false;
          }
          return true;
        })
      );
    },
    []
  );
  return {
    loading,
    items,
    error,
    refresh: load,
    clearAll,
    removeOne
  };
};
export {
  useGlobalSearch,
  useRecentSearches
};

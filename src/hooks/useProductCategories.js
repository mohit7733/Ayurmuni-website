import { useCallback, useEffect, useRef, useState } from 'react';
import { getProductCategories } from '../services/productService';
import { mapProductCategory, normalizeApiList } from '../home/catalog';

const mapList = (response) =>
  normalizeApiList(response)
    .map(mapProductCategory)
    .filter((item) => item.id);

export default function useProductCategories(parentId, serviceCategoryId, enabled = true, fallback = true) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const loadCategories = useCallback(
    async (opts = {}) => {
      const reqId = ++requestIdRef.current;
      const parent = parentId ? String(parentId) : '';
      try {
        if (!opts.refresh) setLoading(true);
        let response = await getProductCategories(parent || undefined, serviceCategoryId);
        if (reqId !== requestIdRef.current) return;
        if (response?.success === false) response = null;

        let list = mapList(response);

        if (!list.length && !parent && serviceCategoryId && fallback) {
          const fallbackRes = await getProductCategories(undefined, undefined);
          if (reqId !== requestIdRef.current) return;
          list = mapList(fallbackRes);
        }

        if (parent) {
          list = list.filter((item) => {
            if (item.id === parent) return false;
            const itemParent = String(item.parent_id || '');
            if (itemParent) return itemParent === parent;
            return true;
          });
        }

        setCategories(list);
      } catch {
        if (reqId !== requestIdRef.current) return;
        setCategories([]);
      } finally {
        if (reqId === requestIdRef.current) setLoading(false);
      }
    },
    [parentId, serviceCategoryId, fallback],
  );

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1;
      setCategories([]);
      setLoading(false);
      return;
    }
    loadCategories();
  }, [loadCategories, enabled]);

  return { categories, loading, refresh: () => loadCategories({ refresh: true }) };
}

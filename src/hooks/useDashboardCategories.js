import { useEffect, useState } from 'react';
import { getHomeCategory } from '../services/homeService';
import { normalizeServiceCategories } from '../home/serviceCategories';

export default function useDashboardCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getHomeCategory();
        if (!alive) return;
        const list = normalizeServiceCategories(res?.data ?? res)
          .map((item) => ({
            ...item,
            id: String(item?.id ?? item?.service_category_id ?? ''),
            name: String(item?.name ?? item?.category_name ?? item?.title ?? ''),
          }))
          .filter((item) => item.id);
        setCategories(list);
      } catch {
        if (alive) setCategories([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { categories, loading };
}

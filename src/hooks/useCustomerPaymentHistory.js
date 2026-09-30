import { useCallback, useEffect, useRef, useState } from 'react';
import { getCustomerPaymentHistory } from '../services/orderService';

const PAGE_SIZE = 20;

const readPage = (res) => {
  const data = res?.data;
  if (Array.isArray(data)) return { list: data, hasNext: false };
  const list = Array.isArray(data?.results) ? data.results : [];
  return { list, hasNext: Boolean(data?.next) };
};

export default function useCustomerPaymentHistory(filters, options = {}) {
  const enabled = options.enabled !== false;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  const pageRef = useRef(1);
  const busyRef = useRef(false);
  const requestIdRef = useRef(0);

  const type = filters?.type ?? null;
  const entryType = filters?.entry_type ?? null;
  const dateFrom = filters?.date_from ?? null;
  const dateTo = filters?.date_to ?? null;

  const fetchPage = useCallback(
    async (page, mode) => {
      if (!enabled) return;
      if (mode === 'more' && busyRef.current) return;
      busyRef.current = true;
      const requestId = ++requestIdRef.current;

      if (mode === 'initial') setLoading(true);
      if (mode === 'more') setLoadingMore(true);
      setError('');

      try {
        const res = await getCustomerPaymentHistory({
          type,
          entry_type: entryType,
          date_from: dateFrom,
          date_to: dateTo,
          page,
          page_size: PAGE_SIZE,
        });
        if (requestId !== requestIdRef.current) return;

        const { list, hasNext } = readPage(res);
        setItems((prev) => (mode === 'more' ? [...prev, ...list] : list));
        setHasMore(hasNext);
        pageRef.current = page;
      } catch (e) {
        if (requestId !== requestIdRef.current) return;
        setError(e?.message || 'Failed to load payment history');
        if (mode !== 'more') {
          setItems([]);
          setHasMore(false);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
          busyRef.current = false;
        }
      }
    },
    [enabled, type, entryType, dateFrom, dateTo],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    fetchPage(1, 'initial');
    return undefined;
  }, [fetchPage, enabled]);

  const loadMore = useCallback(() => {
    if (!hasMore || busyRef.current) return;
    fetchPage(pageRef.current + 1, 'more');
  }, [hasMore, fetchPage]);

  return { items, loading, loadingMore, hasMore, error, loadMore };
}

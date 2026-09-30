import { useCallback, useEffect, useState } from 'react';
import { isLikelyId, mapNotification } from '../notifications/utils';
import { getNotification, manageNotification } from '../services/notificationService';

let unreadCountListeners = new Set();

export const publishUnreadCount = (count) => {
  unreadCountListeners.forEach((listener) => listener(count));
};

export const subscribeUnreadCount = (listener) => {
  unreadCountListeners.add(listener);
  return () => unreadCountListeners.delete(listener);
};

export const fetchUnreadNotificationCount = async () => {
  try {
    const res = await getNotification({
      view: 'list',
      is_read: false,
      page: 1,
      page_size: 1,
    });
    if (res?.success) {
      const total = res?.data?.count ?? res?.count ?? res?.data?.total ?? res?.total;
      if (total !== undefined && total !== null) return Number(total) || 0;
      const results = res?.data?.results ?? res?.results ?? [];
      return Array.isArray(results) ? results.length : 0;
    }
  } catch (error) {
    console.log('Unread count error:', error);
  }
  return 0;
};

export const useUnreadNotificationCount = () => {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    const count = await fetchUnreadNotificationCount();
    setUnreadCount(count);
    publishUnreadCount(count);
  }, []);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => subscribeUnreadCount(setUnreadCount), []);

  return { unreadCount, refreshUnreadCount };
};

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const buildParams = useCallback(
    (pageNo) => {
      const params = { page: pageNo, view: 'list' };
      if (filter === 'read') params.is_read = true;
      if (filter === 'unread') params.is_read = false;
      if (typeFilter !== 'all') params.notification_type = typeFilter;
      return params;
    },
    [filter, typeFilter],
  );

  const fetchUnreadCount = useCallback(async () => {
    const count = await fetchUnreadNotificationCount();
    setUnreadCount(count);
    publishUnreadCount(count);
  }, []);

  const fetchNotifications = useCallback(
    async (pageNo = 1, options = {}) => {
      const { isLoadMore = false, isRefresh = false } = options;
      try {
        if (isLoadMore) setLoadingMore(true);
        else if (!isRefresh) setLoading(true);

        const res = await getNotification(buildParams(pageNo));
        if (res?.success) {
          const results = res?.data?.results ?? res?.results ?? [];
          const data = results
            .map(mapNotification)
            .filter((item) => item.id && item.title && item.description && !isLikelyId(item.title));
          setNotifications((prev) => (isLoadMore ? [...prev, ...data] : data));
          setPage(pageNo);
          setHasMore(!!(res?.data?.next ?? res?.next));
        }
      } catch (error) {
        console.log('Notification Error:', error);
      } finally {
        if (isLoadMore) setLoadingMore(false);
        else if (!isRefresh) setLoading(false);
      }
    },
    [buildParams],
  );

  const markAsRead = useCallback(
    async (id) => {
      let snapshot = [];
      let wasUnread = false;
      setNotifications((prev) => {
        snapshot = prev;
        const target = prev.find((item) => item.id === id);
        wasUnread = !!target && !target.isRead;
        if (filter === 'unread') return prev.filter((item) => item.id !== id);
        return prev.map((item) =>
          item.id === id
            ? { ...item, isRead: true, isNew: false, rawData: { ...item.rawData, is_read: true } }
            : item,
        );
      });
      if (wasUnread) {
        setUnreadCount((prev) => {
          const next = Math.max(0, prev - 1);
          publishUnreadCount(next);
          return next;
        });
      }
      try {
        const res = await manageNotification({ action: 'read', notification_id: id });
        if (!res?.success) throw new Error(res?.message || 'Mark as read failed');
      } catch (e) {
        console.log('Mark as read failed:', e);
        setNotifications(snapshot);
        if (wasUnread) setUnreadCount((prev) => prev + 1);
      }
    },
    [filter],
  );

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    const previous = notifications;
    setNotifications((prev) =>
      filter === 'unread'
        ? []
        : prev.map((item) => ({
            ...item,
            isRead: true,
            isNew: false,
            rawData: { ...item.rawData, is_read: true },
          })),
    );
    setUnreadCount(0);
    publishUnreadCount(0);
    try {
      const res = await manageNotification({ action: 'read', all: true });
      if (!res?.success) throw new Error(res?.message || 'Mark all as read failed');
      if (filter === 'unread') setNotifications([]);
    } catch (e) {
      console.log('Mark all as read failed:', e);
      setNotifications(previous);
      await fetchUnreadCount();
    }
  };

  const clearNotifications = async () => {
    try {
      const res = await manageNotification({ action: 'clear', all: true });
      if (!res?.success) throw new Error(res?.message || 'Clear notifications failed');
      setNotifications([]);
      setUnreadCount(0);
      publishUnreadCount(0);
    } catch (e) {
      console.log('Clear notifications failed:', e);
    }
  };

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchNotifications(page + 1, { isLoadMore: true });
  }, [page, hasMore, loadingMore, fetchNotifications]);

  const refreshNotifications = useCallback(async () => {
    setPage(1);
    setHasMore(true);
    setRefreshing(true);
    try {
      await fetchNotifications(1, { isRefresh: true });
    } finally {
      setRefreshing(false);
    }
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications(1);
  }, [filter, typeFilter]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return {
    notifications,
    loading,
    loadingMore,
    refreshing,
    unreadCount,
    filter,
    typeFilter,
    setFilter,
    setTypeFilter,
    hasMore,
    loadMore,
    refreshNotifications,
    markAsRead,
    markAllRead,
    clearNotifications,
  };
};

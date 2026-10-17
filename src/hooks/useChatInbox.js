import { useCallback, useEffect, useRef, useState } from 'react';
import { isChatSendEnabled } from '../chat/chatAccessUtils';
import { dedupeMessages } from '../chat/messageUtils';
import { resolveAppointmentLookupId } from '../consult/appointmentUtils';
import { mapAppointment } from '../profile/map';
import { chatService } from '../services/chatService';
import { getConsultHistory } from '../services/consultService';

const HISTORY_PAGE_SIZE = 50;
const MAX_THREADS = 40;
const FETCH_CONCURRENCY = 4;
const REFRESH_INTERVAL_MS = 60_000;
const PATIENT_ROLE = 'patient';

const toTime = (value) => {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const runPool = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const next = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
};

const buildThreadBase = (item) => {
  const raw = item.raw || {};
  const appointment = raw.appointment || raw;
  const followUp = raw.follow_up || appointment.follow_up;
  const chatContext = {
    call_status: item.call_status,
    appointment_status: item.status,
    appointment_date: item.date,
    follow_up: followUp,
  };
  return {
    id: resolveAppointmentLookupId({ rawData: raw, ...item }),
    doctorId: item.doctorId,
    doctorName: item.doctorName,
    doctorAvatar: item.image,
    specialty: item.therapies || item.specialty,
    patientName: item.patientName,
    appointmentDate: item.date,
    status: item.status.toLowerCase(),
    chatContext,
    extras: {
      role: PATIENT_ROLE,
      doctorName: item.doctorName,
      doctorAvatar: item.image,
      patientName: item.patientName,
      appointmentDate: item.date,
      doctorId: item.doctorId,
      chatContext,
    },
  };
};

export const summarizeMessages = (messages) => {
  const list = dedupeMessages(messages || []);
  const last = list[list.length - 1] || null;
  const unread = list.filter((m) => m.sender_role !== PATIENT_ROLE && !m.is_seen).length;
  return { lastMessage: last, unreadCount: unread, messageCount: list.length };
};

const fetchHistory = async () => {
  const scopes = ['upcoming', 'past'];
  const responses = await Promise.all(
    scopes.map((scope) =>
      getConsultHistory({ page: 1, page_size: HISTORY_PAGE_SIZE, appointment_status: scope }).catch(
        () => null,
      ),
    ),
  );
  const seen = new Set();
  const items = [];
  responses.forEach((res) => {
    const list = res?.data?.results || res?.results || [];
    if (!Array.isArray(list)) return;
    list.forEach((entry) => {
      const mapped = mapAppointment(entry);
      const thread = buildThreadBase(mapped);
      if (!thread.id || seen.has(thread.id)) return;
      seen.add(thread.id);
      items.push(thread);
    });
  });
  return items
    .sort((a, b) => toTime(b.appointmentDate) - toTime(a.appointmentDate))
    .slice(0, MAX_THREADS);
};

const loadThread = async (base) => {
  try {
    const data = await chatService.getMessages(base.id);
    const summary = summarizeMessages(data.messages);
    return {
      ...base,
      ...summary,
      canSend: isChatSendEnabled(data.chat_access, base.appointmentDate, base.chatContext),
    };
  } catch {
    return {
      ...base,
      lastMessage: null,
      unreadCount: 0,
      messageCount: 0,
      canSend: isChatSendEnabled(null, base.appointmentDate, base.chatContext),
    };
  }
};

const isVisibleThread = (thread) =>
  thread.messageCount > 0 || (thread.canSend && thread.status !== 'cancelled');

export const threadActivityTime = (thread) =>
  toTime(thread.lastMessage?.created_at) || toTime(thread.appointmentDate);

const sortThreads = (threads) =>
  [...threads].sort((a, b) => {
    const aHas = a.messageCount > 0 ? 1 : 0;
    const bHas = b.messageCount > 0 ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    return threadActivityTime(b) - threadActivityTime(a);
  });

export function useChatInbox({ enabled = true, refreshMs = REFRESH_INTERVAL_MS } = {}) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const load = useCallback(async (mode = 'initial') => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (mode === 'refresh') setRefreshing(true);
    try {
      const bases = await fetchHistory();
      const loaded = await runPool(bases, FETCH_CONCURRENCY, loadThread);
      if (!mountedRef.current) return;
      setThreads(sortThreads(loaded.filter(isVisibleThread)));
      setError('');
    } catch {
      if (mountedRef.current) setError('Unable to load your conversations.');
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    load('initial');
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') load('silent');
    }, refreshMs);
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') load('silent');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, refreshMs, load]);

  const updateThreadMessages = useCallback((threadId, messages) => {
    if (!messages?.length) return;
    setThreads((prev) => {
      const index = prev.findIndex((t) => t.id === threadId);
      if (index === -1) return prev;
      const summary = summarizeMessages(messages);
      const current = prev[index];
      // The open conversation marks incoming messages as read.
      const unreadCount = 0;
      if (
        current.lastMessage?.id === summary.lastMessage?.id &&
        current.messageCount === summary.messageCount &&
        current.unreadCount === unreadCount
      ) {
        return prev;
      }
      const next = [...prev];
      next[index] = { ...current, ...summary, unreadCount };
      return sortThreads(next);
    });
  }, []);

  const markThreadRead = useCallback((threadId) => {
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId && t.unreadCount ? { ...t, unreadCount: 0 } : t)),
    );
  }, []);

  return {
    threads,
    loading,
    refreshing,
    error,
    refresh: () => load('refresh'),
    updateThreadMessages,
    markThreadRead,
  };
}

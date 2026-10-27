import { useCallback, useEffect, useRef, useState } from 'react';
import { isChatSendEnabled } from '../chat/chatAccessUtils';
import { dedupeMessages } from '../chat/messageUtils';
import { resolveAppointmentLookupId } from '../consult/appointmentUtils';
import { mapAppointment } from '../profile/map';
import { chatService } from '../services/chatService';
import { getConsultHistory } from '../services/consultService';
import { currentApiIdentity, invalidateApiCache, subscribeApiSession } from '../services/apiClient';

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
  const followUp = appointment.follow_up || raw.prescription?.follow_up || raw.follow_up;
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
    raw,
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

export const findRelatedAppointmentIds = async ({ doctorId, doctorName } = {}) => {
  const key = doctorId
    ? `id:${String(doctorId).trim()}`
    : `name:${String(doctorName || '').trim().toLowerCase()}`;
  if (key === 'id:' || key === 'name:') return [];
  const bases = await fetchHistory();
  return bases.filter((thread) => doctorKey(thread) === key).map((thread) => thread.id);
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

// No chat exists for cancelled or unpaid bookings (backend answers 409 "cancelled"), so never
// request their messages.
const NO_CHAT_STATUS_RE = /cancel|reject|declin|expired|payment_pending|pending_payment|unpaid/;
const PAYMENT_PENDING_RE = /^(pending|created|initiated|unpaid|failed|payment_pending|attempted)$/;
const isPaymentPending = (raw = {}) => {
  const appt = raw.appointment || {};
  const value = String(
    raw.payment_status ??
      raw.payment?.status ??
      raw.payment?.payment_status ??
      appt.payment_status ??
      appt.payment?.status ??
      (raw.is_paid === false || appt.is_paid === false ? 'unpaid' : ''),
  )
    .trim()
    .toLowerCase();
  return PAYMENT_PENDING_RE.test(value);
};
// Missed / no-show consults have no chat unless a follow-up was scheduled.
const MISSED_STATUS_RE = /missed|no_show|noshow/;
const hasFollowUp = (raw) => {
  const fu = raw?.follow_up || raw?.prescription?.follow_up;
  return Boolean(fu && (fu.schedule || fu.date));
};
const hasNoChat = (base) => {
  const status = String(base.status || '').toLowerCase();
  if (NO_CHAT_STATUS_RE.test(status) || isPaymentPending(base.raw)) return true;
  return MISSED_STATUS_RE.test(status) && !hasFollowUp(base.raw);
};

/** 409 cancelled / 403 / 404: the appointment simply has no chat. */
const isNoChatError = (error) =>
  error?.code === 'cancelled' || [403, 404, 409].includes(Number(error?.httpStatus));

const emptyThread = (base) => ({
  ...base,
  lastMessage: null,
  unreadCount: 0,
  messageCount: 0,
  canSend: false,
});

const loadThread = async (base) => {
  if (hasNoChat(base)) return emptyThread(base);
  try {
    const data = await chatService.getMessages(base.id);
    const summary = summarizeMessages(data.messages);
    return {
      ...base,
      ...summary,
      canSend: isChatSendEnabled(data.chat_access, base.appointmentDate, base.chatContext),
    };
  } catch (error) {
    if (isNoChatError(error)) return emptyThread(base);
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

const doctorKey = (thread) => {
  const id = String(thread.doctorId || '').trim();
  if (id) return `id:${id}`;
  return `name:${String(thread.doctorName || '').trim().toLowerCase()}`;
};

/** One row per doctor. Messages stay on their appointment, but the list and the open chat show them together. */
const groupByDoctor = (threads) => {
  const groups = new Map();
  threads.forEach((thread) => {
    const key = doctorKey(thread);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(thread);
  });

  return [...groups.values()].map((group) => {
    const sendable = group
      .filter((thread) => thread.canSend)
      .sort((a, b) => toTime(b.appointmentDate) - toTime(a.appointmentDate));
    const primary = sendable[0] || [...group].sort((a, b) => threadActivityTime(b) - threadActivityTime(a))[0];
    const lastMessages = group
      .map((thread) => thread.lastMessage)
      .filter(Boolean)
      .sort((a, b) => toTime(a.created_at) - toTime(b.created_at));
    const lastMessage = lastMessages[lastMessages.length - 1] || null;
    return {
      ...primary,
      lastMessage,
      messageCount: group.reduce((sum, thread) => sum + thread.messageCount, 0),
      unreadCount: group.reduce((sum, thread) => sum + thread.unreadCount, 0),
      canSend: group.some((thread) => thread.canSend),
      extras: {
        ...primary.extras,
        relatedAppointmentIds: group.map((thread) => thread.id),
      },
    };
  });
};

// One inbox load (history + per-thread messages) is shared by every hook instance, and the
// last result is reused for a short window so re-enabling the launcher on navigation does not
// re-run the whole fan-out. Polling, focus and manual refresh still load fresh.
const SNAPSHOT_FRESH_MS = 30_000;
let inboxSnapshot = null; // { identity, at, threads }
let sharedInboxLoad = null; // Promise<threads>
subscribeApiSession(() => {
  inboxSnapshot = null;
});

const loadInboxThreads = () => {
  if (sharedInboxLoad) return sharedInboxLoad;
  sharedInboxLoad = (async () => {
    const identity = await currentApiIdentity();
    const bases = await fetchHistory();
    const loaded = await runPool(bases, FETCH_CONCURRENCY, loadThread);
    const threads = sortThreads(groupByDoctor(loaded.filter(isVisibleThread)));
    inboxSnapshot = { identity, at: Date.now(), threads };
    return threads;
  })().finally(() => {
    sharedInboxLoad = null;
  });
  return sharedInboxLoad;
};

const freshSnapshot = async () => {
  if (!inboxSnapshot || Date.now() - inboxSnapshot.at >= SNAPSHOT_FRESH_MS) return null;
  return inboxSnapshot.identity === (await currentApiIdentity()) ? inboxSnapshot.threads : null;
};

const updateSnapshot = (threads) => {
  if (inboxSnapshot) inboxSnapshot = { ...inboxSnapshot, threads };
};

/** Test hook: forget the shared inbox snapshot. */
export const resetChatInboxSnapshot = () => {
  inboxSnapshot = null;
};

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
      if (mode === 'refresh') invalidateApiCache('customers/doctors/consultation-history/');
      const cached = mode === 'initial' ? await freshSnapshot() : null;
      const next = cached || (await loadInboxThreads());
      if (!mountedRef.current) return;
      setThreads(next);
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
    // Tab refocus refreshes at most once per interval (not on every tab switch).
    let lastFocusLoad = Date.now();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastFocusLoad < Math.min(refreshMs, 30_000)) return;
      lastFocusLoad = Date.now();
      load('silent');
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
      const sorted = sortThreads(next);
      updateSnapshot(sorted);
      return sorted;
    });
  }, []);

  const markThreadRead = useCallback((threadId) => {
    setThreads((prev) => {
      const next = prev.map((t) => (t.id === threadId && t.unreadCount ? { ...t, unreadCount: 0 } : t));
      updateSnapshot(next);
      return next;
    });
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

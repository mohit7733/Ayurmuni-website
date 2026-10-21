import { useCallback, useEffect, useRef, useState } from 'react';
import { chatService } from '../services/chatService';
import { WebSocketService } from '../chat/websocketService';
import {
  getChatDisabledReason,
  isChatSendEnabled,
  shouldSuppressChatError,
} from '../chat/chatAccessUtils';
import { dedupeMessages } from '../chat/messageUtils';
import { Utils } from '../common/utils';

const POLL_INTERVAL_MS = 12_000;
const SEND_DEDUPE_MS = 5000;

let recentOutboundSend = null;
let sendEnterLocked = false;

export function useChat(
  appointmentId,
  role,
  appointmentDate,
  appointmentContext,
  relatedAppointmentIds = [],
) {
  const [state, setState] = useState({
    appointmentId,
    messages: [],
    isLoading: true,
    isConnected: false,
    error: null,
    participantRole: role,
    chatAccess: null,
    followUpActive: false,
    activePhase: 'live',
  });

  const wsRef = useRef(null);
  const mountedRef = useRef(true);
  const pageVisibleRef = useRef(typeof document === 'undefined' ? true : document.visibilityState !== 'hidden');
  const loadMessagesRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);
  const errorTimeoutRef = useRef(null);
  const sendingLockRef = useRef(false);
  const chatAccessRef = useRef(state.chatAccess);
  chatAccessRef.current = state.chatAccess;
  const appointmentDateRef = useRef(appointmentDate);
  appointmentDateRef.current = appointmentDate;
  const appointmentContextRef = useRef(appointmentContext);
  appointmentContextRef.current = appointmentContext;
  const messagesRef = useRef([]);
  messagesRef.current = state.messages;
  const relatedMessagesRef = useRef([]);
  const relatedKey = [...new Set((relatedAppointmentIds || []).filter((id) => id && id !== appointmentId))]
    .sort()
    .join('|');
  const relatedKeyRef = useRef('');
  const relatedFlightRef = useRef(null);

  const isChatEnabledFlag = isChatSendEnabled(
    state.chatAccess,
    appointmentDate,
    appointmentContext,
  );

  const appendOrReplaceMessage = useCallback((prevMessages, incoming) => {
    const exists = prevMessages.some((m) => m.id === incoming.id);
    let next;
    if (exists) {
      next = prevMessages.map((m) => (m.id === incoming.id ? incoming : m));
    } else {
      const withoutMatchingTemp = prevMessages.filter((m) => {
        if (!String(m.id || '').startsWith('temp-')) return true;
        return !(
          m.sender_role === incoming.sender_role &&
          (m.text || '') === (incoming.text || '')
        );
      });
      next = [...withoutMatchingTemp, incoming];
    }
    return dedupeMessages(next);
  }, []);

  const loadRelatedMessages = useCallback(async () => {
    if (relatedKeyRef.current === relatedKey) return;
    if (relatedFlightRef.current?.key === relatedKey) {
      await relatedFlightRef.current.promise;
      return;
    }
    const ids = relatedKey ? relatedKey.split('|') : [];
    const promise = (async () => {
      if (!ids.length) {
        relatedMessagesRef.current = [];
        return;
      }
      const batches = await Promise.all(ids.map((id) => chatService.getMessages(id).catch(() => null)));
      relatedMessagesRef.current = batches.flatMap((data, index) =>
        (data?.messages || []).map((message) => ({
          ...message,
          appointment_id: message.appointment_id || ids[index],
        })),
      );
    })();
    relatedFlightRef.current = { key: relatedKey, promise };
    try {
      await promise;
      relatedKeyRef.current = relatedKey;
    } finally {
      if (relatedFlightRef.current?.promise === promise) relatedFlightRef.current = null;
    }
  }, [relatedKey]);

  const withRelatedHistory = (messages) =>
    dedupeMessages([...(relatedMessagesRef.current || []), ...messages]);

  const loadMessages = useCallback(
    async (markRead) => {
      if (!mountedRef.current || !appointmentId) return;
      await loadRelatedMessages();
      if (!mountedRef.current) return;
      const isFirstLoad = !hasLoadedOnceRef.current;
      if (isFirstLoad) setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const data = await chatService.getMessages(appointmentId, markRead);
        if (!mountedRef.current) return;
        hasLoadedOnceRef.current = true;
        setState((prev) => {
          const incoming = data.messages ?? [];
          const keepExisting =
            incoming.length === 0 && !!data.sendBlocked && prev.messages.length > 0;
          let nextMessages = keepExisting ? prev.messages : incoming;
          if (!keepExisting && prev.messages.some((m) => String(m.id).startsWith('temp-'))) {
            const temps = prev.messages.filter((m) => String(m.id).startsWith('temp-'));
            nextMessages = [...incoming];
            temps.forEach((temp) => {
              const matched = incoming.some(
                (s) =>
                  s.sender_role === temp.sender_role && (s.text || '') === (temp.text || ''),
              );
              if (!matched) nextMessages.push(temp);
            });
          }
          return {
            ...prev,
            messages: withRelatedHistory(nextMessages),
            chatAccess: data.chat_access ?? prev.chatAccess,
            followUpActive: data.chat_access?.follow_up_active ?? prev.followUpActive,
            activePhase: data.chat_access?.active_phase ?? prev.activePhase,
            isLoading: false,
            isConnected: true,
            error: null,
          };
        });
      } catch (error) {
        if (!mountedRef.current) return;
        hasLoadedOnceRef.current = true;
        const isSendBlocked = error?.httpStatus === 403;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: null,
          chatAccess: isSendBlocked
            ? {
                ...(prev.chatAccess ?? {}),
                can_send: false,
                can_read: true,
              }
            : prev.chatAccess,
        }));
      }
    },
    [appointmentId, loadRelatedMessages],
  );

  useEffect(() => {
    mountedRef.current = true;
    loadMessages();
    return () => {
      mountedRef.current = false;
    };
  }, [appointmentId, loadMessages]);

  useEffect(() => {
    loadMessagesRef.current = loadMessages;
  }, [loadMessages]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!mountedRef.current) return;
      if (!pageVisibleRef.current) return;
      loadMessagesRef.current?.();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [appointmentId]);

  const showTransientError = useCallback((message) => {
    if (!mountedRef.current || shouldSuppressChatError(message)) return;
    setState((prev) => ({ ...prev, error: message }));
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) setState((prev) => ({ ...prev, error: null }));
    }, 4000);
  }, []);

  const sendViaHttp = useCallback(
    async (tempId, trimmedText, attachments) => {
      const payload = {};
      if (trimmedText) payload.text = trimmedText;
      if (attachments?.length) payload.attachments = attachments;
      const result = await chatService.sendMessage(appointmentId, payload);
      if (!mountedRef.current) return;
      const nested = result?.message && typeof result.message === 'object' ? result.message : null;
      const serverMessage = nested || (result?.id || result?.text ? result : null);
      setState((prev) => ({
        ...prev,
        messages: dedupeMessages(
          prev.messages.map((m) =>
            m.id === tempId
              ? serverMessage
                ? { ...serverMessage, _pending: false }
                : { ...m, _pending: false }
              : m,
          ),
        ),
      }));
    },
    [appointmentId],
  );

  const sendMessage = useCallback(
    async (text, attachments) => {
      const trimmedText = (text || '').trim();
      const hasAttachments = !!attachments && attachments.length > 0;
      if (!trimmedText && !hasAttachments) return;
      if (sendEnterLocked || sendingLockRef.current) return;

      const dedupeKey = `${appointmentId}|${role}|${trimmedText}|${
        hasAttachments ? attachments.map((a) => a.file_url).join(',') : ''
      }`;
      const now = Date.now();
      if (
        recentOutboundSend &&
        recentOutboundSend.key === dedupeKey &&
        now - recentOutboundSend.at < SEND_DEDUPE_MS
      ) {
        return;
      }

      if (
        !isChatSendEnabled(
          chatAccessRef.current,
          appointmentDateRef.current,
          appointmentContextRef.current,
        )
      ) {
        showTransientError(
          getChatDisabledReason(
            chatAccessRef.current,
            appointmentDateRef.current,
            appointmentContextRef.current,
          ),
        );
        return;
      }

      sendEnterLocked = true;
      sendingLockRef.current = true;
      recentOutboundSend = { key: dedupeKey, at: now };

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tempMessage = {
        id: tempId,
        appointment_id: appointmentId,
        sender_id: 'me',
        sender_role: role,
        text: trimmedText,
        attachments: attachments || [],
        phase: 'live',
        message_type: hasAttachments ? attachments[0].file_type : 'text',
        is_seen: false,
        created_at: new Date().toISOString(),
        _pending: true,
      };

      setState((prev) => ({
        ...prev,
        messages: dedupeMessages([...prev.messages, tempMessage]),
      }));

      try {
        await sendViaHttp(tempId, trimmedText, attachments);
        setTimeout(() => loadMessagesRef.current?.(), 800);
      } catch (error) {
        if (error?.code === 'DUPLICATE_SEND') {
          setState((prev) => ({
            ...prev,
            messages: prev.messages.filter((m) => m.id !== tempId),
          }));
          return;
        }
        if (recentOutboundSend?.key === dedupeKey) recentOutboundSend = null;
        setState((prev) => ({
          ...prev,
          messages: prev.messages.filter((m) => m.id !== tempId),
        }));
        if (error?.httpStatus === 403) {
          setState((prev) => ({
            ...prev,
            chatAccess: prev.chatAccess
              ? { ...prev.chatAccess, can_send: false }
              : { can_send: false, can_read: true },
          }));
          showTransientError(
            getChatDisabledReason(
              chatAccessRef.current,
              appointmentDateRef.current,
              appointmentContextRef.current,
            ),
          );
          return;
        }
        showTransientError('Unable to send message. Please try again.');
      } finally {
        sendingLockRef.current = false;
        sendEnterLocked = false;
      }
    },
    [appointmentId, role, showTransientError, sendViaHttp],
  );

  const markAsRead = useCallback(
    async (messageIds) => {
      if (!messageIds || messageIds.length === 0) return;
      const wanted = new Set(messageIds);
      const groups = new Map();
      messagesRef.current.forEach((message) => {
        if (!wanted.has(message.id)) return;
        const owner = message.appointment_id || appointmentId;
        if (!groups.has(owner)) groups.set(owner, []);
        groups.get(owner).push(message.id);
      });
      const known = new Set([...groups.values()].flat());
      messageIds.forEach((id) => {
        if (known.has(id)) return;
        if (!groups.has(appointmentId)) groups.set(appointmentId, []);
        groups.get(appointmentId).push(id);
      });
      await Promise.all(
        [...groups.entries()].map(async ([ownerId, ids]) => {
          if (ownerId === appointmentId && wsRef.current?.isConnected()) {
            wsRef.current.sendRead(ids);
            return;
          }
          try {
            await chatService.getMessages(ownerId, ids.join(','));
          } catch {
            // silent
          }
        }),
      );
    },
    [appointmentId],
  );

  const attachSocketHandlers = useCallback(
    (ws) => {
      ws.on('connected', () => {
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, isConnected: true, error: null }));
        }
      });
      ws.on('message', (data) => {
        if (!data.message || !mountedRef.current) return;
        setState((prev) => ({
          ...prev,
          messages: appendOrReplaceMessage(prev.messages, data.message),
        }));
      });
      ws.on('read', (data) => {
        if (!data.message_ids || !mountedRef.current) return;
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((msg) =>
            data.message_ids.includes(msg.id)
              ? { ...msg, is_seen: true, seen_at: new Date().toISOString() }
              : msg,
          ),
        }));
      });
    },
    [appendOrReplaceMessage],
  );

  const readAccessToken = useCallback(async () => {
    const tokenRaw = await Utils.getData('_TOKEN');
    if (!tokenRaw) return null;
    return String(tokenRaw).replace(/^Bearer\s+/i, '');
  }, []);

  const ensureSocket = useCallback(async () => {
    if (!mountedRef.current || !appointmentId) return;
    if (wsRef.current?.isConnected()) {
      setState((prev) => ({ ...prev, isConnected: true }));
      return;
    }
    const token = await readAccessToken();
    if (!token || !mountedRef.current) return;
    if (wsRef.current) {
      wsRef.current.updateToken(token);
      await wsRef.current.connect();
      return;
    }
    const ws = new WebSocketService(
      appointmentId,
      token,
      () => {
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, isConnected: true, error: null }));
          loadMessagesRef.current?.();
        }
      },
      () => {
        if (mountedRef.current) setState((prev) => ({ ...prev, isConnected: true }));
      },
      readAccessToken,
    );
    attachSocketHandlers(ws);
    await ws.connect();
    wsRef.current = ws;
  }, [appointmentId, attachSocketHandlers, readAccessToken]);

  useEffect(() => {
    ensureSocket();
    const onVisibility = () => {
      const visible = document.visibilityState !== 'hidden';
      const comingForeground = visible && !pageVisibleRef.current;
      pageVisibleRef.current = visible;
      if (comingForeground) {
        loadMessagesRef.current?.();
        ensureSocket();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [appointmentId, ensureSocket]);

  return {
    ...state,
    loadMessages,
    sendMessage,
    markAsRead,
    isConnected: state.isConnected,
    isChatEnabled: isChatEnabledFlag,
  };
}

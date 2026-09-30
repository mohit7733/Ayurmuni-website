import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { formatMessageTime } from '../chat/dateFormatter';
import { getChatDisabledReason, shouldSuppressChatError } from '../chat/chatAccessUtils';
import { dedupeMessages, isTempMessage } from '../chat/messageUtils';
import { formatDoctorDisplayName } from '../consult/appointmentUtils';
import { doctorDisplayName, doctorImage, getDoctorId } from '../consult/doctors';
import { useChat } from '../hooks/useChat';
import { requireAuth } from '../services/guestAuth';
import { chatService } from '../services/chatService';
import { getAppointmentDetail } from '../services/consultService';
import AppShell from '../components/AppShell';

let globalInputSendLock = false;
const CHAT_META_KEY = 'ayurmuni_chat_meta';

const readChatMeta = (appointmentId, extras) => {
  let stored = {};
  try {
    const all = JSON.parse(sessionStorage.getItem(CHAT_META_KEY) || '{}');
    stored = all?.[appointmentId] || {};
  } catch {
    stored = {};
  }
  return {
    role: extras.role === 'doctor' || stored.role === 'doctor' ? 'doctor' : 'patient',
    doctorName: extras.doctorName || stored.doctorName || 'Doctor',
    patientName: extras.patientName || stored.patientName || 'Patient',
    doctorAvatar: extras.doctorAvatar || stored.doctorAvatar || '',
    patientAvatar: extras.patientAvatar || stored.patientAvatar || '',
    appointmentDate: extras.appointmentDate || stored.appointmentDate || '',
    chatContext: extras.chatContext || stored.chatContext || null,
    doctorId: extras.doctorId || stored.doctorId || '',
  };
};

const writeChatMeta = (appointmentId, meta) => {
  if (!appointmentId) return;
  try {
    const all = JSON.parse(sessionStorage.getItem(CHAT_META_KEY) || '{}');
    all[appointmentId] = meta;
    sessionStorage.setItem(CHAT_META_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
};

const formatChatDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export default function Chat() {
  const { appointmentId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const extras = location.state || {};
  const [meta, setMeta] = useState(() => readChatMeta(appointmentId, extras));

  const {
    messages,
    isLoading,
    isConnected,
    error,
    participantRole,
    sendMessage,
    markAsRead,
    chatAccess,
    loadMessages,
    isChatEnabled,
  } = useChat(appointmentId, meta.role, meta.appointmentDate, meta.chatContext);

  const listRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const markedReadRef = useRef(new Set());
  const [text, setText] = useState('');
  const [pickedFile, setPickedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [lightbox, setLightbox] = useState('');

  const visibleMessages = useMemo(() => dedupeMessages(messages), [messages]);
  const disabledReason = getChatDisabledReason(chatAccess, meta.appointmentDate, meta.chatContext);
  const visibleError =
    error && !shouldSuppressChatError(error, visibleMessages.length) ? error : null;
  const canInteract = isChatEnabled && !isSending && !globalInputSendLock;
  const hasContent = !!text.trim() || !!pickedFile;
  const headerTitle =
    participantRole === 'doctor'
      ? meta.patientName || 'Patient'
      : formatDoctorDisplayName(meta.doctorName);
  const headerAvatar = participantRole === 'doctor' ? meta.patientAvatar : meta.doctorAvatar;
  const roleLabel = participantRole === 'doctor' ? 'Doctor' : 'Patient';
  const statusLine = !isChatEnabled
    ? 'Chat closed — read only'
    : isConnected
      ? `Connected • ${roleLabel}`
      : `Connecting • ${roleLabel}`;

  useEffect(() => {
    setMeta(readChatMeta(appointmentId, location.state || {}));
  }, [appointmentId, location.state]);

  useEffect(() => {
    writeChatMeta(appointmentId, meta);
  }, [appointmentId, meta]);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to open chat'))) return;
      if (!appointmentId) return;
      const res = await getAppointmentDetail(appointmentId);
      if (!res?.success) return;
      const data = res.data || {};
      const doctor = data.doctor || {};
      const appointment = data.appointment || {};
      const patient = appointment.patient || {};
      setMeta((prev) => ({
        ...prev,
        doctorName: prev.doctorName && prev.doctorName !== 'Doctor' ? prev.doctorName : doctorDisplayName(doctor),
        doctorAvatar: prev.doctorAvatar || doctorImage(doctor),
        patientName: prev.patientName && prev.patientName !== 'Patient' ? prev.patientName : patient.patient_name || prev.patientName,
        patientAvatar: prev.patientAvatar || patient.patient_image || '',
        appointmentDate: prev.appointmentDate || appointment.appointment_date || '',
        doctorId: prev.doctorId || getDoctorId(doctor),
        chatContext: prev.chatContext || {
          call_status: appointment.call_status,
          appointment_status: appointment.appointment_status,
          appointment_date: appointment.appointment_date,
          follow_up: appointment.follow_up || data.prescription?.follow_up || data.follow_up,
        },
      }));
    })();
  }, [appointmentId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!isChatEnabled) return;
    const unread = visibleMessages.filter(
      (msg) =>
        msg.sender_role !== participantRole &&
        !msg.is_seen &&
        !markedReadRef.current.has(msg.id),
    );
    if (!unread.length) return;
    unread.forEach((m) => markedReadRef.current.add(m.id));
    markAsRead(unread.map((m) => m.id));
  }, [visibleMessages, participantRole, markAsRead, isChatEnabled]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !visibleMessages.length) return;
    el.scrollTop = el.scrollHeight;
  }, [visibleMessages, isLoading]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const handlePickImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !canInteract) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPickedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const removePicked = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPickedFile(null);
    setPreviewUrl('');
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!canInteract || globalInputSendLock) return;
    if (!trimmed && !pickedFile) return;
    if (!isChatEnabled) return;

    globalInputSendLock = true;
    setIsSending(true);
    const asset = pickedFile;
    const toSend = trimmed;
    setText('');
    removePicked();

    try {
      if (!asset) {
        await sendMessage(toSend);
      } else {
        const url = await chatService.uploadAttachment(asset, asset.name || 'image.jpg');
        await sendMessage(toSend, [
          {
            file_url: url,
            file_type: 'image',
            file_name: asset.name || 'image.jpg',
          },
        ]);
      }
    } catch {
      setText(toSend);
      if (asset) {
        setPickedFile(asset);
        setPreviewUrl(URL.createObjectURL(asset));
      }
    } finally {
      globalInputSendLock = false;
      setIsSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const onComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  if (!appointmentId) {
    return <Navigate to="/profile/appointments" replace />;
  }

  return (
    <AppShell tab="profile">
      <div className="chat-page">
        <header className="chat-header">
          <button
            type="button"
            className="chat-back"
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            ←
          </button>
          <button
            type="button"
            className="chat-avatar-wrap"
            onClick={() => {
              if (participantRole === 'patient' && meta.doctorId) {
                navigate(`/consult/doctors/${meta.doctorId}`);
              }
            }}
            aria-label={headerTitle}
          >
            {headerAvatar ? (
              <img src={headerAvatar} alt="" />
            ) : (
              <span>{String(headerTitle || '?').charAt(0).toUpperCase()}</span>
            )}
            <i className={isConnected && isChatEnabled ? 'on' : ''} />
          </button>
          <div>
            <strong>{headerTitle || 'Unknown'}</strong>
            <small>{statusLine}</small>
          </div>
        </header>

        {isLoading && visibleMessages.length === 0 ? (
          <p className="chat-loading">Loading messages…</p>
        ) : null}

        <div className="chat-list" ref={listRef}>
          {!isLoading && visibleMessages.length === 0 ? (
            <div className="chat-empty">
              <strong>No messages yet</strong>
              <p>Start a conversation when chat is open, or check back later for history.</p>
            </div>
          ) : (
            visibleMessages.map((item, index) => {
              const prev = index > 0 ? visibleMessages[index - 1] : null;
              const showDate = !prev || formatChatDay(item.created_at) !== formatChatDay(prev.created_at);
              const isOwn = item.sender_role === participantRole;
              const pending = isTempMessage(item);
              return (
                <div key={`${item.id}-${index}`}>
                  {showDate ? (
                    <div className="chat-date">
                      <span>{formatChatDay(item.created_at)}</span>
                    </div>
                  ) : null}
                  <article className={`chat-bubble ${isOwn ? 'own' : 'other'}`}>
                    {!isOwn ? <em>{item.sender_name || 'Unknown'}</em> : null}
                    <div>
                      {item.text ? <p>{item.text}</p> : null}
                      {(item.attachments || []).map((attachment, idx) =>
                        attachment.file_type === 'image' ? (
                          <button
                            key={`${attachment.file_url}-${idx}`}
                            type="button"
                            className="chat-image-btn"
                            onClick={() => setLightbox(attachment.file_url)}
                          >
                            <img src={attachment.file_url} alt={attachment.file_name || 'Attachment'} />
                          </button>
                        ) : (
                          <a
                            key={`${attachment.file_url}-${idx}`}
                            href={attachment.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="chat-file"
                          >
                            📎 {attachment.file_name || 'Download'}
                          </a>
                        ),
                      )}
                    </div>
                    <small>
                      {formatMessageTime(item.created_at).toUpperCase()}
                      {isOwn ? (
                        <b className={item.is_seen ? 'seen' : pending ? 'pending' : ''}>
                          {pending ? '…' : item.is_seen ? '✓✓' : '✓'}
                        </b>
                      ) : null}
                    </small>
                  </article>
                </div>
              );
            })
          )}
        </div>

        {!isChatEnabled && disabledReason ? <p className="chat-disabled">{disabledReason}</p> : null}

        <div className="chat-composer">
          {previewUrl ? (
            <div className="chat-preview">
              <img src={previewUrl} alt="" />
              <button type="button" onClick={removePicked} disabled={isSending}>
                ×
              </button>
            </div>
          ) : null}
          <div className="chat-input-row">
            <button
              type="button"
              className="chat-attach"
              disabled={!canInteract}
              onClick={() => fileRef.current?.click()}
              aria-label="Attach image"
            >
              📎
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePickImage} />
            <textarea
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={isChatEnabled ? 'Type a message...' : 'Chat closed — read only'}
              disabled={!canInteract}
              rows={1}
            />
            <button
              type="button"
              className="chat-send"
              disabled={!hasContent || !canInteract}
              onClick={handleSend}
            >
              {isSending ? '…' : '➤'}
            </button>
          </div>
        </div>

        {visibleError ? (
          <div className="chat-error">
            <span>{visibleError}</span>
            <button type="button" onClick={() => loadMessages()}>
              Retry
            </button>
          </div>
        ) : null}

        {lightbox ? (
          <div className="chat-lightbox" role="dialog" onClick={() => setLightbox('')}>
            <img src={lightbox} alt="" />
            <button type="button" onClick={() => setLightbox('')}>
              Close
            </button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

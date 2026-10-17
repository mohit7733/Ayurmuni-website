import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Maximize2, MessageCircle, X } from 'lucide-react';
import { formatListTime, previewText } from '../../chat/inboxFormat';
import { formatDoctorDisplayName } from '../../consult/appointmentUtils';
import { useVideoCall } from '../../context/VideoCallContext';
import { useChatInbox } from '../../hooks/useChatInbox';
import useLoggedIn from '../../hooks/useLoggedIn';
import ChatConversation from './ChatConversation';
import ThreadAvatar from './ThreadAvatar';
import Skeleton from '../ui/Skeleton';
import '../../design/pages/chat-inbox.css';
import '../../design/components/chat-launcher.css';

const HIDDEN_EXACT = ['/'];
const HIDDEN_PREFIXES = [
  '/welcome',
  '/login',
  '/otp',
  '/access-mode',
  '/onboarding',
  '/assessment',
  '/patient-faq',
  '/prakriti-profile',
  '/complete-details',
  '/policy-detail',
  '/network-error',
  '/medical-history',
  '/profile/chats',
  '/profile/chat/',
  '/profile/video',
];
// Pages with a sticky bottom action bar on phones.
const MOBILE_HIDDEN_PREFIXES = [
  '/cart',
  '/checkout',
  '/products/',
  '/consult/doctors/',
  '/consult/booking-confirm',
  '/consult/add-calendar',
  '/medicines/checkout',
];

const OPEN_REFRESH_MS = 30_000;
const IDLE_REFRESH_MS = 120_000;

const matchesPrefix = (pathname, prefixes) => prefixes.some((p) => pathname.startsWith(p));

export default function ChatLauncher() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const loggedIn = useLoggedIn();
  const { viewMode, callParams } = useVideoCall();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState('');
  const extrasCacheRef = useRef({});
  const panelRef = useRef(null);

  const hidden =
    !loggedIn ||
    HIDDEN_EXACT.includes(pathname) ||
    matchesPrefix(pathname, HIDDEN_PREFIXES) ||
    (viewMode === 'minimized' && !!callParams);
  const hideOnMobile = matchesPrefix(pathname, MOBILE_HIDDEN_PREFIXES);

  const { threads, loading, updateThreadMessages, markThreadRead } = useChatInbox({
    enabled: !hidden,
    refreshMs: open ? OPEN_REFRESH_MS : IDLE_REFRESH_MS,
  });

  const totalUnread = useMemo(
    () => threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0),
    [threads],
  );

  useEffect(() => {
    setOpen(false);
    setActiveId('');
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (hidden) return null;

  const openThread = (thread) => {
    extrasCacheRef.current[thread.id] = extrasCacheRef.current[thread.id] || thread.extras;
    markThreadRead(thread.id);
    setActiveId(thread.id);
  };

  const badgeText = totalUnread > 99 ? '99+' : String(totalUnread);

  return (
    <div className={`ci-launch${hideOnMobile ? ' is-mobile-hidden' : ''}${open ? ' is-open' : ''}`}>
      {open ? (
        <section
          ref={panelRef}
          className={`ci-pop${activeId ? ' is-chat' : ''}`}
          role="dialog"
          aria-label="Ayurchat"
          tabIndex={-1}
        >
          {activeId ? (
            <>
              <button
                type="button"
                className="ci-pop__float-close"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
              >
                <X size={18} aria-hidden />
              </button>
              <ChatConversation
                key={activeId}
                appointmentId={activeId}
                extras={extrasCacheRef.current[activeId]}
                embedded
                onBack={() => setActiveId('')}
                onMessagesChange={updateThreadMessages}
              />
            </>
          ) : (
            <>
              <header className="ci-pop__head">
                <div>
                  <strong>Ayurchat</strong>
                  <small>
                    {totalUnread > 0
                      ? `${totalUnread} unread ${totalUnread === 1 ? 'message' : 'messages'}`
                      : 'Your conversations with doctors'}
                  </small>
                </div>
                <button
                  type="button"
                  className="ci-pop__icon"
                  aria-label="Open full chat page"
                  title="Open full page"
                  onClick={() => navigate('/profile/chats')}
                >
                  <Maximize2 size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="ci-pop__icon"
                  aria-label="Close chats"
                  onClick={() => setOpen(false)}
                >
                  <X size={18} aria-hidden />
                </button>
              </header>

              <div className="ci-pop__body">
                {loading ? (
                  Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="ci-row is-skeleton" aria-hidden>
                      <Skeleton variant="circle" width={44} height={44} />
                      <div className="ci-row__body">
                        <Skeleton width="55%" />
                        <Skeleton width="85%" />
                      </div>
                    </div>
                  ))
                ) : threads.length === 0 ? (
                  <div className="ci-pop__empty">
                    <MessageCircle size={32} aria-hidden />
                    <strong>No chats yet</strong>
                    <p>Book a consultation and you can chat with your doctor here.</p>
                    <button
                      type="button"
                      className="cta"
                      onClick={() => navigate('/consult/doctors')}
                    >
                      Find a doctor
                    </button>
                  </div>
                ) : (
                  <ul className="ci-list">
                    {threads.map((thread) => {
                      const unread = thread.unreadCount > 0;
                      return (
                        <li key={thread.id}>
                          <button
                            type="button"
                            className={`ci-row${unread ? ' is-unread' : ''}`}
                            onClick={() => openThread(thread)}
                          >
                            <ThreadAvatar name={thread.doctorName} src={thread.doctorAvatar} />
                            <div className="ci-row__body">
                              <div className="ci-row__top">
                                <strong>{formatDoctorDisplayName(thread.doctorName)}</strong>
                                <time>{formatListTime(thread.lastMessage?.created_at)}</time>
                              </div>
                              <div className="ci-row__bottom">
                                <p>{previewText(thread)}</p>
                                {unread ? (
                                  <span className="ci-badge">
                                    {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      ) : null}

      <button
        type="button"
        className={`ci-launch__btn${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-label={
          open
            ? 'Close Ayurchat'
            : totalUnread > 0
              ? `Ayurchat (${badgeText} unread)`
              : 'Ayurchat'
        }
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={22} aria-hidden /> : <MessageCircle size={22} aria-hidden />}
        <span className="ci-launch__label" aria-hidden>
          {open ? 'Close' : 'Ayurchat'}
        </span>
        {!open && totalUnread > 0 ? (
          <span className="ci-launch__badge" aria-hidden>
            {badgeText}
          </span>
        ) : null}
      </button>
    </div>
  );
}

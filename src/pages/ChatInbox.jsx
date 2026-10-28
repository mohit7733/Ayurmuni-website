import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageCircle, RefreshCw, Search } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import ChatConversation from '../components/chat/ChatConversation';
import ThreadAvatar from '../components/chat/ThreadAvatar';
import { Button, EmptyState, SectionHold } from '../components/ui';
import { formatListTime, previewText } from '../chat/inboxFormat';
import { formatDoctorDisplayName } from '../consult/appointmentUtils';
import { useChatInbox } from '../hooks/useChatInbox';
import '../design/pages/chat-inbox.css';

const DESKTOP_QUERY = '(min-width: 901px)';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'open', label: 'Open' },
];

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

export default function ChatInbox() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [params, setParams] = useSearchParams();
  const selectedId = isDesktop ? params.get('thread') || '' : '';
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const { threads, loading, refreshing, error, refresh, updateThreadMessages, markThreadRead } =
    useChatInbox();
  const extrasCacheRef = useRef({});

  const totalUnread = useMemo(
    () => threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0),
    [threads],
  );

  const visibleThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((t) => {
      if (filter === 'unread' && !t.unreadCount) return false;
      if (filter === 'open' && !t.canSend) return false;
      if (!q) return true;
      return [t.doctorName, t.specialty, t.patientName, t.lastMessage?.text]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [threads, filter, query]);

  const selectedThread = threads.find((t) => t.id === selectedId) || null;
  if (selectedThread && !extrasCacheRef.current[selectedThread.id]) {
    extrasCacheRef.current[selectedThread.id] = selectedThread.extras;
  }
  const selectedExtras = selectedId ? extrasCacheRef.current[selectedId] : undefined;

  const openThread = (thread) => {
    markThreadRead(thread.id);
    if (isDesktop) {
      extrasCacheRef.current[thread.id] = extrasCacheRef.current[thread.id] || thread.extras;
      setParams({ thread: thread.id }, { replace: true });
      return;
    }
    navigate(`/profile/chat/${thread.id}`, { state: thread.extras });
  };

  const filterLabel = (item) =>
    item.key === 'unread' && totalUnread > 0 ? `${item.label} (${totalUnread})` : item.label;

  const renderList = () => {
    if (loading) {
      return (
        <SectionHold label="Loading conversations" minHeight={280} />
      );
    }
    if (error && !threads.length) {
      return (
        <EmptyState
          compact
          tone="error"
          title="Couldn't load chats"
          description={error}
          action={
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
          }
        />
      );
    }
    if (!threads.length) {
      return (
        <EmptyState
          compact
          icon={<MessageCircle size={28} />}
          title="No chats yet"
          description="Once you book a consultation, your conversations with doctors will show up here."
          action={
            <Button variant="primary" onClick={() => navigate('/consult/doctors')}>
              Find a doctor
            </Button>
          }
        />
      );
    }
    if (!visibleThreads.length) {
      return (
        <p className="ci-none">
          {filter === 'unread' ? "You're all caught up." : 'No conversations match your search.'}
        </p>
      );
    }
    return (
      <ul className="ci-list">
        {visibleThreads.map((thread) => {
          const active = thread.id === selectedId;
          const unread = thread.unreadCount > 0;
          return (
            <li key={thread.id}>
              <button
                type="button"
                className={`ci-row${active ? ' is-active' : ''}${unread ? ' is-unread' : ''}`}
                aria-current={active ? 'true' : undefined}
                onClick={() => openThread(thread)}
              >
                <ThreadAvatar name={thread.doctorName} src={thread.doctorAvatar} />
                <div className="ci-row__body">
                  <div className="ci-row__top">
                    <strong>{formatDoctorDisplayName(thread.doctorName)}</strong>
                    <time>{formatListTime(thread.lastMessage?.created_at)}</time>
                  </div>
                  {thread.specialty ? <small className="ci-row__meta">{thread.specialty}</small> : null}
                  <div className="ci-row__bottom">
                    <p>{previewText(thread)}</p>
                    {unread ? (
                      <span className="ci-badge" aria-label={`${thread.unreadCount} unread`}>
                        {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                      </span>
                    ) : (
                      <span className={`ci-state${thread.canSend ? ' is-open' : ''}`}>
                        {thread.canSend ? 'Open' : 'Closed'}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <AppShell tab="profile">
      <section className="catalog-page ci-page">
        <PageHeader
          title="Ayurchat"
          subtitle="All your conversations with doctors in one place"
          backTo="/profile"
          actions={
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<RefreshCw size={16} aria-hidden className={refreshing ? 'ci-spin' : ''} />}
              onClick={refresh}
              disabled={loading || refreshing}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          }
        />

        <div className={`ci-layout${isDesktop ? ' is-split' : ''}`}>
          <aside className="ci-sidebar" aria-label="Conversations">
            <div className="ci-tools">
              <label className="ci-search">
                <Search size={16} aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search doctor or message"
                  aria-label="Search conversations"
                />
              </label>
              <div className="ci-filters" role="tablist" aria-label="Filter conversations">
                {FILTERS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.key}
                    className={`chip ${filter === item.key ? 'on' : ''}`}
                    onClick={() => setFilter(item.key)}
                  >
                    {filterLabel(item)}
                  </button>
                ))}
              </div>
            </div>
            {renderList()}
          </aside>

          {isDesktop ? (
            <div className="ci-pane">
              {selectedId ? (
                <ChatConversation
                  key={selectedId}
                  appointmentId={selectedId}
                  extras={selectedExtras}
                  embedded
                  onMessagesChange={updateThreadMessages}
                />
              ) : (
                <div className="ci-placeholder">
                  <MessageCircle size={40} aria-hidden />
                  <strong>Select a conversation</strong>
                  <p>Pick a doctor on the left to read and reply to your messages.</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}

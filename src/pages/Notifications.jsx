import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { buildVideoCallNavParams } from '../consult/appointmentUtils';
import { useNotifications } from '../hooks/useNotifications';
import { handleNotificationNavigation } from '../notifications/router';
import { normalizeNotificationPayload } from '../notifications/utils';
import { requireAuth } from '../services/guestAuth';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
];

const TYPE_FILTERS = [
  { key: 'all', label: 'All types' },
  { key: 'order', label: 'Orders' },
  { key: 'appointment', label: 'Appointments' },
  { key: 'prescription', label: 'Follow-ups' },
];

const SECTIONS = [
  { key: 'today', title: 'TODAY' },
  { key: 'yesterday', title: 'YESTERDAY' },
  { key: 'older', title: 'OLDER' },
];

const highlightDescription = (text) => {
  if (!text) return null;
  if (text.includes('%') || text.includes('#')) {
    return text.split(' ').map((word, index) => {
      const highlight = word.includes('%') || word.startsWith('#');
      return (
        <span key={`${word}-${index}`} className={highlight ? 'notif-hl' : undefined}>
          {word}{' '}
        </span>
      );
    });
  }
  return text;
};

export default function Notifications() {
  const navigate = useNavigate();
  const {
    notifications,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    filter,
    typeFilter,
    setFilter,
    setTypeFilter,
    markAsRead,
    markAllRead,
    clearNotifications,
    refreshNotifications,
    refreshing,
  } = useNotifications();
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to view notifications'))) return;
    })();
  }, []);

  const openItem = (item) => {
    if (!item.isRead) {
      markAsRead?.(item.id);
      setFilter?.('read');
    }

    const raw = item.rawData ?? item;
    const nested = typeof raw?.data === 'object' && raw.data ? raw.data : {};
    const typeRaw = String(
      raw?.notification_type ?? raw?.type ?? nested?.notification_type ?? nested?.type ?? item.type ?? '',
    ).toLowerCase();
    const callStatus = String(
      nested?.call_status ?? raw?.call_status ?? nested?.appointment?.call_status ?? '',
    ).toLowerCase();
    const textBlob = `${item.title || ''} ${item.description || ''}`.toLowerCase();
    const isJoinCall =
      ['in_progress', 'started', 'ongoing'].includes(callStatus) ||
      typeRaw.includes('call') ||
      typeRaw.includes('video') ||
      textBlob.includes('join the call') ||
      textBlob.includes('join call') ||
      textBlob.includes('join now') ||
      textBlob.includes('doctor started') ||
      textBlob.includes('call started') ||
      textBlob.includes('call now');

    if (isJoinCall) {
      const params = buildVideoCallNavParams(item.rawData ?? item, {
        role: 'patient',
        otherPartyName: item.doctorName,
      });
      if (params.appointmentId) {
        navigate(`/profile/video/${params.appointmentId}`, { state: params });
      } else {
        navigate('/profile/appointments');
      }
      return;
    }

    if (typeRaw.includes('prescription') || textBlob.includes('prescription')) {
      navigate('/profile/records');
      return;
    }

    const payload = normalizeNotificationPayload({
      ...(typeof raw === 'object' ? raw : {}),
      ...nested,
      title: item.title,
      message: item.description,
      type: typeRaw || item.type,
      route: raw?.route ?? nested?.route ?? raw?.screen,
      order_id: raw?.order_id ?? nested?.order_id,
      appointment_id: raw?.appointment_id ?? nested?.appointment_id ?? item.appointmentId,
      product_id: raw?.product_id ?? nested?.product_id,
      prescription_id: raw?.prescription_id ?? nested?.prescription_id,
      diet_id: raw?.diet_id ?? nested?.diet_id,
      doctor_id: raw?.doctor_id ?? nested?.doctor_id,
      call_status: callStatus,
      doctor_name: item.doctorName ?? raw?.doctor_name ?? nested?.doctor_name,
    });

    if (
      payload.route ||
      payload.screen ||
      payload.order_id ||
      payload.appointment_id ||
      payload.product_id ||
      payload.prescription_id ||
      payload.diet_id ||
      payload.doctor_id ||
      payload.type
    ) {
      handleNotificationNavigation(navigate, payload);
      return;
    }

    setSelected(item);
  };

  const sections = useMemo(
    () =>
      SECTIONS.map((section) => ({
        ...section,
        data: (notifications ?? []).filter(
          (item) => item.section === section.key && item.title && item.description,
        ),
      })).filter((section) => section.data.length > 0),
    [notifications],
  );

  return (
    <AppShell tab="home">
      <section className="catalog-page notif-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>Notifications</h1>
            <p>Orders, appointments, and offers</p>
          </div>
        </header>

        <div className="notif-actions">
          <button type="button" className="ghost" onClick={markAllRead}>
            Mark all
          </button>
          <button type="button" className="ghost" onClick={clearNotifications}>
            Clear
          </button>
          <button type="button" className="ghost" onClick={refreshNotifications} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div className="home-rail subcat-rail">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`chip ${filter === item.key ? 'on' : ''}`}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="home-rail subcat-rail">
          {TYPE_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`chip ${typeFilter === item.key ? 'on' : ''}`}
              onClick={() => setTypeFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="muted">Loading notifications…</p>
        ) : sections.length === 0 ? (
          <p className="empty-copy">No notifications yet</p>
        ) : (
          sections.map((section) => (
            <div key={section.key} className="notif-section">
              <h3>{section.title}</h3>
              {section.data.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`checkout-card order-row notif-row ${item.isRead ? '' : 'unread'}`}
                  onClick={() => openItem(item)}
                >
                  <div className="checkout-item txn-item">
                    {item.image ? (
                      <img src={item.image} alt="" />
                    ) : (
                      <span className="thumb-fallback" style={{ background: item.iconBg, color: '#fff' }}>
                        {item.glyph}
                      </span>
                    )}
                    <p>
                      {item.title}
                      <small>{highlightDescription(item.description)}</small>
                      <small>{item.time}</small>
                    </p>
                    {!item.isRead ? <em className="notif-dot" /> : null}
                  </div>
                </button>
              ))}
            </div>
          ))
        )}

        {hasMore && !loading ? (
          <div className="load-more-wrap">
            <button type="button" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        ) : null}

        {selected ? (
          <div className="web-modal" role="dialog">
            <div className="web-modal-card">
              <h3>{selected.title}</h3>
              <p>{selected.description}</p>
              <div className="detail-cta">
                <button type="button" className="ghost" onClick={() => setSelected(null)}>
                  Close
                </button>
                <button
                  type="button"
                  className="cta"
                  onClick={() => {
                    const payload = normalizeNotificationPayload({
                      ...(selected.rawData || {}),
                      ...(selected.rawData?.data || {}),
                      title: selected.title,
                      message: selected.description,
                    });
                    setSelected(null);
                    handleNotificationNavigation(navigate, payload);
                  }}
                >
                  View details
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, CheckCheck, RefreshCw, Trash2 } from "lucide-react";
import AppShell from "../components/AppShell";
import { buildVideoCallNavParams } from "../consult/appointmentUtils";
import { useNotifications } from "../hooks/useNotifications";
import { handleNotificationNavigation } from "../notifications/router";
import {
  buildViewAppointmentPayload,
  getNotificationDetailRows,
  normalizeNotificationPayload,
} from "../notifications/utils";
import { requireAuth } from "../services/guestAuth";
import "../design/pages/notifications.css";
import "../design/pages/notifications-compact.css";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
];

const TYPE_FILTERS = [
  { key: "all", label: "All types" },
  { key: "order", label: "Orders" },
  { key: "appointment", label: "Appointments" },
  { key: "prescription", label: "Follow-ups" },
];

const SECTIONS = [
  { key: "today", title: "TODAY" },
  { key: "yesterday", title: "YESTERDAY" },
  { key: "older", title: "OLDER" },
];

const highlightDescription = (text) => {
  if (!text) return null;
  if (text.includes("%") || text.includes("#")) {
    return text.split(" ").map((word, index) => {
      const highlight = word.includes("%") || word.startsWith("#");
      return (
        <span
          key={`${word}-${index}`}
          className={highlight ? "notif-hl" : undefined}
        >
          {word}{" "}
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
      if (!(await requireAuth("Please login to view notifications"))) return;
    })();
  }, []);

  const openItem = (item) => {
    if (!item.isRead) {
      markAsRead?.(item.id);
      setFilter?.("read");
    }

    const raw = item.rawData ?? item;
    const nested = typeof raw?.data === "object" && raw.data ? raw.data : {};
    const typeRaw = String(
      raw?.notification_type ??
        raw?.type ??
        nested?.notification_type ??
        nested?.type ??
        item.type ??
        "",
    ).toLowerCase();
    const callStatus = String(
      nested?.call_status ??
        raw?.call_status ??
        nested?.appointment?.call_status ??
        "",
    ).toLowerCase();
    const textBlob =
      `${item.title || ""} ${item.description || ""}`.toLowerCase();
    const isJoinCall =
      ["in_progress", "started", "ongoing"].includes(callStatus) ||
      typeRaw.includes("call") ||
      typeRaw.includes("video") ||
      textBlob.includes("join the call") ||
      textBlob.includes("join call") ||
      textBlob.includes("join now") ||
      textBlob.includes("doctor started") ||
      textBlob.includes("call started") ||
      textBlob.includes("call now");

    if (isJoinCall) {
      const params = buildVideoCallNavParams(item.rawData ?? item, {
        role: "patient",
        otherPartyName: item.doctorName,
      });
      if (params.appointmentId) {
        navigate(`/profile/video/${params.appointmentId}`, { state: params });
      } else {
        navigate("/profile/appointments");
      }
      return;
    }

    if (typeRaw.includes("prescription") || textBlob.includes("prescription")) {
      navigate("/profile/records");
      return;
    }

    const payload = normalizeNotificationPayload({
      ...(typeof raw === "object" ? raw : {}),
      ...nested,
      title: item.title,
      message: item.description,
      type: typeRaw || item.type,
      route: raw?.route ?? nested?.route ?? raw?.screen,
      order_id: raw?.order_id ?? nested?.order_id,
      appointment_id:
        raw?.appointment_id ?? nested?.appointment_id ?? item.appointmentId,
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
          (item) =>
            item.section === section.key && item.title && item.description,
        ),
      })).filter((section) => section.data.length > 0),
    [notifications],
  );

  const chip = (item, active, onClick) => (
    <button
      key={item.key}
      type="button"
      className={`nt-chip${active ? " is-on" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {item.label}
    </button>
  );

  return (
    <AppShell tab="home">
      <section className="nt-page">
        <header className="nt-head">
          <button
            type="button"
            className="nt-head__back"
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div className="nt-head__copy">
            <h1 className="nt-head__title">Notifications</h1>
            <p className="nt-head__desc">Orders, appointments, and offers</p>
          </div>
        </header>

        <div className="nt-panel">
          <div className="nt-toolbar">
            <div className="nt-toolbar__chips">
              <div className="nt-chipgroup" role="group" aria-label="Filter by read status">
                {FILTERS.map((item) =>
                  chip(item, filter === item.key, () => setFilter(item.key)),
                )}
              </div>
              <span className="nt-toolbar__sep" aria-hidden="true" />
              <div className="nt-chipgroup" role="group" aria-label="Filter by notification type">
                {TYPE_FILTERS.map((item) =>
                  chip(item, typeFilter === item.key, () => setTypeFilter(item.key)),
                )}
              </div>
            </div>
            <div className="nt-toolbar__actions" aria-label="Notification actions">
              <button type="button" className="nt-act" onClick={markAllRead} title="Mark all read" aria-label="Mark all read">
                <CheckCheck size={16} aria-hidden="true" />
                <span>Mark all</span>
              </button>
              <button type="button" className="nt-act" onClick={clearNotifications} title="Clear" aria-label="Clear notifications">
                <Trash2 size={16} aria-hidden="true" />
                <span>Clear</span>
              </button>
              <button
                type="button"
                className="nt-act"
                onClick={refreshNotifications}
                disabled={refreshing}
                title="Refresh"
                aria-label={refreshing ? "Refreshing" : "Refresh"}
              >
                <RefreshCw size={16} aria-hidden="true" className={refreshing ? "is-refreshing" : undefined} />
                <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="nt-state" role="status" aria-live="polite">
              <span className="nt-state__icon"><Bell size={20} aria-hidden="true" /></span>
              <p>Loading your notifications…</p>
            </div>
          ) : sections.length === 0 ? (
            <div className="nt-state">
              <span className="nt-state__icon"><Bell size={20} aria-hidden="true" /></span>
              <h2>No notifications yet</h2>
              <p>Updates about your orders and appointments will appear here.</p>
            </div>
          ) : (
            sections.map((section) => (
              <section key={section.key} className="nt-section" aria-labelledby={`notif-${section.key}`}>
                <h2 id={`notif-${section.key}`} className="nt-section__heading">
                  {section.title}
                  <span>{section.data.length}</span>
                </h2>
                <ul className="nt-list">
                  {section.data.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`nt-row${item.isRead ? "" : " is-unread"}`}
                        onClick={() => openItem(item)}
                        aria-label={`${item.isRead ? "" : "Unread notification: "}${item.title}. ${item.description}`}
                      >
                        {item.image ? (
                          <img className="nt-row__icon" src={item.image} alt="" />
                        ) : (
                          <span className="nt-row__icon" style={{ background: item.iconBg }} aria-hidden="true">
                            {item.glyph}
                          </span>
                        )}
                        <span className="nt-row__text">
                          <strong>{item.title}</strong>
                          <span>{highlightDescription(item.description)}</span>
                        </span>
                        <span className="nt-row__meta">
                          <time>{item.time}</time>
                          {!item.isRead ? <em className="nt-row__dot" aria-label="Unread" /> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}

          {hasMore && !loading ? (
            <div className="nt-more">
              <button type="button" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </div>

        {selected ? (
          <div className="web-modal" role="dialog">
            <div className="web-modal-card">
              <h3>{selected.title}</h3>
              <p className="nt-sheet__time">
                {selected.time}
                {!selected.isRead ? " · Unread" : ""}
              </p>
              <p>{selected.description}</p>
              {selected.eventType ? (
                <p className="nt-sheet__tag">{selected.eventType}</p>
              ) : null}
              {getNotificationDetailRows(selected).length ? (
                <dl className="nt-sheet__details">
                  {getNotificationDetailRows(selected).map((row) => (
                    <div key={row.label}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <div className="detail-cta">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
                {selected.appointmentId ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      const payload = buildViewAppointmentPayload(selected);
                      setSelected(null);
                      handleNotificationNavigation(navigate, payload);
                    }}
                  >
                    View Appointment
                  </button>
                ) : null}
                {!selected.isRead ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      markAsRead?.(selected.id);
                      setSelected({ ...selected, isRead: true });
                    }}
                  >
                    Mark as Read
                  </button>
                ) : null}
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

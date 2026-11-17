import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  RefreshCw,
  Plus,
} from "lucide-react";
import AppShell from "../components/AppShell";
import AdvanceLoad from "../components/ui/AdvanceLoad";
import DietitianBadge from "../components/DietitianBadge";
import PageHeader from "../components/PageHeader";
import {
  buildVideoCallNavParams,
  canOfferCancel,
  canOfferReschedule,
  hasAlreadyRescheduled,
  isAppointmentJoinable,
  isAppointmentInPast,
  formatAppointmentDateFull,
  formatAppointmentTimeLabel,
  formatDoctorDisplayName,
  getConsultationScheduleLabels,
  resolveAppointmentLookupId,
} from "../consult/appointmentUtils";
import { showSuccessToast } from "../config/key";
import { useJoinWindowTick } from "../hooks/useJoinWindow";
import { mapAppointment } from "../profile/map";
import { formatConsultationAmount } from "../home/catalog";
import { formatPaymentTimestamp, getRefundProgress } from "../utils/paymentHistoryUtils";
import { requireAuth } from "../services/guestAuth";
import { getConsultHistory } from "../services/consultService";
import { invalidateApiCache } from "../services/apiClient";
import { consultationHasPrescription } from "../utils/prescriptionDetailUtils";
import "../design/pages/appointments.css";

const PAGE_SIZE = 20;

const PAST_STATUS = [
  "completed",
  "cancelled",
  "missed",
  "expired",
  "no_show",
  "noshow",
  "past",
];

const FOLLOW_UP_FILTERS = [
  { key: "all", label: "All visits" },
  { key: "true", label: "Follow-up" },
  { key: "false", label: "Regular" },
];

const UPCOMING_STATUS_FILTERS = [
  { key: "all", label: "Any status" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "reschedule", label: "Reschedule" },
];

const PAST_STATUS_FILTERS = [
  { key: "all", label: "Any status" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "missed", label: "Missed" },
];

const STATUS_STYLE = {
  confirmed: { background: "#e3f3ec", color: "#0b6b4f" },
  upcoming: { background: "#e3f3ec", color: "#0b6b4f" },
  booked: { background: "#e3f3ec", color: "#0b6b4f" },
  pending: { background: "#fff4dc", color: "#a8650c" },
  testing: { background: "#f3f4f6", color: "#64748b" },
  processing: { background: "#f3f4f6", color: "#64748b" },
  cancelled: { background: "#fbe9e7", color: "#a8453a" },
  completed: { background: "#e3f3ec", color: "#0b6b4f" },
  missed: { background: "#f3f4f6", color: "#6b7280" },
  expired: { background: "#f3f4f6", color: "#6b7280" },
  no_show: { background: "#f3f4f6", color: "#6b7280" },
  noshow: { background: "#f3f4f6", color: "#6b7280" },
  reschedule: { background: "#f8ecc9", color: "#8a6b2e" },
  rescheduled: { background: "#f8ecc9", color: "#8a6b2e" },
};

const formatStatusLabel = (status) => {
  if (status === "cancellation_requested") return "Confirmed";
  // Patient-facing label for internal statuses (same as the app).
  if (["testing", "test"].includes(String(status || "").toLowerCase())) return "Processing";
  const raw = String(status || "")
    .replace(/_/g, " ")
    .trim();
  if (!raw) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
};

// Backend may mark an appointment "confirmed" before payment is captured.
// Never show Confirmed for an unpaid booking.
const PAYMENT_PENDING_RE = /^(pending|created|initiated|unpaid|failed|payment_pending|attempted)$/;
const paymentPendingOf = (item) => {
  const raw = item?.raw ?? item ?? {};
  const appt = raw?.appointment || {};
  const value = String(
    raw?.payment_status ??
      raw?.payment?.status ??
      raw?.payment?.payment_status ??
      appt?.payment_status ??
      appt?.payment?.status ??
      (raw?.is_paid === false || appt?.is_paid === false ? "unpaid" : ""),
  )
    .trim()
    .toLowerCase();
  return PAYMENT_PENDING_RE.test(value);
};

const LIVE_CALL = ["in_progress", "live", "ongoing", "started"];

const apiDay = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const visitDate = (item) => {
  const raw = item?.raw || {};
  const appointment = raw.appointment || {};
  return (
    item?.date ||
    appointment.appointment_date ||
    raw.appointment_date ||
    raw.date ||
    ""
  );
};

/** Calendar date is before today, even if the status is still Confirmed. */
const isBeforeToday = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || "").trim());
  if (!match) return false;
  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return day < today;
};

/** A finished visit belongs in Past: earlier calendar day, or today's slot has ended. */
const isPastVisit = (item) => {
  const call = String(item?.call_status || "").toLowerCase();
  if (LIVE_CALL.includes(call)) return false;
  if (isBeforeToday(visitDate(item))) return true;
  return isAppointmentInPast(item);
};

const itemHasPrescription = (item) => {
  if (item?.hasPrescription) return true;
  const raw = item?.raw ?? item;
  return (
    consultationHasPrescription(raw) ||
    consultationHasPrescription(raw?.appointment) ||
    raw?.has_prescription === true ||
    raw?.is_prescribed === true ||
    Boolean(raw?.prescription_id || raw?.appointment?.prescription_id)
  );
};


export default function Appointments() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const upcomingOnly = params.get("mode") === "upcoming";
  const [tab, setTab] = useState("upcoming");
  const [statusFilter, setStatusFilter] = useState("all");
  const [followUpFilter, setFollowUpFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const listScope = upcomingOnly ? "upcoming" : tab;

  const apiFilters = useMemo(() => {
    const filters = {};
    filters.appointment_status =
      statusFilter !== "all" ? statusFilter : listScope;
    if (followUpFilter !== "all") filters.follow_up = followUpFilter;
    return filters;
  }, [listScope, statusFilter, followUpFilter]);

  // Tab / filter switches and refresh race: only the newest list request may write state.
  const listRequestRef = useRef(0);
  const loadPage = useCallback(
    async (pageNo, mode = "replace") => {
      if (!(await requireAuth("Please login to view appointments"))) return;
      const requestId = ++listRequestRef.current;
      if (mode === "refresh") invalidateApiCache("customers/doctors/consultation-history/");
      if (mode === "append") setLoadingMore(true);
      else if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      try {
        const mapList = (res) => {
          const list = res?.data?.results || res?.results || [];
          return Array.isArray(list) ? list.map(mapAppointment) : [];
        };
        const hasNext = (res, mapped) =>
          Boolean(res?.data?.next || res?.next) || mapped.length >= PAGE_SIZE;

        const today = apiDay();
        let mapped = [];
        let more = false;
        if (listScope === "past" && statusFilter === "all") {
          const followUp =
            followUpFilter !== "all" ? { follow_up: followUpFilter } : {};
          const [pastRes, activeRes] = await Promise.all([
            getConsultHistory({
              page: pageNo,
              page_size: PAGE_SIZE,
              appointment_status: "past",
              ...followUp,
            }),
            getConsultHistory({
              page: pageNo,
              page_size: PAGE_SIZE,
              to_date: today,
              ...followUp,
            }),
          ]);
          if (requestId !== listRequestRef.current) return;
          const pastList = mapList(pastRes);
          const endedActive = mapList(activeRes).filter(isPastVisit);
          const seen = new Set();
          mapped = [...pastList, ...endedActive].filter((item) => {
            const key = String(item.consultationId || item.appointmentId || item.id);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          more = hasNext(pastRes, pastList) || hasNext(activeRes, mapList(activeRes));
        } else if (listScope === "upcoming" && statusFilter === "all") {
          const followUp =
            followUpFilter !== "all" ? { follow_up: followUpFilter } : {};
          const results = await Promise.all(
            ["confirmed", "pending", "reschedule", "rescheduled", "cancellation_requested"].map(
              (status) =>
                getConsultHistory({
                  page: pageNo,
                  page_size: PAGE_SIZE,
                  status,
                  ...followUp,
                }).catch(() => null),
            ),
          );
          if (requestId !== listRequestRef.current) return;
          const seen = new Set();
          mapped = results.flatMap(mapList).filter((item) => {
            const key = String(item.consultationId || item.appointmentId || item.id);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          more = results.some((res) => hasNext(res, mapList(res)));
        } else {
          const res = await getConsultHistory({
            page: pageNo,
            page_size: PAGE_SIZE,
            ...apiFilters,
          });
          if (requestId !== listRequestRef.current) return;
          mapped = mapList(res);
          more = hasNext(res, mapped);
        }
        setItems((prev) => (mode === "append" ? [...prev, ...mapped] : mapped));
        setPage(pageNo);
        setHasMore(more);
      } finally {
        if (requestId === listRequestRef.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [apiFilters, followUpFilter, listScope, statusFilter],
  );

  useEffect(() => {
    loadPage(1, "replace");
  }, [loadPage]);

  // Re-render when a join window opens / closes so "Join call" appears exactly 5 min before start.
  useJoinWindowTick(items);

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    setStatusFilter("all");
    setFollowUpFilter("all");
  };

  const visible = useMemo(
    () =>
      items.filter((item) => {
        const status = String(item.status || "").toLowerCase();
        const ended = isPastVisit(item);
        if (statusFilter === "all") {
          if (listScope === "upcoming") {
            if (PAST_STATUS.includes(status) || ended) return false;
          } else if (
            !PAST_STATUS.includes(status) &&
            status !== "past" &&
            !ended
          ) {
            return false;
          }
        } else if (listScope === "upcoming" && ended) {
          return false;
        } else if (status !== statusFilter && status !== `${statusFilter}d`) {
          if (
            !(
              statusFilter === "reschedule" &&
              (status === "reschedule" || status === "rescheduled")
            )
          ) {
            return false;
          }
        }
        if (followUpFilter !== "all") {
          const raw = item.raw || {};
          const fu = raw.follow_up;
          const hasFollowUp = Boolean(
            item.followUpDate ||
            fu?.date ||
            fu?.schedule ||
            raw.follow_up_active,
          );
          if (followUpFilter === "true" && !hasFollowUp) return false;
          if (followUpFilter === "false" && hasFollowUp) return false;
        }
        return true;
      }),
    [items, listScope, statusFilter, followUpFilter],
  );

  const openDetails = (item, action) => {
    const lookupId =
      resolveAppointmentLookupId({ rawData: item.raw, ...item }) ||
      item.appointmentId ||
      item.id;
    if (!lookupId) return;
    navigate(
      `/profile/appointments/${lookupId}`,
      action ? { state: { action } } : undefined,
    );
  };

  const joinCall = (item) => {
    if (!isAppointmentJoinable(item)) {
      showSuccessToast(
        "Video call is not active yet. Please wait for the doctor to start the consultation.",
        "error",
      );
      return;
    }
    const video = buildVideoCallNavParams(
      { rawData: item.raw, ...item },
      {
        role: "patient",
        otherPartyName: formatDoctorDisplayName(item.doctorName),
        otherPartyImage: item.image,
      },
    );
    navigate(`/profile/video/${video.appointmentId}`, { state: video });
  };

  const openPrescription = (item) => {
    const lookupId = item.consultationId || item.appointmentId || item.id;
    if (!lookupId) return;
    navigate(`/profile/prescriptions/${lookupId}`, {
      state: {
        appointment_id: item.appointmentId,
        consultation_id: item.consultationId,
      },
    });
  };

  const statusChips =
    listScope === "upcoming" ? UPCOMING_STATUS_FILTERS : PAST_STATUS_FILTERS;
  const filtersOn = followUpFilter !== "all" || statusFilter !== "all";
  const resultLabel = loading
    ? "Loading…"
    : `${visible.length} ${visible.length === 1 ? "appointment" : "appointments"}`;
  const clearFilters = () => {
    setFollowUpFilter("all");
    setStatusFilter("all");
  };

  return (
    <AppShell tab="profile">
      <section className="catalog-page appointments-page ap-premium">
        <PageHeader
          title={upcomingOnly ? "Upcoming" : "My Appointments"}
          subtitle={
            upcomingOnly ? "Your next consultations" : "Manage your visits"
          }
          backTo="/profile"
          actions={
            <>
              <button
                type="button"
                className="ap-btn ap-btn--ghost"
                onClick={() => loadPage(1, "refresh")}
                disabled={refreshing || loading}
              >
                <RefreshCw size={18} className={refreshing ? "ap-spin" : ""} aria-hidden />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
              <button
                type="button"
                className="ap-btn ap-btn--primary"
                onClick={() => navigate("/consult/doctors")}
              >
                <Plus size={18} aria-hidden />
                Book
              </button>
            </>
          }
        />

        <div className="ap-layout">
          <aside className="ap-side" aria-label="Filter appointments">
            {!upcomingOnly ? (
              <div className="ap-side__group">
                <p className="ap-side__label" id="ap-when-label">When</p>
                <div className="ap-side__list" role="tablist" aria-labelledby="ap-when-label">
                  {[
                    { id: "upcoming", label: "Upcoming" },
                    { id: "past", label: "Past" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === item.id}
                      className={`ap-side__opt${tab === item.id ? " is-on" : ""}`}
                      onClick={() => handleTabChange(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="ap-side__group">
              <p className="ap-side__label" id="ap-visit-label">Visit</p>
              <div className="ap-side__list" role="group" aria-labelledby="ap-visit-label">
                {FOLLOW_UP_FILTERS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={followUpFilter === item.key}
                    className={`ap-side__opt${followUpFilter === item.key ? " is-on" : ""}`}
                    onClick={() => setFollowUpFilter(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ap-side__group">
              <p className="ap-side__label" id="ap-status-label">Status</p>
              <div className="ap-side__list" role="group" aria-labelledby="ap-status-label">
                {statusChips.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={statusFilter === item.key}
                    className={`ap-side__opt${statusFilter === item.key ? " is-on" : ""}`}
                    onClick={() => setStatusFilter(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
          <div className="ap-layout__main">
            <div className="ap-filters__meta">
              <span className="ap-toolbar__count" aria-live="polite">{resultLabel}</span>
              {filtersOn ? (
                <button type="button" className="ap-toolbar__clear" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : null}
            </div>

        {loading ? (
          <AdvanceLoad variant="list" label="Loading appointments" onRetry={() => loadPage(1, "replace")} />
        ) : visible.length === 0 ? (
          <div className="empty-copy">
            <strong>
              {filtersOn
                ? "No visits match these filters"
                : listScope === "upcoming"
                  ? "No upcoming appointments"
                  : "No past appointments"}
            </strong>
            <p>
              {filtersOn
                ? "Clear Visit or Status to see the rest of this list."
                : listScope === "upcoming"
                  ? "Book a doctor to schedule your next consultation."
                  : "Finished visits show up here, including ones still marked confirmed."}
            </p>
            {filtersOn ? (
              <button type="button" className="cta" onClick={clearFilters}>
                Clear filters
              </button>
            ) : listScope === "upcoming" ? (
              <button
                type="button"
                className="cta"
                onClick={() => navigate("/consult/doctors")}
              >
                Find doctors
              </button>
            ) : null}
          </div>
        ) : (
          <div className="appoint-list">
            {visible.map((item) => {
              const paymentPending = paymentPendingOf(item);
              const status = String(item.status || "").toLowerCase();
              const statusStyle = (paymentPending
                ? STATUS_STYLE.pending
                : STATUS_STYLE[status]) || {
                background: "#f3f4f6",
                color: "#64748b",
              };
              const schedule = getConsultationScheduleLabels(item);
              const dateLabel = [
                schedule.weekday,
                schedule.dateLabel || formatAppointmentDateFull(item.date),
              ]
                .filter(Boolean)
                .join(", ");
              const timeLabel =
                schedule.timeLabel ||
                formatAppointmentTimeLabel(item.time) ||
                item.time;
              const timeRange = item.endTime
                ? `${timeLabel} – ${formatAppointmentTimeLabel(item.endTime)}`
                : timeLabel;
              const showReschedule = canOfferReschedule(
                status,
                item.date,
                item.time,
                item,
              );
              const showCancel = canOfferCancel(status, item.date, item.time);
              const withinModify = showReschedule || showCancel;
              const hasRx = itemHasPrescription(item);
              const showViewDetails = hasRx && PAST_STATUS.includes(status);
              const showJoinCall = isAppointmentJoinable(item);
              const refund = getRefundProgress(status, item.raw, item);
              const therapy =
                item.therapies || item.specialty || "Ayurvedic consultation";
              const followUp = item.followUpDate;
              return (
                <article
                  key={item.consultationId || item.appointmentId || item.id}
                  className="checkout-card appoint-card ap-card"
                  data-status={paymentPending ? "pending" : status}
                >
                  <button
                    type="button"
                    className="history-card-main"
                    onClick={() => openDetails(item)}
                  >
                    {item.image ? (
                      <img src={item.image} alt="" />
                    ) : (
                      <span className="thumb-fallback">+</span>
                    )}
                    <div>
                      <div className="history-name-row">
                        <strong>
                          {formatDoctorDisplayName(item.doctorName)}
                        </strong>
                        {status ? (
                          <em
                            style={{
                              background: statusStyle.background,
                              color: statusStyle.color,
                            }}
                          >
                            {paymentPending
                              ? "Payment pending"
                              : formatStatusLabel(status)}
                          </em>
                        ) : null}
                      </div>
                      <DietitianBadge doctor={item} />
                      <div className="ap-specialties">
                        {String(therapy)
                          .split(/[,;|]/)
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((s) => (
                            <span key={s}>{s}</span>
                          ))}
                      </div>
                      {item.patientName ? (
                        <small className="ap-patient">Patient · {item.patientName}</small>
                      ) : null}
                    </div>
                  </button>
                  <div className="confirm-meta-grid appoint-meta">
                    <div className="confirm-meta-chip">
                      <small>
                        <CalendarDays size={13} aria-hidden /> Date
                      </small>
                      <strong>{dateLabel || "—"}</strong>
                    </div>
                    <div className="confirm-meta-chip">
                      <small>
                        <Clock size={13} aria-hidden /> Time
                      </small>
                      <strong>{timeRange || "—"}</strong>
                    </div>
                  </div>
                  {refund ? (
                    <p className="appoint-followup">
                      {refund.title} {refund.amount != null ? formatConsultationAmount(refund.amount) : ""}
                      {refund.at ? ` · ${formatPaymentTimestamp(refund.at)}` : ""}
                    </p>
                  ) : null}
                  {followUp ? (
                    <p className="appoint-followup">
                      Follow-up scheduled · {followUp}
                    </p>
                  ) : null}
                  {withinModify || showViewDetails || showJoinCall ? (
                    <div className="history-actions">
                      {showReschedule && !showJoinCall ? (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            if (hasAlreadyRescheduled(item)) {
                              showSuccessToast(
                                "This appointment was already rescheduled once. You can only cancel it.",
                                "error",
                              );
                              return;
                            }
                            openDetails(item, "reschedule");
                          }}
                        >
                          {status === "reschedule"
                            ? "Request change"
                            : "Reschedule"}
                        </button>
                      ) : null}
                      {showJoinCall ? (
                        <button
                          type="button"
                          className="cta"
                          onClick={() => joinCall(item)}
                        >
                          Join call
                        </button>
                      ) : showCancel ? (
                        <button
                          type="button"
                          className="cta danger"
                          onClick={() => openDetails(item, "cancel")}
                        >
                          Cancel
                        </button>
                      ) : null}
                      {!withinModify && showViewDetails ? (
                        <button
                          type="button"
                          className="cta"
                          onClick={() => openPrescription(item)}
                        >
                          View details
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {!loading && hasMore && visible.length > 0 ? (
          <button
            type="button"
            className="ghost"
            disabled={loadingMore}
            onClick={() => loadPage(page + 1, "append")}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        ) : null}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

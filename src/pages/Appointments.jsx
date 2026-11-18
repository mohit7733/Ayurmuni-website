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
import { consultationDoctorPhoto } from "../components/consult/ConsultationCard";
import { nameInitials } from "../utils/initials";
import {
  buildVideoCallNavParams,
  canOfferCancel,
  canOfferReschedule,
  hasAlreadyRescheduled,
  isAppointmentJoinable,
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
import { fetchUpcomingAppointmentList } from "../hooks/useUpcomingAppointments";
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
  // { key: "all", label: "All visits" },
  // { key: "follow_up", label: "Follow-up" },
];

const followUpDetails = (item) => {
  const raw = item?.raw || {};
  const appointment = raw.appointment || {};
  const followUp = raw.follow_up || appointment.follow_up || {};
  const scheduled =
    followUp.schedule === true || String(followUp.schedule).toLowerCase() === "true";
  const date = String(followUp.date || "").trim();
  const reason = String(followUp.reason || "").trim();
  return {
    scheduled,
    date,
    reason,
    dateLabel: date ? formatAppointmentDateFull(date) : "",
  };
};

const isFollowUpVisit = (item) => followUpDetails(item).scheduled;

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

const ALL_STATUS_FILTERS = [
  { key: "all", label: "Any status" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "reschedule", label: "Reschedule" },
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

function VisitPhoto({ src, name }) {
  const [failed, setFailed] = useState(false);
  const show = Boolean(src) && !failed;
  return (
    <span className="ap-card__photo" aria-hidden>
      {show ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className="ap-card__initials">{nameInitials(name, 2, "Dr")}</span>
      )}
    </span>
  );
}

const visitRole = (item) => {
  const specialty = String(item.specialty || "")
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");
  return specialty || "Ayurveda consultation";
};

const visitFacts = (item) => {
  const type = String(item.consultationType || "")
    .replace(/_/g, " ")
    .trim();
  return [item.experience, item.city, type]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
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
        // Match HomeJoinAppointments / useUpcomingAppointments so "+3 more" opens the same set.
        if (listScope === "upcoming") {
          const mapped = await fetchUpcomingAppointmentList(Math.max(PAGE_SIZE, 50));
          if (requestId !== listRequestRef.current) return;
          setItems(mapped);
          setPage(1);
          setHasMore(false);
          return;
        }

        const mapList = (res) => {
          const list = res?.data?.results || res?.results || [];
          return Array.isArray(list) ? list.map(mapAppointment) : [];
        };
        const hasNext = (res, mapped) =>
          Boolean(res?.data?.next || res?.next) || mapped.length >= PAGE_SIZE;

        const res = await getConsultHistory({
          page: pageNo,
          page_size: PAGE_SIZE,
          timeframe: listScope,
          ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        });
        if (requestId !== listRequestRef.current) return;
        const mapped = mapList(res);
        const more = hasNext(res, mapped);
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
    [listScope, statusFilter],
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
        if (statusFilter !== "all" && status !== statusFilter && status !== `${statusFilter}d`) {
          if (
            !(
              statusFilter === "reschedule" &&
              (status === "reschedule" || status === "rescheduled")
            )
          ) {
            return false;
          }
        }
        if (followUpFilter === "follow_up" && !isFollowUpVisit(item)) return false;
        return true;
      }),
    [items, statusFilter, followUpFilter],
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
    listScope === "upcoming"
      ? UPCOMING_STATUS_FILTERS
      : listScope === "past"
        ? PAST_STATUS_FILTERS
        : ALL_STATUS_FILTERS;
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
          <aside className="st-cat-col ap-side" aria-label="Filter appointments">
            <p className="st-cat-col__eyebrow">Filter</p>
            <h3 id="ap-filter-title">Appointments</h3>
            {!upcomingOnly ? (
              <div className="ap-side__group">
                <p className="ap-side__label" id="ap-when-label">When</p>
                <ul className="st-cat-filter" role="tablist" aria-labelledby="ap-when-label">
                  {[
                    { id: "all", label: "All" },
                    { id: "upcoming", label: "Upcoming" },
                    { id: "past", label: "Past" },
                  ].map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        className={tab === item.id ? "is-on" : ""}
                        onClick={() => handleTabChange(item.id)}
                      >
                        <span className="st-cat-filter__mark" aria-hidden>
                          {item.label.charAt(0)}
                        </span>
                        <span className="st-cat-filter__copy">
                          <strong>{item.label}</strong>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {/* <div className="ap-side__group">
              <p className="ap-side__label" id="ap-visit-label">Visit</p>
              <ul className="st-cat-filter" role="group" aria-labelledby="ap-visit-label">
                {FOLLOW_UP_FILTERS.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      aria-pressed={followUpFilter === item.key}
                      className={followUpFilter === item.key ? "is-on" : ""}
                      onClick={() => setFollowUpFilter(item.key)}
                    >
                      <span className="st-cat-filter__mark" aria-hidden>
                        {item.label.charAt(0)}
                      </span>
                      <span className="st-cat-filter__copy">
                        <strong>{item.label}</strong>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div> */}
            <div className="ap-side__group">
              <p className="ap-side__label" id="ap-status-label">Status</p>
              <ul className="st-cat-filter" role="group" aria-labelledby="ap-status-label">
                {statusChips.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      aria-pressed={statusFilter === item.key}
                      className={statusFilter === item.key ? "is-on" : ""}
                      onClick={() => setStatusFilter(item.key)}
                    >
                      <span className="st-cat-filter__mark" aria-hidden>
                        {item.label.charAt(0)}
                      </span>
                      <span className="st-cat-filter__copy">
                        <strong>{item.label}</strong>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
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
                  : listScope === "past"
                    ? "No past appointments"
                    : "No appointments"}
            </strong>
            <p>
              {filtersOn
                ? "Clear Visit or Status to see the rest of this list."
                : listScope === "upcoming"
                  ? "Book a doctor to schedule your next consultation."
                  : listScope === "past"
                    ? "Finished visits show up here, including ones still marked confirmed."
                    : "Upcoming and past visits show up here."}
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
              const followUp = followUpDetails(item);
              const doctorName = formatDoctorDisplayName(item.doctorName);
              const photo = item.image || consultationDoctorPhoto(item);
              const facts = visitFacts(item);
              return (
                <article
                  key={item.consultationId || item.appointmentId || item.id}
                  className="checkout-card appoint-card ap-card"
                  data-status={paymentPending ? "pending" : status}
                >
                  <button
                    type="button"
                    className="ap-card__main"
                    onClick={() => openDetails(item)}
                  >
                    <VisitPhoto src={photo} name={doctorName} />
                    <div className="ap-card__who">
                      <div className="ap-card__name">
                        <strong>{doctorName}</strong>
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
                      <div className="ap-card__role">
                        <DietitianBadge doctor={item} />
                        <span>{visitRole(item)}</span>
                      </div>
                      {facts.length ? (
                        <p className="ap-card__facts">{facts.join(" · ")}</p>
                      ) : null}
                      {item.patientName ? (
                        <p className="ap-card__patient">Patient · {item.patientName}</p>
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
                    {followUp.scheduled ? (
                      <div className="confirm-meta-chip confirm-meta-chip--follow">
                        <small>
                          <CalendarDays size={13} aria-hidden /> Follow-up
                        </small>
                        <strong>{followUp.dateLabel || "Scheduled"}</strong>
                        {followUp.reason ? <span>{followUp.reason}</span> : null}
                      </div>
                    ) : null}
                  </div>
                  {refund ? (
                    <p className="appoint-followup">
                      {refund.title} {refund.amount != null ? formatConsultationAmount(refund.amount) : ""}
                      {refund.at ? ` · ${formatPaymentTimestamp(refund.at)}` : ""}
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
            className="ap-more"
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

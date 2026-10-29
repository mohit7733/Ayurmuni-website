import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  RefreshCw,
  Plus,
} from "lucide-react";
import AppShell from "../components/AppShell";
import { Chip, Tabs } from "../components/ui";
import AdvanceLoad from "../components/ui/AdvanceLoad";
import DietitianBadge from "../components/DietitianBadge";
import PageHeader from "../components/PageHeader";
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
import { formatRupee } from "../home/catalog";
import { formatPaymentTimestamp, getCompletedRefund } from "../utils/paymentHistoryUtils";
import { requireAuth } from "../services/guestAuth";
import { getConsultHistory } from "../services/consultService";
import { invalidateApiCache } from "../services/apiClient";
import { consultationHasPrescription } from "../utils/prescriptionDetailUtils";
import "../design/pages/appointments.css";

const PAGE_SIZE = 20;

const UPCOMING_STATUS = [
  "confirmed",
  "reschedule",
  "rescheduled",
  "cancelled",
  "upcoming",
  "booked",
];
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
  { key: "cancelled", label: "Cancelled" },
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
        const res = await getConsultHistory({
          page: pageNo,
          page_size: PAGE_SIZE,
          ...apiFilters,
        });
        if (requestId !== listRequestRef.current) return;
        const list = res?.data?.results || res?.results || [];
        const mapped = Array.isArray(list) ? list.map(mapAppointment) : [];
        setItems((prev) => (mode === "append" ? [...prev, ...mapped] : mapped));
        setPage(pageNo);
        setHasMore(Boolean(res?.data?.next) || mapped.length >= PAGE_SIZE);
      } finally {
        if (requestId === listRequestRef.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [apiFilters],
  );

  useEffect(() => {
    loadPage(1, "replace");
  }, [loadPage]);

  // Re-render when a join window opens / closes so "Join call" appears exactly 5 min before start.
  useJoinWindowTick(items);

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    setStatusFilter("all");
  };

  const visible = useMemo(
    () =>
      items.filter((item) => {
        const status = String(item.status || "").toLowerCase();
        if (statusFilter === "all") {
          const inScope =
            listScope === "upcoming"
              ? UPCOMING_STATUS.includes(status) ||
                status === "upcoming" ||
                !PAST_STATUS.includes(status)
              : PAST_STATUS.includes(status) || status === "past";
          if (!inScope && listScope === "past") return false;
          if (listScope === "upcoming" && PAST_STATUS.includes(status))
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
  const resultLabel = loading
    ? "Loading…"
    : `${visible.length} ${visible.length === 1 ? "appointment" : "appointments"}`;

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
                <RefreshCw size={15} className={refreshing ? "ap-spin" : ""} aria-hidden />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
              <button
                type="button"
                className="ap-btn ap-btn--primary"
                onClick={() => navigate("/consult/doctors")}
              >
                <Plus size={15} aria-hidden />
                Book
              </button>
            </>
          }
        />

        {!upcomingOnly ? (
          <Tabs
            label="When"
            className="ap-when-tabs"
            value={tab}
            onChange={handleTabChange}
            items={[
              { id: "upcoming", label: "Upcoming" },
              { id: "past", label: "Past" },
            ]}
          />
        ) : null}
        <div className="ap-toolbar" role="toolbar" aria-label="Filter appointments">
          <div className="ap-toolbar__chips">
            <div className="ap-toolbar__group" role="group" aria-label="Visit type">
              {FOLLOW_UP_FILTERS.map((item) => (
                <Chip
                  key={item.key}
                  selected={followUpFilter === item.key}
                  onClick={() => setFollowUpFilter(item.key)}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
            <span className="ap-toolbar__sep" aria-hidden />
            <div className="ap-toolbar__group" role="group" aria-label="Status">
              {statusChips.map((item) => (
                <Chip
                  key={item.key}
                  selected={statusFilter === item.key}
                  onClick={() => setStatusFilter(item.key)}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="ap-toolbar__meta">
            <span className="ap-toolbar__count" aria-live="polite">{resultLabel}</span>
            {followUpFilter !== "all" || statusFilter !== "all" ? (
              <button
                type="button"
                className="ap-toolbar__clear"
                onClick={() => {
                  setFollowUpFilter("all");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <AdvanceLoad variant="list" label="Loading appointments" onRetry={() => loadPage(1, "replace")} />
        ) : visible.length === 0 ? (
          <div className="empty-copy">
            <strong>
              {listScope === "upcoming"
                ? "No upcoming appointments"
                : "No past appointments"}
            </strong>
            <p>
              {listScope === "upcoming"
                ? "Book a doctor to schedule your next consultation."
                : "Your completed and missed visits will appear here."}
            </p>
            {listScope === "upcoming" ? (
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
              const refund = getCompletedRefund(status, item.raw, item);
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
                      Refunded {refund.amount != null ? formatRupee(refund.amount) : ""}
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

        {!loading && hasMore ? (
          <button
            type="button"
            className="ghost"
            disabled={loadingMore}
            onClick={() => loadPage(page + 1, "append")}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </section>
    </AppShell>
  );
}

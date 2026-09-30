import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import {
  buildVideoCallNavParams,
  canModifyAppointment,
  formatAppointmentDateFull,
  formatAppointmentTimeLabel,
  formatDoctorDisplayName,
  getConsultationScheduleLabels,
  resolveAppointmentLookupId,
} from '../consult/appointmentUtils';
import { showSuccessToast } from '../config/key';
import { mapAppointment } from '../profile/map';
import { requireAuth } from '../services/guestAuth';
import { getConsultHistory } from '../services/consultService';
import { consultationHasPrescription } from '../utils/prescriptionDetailUtils';

const PAGE_SIZE = 20;

const UPCOMING_STATUS = ['confirmed', 'reschedule', 'rescheduled', 'cancelled', 'upcoming', 'booked'];
const PAST_STATUS = ['completed', 'cancelled', 'missed', 'expired', 'no_show', 'noshow', 'past'];

const FOLLOW_UP_FILTERS = [
  { key: 'all', label: 'All visits' },
  { key: 'true', label: 'Follow-up' },
  { key: 'false', label: 'Regular' },
];

const UPCOMING_STATUS_FILTERS = [
  { key: 'all', label: 'Any status' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'reschedule', label: 'Reschedule' },
];

const PAST_STATUS_FILTERS = [
  { key: 'all', label: 'Any status' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'missed', label: 'Missed' },
];

const STATUS_STYLE = {
  confirmed: { background: '#eef4ff', color: '#1048b9' },
  upcoming: { background: '#eef4ff', color: '#1048b9' },
  booked: { background: '#eef4ff', color: '#1048b9' },
  pending: { background: '#fff7ed', color: '#ea580c' },
  cancelled: { background: '#fee2e2', color: '#ef4444' },
  completed: { background: '#dcfce7', color: '#16a34a' },
  missed: { background: '#f3f4f6', color: '#6b7280' },
  expired: { background: '#f3f4f6', color: '#6b7280' },
  no_show: { background: '#f3f4f6', color: '#6b7280' },
  noshow: { background: '#f3f4f6', color: '#6b7280' },
  reschedule: { background: '#fef3c7', color: '#b45309' },
  rescheduled: { background: '#fef3c7', color: '#b45309' },
};

const formatStatusLabel = (status) => {
  if (status === 'cancellation_requested') return 'Confirmed';
  const raw = String(status || '')
    .replace(/_/g, ' ')
    .trim();
  if (!raw) return '';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
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

const ChipRow = ({ items, activeKey, onChange }) => (
  <div className="home-rail subcat-rail">
    {items.map((item) => (
      <button
        key={item.key}
        type="button"
        className={`chip ${activeKey === item.key ? 'on' : ''}`}
        onClick={() => onChange(item.key)}
      >
        {item.label}
      </button>
    ))}
  </div>
);

export default function Appointments() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const upcomingOnly = params.get('mode') === 'upcoming';
  const [tab, setTab] = useState('upcoming');
  const [statusFilter, setStatusFilter] = useState('all');
  const [followUpFilter, setFollowUpFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const listScope = upcomingOnly ? 'upcoming' : tab;

  const apiFilters = useMemo(() => {
    const filters = {};
    filters.appointment_status = statusFilter !== 'all' ? statusFilter : listScope;
    if (followUpFilter !== 'all') filters.follow_up = followUpFilter;
    return filters;
  }, [listScope, statusFilter, followUpFilter]);

  const loadPage = useCallback(
    async (pageNo, mode = 'replace') => {
      if (!(await requireAuth('Please login to view appointments'))) return;
      if (mode === 'append') setLoadingMore(true);
      else if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const res = await getConsultHistory({
          page: pageNo,
          page_size: PAGE_SIZE,
          ...apiFilters,
        });
        const list = res?.data?.results || res?.results || [];
        const mapped = Array.isArray(list) ? list.map(mapAppointment) : [];
        setItems((prev) => (mode === 'append' ? [...prev, ...mapped] : mapped));
        setPage(pageNo);
        setHasMore(Boolean(res?.data?.next) || mapped.length >= PAGE_SIZE);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [apiFilters],
  );

  useEffect(() => {
    loadPage(1, 'replace');
  }, [loadPage]);

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    setStatusFilter('all');
  };

  const visible = useMemo(
    () =>
      items.filter((item) => {
        const status = String(item.status || '').toLowerCase();
        if (statusFilter === 'all') {
          const inScope =
            listScope === 'upcoming'
              ? UPCOMING_STATUS.includes(status) || status === 'upcoming' || !PAST_STATUS.includes(status)
              : PAST_STATUS.includes(status) || status === 'past';
          if (!inScope && listScope === 'past') return false;
          if (listScope === 'upcoming' && PAST_STATUS.includes(status)) return false;
        } else if (status !== statusFilter && status !== `${statusFilter}d`) {
          if (!(statusFilter === 'reschedule' && (status === 'reschedule' || status === 'rescheduled'))) {
            return false;
          }
        }
        if (followUpFilter !== 'all') {
          const raw = item.raw || {};
          const fu = raw.follow_up;
          const hasFollowUp = Boolean(item.followUpDate || fu?.date || fu?.schedule || raw.follow_up_active);
          if (followUpFilter === 'true' && !hasFollowUp) return false;
          if (followUpFilter === 'false' && hasFollowUp) return false;
        }
        return true;
      }),
    [items, listScope, statusFilter, followUpFilter],
  );

  const openDetails = (item, action) => {
    const lookupId = resolveAppointmentLookupId({ rawData: item.raw, ...item }) || item.appointmentId || item.id;
    if (!lookupId) return;
    navigate(`/profile/appointments/${lookupId}`, action ? { state: { action } } : undefined);
  };

  const joinCall = (item) => {
    if (item.call_status !== 'in_progress') {
      showSuccessToast(
        'Video call is not active yet. Please wait for the doctor to start the consultation.',
        'error',
      );
      return;
    }
    const video = buildVideoCallNavParams(
      { rawData: item.raw, ...item },
      {
        role: 'patient',
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

  const statusChips = listScope === 'upcoming' ? UPCOMING_STATUS_FILTERS : PAST_STATUS_FILTERS;
  const resultLabel = loading
    ? 'Loading…'
    : `${visible.length} ${visible.length === 1 ? 'appointment' : 'appointments'}`;

  return (
    <AppShell tab="profile">
      <section className="catalog-page appointments-page">
        <PageHeader
          title={upcomingOnly ? 'Upcoming' : 'My Appointments'}
          subtitle={upcomingOnly ? 'Your next consultations' : 'Manage your visits'}
          backTo="/profile"
          actions={
            <>
              <button type="button" className="ghost" onClick={() => loadPage(1, 'refresh')} disabled={refreshing || loading}>
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
              <button type="button" className="cta" onClick={() => navigate('/consult/doctors')}>
                Book
              </button>
            </>
          }
        />

        {!upcomingOnly ? (
          <div className="appoint-filters">
            <div className="filter-group">
              <span>When</span>
              <div className="filter-chips">
                {[
                  { key: 'upcoming', label: 'Upcoming' },
                  { key: 'past', label: 'Past' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`chip ${tab === item.key ? 'on' : ''}`}
                    onClick={() => handleTabChange(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <span>Follow-up</span>
              <ChipRow items={FOLLOW_UP_FILTERS} activeKey={followUpFilter} onChange={setFollowUpFilter} />
            </div>
            <div className="filter-group">
              <span>Status</span>
              <ChipRow items={statusChips} activeKey={statusFilter} onChange={setStatusFilter} />
            </div>
          </div>
        ) : (
          <div className="appoint-filters">
            <div className="filter-group">
              <span>Follow-up</span>
              <ChipRow items={FOLLOW_UP_FILTERS} activeKey={followUpFilter} onChange={setFollowUpFilter} />
            </div>
            <div className="filter-group">
              <span>Status</span>
              <ChipRow items={statusChips} activeKey={statusFilter} onChange={setStatusFilter} />
            </div>
          </div>
        )}
        <p className="muted appoint-count">{resultLabel}</p>

        {loading ? (
          <p className="muted">Loading appointments…</p>
        ) : visible.length === 0 ? (
          <div className="empty-copy">
            <strong>{listScope === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}</strong>
            <p>
              {listScope === 'upcoming'
                ? 'Book a doctor to schedule your next consultation.'
                : 'Your completed and missed visits will appear here.'}
            </p>
            {listScope === 'upcoming' ? (
              <button type="button" className="cta" onClick={() => navigate('/consult/doctors')}>
                Find doctors
              </button>
            ) : null}
          </div>
        ) : (
          <div className="appoint-list">
          {visible.map((item) => {
            const status = String(item.status || '').toLowerCase();
            const statusStyle = STATUS_STYLE[status] || { background: '#f3f4f6', color: '#64748b' };
            const schedule = getConsultationScheduleLabels(item);
            const dateLabel = [schedule.weekday, schedule.dateLabel || formatAppointmentDateFull(item.date)]
              .filter(Boolean)
              .join(', ');
            const timeLabel =
              schedule.timeLabel ||
              formatAppointmentTimeLabel(item.time) ||
              item.time;
            const timeRange = item.endTime
              ? `${timeLabel} – ${formatAppointmentTimeLabel(item.endTime)}`
              : timeLabel;
            const withinModify = canModifyAppointment(status, item.date, item.time);
            const hasRx = itemHasPrescription(item);
            const showViewDetails = hasRx && PAST_STATUS.includes(status);
            const showJoinCall = item.call_status === 'in_progress';
            const therapy = item.therapies || item.specialty || 'Ayurvedic consultation';
            const followUp = item.followUpDate;
            return (
              <article key={item.consultationId || item.appointmentId || item.id} className="checkout-card appoint-card">
                <button type="button" className="history-card-main" onClick={() => openDetails(item)}>
                  {item.image ? <img src={item.image} alt="" /> : <span className="thumb-fallback">+</span>}
                  <div>
                    <div className="history-name-row">
                      <strong>{formatDoctorDisplayName(item.doctorName)}</strong>
                      {status ? (
                        <em style={{ background: statusStyle.background, color: statusStyle.color }}>
                          {formatStatusLabel(status)}
                        </em>
                      ) : null}
                    </div>
                    <small className="history-specialty">{therapy}</small>
                    {item.patientName ? <small>Patient · {item.patientName}</small> : null}
                  </div>
                </button>
                <div className="confirm-meta-grid appoint-meta">
                  <div className="confirm-meta-chip">
                    <small>Date</small>
                    <strong>{dateLabel || '—'}</strong>
                  </div>
                  <div className="confirm-meta-chip">
                    <small>Time</small>
                    <strong>{timeRange || '—'}</strong>
                  </div>
                </div>
                {followUp ? <p className="appoint-followup">Follow-up scheduled · {followUp}</p> : null}
                {withinModify || showViewDetails || showJoinCall ? (
                  <div className="history-actions">
                    {withinModify && !showJoinCall ? (
                      <button type="button" className="ghost" onClick={() => openDetails(item, 'reschedule')}>
                        {status === 'reschedule' ? 'Request change' : 'Reschedule'}
                      </button>
                    ) : null}
                    {showJoinCall ? (
                      <button type="button" className="cta" onClick={() => joinCall(item)}>
                        Join call
                      </button>
                    ) : withinModify ? (
                      <button type="button" className="cta danger" onClick={() => openDetails(item, 'cancel')}>
                        Cancel
                      </button>
                    ) : null}
                    {!withinModify && showViewDetails ? (
                      <button type="button" className="cta" onClick={() => openPrescription(item)}>
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
          <button type="button" className="ghost" disabled={loadingMore} onClick={() => loadPage(page + 1, 'append')}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        ) : null}
      </section>
    </AppShell>
  );
}

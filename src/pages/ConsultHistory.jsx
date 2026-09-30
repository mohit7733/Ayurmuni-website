import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import {
  canModifyAppointment,
  formatAppointmentDateFull,
  formatDoctorDisplayName,
  resolveAppointmentLookupId,
} from '../consult/appointmentUtils';
import { formatSlotTime } from '../consult/doctors';
import { mapAppointment } from '../profile/map';
import { requireAuth } from '../services/guestAuth';
import { getConsultHistory } from '../services/consultService';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'last_30_days', label: 'Last 30 Days' },
  { key: 'last_90_days', label: 'Last 90 Days' },
];

const PAGE_SIZE = 5;

const PAST_STATUSES = ['completed', 'cancelled', 'missed', 'expired', 'no_show', 'noshow'];

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

const weekdayFrom = (dateStr) => {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
  const date = ymd
    ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    : new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { weekday: 'long' });
};

const formatStatusLabel = (status) =>
  String(status || '')
    .replace(/_/g, ' ')
    .trim();

export default function ConsultHistory() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [tab, setTab] = useState('all');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim().toLowerCase()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await requireAuth('Please login to view consultation history'))) return;
      setLoading(true);
      const res = await getConsultHistory({ period: tab });
      if (!alive) return;
      if (res?.success === false) {
        setHistory([]);
      } else {
        const list = res?.data?.results || res?.results || [];
        setHistory(Array.isArray(list) ? list.map(mapAppointment) : []);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [tab]);

  const filtered = useMemo(() => {
    if (!debounced) return history;
    return history.filter((item) => {
      const doctorName = String(item.doctorName || '').toLowerCase();
      const concern = String(item.concern || '').toLowerCase();
      const status = String(item.status || '').toLowerCase();
      return (
        doctorName.includes(debounced) ||
        concern.includes(debounced) ||
        status.includes(debounced)
      );
    });
  }, [history, debounced]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(0);
  }, [tab, debounced]);

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [filtered.length, page, totalPages]);

  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const openDetails = (item) => {
    const lookupId = resolveAppointmentLookupId({ rawData: item.raw, ...item });
    if (lookupId) navigate(`/profile/appointments/${lookupId}`);
  };

  const openSlots = (item) => {
    if (!item.doctorId) return;
    navigate(`/consult/doctors/${item.doctorId}/slots`, {
      state: {
        doctor: item.raw?.doctor || {
          id: item.doctorId,
          full_name: item.doctorName,
          profile_image: item.image,
        },
        appointmentId: item.appointmentId,
      },
    });
  };

  return (
    <AppShell tab="consult">
      <section className="catalog-page history-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>Consultation History</h1>
            <p>Track your medical journey</p>
          </div>
        </header>

        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            setDebounced(search.trim().toLowerCase());
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search doctors..."
          />
          <button type="submit" className="cta">
            Search
          </button>
        </form>

        <div className="home-rail subcat-rail">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`chip ${tab === item.key ? 'on' : ''}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading && history.length === 0 ? (
          <p className="muted">Loading consultations…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-copy">
            <strong>{history.length === 0 ? 'No Appointments Yet' : 'Appointment Not Found'}</strong>
            <p>
              {history.length === 0
                ? 'Your consultations will appear here.'
                : 'Try another doctor name or clear filters.'}
            </p>
          </div>
        ) : (
          <>
            {totalPages > 1 ? (
              <div className="history-pager">
                <button type="button" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  ‹
                </button>
                <span>
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  ›
                </button>
              </div>
            ) : null}

            {paged.map((item) => {
              const status = String(item.status || '').toLowerCase();
              const statusStyle = STATUS_STYLE[status] || { background: '#f3f4f6', color: '#000' };
              const showReschedule = canModifyAppointment(status, item.date, item.time);
              const showReceipt = Boolean(item.consultationId);
              const showBookAgain = !showReschedule && PAST_STATUSES.includes(status);
              const weekday = weekdayFrom(item.date);
              const dateLabel = formatAppointmentDateFull(item.date);
              const timeLabel = formatSlotTime(item.time);
              return (
                <article key={item.consultationId || item.appointmentId || item.id} className="history-card">
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
                      <small className="history-specialty">{item.specialty || 'General Physician'}</small>
                      <div className="history-meta">
                        {weekday ? <span>{weekday}</span> : null}
                        {dateLabel ? <span>{dateLabel}</span> : null}
                        {timeLabel ? <span>{timeLabel}</span> : null}
                      </div>
                    </div>
                  </button>
                  {showReceipt || showReschedule || showBookAgain ? (
                    <div className="history-actions">
                      {showReceipt ? (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => navigate(`/profile/receipts/${item.consultationId}`)}
                        >
                          Receipt
                        </button>
                      ) : null}
                      {showReschedule ? (
                        <button type="button" className="cta" onClick={() => openDetails(item)}>
                          {status === 'reschedule' ? 'Request Change' : 'Reschedule'}
                        </button>
                      ) : showBookAgain && item.doctorId ? (
                        <button type="button" className="cta" onClick={() => openSlots(item)}>
                          Book Again
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </>
        )}
      </section>
    </AppShell>
  );
}

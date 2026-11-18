import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import AdvanceLoad from '../components/ui/AdvanceLoad';
import DietitianBadge from '../components/DietitianBadge';
import {
  canOfferReschedule,
  formatAppointmentDateFull,
  formatDoctorDisplayName,
  resolveAppointmentLookupId,
} from '../consult/appointmentUtils';
import { formatSlotTime } from '../consult/doctors';
import { mapAppointment } from '../profile/map';
import { requireAuth } from '../services/guestAuth';
import { getConsultHistory } from '../services/consultService';
import { invalidateApiCache } from '../services/apiClient';
import { nameInitials } from '../utils/initials';
import '../design/pages/consult-history.css';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'last_30_days', label: 'Last 30 Days' },
  { key: 'last_6_months', label: 'Last 6 Months' },
];

const PAGE_SIZE = 8;

const historyRows = (res) => {
  const list = res?.data?.results || res?.results || [];
  return Array.isArray(list) ? list.map(mapAppointment) : [];
};

const historyTotal = (res) => {
  const count = Number(res?.data?.count ?? res?.count);
  return Number.isFinite(count) ? count : 0;
};

const historyHasNext = (res, pageNo) => {
  if (res?.data?.next || res?.next) return true;
  const count = historyTotal(res);
  return count > 0 && pageNo * PAGE_SIZE < count;
};

const rowKey = (item) => String(item.consultationId || item.appointmentId || item.id || '');

const HIDDEN_HISTORY_STATUSES = new Set(['testing', 'test', 'draft']);
const PAST_STATUSES = ['completed', 'cancelled', 'missed', 'expired', 'no_show', 'noshow'];

const weekdayFrom = (dateStr) => {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
  const date = ymd
    ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    : new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { weekday: 'long' });
};

const formatStatusLabel = (status) =>
  ['testing', 'test'].includes(String(status || '').toLowerCase())
    ? 'Processing'
    : String(status || '')
    .replace(/_/g, ' ')
    .trim();

export default function ConsultHistory() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [tab, setTab] = useState('all');
  const [history, setHistory] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim().toLowerCase()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const loadPage = useCallback(async (pageNo, mode = 'replace') => {
    if (!(await requireAuth('Please login to view consultation history'))) return;
    const requestId = ++requestRef.current;
    if (mode === 'append') setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await getConsultHistory({
        period: tab,
        page: pageNo,
        page_size: PAGE_SIZE,
      });
      if (requestId !== requestRef.current) return;
      if (res?.success === false) {
        if (mode !== 'append') {
          setHistory([]);
          setTotal(0);
          setHasMore(false);
        }
        return;
      }
      const mapped = historyRows(res);
      setTotal(historyTotal(res));
      setHistory((prev) => {
        const base = mode === 'append' ? prev : [];
        const seen = new Set(base.map(rowKey));
        const next = mapped.filter((item) => {
          const key = rowKey(item);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return [...base, ...next];
      });
      setPage(pageNo);
      setHasMore(historyHasNext(res, pageNo));
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [tab]);

  useEffect(() => {
    loadPage(1, 'replace');
  }, [loadPage]);

  const filtered = useMemo(() => {
    // Hide internal / unfinished statuses from patient history (same as the app).
    const base = history.filter(
      (item) => !HIDDEN_HISTORY_STATUSES.has(String(item.status || '').toLowerCase().trim()),
    );
    if (!debounced) return base;
    return base.filter((item) => {
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

  const openDetails = (item) => {
    const lookupId = resolveAppointmentLookupId({ rawData: item.raw, ...item });
    if (lookupId) navigate(`/profile/appointments/${lookupId}`);
  };

  const openSlots = (item, { reschedule = false } = {}) => {
    if (!item.doctorId) return;
    const lookupId = resolveAppointmentLookupId({ rawData: item.raw, ...item });
    navigate(`/consult/doctors/${item.doctorId}/slots`, {
      state: {
        doctor: item.raw?.doctor || {
          id: item.doctorId,
          full_name: item.doctorName,
          profile_image: item.image,
        },
        ...(reschedule ? { appointmentId: lookupId || item.appointmentId } : {}),
      },
    });
  };

  return (
    <AppShell tab="consult">
      <section className="catalog-page history-page">
        <header className="hx-head">
          <div className="hx-head__top">
            <button type="button" className="hx-back" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <div className="hx-head__title">
              <h1>Consultation History</h1>
              <p>{total > 0 ? `${history.length} of ${total} visits` : 'Your visits'}</p>
            </div>
            <button
              type="button"
              className="hx-refresh"
              disabled={loading || loadingMore}
              onClick={() => {
                invalidateApiCache('customers/doctors/consultation-history/');
                loadPage(1, 'replace');
              }}
            >
              Refresh
            </button>
          </div>
          <div className="hx-head__tools">
            <form
              className="hx-search"
              onSubmit={(e) => {
                e.preventDefault();
                setDebounced(search.trim().toLowerCase());
              }}
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search doctor or status"
                aria-label="Search doctors"
              />
            </form>
            <div className="hx-tabs" role="tablist" aria-label="Time period">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  className={tab === item.key ? 'is-on' : ''}
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {loading && history.length === 0 ? (
          <AdvanceLoad variant="list" label="Loading consultations" />
        ) : filtered.length === 0 ? (
          <>
            <div className="empty-copy">
              <strong>{history.length === 0 ? 'No Appointments Yet' : 'Appointment Not Found'}</strong>
              <p>
                {history.length === 0
                  ? 'Your consultations will appear here.'
                  : 'Try another doctor name, or load the next page.'}
              </p>
            </div>
            {hasMore ? (
              <button
                type="button"
                className="hx-more"
                disabled={loadingMore}
                onClick={() => loadPage(page + 1, 'append')}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <div className="hx-list">
            {filtered.map((item) => {
              const status = String(item.status || '').toLowerCase();
              const showReschedule = canOfferReschedule(status, item.date, item.time, item);
              const showReceipt = Boolean(item.consultationId);
              const showBookAgain = !showReschedule && PAST_STATUSES.includes(status);
              const weekday = weekdayFrom(item.date);
              const dateLabel = formatAppointmentDateFull(item.date);
              const timeLabel = formatSlotTime(item.time);
              const doctorName = formatDoctorDisplayName(item.doctorName);
              const when = [weekday, dateLabel].filter(Boolean).join(', ');
              return (
                <article key={item.consultationId || item.appointmentId || item.id} className="hx-card">
                  <button type="button" className="hx-card__main" onClick={() => openDetails(item)}>
                    {item.image ? (
                      <img src={item.image} alt="" />
                    ) : (
                      <span className="hx-card__initials" aria-hidden="true">
                        {nameInitials(doctorName, 2, 'Dr')}
                      </span>
                    )}
                    <span className="hx-card__who">
                      <span className="hx-card__name">
                        <strong>{doctorName}</strong>
                        <DietitianBadge doctor={item} />
                        {status ? (
                          <em className={`hx-status hx-status--${status.replace(/_/g, '-')}`}>
                            {formatStatusLabel(status)}
                          </em>
                        ) : null}
                      </span>
                      <small>{item.specialty || 'General Physician'}</small>
                    </span>
                    {when || timeLabel ? (
                      <span className="hx-card__when">
                        {when ? <span>{when}</span> : null}
                        {timeLabel ? <strong>{timeLabel}</strong> : null}
                      </span>
                    ) : null}
                  </button>
                  <div className="hx-card__actions">
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
                      <button type="button" className="cta" onClick={() => openSlots(item, { reschedule: true })}>
                        {status === 'reschedule' ? 'Request Change' : 'Reschedule'}
                      </button>
                    ) : showBookAgain && item.doctorId ? (
                      <button type="button" className="cta" onClick={() => openSlots(item)}>
                        Book Again
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
            </div>
            {hasMore ? (
              <button
                type="button"
                className="hx-more"
                disabled={loadingMore}
                onClick={() => loadPage(page + 1, 'append')}
              >
                {loadingMore ? 'Loading…' : `Load more${total > history.length ? ` · ${total - history.length} left` : ''}`}
              </button>
            ) : null}
          </>
        )}
      </section>
    </AppShell>
  );
}

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import AdvanceLoad from '../components/ui/AdvanceLoad';
import { formatConsultationAmount, formatRupee } from '../home/catalog';
import useCustomerPaymentHistory from '../hooks/useCustomerPaymentHistory';
import { mapPaymentHistoryEntry, transactionIconGlyph } from '../profile/transactions';
import { requireAuth } from '../services/guestAuth';
import '../design/pages/payments.css';

const SOURCE_TABS = [
  { key: 'all', mark: 'All', label: 'All payments', hint: 'Every charge' },
  { key: 'consultation', mark: 'Cn', label: 'Consultations', hint: 'Doctor visits' },
  { key: 'order', mark: 'Or', label: 'Orders', hint: 'Store purchases' },
];

const ENTRY_CHIPS = [
  { key: 'all', mark: 'All', label: 'All types', hint: 'Paid and refunds' },
  { key: 'debit', mark: 'Pd', label: 'Paid', hint: 'Money out' },
  { key: 'credit', mark: 'Rf', label: 'Refunds', hint: 'Money back' },
];

const DATE_PRESETS = [
  { key: 'all', mark: 'All', label: 'All time', hint: 'Every date' },
  { key: 'last7', mark: '7d', label: 'Last 7 days', hint: 'This week' },
  { key: 'last30', mark: '30', label: 'Last 30 days', hint: 'This month' },
  { key: 'last90', mark: '90', label: 'Last 90 days', hint: 'Recent' },
  { key: 'thisMonth', mark: 'Mo', label: 'This month', hint: 'Current' },
  { key: 'lastMonth', mark: 'Lm', label: 'Last month', hint: 'Previous' },
  { key: 'custom', mark: 'Rng', label: 'Custom range', hint: 'Pick dates' },
];

const toApiDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
};

const parseInputDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolvePresetRange = (preset, custom) => {
  const today = new Date();
  const daysAgo = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d;
  };
  switch (preset) {
    case 'last7':
      return { from: daysAgo(6), to: today };
    case 'last30':
      return { from: daysAgo(29), to: today };
    case 'last90':
      return { from: daysAgo(89), to: today };
    case 'thisMonth':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
    case 'lastMonth':
      return {
        from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        to: new Date(today.getFullYear(), today.getMonth(), 0),
      };
    case 'custom':
      return custom;
    default:
      return { from: null, to: null };
  }
};

export default function Payments() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [source, setSource] = useState('all');
  const [entry, setEntry] = useState('all');
  const [datePreset, setDatePreset] = useState('all');
  const [customRange, setCustomRange] = useState({ from: null, to: null });

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to view payments'))) return;
      setAuthed(true);
    })();
  }, []);

  const range = useMemo(
    () => resolvePresetRange(datePreset, customRange),
    [datePreset, customRange],
  );

  const filters = useMemo(
    () => ({
      type: source === 'all' ? null : source,
      entry_type: entry === 'all' ? null : entry,
      date_from: range.from ? toApiDate(range.from) : null,
      date_to: range.to ? toApiDate(range.to) : null,
    }),
    [source, entry, range],
  );

  const { items, loading, loadingMore, hasMore, error, loadMore } = useCustomerPaymentHistory(
    filters,
    { enabled: authed },
  );

  const mapped = useMemo(() => items.map(mapPaymentHistoryEntry).filter((item) => item.id), [items]);

  const sections = useMemo(() => {
    const groups = [];
    mapped.forEach((item) => {
      const last = groups[groups.length - 1];
      if (last && last.title === item.month) last.data.push(item);
      else groups.push({ title: item.month, data: [item] });
    });
    return groups;
  }, [mapped]);

  const filtersOn = source !== 'all' || entry !== 'all' || datePreset !== 'all';

  const clearAll = () => {
    setSource('all');
    setEntry('all');
    setDatePreset('all');
    setCustomRange({ from: null, to: null });
  };

  const openDetail = (item) => {
    navigate(`/profile/payments/${item.id}`, { state: { transaction: item.raw } });
  };

  const todayInput = toApiDate(new Date());

  const filterButton = (item, selected, onClick) => (
    <li key={item.key}>
      <button
        type="button"
        aria-pressed={selected}
        className={selected ? 'is-on' : ''}
        onClick={onClick}
      >
        <span className="st-cat-filter__mark" aria-hidden>
          {item.mark}
        </span>
        <span className="st-cat-filter__copy">
          <strong>{item.label}</strong>
          <em>{item.hint}</em>
        </span>
      </button>
    </li>
  );

  return (
    <AppShell tab="profile">
      <section className="catalog-page payments-page">
        <PageHeader
          title="Payments"
          subtitle="Consultations and orders, including refunds."
          backTo="/profile"
          backLabel="Profile"
        />

        <div className="pay-layout">
          <aside className="st-cat-col pay-filter" aria-label="Filter payments">
            <p className="st-cat-col__eyebrow">Filter</p>
            <h3 id="pay-filter-title">Payments</h3>
            <div className="pay-side__group">
              <p className="pay-side__label" id="pay-source-label">Source</p>
              <ul className="st-cat-filter" role="group" aria-labelledby="pay-source-label">
                {SOURCE_TABS.map((item) =>
                  filterButton(item, source === item.key, () => setSource(item.key)),
                )}
              </ul>
            </div>
            <div className="pay-side__group">
              <p className="pay-side__label" id="pay-type-label">Type</p>
              <ul className="st-cat-filter" role="group" aria-labelledby="pay-type-label">
                {ENTRY_CHIPS.map((item) =>
                  filterButton(item, entry === item.key, () => setEntry(item.key)),
                )}
              </ul>
            </div>
            <div className="pay-side__group">
              <p className="pay-side__label" id="pay-when-label">When</p>
              <ul className="st-cat-filter" role="group" aria-labelledby="pay-when-label">
                {DATE_PRESETS.map((item) =>
                  filterButton(item, datePreset === item.key, () => setDatePreset(item.key)),
                )}
              </ul>
              {datePreset === 'custom' ? (
                <div className="pay-dates">
                  <label>
                    From
                    <input
                      type="date"
                      max={todayInput}
                      value={customRange.from ? toApiDate(customRange.from) : ''}
                      onChange={(event) => {
                        const nextFrom = parseInputDate(event.target.value);
                        setCustomRange((prev) => {
                          const next = { ...prev, from: nextFrom };
                          if (next.from && next.to && next.from > next.to) next.to = nextFrom;
                          return next;
                        });
                      }}
                    />
                  </label>
                  <label>
                    To
                    <input
                      type="date"
                      max={todayInput}
                      min={customRange.from ? toApiDate(customRange.from) : undefined}
                      value={customRange.to ? toApiDate(customRange.to) : ''}
                      onChange={(event) => {
                        const nextTo = parseInputDate(event.target.value);
                        setCustomRange((prev) => {
                          const next = { ...prev, to: nextTo };
                          if (next.from && next.to && next.from > next.to) next.from = nextTo;
                          return next;
                        });
                      }}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </aside>

          <div className="pay-main">
            {filtersOn ? (
              <button type="button" className="pay-clear" onClick={clearAll}>
                Clear filters
              </button>
            ) : null}
            {loading ? (
              <AdvanceLoad variant="list" label="Loading transactions" />
            ) : sections.length === 0 ? (
              <div className="empty-copy">
                <strong>{filtersOn ? 'No matching transactions' : 'No transactions yet'}</strong>
                <p>
                  {error ||
                    (filtersOn
                      ? 'Try changing or clearing the filters.'
                      : 'Your consultation and order payments will appear here.')}
                </p>
              </div>
            ) : (
              <>
                {sections.map((section) => (
                  <Fragment key={section.title}>
                    <h3 className="pay-month">{section.title}</h3>
                    <div className="pay-list">
                      {section.data.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="pay-card"
                          onClick={() => openDetail(item)}
                        >
                          <span className="pay-card__mark" aria-hidden>
                            {transactionIconGlyph(item.iconName)}
                          </span>
                          <span className="pay-card__body">
                            <strong>{item.name}</strong>
                            <small>
                              {[item.paymentMethod, item.date].filter(Boolean).join(' · ')}
                            </small>
                          </span>
                          <span className="pay-card__aside">
                            <strong className={item.isCredit ? 'is-credit' : undefined}>
                              {item.isCredit ? '+ ' : ''}
                              {item.raw?.type === 'order'
                                ? formatRupee(item.amount)
                                : formatConsultationAmount(item.amount)}
                            </strong>
                            <em className={`txn-status ${String(item.status || '').toLowerCase()}`}>
                              {item.status}
                            </em>
                          </span>
                        </button>
                      ))}
                    </div>
                  </Fragment>
                ))}
                {hasMore ? (
                  <button type="button" className="pay-more" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

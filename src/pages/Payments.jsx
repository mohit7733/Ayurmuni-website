import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { Button, Modal } from '../components/ui';
import { formatRupee } from '../home/catalog';
import useCustomerPaymentHistory from '../hooks/useCustomerPaymentHistory';
import { mapPaymentHistoryEntry, transactionIconGlyph } from '../profile/transactions';
import { requireAuth } from '../services/guestAuth';
import '../design/pages/payments.css';

const SOURCE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'consultation', label: 'Consultations' },
  { key: 'order', label: 'Orders' },
];

const ENTRY_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'debit', label: 'Paid' },
  { key: 'credit', label: 'Refunds' },
];

const DATE_PRESETS = [
  { key: 'all', label: 'All time' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'last90', label: 'Last 90 days' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'custom', label: 'Custom range' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toApiDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
};

const toShortDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
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
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [draftPreset, setDraftPreset] = useState('all');
  const [draftRange, setDraftRange] = useState({ from: null, to: null });

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

  const dateChipLabel = useMemo(() => {
    if (datePreset === 'all') return 'Date';
    if (datePreset === 'custom') {
      if (range.from && range.to) return `${toShortDate(range.from)} – ${toShortDate(range.to)}`;
      return range.from ? `From ${toShortDate(range.from)}` : 'Custom range';
    }
    return DATE_PRESETS.find((item) => item.key === datePreset)?.label || 'Date';
  }, [datePreset, range]);

  const activeFilterCount =
    (source !== 'all' ? 1 : 0) + (entry !== 'all' ? 1 : 0) + (datePreset !== 'all' ? 1 : 0);

  const openDateSheet = () => {
    setDraftPreset(datePreset);
    setDraftRange(customRange);
    setShowDateSheet(true);
  };

  const applyDateSheet = () => {
    if (draftPreset === 'custom' && !draftRange.from && !draftRange.to) {
      setDatePreset('all');
    } else {
      setDatePreset(draftPreset);
      if (draftPreset === 'custom') setCustomRange(draftRange);
    }
    setShowDateSheet(false);
  };

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

  return (
    <AppShell tab="profile">
      <section className="catalog-page payments-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate('/profile')}>
            ← Back
          </button>
          <div className="payments-heading">
            <span className="payments-eyebrow">Account activity</span>
            <h1>Payments</h1>
            <p>Track payments and refunds for consultations and orders.</p>
          </div>
          <span className="payments-mark" aria-hidden>₹</span>
        </header>

        <div className="home-rail subcat-rail payments-source" role="tablist" aria-label="Payment source">
          {SOURCE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`chip ${source === tab.key ? 'on' : ''}`}
              onClick={() => setSource(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          className="home-rail subcat-rail payments-filters"
          role="group"
          aria-label="Payment filters"
        >
          <button
            type="button"
            className={`chip ${datePreset !== 'all' ? 'on' : ''}`}
            onClick={openDateSheet}
          >
            {dateChipLabel}
          </button>
          {ENTRY_CHIPS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={`chip ${entry === chip.key ? 'on' : ''}`}
              onClick={() => setEntry(chip.key)}
            >
              {chip.label}
            </button>
          ))}
          {activeFilterCount > 0 ? (
            <button type="button" className="chip" onClick={clearAll}>
              Clear
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="muted">Loading transactions…</p>
        ) : sections.length === 0 ? (
          <div className="empty-copy">
            <strong>{activeFilterCount > 0 ? 'No matching transactions' : 'No transactions yet'}</strong>
            <p>
              {error ||
                (activeFilterCount > 0
                  ? 'Try changing or clearing the filters.'
                  : 'Your consultation and order payments will appear here.')}
            </p>
          </div>
        ) : (
          <>
            {sections.map((section) => (
              <Fragment key={section.title}>
                <h3 className="pay-month">{section.title}</h3>
                {section.data.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="checkout-card order-row"
                    onClick={() => openDetail(item)}
                  >
                    <div className="checkout-item txn-item">
                      <span className="thumb-fallback txn-icon">{transactionIconGlyph(item.iconName)}</span>
                      <p>
                        {item.name}
                        {item.paymentMethod ? <small>{item.paymentMethod}</small> : null}
                        <small>{item.date}</small>
                      </p>
                      <span className="txn-right">
                        <strong className={item.isCredit ? 'txn-credit' : undefined}>
                          {item.isCredit ? '+ ' : ''}
                          {formatRupee(item.amount)}
                        </strong>
                        <em className={`txn-status ${item.status.toLowerCase()}`}>{item.status}</em>
                      </span>
                    </div>
                  </button>
                ))}
              </Fragment>
            ))}
            {hasMore ? (
              <div className="load-more-wrap">
                <button type="button" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <Modal
        open={showDateSheet}
        onClose={() => setShowDateSheet(false)}
        title="Filter by date"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDraftPreset('all');
                setDraftRange({ from: null, to: null });
              }}
            >
              Reset
            </Button>
            <Button variant="primary" onClick={applyDateSheet}>
              Apply
            </Button>
          </>
        }
      >
        <div className="pay-date-presets">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={`chip ${draftPreset === preset.key ? 'on' : ''}`}
              onClick={() => setDraftPreset(preset.key)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {draftPreset === 'custom' ? (
          <div className="pay-date-range">
            <label>
              From
              <input
                type="date"
                max={todayInput}
                value={draftRange.from ? toApiDate(draftRange.from) : ''}
                onChange={(event) => {
                  const nextFrom = parseInputDate(event.target.value);
                  setDraftRange((prev) => {
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
                min={draftRange.from ? toApiDate(draftRange.from) : undefined}
                value={draftRange.to ? toApiDate(draftRange.to) : ''}
                onChange={(event) => {
                  const nextTo = parseInputDate(event.target.value);
                  setDraftRange((prev) => {
                    const next = { ...prev, to: nextTo };
                    if (next.from && next.to && next.from > next.to) next.from = nextTo;
                    return next;
                  });
                }}
              />
            </label>
          </div>
        ) : null}
      </Modal>
    </AppShell>
  );
}

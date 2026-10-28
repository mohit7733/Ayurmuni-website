import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, FileText, Leaf, Package, RefreshCw } from 'lucide-react';
import { buildRequestViewRoute } from '../cart/rxGroups';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { formatRupee } from '../home/catalog';
import { mapOrderToListItem } from '../profile/map';
import { requireAuth } from '../services/guestAuth';
import { getOrders, normalizeOrdersList } from '../services/orderService';
import {
  countReturns,
  filterReturns,
  getReturnStatusMeta,
  loadAllReturns,
  RETURN_FILTERS,
} from '../services/returnService';
import {
  formatPrescriptionDate,
  getPrescriptionRequests,
  getRequestedVariants,
  getStatusLabel,
  isPrescriptionApproved,
  isPrescriptionRejected,
  normalizePrescriptionRequestList,
} from '../services/prescriptionService';
import {
  Badge,
  Button,
  Chip,
  Disclaimer,
  EmptyState,
  SearchField,
  SectionHold,
  Tabs,
} from '../components/ui';
import {
  ORDERS_COPY as T,
  orderStatusLabel,
  orderStatusTone,
} from '../content/orders';
import { formatOrderId } from '../utils/formatDisplayId';
import { formatOrderDateTime } from '../utils/orderDetailUtils';
import '../design/pages/orders.css';

const requestTone = (item) => {
  if (isPrescriptionApproved(item)) return 'success';
  if (isPrescriptionRejected(item)) return 'danger';
  return 'warning';
};

export default function OrderHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  const openedTab = ['requested', 'returns'].includes(location.state?.tab) ? location.state.tab : 'orders';
  const [tab, setTab] = useState(openedTab);
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [returns, setReturns] = useState([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsLoaded, setReturnsLoaded] = useState(false);
  const [returnFilter, setReturnFilter] = useState('all');
  const [returnSearch, setReturnSearch] = useState('');

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to view orders'))) return;
      setLoading(true);
      const res = await getOrders({ page: 1, page_size: 40 });
      setOrders(normalizeOrdersList(res).map(mapOrderToListItem));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to view orders'))) return;
      setRequestsLoading(true);
      const res = await getPrescriptionRequests();
      setRequests(normalizePrescriptionRequestList(res));
      setRequestsLoading(false);
    })();
  }, []);

  // The Returns tab loads on first open and refreshes every time it is opened again.
  useEffect(() => {
    if (tab !== 'returns' || loading) return undefined;
    let active = true;
    (async () => {
      if (!(await requireAuth('Please login to view returns'))) return;
      setReturnsLoading(true);
      const next = await loadAllReturns(orders);
      if (!active) return;
      setReturns(next);
      setReturnsLoaded(true);
      setReturnsLoading(false);
    })();
    return () => {
      active = false;
    };
    // `orders` only feeds the fallback path; reload on tab open / initial orders load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, loading]);

  const returnList = useMemo(
    () => filterReturns(returns, returnFilter, returnSearch),
    [returns, returnFilter, returnSearch],
  );
  const returnCounts = useMemo(() => countReturns(returns), [returns]);

  const list = useMemo(() => {
    const chip = T.filters.find((item) => item.key === filter);
    const q = search.trim().toLowerCase();
    return orders.filter((item) => {
      const status = String(item.status || '').toLowerCase();
      if (chip?.match && !chip.match.includes(status)) return false;
      if (!q) return true;
      const titles = (item.items || [])
        .map((line) => line?.variant?.variant_title || line?.product_name || line?.name || '')
        .join(' ');
      return [item.title, item.orderCode, item.id, item.status, titles].some((value) =>
        String(value || '').toLowerCase().includes(q),
      );
    });
  }, [orders, filter, search]);

  const counts = useMemo(() => {
    const next = { all: orders.length };
    T.filters.forEach((chip) => {
      if (!chip.match) return;
      next[chip.key] = orders.filter((item) => chip.match.includes(String(item.status || '').toLowerCase())).length;
    });
    return next;
  }, [orders]);

  return (
    <AppShell tab="profile">
      <section className="or-page">
        <PageHeader title={T.historyTitle} subtitle={T.historySubtitle} backTo="/profile" />

        <Tabs
          label={T.historyTitle}
          value={tab}
          onChange={setTab}
          items={[
            { id: 'orders', label: T.ordersTab },
            { id: 'returns', label: returns.length ? `${T.returnsTab} (${returns.length})` : T.returnsTab },
            {
              id: 'requested',
              label: requests.length ? `${T.requestedTab} (${requests.length})` : T.requestedTab,
            },
          ]}
        />

        {tab === 'orders' ? (
          <>
            <div className="or-toolbar">
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder={T.searchPlaceholder}
                label={T.searchPlaceholder}
              />
              <div className="or-filters" role="group" aria-label={T.statusFilter}>
                {T.filters.map((item) => (
                  <Chip
                    key={item.key}
                    selected={filter === item.key}
                    count={counts[item.key] > 0 ? counts[item.key] : undefined}
                    onClick={() => setFilter(item.key)}
                  >
                    {item.label}
                  </Chip>
                ))}
              </div>
            </div>

            {loading ? (
              <SectionHold label={T.loading} minHeight={240} />
            ) : list.length === 0 ? (
              <EmptyState
                icon={<Package size={28} />}
                title={T.emptyTitle}
                description={T.emptyText}
                action={
                  <Button variant="primary" onClick={() => navigate('/products')}>
                    {T.shopProducts}
                  </Button>
                }
              />
            ) : (
              <div className="or-list">
                {list.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="or-row"
                    onClick={() => navigate(`/profile/orders/${item.id}`)}
                  >
                    <span className="or-row__thumb">
                      {item.image ? (
                        <img src={item.image} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <Leaf size={22} aria-hidden />
                      )}
                    </span>
                    <div className="or-row__body">
                      <p className="or-row__title">{item.title}</p>
                      <p className="or-row__meta">#{item.orderCode}</p>
                      <p className="or-row__meta">{item.date}</p>
                    </div>
                    <div className="or-row__aside">
                      <Badge tone={orderStatusTone(item.status)}>
                        {orderStatusLabel(item.status)}
                      </Badge>
                      <strong className="or-row__amount">{item.amount}</strong>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : tab === 'returns' ? (
          <>
            <div className="or-toolbar">
              <SearchField
                value={returnSearch}
                onChange={setReturnSearch}
                placeholder={T.returnsSearchPlaceholder}
                label={T.returnsSearchPlaceholder}
              />
              <div className="or-filters" role="group" aria-label={T.statusFilter}>
                {RETURN_FILTERS.map((item) => (
                  <Chip
                    key={item.key}
                    selected={returnFilter === item.key}
                    count={returnCounts[item.key] > 0 ? returnCounts[item.key] : undefined}
                    onClick={() => setReturnFilter(item.key)}
                  >
                    {item.label}
                  </Chip>
                ))}
              </div>
            </div>
            {returnsLoading && !returnsLoaded ? (
              <SectionHold label="Loading returns" minHeight={220} />
            ) : returnList.length === 0 ? (
              <EmptyState
                icon={<RefreshCw size={28} />}
                title={T.returnsEmptyTitle}
                description={T.returnsEmptyText}
              />
            ) : (
              <div className="or-list">
                {returnList.map((ret) => {
                  const meta = getReturnStatusMeta(ret.status);
                  const qty = ret.items.reduce((sum, line) => sum + line.quantity, 0);
                  return (
                    <button
                      key={ret.id}
                      type="button"
                      className="or-row"
                      onClick={() => navigate(`/profile/returns/${ret.id}`, { state: { returnRequest: ret.raw } })}
                    >
                      <span className="or-row__thumb">
                        <RefreshCw size={22} aria-hidden />
                      </span>
                      <div className="or-row__body">
                        <p className="or-row__title">
                          Order #{formatOrderId(ret.orderCode || ret.orderId)}
                        </p>
                        <p className="or-row__meta">
                          {qty} item{qty === 1 ? '' : 's'} · {ret.reason || 'Return request'}
                        </p>
                        <p className="or-row__meta">{formatOrderDateTime(ret.createdAt)}</p>
                      </div>
                      <div className="or-row__aside">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : requestsLoading ? (
          <SectionHold label="Loading requests" minHeight={220} />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<FileText size={28} />}
            title={T.requestedEmptyTitle}
            description={T.requestedEmptyText}
            action={
              <Button variant="primary" onClick={() => navigate('/medicines/prescription')}>
                {T.uploadPrescription}
              </Button>
            }
          />
        ) : (
          <div className="or-list">
            {requests.map((item) => {
              const variants = getRequestedVariants(item);
              const itemCount = variants.reduce((sum, row) => sum + row.quantity, 0);
              return (
                <div key={item.id} className="or-row or-row--static">
                  <span className="or-row__thumb">
                    <FileText size={22} aria-hidden />
                  </span>
                  <div className="or-row__body">
                    <p className="or-row__title">{item.patient_name || 'Prescription request'}</p>
                    <p className="or-row__meta">
                      {formatPrescriptionDate(item.created_at) || 'Submitted'}
                      {itemCount ? ` · ${itemCount} item${itemCount === 1 ? '' : 's'}` : ''}
                    </p>
                    {variants.slice(0, 2).map((row) => (
                      <p key={row.id} className="or-row__meta">
                        {row.name}
                        {row.price != null ? ` · ${formatRupee(row.price)}` : ''}
                      </p>
                    ))}
                  </div>
                  <div className="or-row__aside">
                    <Badge tone={requestTone(item)}>{getStatusLabel(item)}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      trailingIcon={<ChevronRight size={14} aria-hidden />}
                      onClick={() => {
                        const route = buildRequestViewRoute(item);
                        navigate(route.path, { state: route.state });
                      }}
                    >
                      View request
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Disclaimer />
      </section>
    </AppShell>
  );
}

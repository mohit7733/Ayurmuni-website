import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Leaf, Package } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { formatRupee } from '../home/catalog';
import { mapOrderToListItem } from '../profile/map';
import { requireAuth } from '../services/guestAuth';
import { getOrders, normalizeOrdersList } from '../services/orderService';
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
  Skeleton,
  SkeletonText,
  Tabs,
} from '../components/ui';
import {
  ORDERS_COPY as T,
  orderStatusLabel,
  orderStatusTone,
} from '../content/orders';
import '../design/pages/orders.css';

const requestTone = (item) => {
  if (isPrescriptionApproved(item)) return 'success';
  if (isPrescriptionRejected(item)) return 'danger';
  return 'warning';
};

export default function OrderHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  const openedTab = location.state?.tab === 'requested' ? 'requested' : 'orders';
  const [tab, setTab] = useState(openedTab);
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);

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
              <div className="or-skel" aria-busy="true" aria-label={T.loading}>
                <Skeleton style={{ height: 88, borderRadius: 'var(--am-radius-lg)' }} />
                <Skeleton style={{ height: 88, borderRadius: 'var(--am-radius-lg)' }} />
                <SkeletonText lines={2} />
              </div>
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
        ) : requestsLoading ? (
          <div className="or-skel" aria-busy="true">
            <Skeleton style={{ height: 88, borderRadius: 'var(--am-radius-lg)' }} />
            <SkeletonText lines={2} />
          </div>
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

import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarClock,
  ChevronRight,
  CreditCard,
  HelpCircle,
  Package,
  ReceiptText,
  RotateCcw,
  Stethoscope,
  Wallet,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { Button } from '../components/ui';
import {
  ActionStack,
  DetailCard,
  DetailEmpty,
  DetailHero,
  DetailLayout,
  DetailPage,
  DetailSkeleton,
  DetailTop,
  InfoGrid,
  MetaChip,
  StatusPill,
  Timeline,
} from '../components/detail/Detail';
import { formatRupee } from '../home/catalog';
import { formatEventType, getStatusDetailLabel } from '../profile/transactions';
import { getCustomerPaymentHistory } from '../services/orderService';
import { requireAuth } from '../services/guestAuth';

const LOOKUP_PAGES = 5;

const when = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const words = (value) => {
  const text = String(value ?? '').replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

const listOf = (res) => {
  const data = res?.data;
  if (Array.isArray(data)) return { list: data, hasNext: false };
  return { list: Array.isArray(data?.results) ? data.results : [], hasNext: Boolean(data?.next) };
};

const methodIcon = (txn) => {
  const method = String(txn?.payment_method ?? '').toLowerCase();
  if (txn?.entry_type === 'credit') return RotateCcw;
  if (method.includes('card')) return CreditCard;
  if (method.includes('upi') || method.includes('wallet') || method.includes('cash')) return Wallet;
  return ReceiptText;
};

function buildRefundTimeline(txn) {
  const paidAt = txn.consultation_payment?.paid_at || txn.order_payment?.paid_at;
  const refund = txn.refund_request;
  if (!refund && txn.entry_type !== 'credit') return [];
  const processed =
    refund?.gateway_status === 'processed' || txn.event_type === 'refund_processed' || txn.status === 'success';
  const approved = processed || refund?.admin_status === 'approved';
  return [
    { key: 'paid', title: 'Payment received', time: when(paidAt), state: 'done' },
    { key: 'requested', title: 'Refund requested', time: when(txn.created_at), state: 'done' },
    {
      key: 'approved',
      title: 'Refund approved',
      text: refund?.admin_status ? words(refund.admin_status) : '',
      state: approved ? 'done' : 'current',
    },
    {
      key: 'processed',
      title: 'Refund credited',
      text: processed ? 'Back to your original payment method' : 'Usually takes 5–7 working days',
      time: when(refund?.processed_at || txn.consultation_payment?.refunded_at),
      state: processed ? 'done' : approved ? 'current' : 'pending',
    },
  ];
}

export default function TransactionDetails() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const seed = location.state?.transaction || null;
  const [transaction, setTransaction] = useState(seed);
  const [loading, setLoading] = useState(!seed);

  useEffect(() => {
    requireAuth('Please login to view payments');
  }, []);

  useEffect(() => {
    if (seed || !transactionId) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        for (let page = 1; page <= LOOKUP_PAGES; page += 1) {
          const { list, hasNext } = listOf(await getCustomerPaymentHistory({ page, page_size: 50 }));
          const match = list.find((entry) => String(entry?.id) === String(transactionId));
          if (match) {
            if (alive) setTransaction(match);
            break;
          }
          if (!hasNext) break;
        }
      } catch {
        /* show empty state */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [seed, transactionId]);

  const txn = transaction;
  const isCredit = txn?.entry_type === 'credit';
  const orderId = txn?.order?.id || txn?.order?.order_id;
  const appointmentId = txn?.appointment?.id;
  const statusLabel = !txn
    ? ''
    : isCredit && String(txn.status).toLowerCase() === 'success'
      ? 'Refunded'
      : getStatusDetailLabel(txn.status);
  const title = txn?.doctor?.name
    ? `Dr. ${txn.doctor.name}`
    : txn?.type === 'order' || txn?.order
      ? 'Order payment'
      : 'Consultation payment';
  const eventLabel = formatEventType(txn?.event_type) || words(txn?.transaction_type) || 'Payment';
  const MethodIcon = methodIcon(txn);
  const refundTimeline = txn ? buildRefundTimeline(txn) : [];
  const consultationPayment = txn?.consultation_payment;
  const orderPayment = txn?.order_payment;

  return (
    <AppShell tab="profile">
      <DetailPage>
        <DetailTop backTo="/profile/payments" backLabel="Payments" />

        {loading && !txn ? (
          <DetailSkeleton media={false} label="Loading transaction" />
        ) : !txn ? (
          <DetailEmpty
            icon={ReceiptText}
            title="Transaction not found"
            text="We couldn't find this payment. Open it again from your payment history."
            action={<Button onClick={() => navigate('/profile/payments')}>Payment history</Button>}
          />
        ) : (
          <>
            <DetailHero
              variant="band"
              titleId="txn-title"
              eyebrow={isCredit ? 'Refund' : 'Payment'}
              title={title}
              lede={eventLabel}
              chips={
                <>
                  {txn.payment_method || txn.payment_type ? (
                    <MetaChip icon={MethodIcon}>
                      {words(txn.payment_method || txn.payment_type).toUpperCase()}
                    </MetaChip>
                  ) : null}
                  {when(txn.paid_at || txn.created_at) ? (
                    <MetaChip icon={CalendarClock}>{when(txn.paid_at || txn.created_at)}</MetaChip>
                  ) : null}
                </>
              }
              aside={
                <>
                  <StatusPill status={txn.status}>{statusLabel}</StatusPill>
                  <div className="dx-figure">
                    <small>{isCredit ? 'Credited' : 'Amount'}</small>
                    <strong>
                      {isCredit ? '+ ' : ''}
                      {formatRupee(txn.amount ?? 0)}
                    </strong>
                  </div>
                </>
              }
            />

            <DetailLayout
              aside={
                <>
                  <DetailCard id="txn-ref" title="Reference" icon={ReceiptText}>
                    <InfoGrid
                      columns={2}
                      items={[
                        { label: 'Reference', value: txn.reference_code || txn.id, wide: true },
                        { label: 'Currency', value: txn.currency },
                        { label: 'Gateway', value: words(txn.gateway) },
                      ]}
                    />
                  </DetailCard>
                  <ActionStack>
                    {orderId ? (
                      <Button
                        leadingIcon={<Package size={16} aria-hidden />}
                        onClick={() => navigate(`/profile/orders/${orderId}`)}
                      >
                        View order
                      </Button>
                    ) : null}
                    {appointmentId ? (
                      <Button
                        leadingIcon={<Stethoscope size={16} aria-hidden />}
                        onClick={() => navigate(`/profile/appointments/${appointmentId}`)}
                      >
                        View appointment
                      </Button>
                    ) : null}
                    <Button
                      variant="secondary"
                      leadingIcon={<HelpCircle size={16} aria-hidden />}
                      onClick={() => navigate('/profile/faq')}
                    >
                      Payment help
                    </Button>
                  </ActionStack>
                </>
              }
            >
              {refundTimeline.length ? (
                <DetailCard id="txn-refund" title="Refund progress" icon={RotateCcw}>
                  <Timeline items={refundTimeline} />
                </DetailCard>
              ) : null}

              <DetailCard id="txn-info" title="Payment details" icon={CreditCard}>
                <InfoGrid
                  items={[
                    { label: 'Type', value: words(txn.transaction_type || txn.type) },
                    { label: 'Payment type', value: words(txn.payment_type) },
                    { label: 'Method', value: words(txn.payment_method).toUpperCase() },
                    { label: 'Event', value: formatEventType(txn.event_type) },
                    { label: 'Paid on', value: when(txn.paid_at) },
                    { label: 'Created on', value: when(txn.created_at) },
                    { label: 'Payment ID', value: txn.gateway_payment_id },
                    { label: 'Refund ID', value: txn.gateway_refund_id },
                    { label: 'Gateway ref', value: txn.gateway_reference },
                    { label: 'Failure reason', value: txn.failure_reason, wide: true },
                    { label: 'Note', value: txn.note, wide: true },
                  ]}
                />
              </DetailCard>

              {txn.doctor || txn.patient || txn.appointment ? (
                <DetailCard id="txn-consult" title="Consultation" icon={Stethoscope}>
                  <InfoGrid
                    items={[
                      { label: 'Doctor', value: txn.doctor?.name ? `Dr. ${txn.doctor.name}` : '' },
                      { label: 'Patient', value: txn.patient?.name },
                      { label: 'Appointment', value: txn.appointment?.appointment_date },
                      { label: 'Visit type', value: words(txn.appointment?.consultation_type) },
                      { label: 'Visit status', value: words(txn.appointment?.status) },
                    ]}
                  />
                  {appointmentId ? (
                    <button
                      type="button"
                      className="dx-link"
                      onClick={() => navigate(`/profile/appointments/${appointmentId}`)}
                    >
                      <span className="dx-link__icon" aria-hidden>
                        <Stethoscope size={18} />
                      </span>
                      <span className="dx-link__copy">
                        <strong>Open appointment</strong>
                        <span>Prescription, receipt and chat</span>
                      </span>
                      <ChevronRight className="dx-link__chev" size={18} aria-hidden />
                    </button>
                  ) : null}
                </DetailCard>
              ) : null}

              {txn.order ? (
                <DetailCard id="txn-order" title="Order" icon={Package}>
                  <InfoGrid
                    items={[
                      { label: 'Order code', value: txn.order.order_code },
                      { label: 'Order status', value: words(txn.order.order_status) },
                      {
                        label: 'Order total',
                        value: txn.order.total_amount != null ? formatRupee(txn.order.total_amount) : '',
                      },
                    ]}
                  />
                  {orderId ? (
                    <button
                      type="button"
                      className="dx-link"
                      onClick={() => navigate(`/profile/orders/${orderId}`)}
                    >
                      <span className="dx-link__icon" aria-hidden>
                        <Package size={18} />
                      </span>
                      <span className="dx-link__copy">
                        <strong>View order details</strong>
                        <span>Items, tracking and invoice</span>
                      </span>
                      <ChevronRight className="dx-link__chev" size={18} aria-hidden />
                    </button>
                  ) : null}
                </DetailCard>
              ) : null}

              {consultationPayment || orderPayment ? (
                <DetailCard id="txn-gateway" title="Gateway record" icon={Wallet}>
                  <InfoGrid
                    items={[
                      {
                        label: 'Gateway order',
                        value:
                          consultationPayment?.gateway_order_id ||
                          consultationPayment?.razorpay_order_id ||
                          orderPayment?.gateway_order_id ||
                          orderPayment?.razorpay_order_id,
                      },
                      {
                        label: 'Gateway payment',
                        value:
                          consultationPayment?.gateway_payment_id ||
                          consultationPayment?.razorpay_payment_id ||
                          orderPayment?.gateway_payment_id ||
                          orderPayment?.razorpay_payment_id,
                      },
                      { label: 'Status', value: words(consultationPayment?.status || orderPayment?.status) },
                      { label: 'Paid on', value: when(consultationPayment?.paid_at || orderPayment?.paid_at) },
                      { label: 'Refunded on', value: when(consultationPayment?.refunded_at) },
                    ]}
                  />
                </DetailCard>
              ) : null}
            </DetailLayout>
          </>
        )}
      </DetailPage>
    </AppShell>
  );
}

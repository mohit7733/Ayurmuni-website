import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { formatRupee } from '../home/catalog';
import {
  formatTransactionDate,
  getStatusColor,
  getStatusDetailLabel,
  mapTransactionIcon,
  transactionIconGlyph,
} from '../profile/transactions';
import { requireAuth } from '../services/guestAuth';

const DetailRow = ({ label, value }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="txn-detail-row">
      <span>{label}</span>
      <strong>{String(value)}</strong>
    </div>
  );
};

export default function TransactionDetails() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const transaction = location.state?.transaction;

  useEffect(() => {
    requireAuth('Please login to view payments');
  }, []);

  const iconName = useMemo(() => mapTransactionIcon(transaction), [transaction]);
  const statusColor = getStatusColor(transaction?.status);
  const orderId = transaction?.order?.id || transaction?.order?.order_id;

  return (
    <AppShell tab="profile">
      <section className="catalog-page txn-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate('/profile/payments')}>
            ← Back
          </button>
          <div>
            <h1>Transaction Details</h1>
            <p>{transaction?.reference_code || transactionId}</p>
          </div>
        </header>

        {!transaction ? (
          <p className="empty-copy">Transaction not found</p>
        ) : (
          <>
            <div className="checkout-card txn-hero">
              <span className="thumb-fallback txn-icon">{transactionIconGlyph(iconName)}</span>
              <strong>{formatRupee(transaction.amount ?? 0)}</strong>
              <span className="txn-pill" style={{ background: `${statusColor}18`, color: statusColor }}>
                <i style={{ background: statusColor }} />
                {getStatusDetailLabel(transaction.status)}
              </span>
              <small>{transaction.reference_code || transaction.id}</small>
            </div>

            <div className="checkout-card">
              <h3>Payment Info</h3>
              <DetailRow label="Reference" value={transaction.reference_code} />
              <DetailRow
                label="Type"
                value={String(transaction.transaction_type ?? '').replace(/_/g, ' ')}
              />
              <DetailRow
                label="Payment Type"
                value={String(transaction.payment_type ?? '').replace(/_/g, ' ')}
              />
              <DetailRow
                label="Method"
                value={String(transaction.payment_method ?? '').toUpperCase()}
              />
              <DetailRow label="Gateway" value={transaction.gateway} />
              <DetailRow label="Gateway Ref" value={transaction.gateway_reference} />
              <DetailRow label="Currency" value={transaction.currency} />
              <DetailRow label="Paid At" value={formatTransactionDate(transaction.paid_at)} />
              {transaction.at ? (
                <DetailRow label="Date" value={formatTransactionDate(transaction.at)} />
              ) : null}
              <DetailRow
                label="Event"
                value={
                  transaction.event_type
                    ? String(transaction.event_type).replace(/_/g, ' ')
                    : null
                }
              />
              <DetailRow label="Doctor" value={transaction.doctor?.name} />
              <DetailRow label="Patient" value={transaction.patient?.name} />
              <DetailRow
                label="Appointment Date"
                value={transaction.appointment?.appointment_date}
              />
              <DetailRow label="Payment ID" value={transaction.gateway_payment_id} />
              <DetailRow label="Refund Ref" value={transaction.gateway_refund_id} />
              <DetailRow label="Note" value={transaction.note} />
              <DetailRow label="Created At" value={formatTransactionDate(transaction.created_at)} />
              {transaction.failure_reason ? (
                <DetailRow label="Failure Reason" value={transaction.failure_reason} />
              ) : null}
            </div>

            {transaction.order ? (
              <div className="checkout-card">
                <h3>Order</h3>
                <DetailRow label="Order Code" value={transaction.order.order_code} />
                <DetailRow
                  label="Order Status"
                  value={String(transaction.order.order_status ?? '').replace(/_/g, ' ')}
                />
                <DetailRow
                  label="Order Amount"
                  value={formatRupee(transaction.order.total_amount ?? 0)}
                />
                {orderId ? (
                  <button
                    type="button"
                    className="txn-link"
                    onClick={() => navigate(`/profile/orders/${orderId}`)}
                  >
                    View Order Details
                  </button>
                ) : null}
              </div>
            ) : null}

            {transaction.consultation_payment ? (
              <div className="checkout-card">
                <h3>Consultation Payment</h3>
                <DetailRow
                  label="Razorpay Order"
                  value={transaction.consultation_payment.razorpay_order_id}
                />
                <DetailRow
                  label="Razorpay Payment"
                  value={transaction.consultation_payment.razorpay_payment_id}
                />
                <DetailRow label="Status" value={transaction.consultation_payment.status} />
                <DetailRow
                  label="Paid At"
                  value={
                    transaction.consultation_payment.paid_at
                      ? formatTransactionDate(transaction.consultation_payment.paid_at)
                      : null
                  }
                />
                <DetailRow
                  label="Refunded At"
                  value={
                    transaction.consultation_payment.refunded_at
                      ? formatTransactionDate(transaction.consultation_payment.refunded_at)
                      : null
                  }
                />
              </div>
            ) : null}

            {transaction.appointment?.id ? (
              <button
                type="button"
                className="txn-link"
                onClick={() =>
                  navigate(`/profile/appointments/${transaction.appointment.id}`)
                }
              >
                View Appointment
              </button>
            ) : null}

            {transaction.order_payment ? (
              <div className="checkout-card">
                <h3>Payment Record</h3>
                <DetailRow
                  label="Razorpay Order"
                  value={transaction.order_payment.razorpay_order_id}
                />
                <DetailRow
                  label="Razorpay Payment"
                  value={transaction.order_payment.razorpay_payment_id}
                />
                <DetailRow label="Status" value={transaction.order_payment.status} />
                <DetailRow
                  label="Paid At"
                  value={formatTransactionDate(transaction.order_payment.paid_at)}
                />
              </div>
            ) : null}
          </>
        )}
      </section>
    </AppShell>
  );
}

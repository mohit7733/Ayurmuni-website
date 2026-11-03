import { formatRupee } from '../home/catalog';
import {
  formatPaymentReason,
  formatPaymentStatusLabel,
  formatPaymentTimestamp,
  getPaymentStatusTone,
} from '../utils/paymentHistoryUtils';
import '../design/components/payment-history.css';

/** Compact vertical timeline of an appointment's payment / refund events. */
export default function PaymentHistoryTimeline({ history = [] }) {
  if (!history.length) return null;
  return (
    <ol className="pht" aria-label="Payment history">
      {history.map((entry, index) => {
        const tone = getPaymentStatusTone(entry.status);
        const reason = formatPaymentReason(entry.reason);
        const time = formatPaymentTimestamp(entry.at);
        return (
          <li key={`${entry.status}-${entry.at || index}`} className={`pht__row pht--${tone}`}>
            <span className="pht__dot" aria-hidden />
            <div className="pht__body">
              <div className="pht__title">
                <strong>{formatPaymentStatusLabel(entry.status)}</strong>
                {entry.amount != null ? <span>{formatRupee(entry.amount)}</span> : null}
              </div>
              {time ? <small>{time}</small> : null}
              {reason ? <p>{reason}</p> : null}
              {entry.gateway_refund_id ? <em className="pht__ref">Ref: {entry.gateway_refund_id}</em> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
import { ShieldCheck, ShoppingBag } from 'lucide-react';
import { Button, Modal } from './ui';
import { formatRupee } from '../home/catalog';
import { getDietPlanCoverUrl } from '../diet/utils';
import '../design/components/diet-payment.css';

const planMeta = (item) => {
  if (!item) return '';
  const duration = item.duration || (item.duration_days ? `${item.duration_days} days` : '');
  return [duration, item.prakriti, item.season].filter(Boolean).join(' · ');
};

const catalogPrice = (item) => {
  const price = Number(item?.price ?? item?.selling_price);
  return Number.isFinite(price) && price > 0 ? formatRupee(price, { decimals: Number.isInteger(price) ? 0 : 2 }) : '';
};

/**
 * Diet checkout sheet, laid out like the cart: one plan line, then the bill.
 * Payment is Cashfree only. Amounts come from the server.
 */
export default function DietPaymentModal({ review, onPay, onClose }) {
  const quote = review?.quote;
  const fees = quote && !quote.error ? quote.fees : null;
  const loading = Boolean(review?.loading);
  const paying = Boolean(review?.paying);
  const error = review?.error || quote?.error || '';
  const ready = Boolean(quote && !quote.error && !loading);
  const item = review?.item;
  const cover = getDietPlanCoverUrl(item);
  const total = fees?.total || '';
  const rows = fees?.rows?.length
    ? fees.rows
    : total
      ? [{ key: 'price', label: 'Diet plan', value: total }]
      : [];
  const linePrice = rows.find((row) => row.key === 'price')?.value || catalogPrice(item) || total;

  return (
    <Modal
      open={Boolean(review)}
      onClose={paying ? undefined : onClose}
      dismissible={!paying}
      size="md"
      className="dpi-modal"
      title="Checkout"
      description="1 diet plan. Pay with Cashfree, then the plan starts."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={paying}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onPay} disabled={!ready || paying} loading={paying}>
            {loading ? 'Preparing bill…' : total ? `Pay ${total}` : 'Pay now'}
          </Button>
        </>
      }
    >
      <div className="dpi" aria-busy={loading || paying}>
        <section className="dpi-card" aria-label="Plan in cart">
          <h3>
            <ShoppingBag size={16} aria-hidden />
            Your plan
            <span>1 item</span>
          </h3>
          <article className="dpi-line">
            <span className="dpi-line__thumb">
              {cover ? <img src={cover} alt="" /> : null}
            </span>
            <div className="dpi-line__body">
              <strong>{item?.title || item?.name || 'Diet plan'}</strong>
              {planMeta(item) ? <p>{planMeta(item)}</p> : null}
              <span className="dpi-line__qty">Qty 1</span>
            </div>
            <strong className="dpi-line__price">{loading && !linePrice ? '…' : linePrice || '—'}</strong>
          </article>
        </section>

        <section className="dpi-card dpi-summary" aria-label="Order summary">
          <h3>
            Order summary
            <span>{loading ? 'Calculating' : 'To pay'}</span>
          </h3>
          {loading && !rows.length ? <p className="dpi-wait">Preparing your bill…</p> : null}
          {rows.length ? (
            <dl className="dpi-bill">
              {rows.map((row) => (
                <div key={row.key} className={row.deduct ? 'is-save' : undefined}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
              <div className="dpi-bill__total">
                <dt>To pay</dt>
                <dd>{total || '—'}</dd>
              </div>
            </dl>
          ) : null}
          <p className="dpi-method">
            <ShieldCheck size={16} aria-hidden />
            <span>
              <strong>Cashfree</strong>
              <small>UPI, cards, net banking and wallets</small>
            </span>
          </p>
        </section>

        {error ? (
          <p className="dpi-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

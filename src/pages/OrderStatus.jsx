import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Leaf,
  ShoppingBag,
  XCircle,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { Badge, Button } from '../components/ui';
import { formatRupee } from '../home/catalog';
import {
  extractPrescriptionRequest,
  getPrescribedItems,
  getPrescriptionRequests,
  getStatusLabel,
  isPrescriptionApproved,
  isPrescriptionPending,
  isPrescriptionRejected,
  mapPrescribedItem,
} from '../services/prescriptionService';
import { formatPrescriptionId } from '../utils/formatDisplayId';
import '../design/pages/rx-status.css';

const RX_STATUS_KEY = 'ayurmuni_rx_status';
const REDIRECT_SECONDS = 5;

const readStored = () => {
  try {
    return JSON.parse(sessionStorage.getItem(RX_STATUS_KEY) || 'null');
  } catch {
    return null;
  }
};

export default function OrderStatus() {
  const navigate = useNavigate();
  const location = useLocation();
  const stored = useMemo(() => readStored(), []);
  const incoming = location.state?.request || stored?.request || null;
  const [request, setRequest] = useState(incoming);
  const notes = location.state?.notes || stored?.notes || incoming?.notes || '';
  const routeItems = Array.isArray(location.state?.prescribedItems)
    ? location.state.prescribedItems
    : stored?.prescribedItems;

  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  // Only API status counts — item list alone must not show as approved.
  const approved = isPrescriptionApproved(request);
  const rejected = isPrescriptionRejected(request);
  const pending = !approved && !rejected;

  const orderData = useMemo(() => {
    if (Array.isArray(routeItems) && routeItems.length > 0) return routeItems;
    return getPrescribedItems(request).map(mapPrescribedItem);
  }, [routeItems, request]);

  const total = useMemo(
    () => orderData.reduce((sum, item) => sum + (Number(item?.price) || 0), 0),
    [orderData],
  );

  const statusTone = rejected ? 'danger' : approved ? 'success' : 'warning';
  const statusLabel = rejected
    ? getStatusLabel(request)
    : approved
      ? 'Approved'
      : request
        ? getStatusLabel(request)
        : 'Submitted';

  const heroTitle = rejected
    ? 'Prescription rejected'
    : approved
      ? 'Prescription approved'
      : 'Request received';

  const heroCopy = rejected
    ? request?.rejection_reason ||
      'Please upload a clearer prescription and try again.'
    : approved
      ? 'Your prescription is approved. Taking you to cart shortly.'
      : 'A pharmacist usually reviews this within 12–24 hours. Redirecting to cart shortly.';

  useEffect(() => {
    if (request) {
      try {
        sessionStorage.setItem(
          RX_STATUS_KEY,
          JSON.stringify({ request, notes, prescribedItems: orderData }),
        );
      } catch {
        // ignore
      }
    }
  }, [request, notes, orderData]);

  useEffect(() => {
    const requestId = request?.id;
    if (!requestId) return undefined;
    let alive = true;
    (async () => {
      const res = await getPrescriptionRequests({ id: requestId });
      const next = extractPrescriptionRequest(res);
      if (alive && next) setRequest(next);
    })();
    return () => {
      alive = false;
    };
  }, [request?.id]);

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    const redirect = setTimeout(() => {
      navigate('/cart', { replace: true });
    }, REDIRECT_SECONDS * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(redirect);
    };
  }, [navigate]);

  const goCart = () => navigate('/cart', { replace: true });
  const progress = Math.max(0, (secondsLeft / REDIRECT_SECONDS) * 100);

  return (
    <AppShell tab="medicines">
      <section className="rxs">
        <div className="rxs-shell">
          <header className="rxs-head">
            <button type="button" className="am-back" onClick={goCart} aria-label="Back to cart">
              <ChevronLeft size={20} aria-hidden />
            </button>
            <div className="rxs-head__copy">
              <p className="rxs-eyebrow">Medicines</p>
              <h1>Order status</h1>
              <p>{heroTitle}</p>
            </div>
          </header>

          <div
            className={`rxs-hero${
              rejected ? ' is-rejected' : pending && !approved ? ' is-pending' : ''
            }`}
          >
            <div className="rxs-hero__mark" aria-hidden>
              {rejected ? (
                <XCircle size={24} strokeWidth={1.85} />
              ) : approved ? (
                <CheckCircle2 size={24} strokeWidth={1.85} />
              ) : (
                <Clock3 size={24} strokeWidth={1.85} />
              )}
            </div>
            <h2>{heroTitle}</h2>
            <p>{heroCopy}</p>
            <div className="rxs-countdown" aria-live="polite">
              <span className="rxs-countdown__label">Opening cart in {secondsLeft}s</span>
              <span className="rxs-countdown__bar" aria-hidden>
                <i style={{ width: `${progress}%` }} />
              </span>
            </div>
          </div>

          <section className="rxs-card">
            <div className="rxs-card__head">
              <div className="rxs-card__meta">
                <small>Request ID</small>
                <strong>{formatPrescriptionId(request?.id || 'RX')}</strong>
              </div>
              <Badge tone={statusTone}>{statusLabel}</Badge>
            </div>
          </section>

          {notes ? (
            <section className="rxs-card rxs-notes">
              <small>Your notes</small>
              <p>{notes}</p>
            </section>
          ) : null}

          <section className="rxs-card">
            <h2 className="rxs-card__title">
              {approved ? 'Prescribed items' : 'Requested items'}
              {orderData.length ? ` (${orderData.length})` : ''}
            </h2>

            {orderData.length === 0 ? (
              <p className="rxs-empty">
                Items from your prescription will appear in cart after pharmacist matching.
              </p>
            ) : (
              <div className="rxs-items">
                {orderData.map((item) => (
                  <div key={item.id} className="rxs-item">
                    <span className="rxs-item__thumb" aria-hidden>
                      {item.image ? (
                        <img src={item.image} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <Leaf size={18} strokeWidth={1.85} />
                      )}
                    </span>
                    <span className="rxs-item__copy">
                      <strong>{item.name}</strong>
                      <small>{item.desc || 'From prescription'}</small>
                    </span>
                    {item.price != null ? (
                      <strong className="rxs-item__price">{formatRupee(item.price)}</strong>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {total > 0 ? (
              <div className="rxs-total">
                <span>Estimated total</span>
                <strong>{formatRupee(total)}</strong>
              </div>
            ) : null}
          </section>

          <div className="rxs-foot">
            <Button
              variant="primary"
              block
              leadingIcon={<ShoppingBag size={18} aria-hidden />}
              onClick={goCart}
            >
              Go to cart now
            </Button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

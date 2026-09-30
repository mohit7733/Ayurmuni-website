import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { formatRupee } from '../home/catalog';
import {
  extractPrescriptionRequest,
  getPrescribedItems,
  getPrescriptionRequests,
  isPrescriptionApproved,
  mapPrescribedItem,
} from '../services/prescriptionService';

const RX_STATUS_KEY = 'ayurmuni_rx_status';

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

  const [secondsLeft, setSecondsLeft] = useState(5);
  const approved = isPrescriptionApproved(request) || Boolean(routeItems?.length);

  const orderData = useMemo(() => {
    if (Array.isArray(routeItems) && routeItems.length > 0) return routeItems;
    return getPrescribedItems(request).map(mapPrescribedItem);
  }, [routeItems, request]);

  const total = useMemo(
    () => orderData.reduce((sum, item) => sum + (Number(item?.price) || 0), 0),
    [orderData],
  );

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
    }, 5000);
    return () => {
      clearInterval(tick);
      clearTimeout(redirect);
    };
  }, [navigate]);

  const goCart = () => navigate('/cart', { replace: true });

  return (
    <AppShell tab="medicines">
      <section className="catalog-page rx-status-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={goCart}>
            ← Back
          </button>
          <div>
            <h1>Order Status</h1>
            <p>{approved ? 'Prescription approved' : 'Request received'}</p>
          </div>
        </header>

        <div className="rx-status-hero">
          <div className="rx-status-check">✓</div>
          <h2>{approved ? 'Prescription approved' : 'Request received'}</h2>
          <p>
            {approved
              ? 'Your prescription is approved. Taking you to cart shortly.'
              : 'We received your request. Redirecting to cart shortly.'}
          </p>
          <span className="rx-status-chip">Opening cart in {secondsLeft}s</span>
        </div>

        {notes ? (
          <div className="checkout-card">
            <p className="muted">Notes</p>
            <p>{notes}</p>
          </div>
        ) : null}

        <div className="checkout-card">
          <div className="receipt-price">
            <span>
              <small>Request ID</small>
              <strong>#{String(request?.id || 'RX').slice(0, 10)}</strong>
            </span>
            <em className="rx-status-pill">{approved ? 'Approved' : 'Submitted'}</em>
          </div>
          <h3>Prescribed items</h3>
          {orderData.length === 0 ? (
            <p className="muted">
              Items from your outsourced prescription will appear in cart after matching.
            </p>
          ) : (
            orderData.map((item) => (
              <div key={item.id} className="checkout-item">
                {item.image ? <img src={item.image} alt="" /> : <span>Rx</span>}
                <p>
                  {item.name}
                  <small>{item.desc || 'From outsourced prescription'}</small>
                </p>
                {item.price != null ? <strong>{formatRupee(item.price)}</strong> : null}
              </div>
            ))
          )}
          {total > 0 ? (
            <div className="receipt-total">
              <span>Estimated total</span>
              <strong>{formatRupee(total)}</strong>
            </div>
          ) : null}
        </div>

        <button type="button" className="cta" onClick={goCart}>
          Go to cart now
        </button>
      </section>
    </AppShell>
  );
}

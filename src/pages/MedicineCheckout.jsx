import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  Leaf,
  PackageCheck,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { Badge, Button } from '../components/ui';
import { formatRupee } from '../home/catalog';
import { showSuccessToast } from '../config/key';
import {
  getPrescribedItems,
  isPrescriptionApproved,
  mapPrescribedItem,
} from '../services/prescriptionService';
import { formatPrescriptionId } from '../utils/formatDisplayId';
import '../design/pages/rx-checkout.css';

const STEPS = ['Upload', 'Verify', 'Review'];
const EXPRESS_FEE = 9.99;

export default function MedicineCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const request = location.state?.request || null;
  const notes = location.state?.notes || request?.notes || '';
  const productName = String(location.state?.productName || '').trim();
  const routeItems = Array.isArray(location.state?.prescribedItems)
    ? location.state.prescribedItems
    : null;
  const approved = location.state?.approved || isPrescriptionApproved(request);
  const [selectedSpeed, setSelectedSpeed] = useState('standard');

  const orderData = useMemo(() => {
    if (Array.isArray(routeItems) && routeItems.length > 0) return routeItems;
    return getPrescribedItems(request).map(mapPrescribedItem);
  }, [routeItems, request]);

  const subtotal = useMemo(
    () => orderData.reduce((sum, item) => sum + (Number(item?.price) || 0), 0),
    [orderData],
  );
  const deliveryFee = selectedSpeed === 'express' ? EXPRESS_FEE : 0;
  const total = subtotal + deliveryFee;
  const canPlace = approved && orderData.length > 0;

  useEffect(() => {
    if (!approved) {
      showSuccessToast(
        'Finalize order is available only after prescription is approved.',
        'error',
      );
      navigate(-1);
    }
  }, [approved, navigate]);

  const continueNext = () => {
    navigate('/medicines/order-status', {
      state: {
        request,
        prescribedItems: orderData,
        notes,
        productName,
        deliverySpeed: selectedSpeed,
      },
    });
  };

  if (!approved) return null;

  return (
    <AppShell tab="medicines">
      <section className="rxc">
        <div className="rxc-shell">
          <header className="rxc-head">
            <button type="button" className="am-back" onClick={() => navigate(-1)} aria-label="Back">
              <ChevronLeft size={20} aria-hidden />
            </button>
            <div className="rxc-head__copy">
              <p className="rxc-eyebrow">Medicines</p>
              <h1>Checkout</h1>
              <p>{productName || 'Finalize order · Step 3 of 3'}</p>
            </div>
          </header>

          <ol className="rxc-steps" aria-label="Prescription steps">
            {STEPS.map((label, index) => {
              const step = index + 1;
              const done = step < 3;
              const active = step === 3;
              return (
                <li
                  key={label}
                  className={`rxc-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}
                >
                  <span className="rxc-step__dot" aria-hidden>
                    {done ? <CheckCircle2 size={14} /> : step}
                  </span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>

          <aside className="rxc-notice">
            <div className="rxc-notice__mark" aria-hidden>
              <ShieldCheck size={16} strokeWidth={1.85} />
            </div>
            <div>
              <strong>Prescription approved</strong>
              <p>
                {request?.id
                  ? `${formatPrescriptionId(request.id)} is ready for checkout.`
                  : 'Your Rx is approved. Review items and place the order.'}
              </p>
            </div>
          </aside>

          {notes ? (
            <section className="rxc-card rxc-notes">
              <small>Prescription notes</small>
              <p>{notes}</p>
            </section>
          ) : null}

          <section className="rxc-card">
            <div className="rxc-card__head">
              <h2 className="rxc-card__title">
                Order summary
                {orderData.length ? ` (${orderData.length})` : ''}
              </h2>
              <button
                type="button"
                className="rxc-card__link"
                onClick={() => navigate('/medicines')}
              >
                + Add items
              </button>
            </div>

            {orderData.length === 0 ? (
              <p className="rxc-empty">
                Waiting for pharmacist to match medicines from your prescription.
              </p>
            ) : (
              <div className="rxc-items">
                {orderData.map((item) => (
                  <div key={item.id} className="rxc-item">
                    <span className="rxc-item__thumb" aria-hidden>
                      {item.image ? (
                        <img src={item.image} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <Leaf size={18} strokeWidth={1.85} />
                      )}
                    </span>
                    <span className="rxc-item__copy">
                      <strong>{item.name}</strong>
                      {item.desc ? <small>{item.desc}</small> : null}
                      {item.notes ? <small>{item.notes}</small> : null}
                    </span>
                    {item.price != null ? (
                      <strong className="rxc-item__price">{formatRupee(item.price)}</strong>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rxc-card">
            <div className="rxc-card__head">
              <h2 className="rxc-card__title">Delivery speed</h2>
              <Badge tone="success" icon={<Truck size={12} aria-hidden />}>
                Secure
              </Badge>
            </div>
            <div className="rxc-speed" role="radiogroup" aria-label="Delivery speed">
              <button
                type="button"
                role="radio"
                aria-checked={selectedSpeed === 'standard'}
                className={`rxc-speed__opt${selectedSpeed === 'standard' ? ' is-on' : ''}`}
                onClick={() => setSelectedSpeed('standard')}
              >
                <strong>Standard</strong>
                <small>2–3 business days</small>
                <em>Free</em>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={selectedSpeed === 'express'}
                className={`rxc-speed__opt${selectedSpeed === 'express' ? ' is-on' : ''}`}
                onClick={() => setSelectedSpeed('express')}
              >
                <strong>Express</strong>
                <small>Within 24 hours</small>
                <em>{formatRupee(EXPRESS_FEE)}</em>
              </button>
            </div>
          </section>

          {orderData.length > 0 ? (
            <section className="rxc-card">
              <h2 className="rxc-card__title">Payment summary</h2>
              <div className="rxc-totals">
                <div className="rxc-totals__row">
                  <span>Subtotal</span>
                  <strong>{formatRupee(subtotal)}</strong>
                </div>
                <div className="rxc-totals__row">
                  <span>Delivery fee</span>
                  <strong>{selectedSpeed === 'standard' ? 'Free' : formatRupee(EXPRESS_FEE)}</strong>
                </div>
                <div className="rxc-totals__row is-total">
                  <span>Total amount</span>
                  <strong>{formatRupee(total)}</strong>
                </div>
              </div>
            </section>
          ) : null}

          <div className="rxc-foot">
            <Button
              variant="primary"
              block
              leadingIcon={
                canPlace ? (
                  <PackageCheck size={18} aria-hidden />
                ) : (
                  <ShieldCheck size={18} aria-hidden />
                )
              }
              onClick={continueNext}
            >
              {canPlace ? 'Place order' : 'Track request'}
            </Button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

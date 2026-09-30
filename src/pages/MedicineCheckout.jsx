import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { formatRupee } from '../home/catalog';
import { showSuccessToast } from '../config/key';
import {
  getPrescribedItems,
  isPrescriptionApproved,
  mapPrescribedItem,
} from '../services/prescriptionService';

export default function MedicineCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const request = location.state?.request || null;
  const notes = location.state?.notes || request?.notes || '';
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
  const deliveryFee = selectedSpeed === 'express' ? 9.99 : 0;
  const total = subtotal + deliveryFee;

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
      },
    });
  };

  if (!approved) return null;

  return (
    <AppShell tab="medicines">
      <section className="catalog-page rx-checkout">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>Checkout</h1>
            <p>Finalize order · 3 / 3</p>
          </div>
        </header>

        <div className="rx-progress">
          <i />
        </div>

        <div className="rx-trust">
          <span>Secure checkout</span>
          <span>{approved ? 'Rx approved' : 'Rx under review'}</span>
        </div>

        {notes ? (
          <div className="checkout-card">
            <p className="muted">Prescription notes</p>
            <p>{notes}</p>
          </div>
        ) : null}

        <div className="home-section-head">
          <h2>Order summary</h2>
          <button type="button" className="text-back" onClick={() => navigate('/medicines')}>
            + Add items
          </button>
        </div>
        <p className="muted">
          {orderData.length
            ? 'Items from your outsourced prescription'
            : 'Items will appear here once your prescription is approved.'}
        </p>

        <div className="checkout-card">
          {orderData.length === 0 ? (
            <p className="muted">
              Waiting for pharmacist to match medicines from your prescription.
            </p>
          ) : (
            orderData.map((item) => (
              <div key={item.id} className="checkout-item">
                {item.image ? <img src={item.image} alt="" /> : <span>Rx</span>}
                <p>
                  {item.name}
                  <small>{item.desc}</small>
                  {item.notes ? <small>{item.notes}</small> : null}
                </p>
                {item.price != null ? <strong>{formatRupee(item.price)}</strong> : null}
              </div>
            ))
          )}
        </div>

        <h3 className="profile-section">Delivery speed</h3>
        <div className="rx-speed">
          <button
            type="button"
            className={selectedSpeed === 'standard' ? 'on' : ''}
            onClick={() => setSelectedSpeed('standard')}
          >
            <strong>Standard</strong>
            <small>2–3 business days</small>
            <em>Free</em>
          </button>
          <button
            type="button"
            className={selectedSpeed === 'express' ? 'on' : ''}
            onClick={() => setSelectedSpeed('express')}
          >
            <strong>Express</strong>
            <small>Within 24 hours</small>
            <em>₹9.99</em>
          </button>
        </div>

        {orderData.length > 0 ? (
          <div className="checkout-card">
            <div className="receipt-price">
              <span>Subtotal</span>
              <strong>{formatRupee(subtotal)}</strong>
            </div>
            <div className="receipt-price">
              <span>Delivery fee</span>
              <strong>{selectedSpeed === 'standard' ? 'Free' : '₹9.99'}</strong>
            </div>
            <div className="receipt-total">
              <span>Total amount</span>
              <strong>{formatRupee(total)}</strong>
            </div>
          </div>
        ) : null}

        <button type="button" className="cta" onClick={continueNext}>
          {approved && orderData.length > 0 ? 'Place order' : 'Track request'}
        </button>
      </section>
    </AppShell>
  );
}

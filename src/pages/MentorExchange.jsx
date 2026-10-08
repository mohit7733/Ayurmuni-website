import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { showSuccessToast } from '../config/key';
import '../design/pages/mentor-flow.css';

const REASONS = ['Wrong size/variant', 'Damaged on arrival', 'Ordered by mistake', 'Other'];

export default function MentorExchange() {
  const navigate = useNavigate();
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');

  const confirm = () => {
    showSuccessToast('Exchange request submitted', 'success');
    navigate('/mentor/order');
  };

  return (
    <AppShell tab="consult">
      <section className="catalog-page mentor-request">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>Exchange</h1>
            <p>ORDER ID #ORD-98231</p>
          </div>
        </header>

        <div className="checkout-card mentor-flow__item">
          <h3>Medicines Order</h3>
          <p>Original: 500mg - 30 Pack</p>
        </div>

        <h3 className="profile-section">1. Why are you exchanging this item?</h3>
        {REASONS.map((item) => (
          <button
            key={item}
            type="button"
            className={`menu-row ${reason === item ? 'on' : ''}`}
            onClick={() => setReason(item)}
            aria-pressed={reason === item}
          >
            <span>{item}</span>
            <i className={`loc-radio ${reason === item ? 'on' : ''}`} />
          </button>
        ))}

        <h3 className="profile-section">2. Select replacement item</h3>
        <div className="checkout-card mentor-flow__replacement">
          <h3>Medicines Order</h3>
          <p>Original: 500mg - 30 Pack</p>
          <p className="muted">Available for Exchange</p>
          <p>New variant</p>
          <strong>500mg - 30 Pack (Even Exchange)</strong>
        </div>

        <h3 className="profile-section">Tell us more (optional)</h3>
        <label className="form-field">
          Details
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Share any additional details..."
          />
        </label>

        <button type="button" className="cta" onClick={confirm}>
          Confirm Exchange
        </button>
      </section>
    </AppShell>
  );
}

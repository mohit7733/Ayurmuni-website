import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { formatRupee } from '../home/catalog';
import { showSuccessToast } from '../config/key';

const REASONS = ['Product damaged', 'Wrong item received', 'Quality not as expected', 'Other'];
const METHODS = [
  {
    id: 'original',
    title: 'Original Method',
    subtitle: 'Refund to Visa •••• 4242 (5–7 business days)',
  },
  {
    id: 'wallet',
    title: 'Wallet',
    subtitle: 'Instant credit to your health fund wallet',
  },
];

export default function MentorRefund() {
  const navigate = useNavigate();
  const [reason, setReason] = useState(REASONS[0]);
  const [method, setMethod] = useState('original');
  const [note, setNote] = useState('');

  const submit = () => {
    showSuccessToast('Refund request submitted', 'success');
    navigate('/mentor/exchange');
  };

  return (
    <AppShell tab="consult">
      <section className="catalog-page mentor-request">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>Return & Refund</h1>
            <p>#ORD-98231 · Delivered</p>
          </div>
        </header>

        <div className="checkout-card">
          <p className="muted">MEDICINES</p>
          <h3>Prescription Bundle</h3>
          <p>Included: 3 items · Qty: 1</p>
          <strong>{formatRupee(1240)}</strong>
        </div>

        <h3 className="profile-section">1. Why are you requesting a refund?</h3>
        {REASONS.map((item) => (
          <button
            key={item}
            type="button"
            className={`menu-row ${reason === item ? 'on' : ''}`}
            onClick={() => setReason(item)}
          >
            <span>{item}</span>
            <i className={`loc-radio ${reason === item ? 'on' : ''}`} />
          </button>
        ))}

        <h3 className="profile-section">2. Where should we send the refund?</h3>
        {METHODS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`menu-row ${method === item.id ? 'on' : ''}`}
            onClick={() => setMethod(item.id)}
          >
            <span>
              {item.title}
              <small>{item.subtitle}</small>
            </span>
            <i className={`loc-radio ${method === item.id ? 'on' : ''}`} />
          </button>
        ))}

        <h3 className="profile-section">3. Tell us more (optional)</h3>
        <label className="form-field">
          Details
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Please describe the issue..."
          />
        </label>

        <button type="button" className="cta" onClick={submit}>
          Submit Refund Request
        </button>
      </section>
    </AppShell>
  );
}

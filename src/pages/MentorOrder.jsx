import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { formatRupee } from '../home/catalog';
import { loadMentorBooking } from '../mentor/data';

const TIMELINE = [
  { title: 'Ordered', time: '12 Oct, 10:30 AM' },
  { title: 'Packed', time: '12 Oct, 02:15 PM' },
  { title: 'Shipped', time: '13 Oct, 09:00 AM' },
  { title: 'Delivered', time: '14 Oct, 11:20 AM' },
];

export default function MentorOrder() {
  const navigate = useNavigate();
  const booking = loadMentorBooking();
  const title = booking?.service?.title || 'Medicines Order';
  const price = booking?.service?.price || 1240;

  return (
    <AppShell tab="consult">
      <section className="catalog-page mentor-order">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate('/mentor')}>
            ← Back
          </button>
          <div>
            <h1>Order Details</h1>
            <p>Mentor session booking</p>
          </div>
        </header>

        <div className="status-card ok">
          <strong>DELIVERED</strong>
          <p>Your order was successfully delivered on Oct 14.</p>
        </div>

        <div className="checkout-card">
          <div className="receipt-price">
            <span>Order identification</span>
            <strong>#ORD-98231</strong>
          </div>
          <div className="receipt-price">
            <span>Date</span>
            <strong>12 Oct 2023</strong>
          </div>
        </div>

        <div className="checkout-card">
          <h3>Items in this order</h3>
          <p>
            <strong>{title}</strong>
            <small> {booking?.service?.desc || 'Prescription Bundle · 1 Unit'}</small>
          </p>
          <p>
            {formatRupee(price)} · QTY: 1
          </p>
        </div>

        <div className="checkout-card">
          <h3>Delivery Address</h3>
          <p>Home · Default Address</p>
          <p>42-B, Sanctuary Heights, Green Valley, Near Wellness Plaza, Mumbai - 400012</p>
        </div>

        <div className="checkout-card">
          <h3>Order Timeline</h3>
          {TIMELINE.map((item, index) => (
            <div key={item.title} className="mentor-timeline">
              <span>✓</span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.time}</small>
              </div>
              {index < TIMELINE.length - 1 ? <i /> : null}
            </div>
          ))}
        </div>

        <button type="button" className="ghost" onClick={() => navigate('/mentor/refund')}>
          Return & Refund
        </button>
        <button type="button" className="cta" onClick={() => navigate('/mentor/exchange')}>
          Exchange
        </button>
      </section>
    </AppShell>
  );
}

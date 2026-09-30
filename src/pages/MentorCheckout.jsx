import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { formatRupee } from '../home/catalog';
import { EMI_PLANS, loadMentorBooking, MENTOR } from '../mentor/data';
import { showSuccessToast } from '../config/key';
import { getPatientList, listPatients } from '../services/patientService';

const PAYMENTS = [
  { id: '1', title: 'Credit Card', subtitle: '**** **** **** 4290' },
  { id: '2', title: 'UPI ID', subtitle: 'PhonePe, Google Pay, Paytm...' },
  { id: '3', title: 'EMI', subtitle: 'Flexible monthly installments' },
];

const patientName = (item) =>
  `${item?.first_name ?? ''} ${item?.last_name ?? ''}`.trim() || item?.full_name || 'Patient';

export default function MentorCheckout() {
  const navigate = useNavigate();
  const booking = useMemo(() => loadMentorBooking(), []);
  const fee = Number(booking?.service?.price || 1999);
  const discount = 199;
  const total = Math.max(fee - discount, 0);

  const [patients, setPatients] = useState(['John Deo', 'Jane Doe']);
  const [selectedPatient, setSelectedPatient] = useState('John Deo');
  const [openPatients, setOpenPatients] = useState(false);
  const [activePay, setActivePay] = useState('1');
  const [showEmi, setShowEmi] = useState(false);
  const [emiPlan, setEmiPlan] = useState('3');

  useEffect(() => {
    (async () => {
      const res = await getPatientList();
      if (res?.success === false) return;
      const names = listPatients(res).map(patientName).filter(Boolean);
      if (names.length) {
        setPatients(names);
        setSelectedPatient(names[0]);
      }
    })();
  }, []);

  const confirmPlan = () => {
    showSuccessToast('Plan confirmed', 'success');
    navigate('/mentor/order');
  };

  return (
    <AppShell tab="consult">
      <section className="catalog-page mentor-pay">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>Checkout</h1>
            <p>{booking?.service?.title || 'Mentor session'}</p>
          </div>
        </header>

        <div className="hero-doc">
          <div className="doctor-photo">
            <span>{MENTOR.name.charAt(0)}</span>
          </div>
          <div>
            <h2>{MENTOR.name}</h2>
            <p>
              {MENTOR.role}
              {booking?.date ? ` · ${booking.date}` : ''}
              {booking?.time ? ` · ${booking.time}` : ''}
            </p>
          </div>
        </div>

        <h3 className="profile-section">Patient Details</h3>
        <button type="button" className="menu-row" onClick={() => setOpenPatients((v) => !v)}>
          <span>
            FULL NAME
            <small>{selectedPatient}</small>
          </span>
          <em>{openPatients ? '▴' : '▾'}</em>
        </button>
        {openPatients
          ? patients.map((name) => (
              <button
                key={name}
                type="button"
                className="menu-row"
                onClick={() => {
                  setSelectedPatient(name);
                  setOpenPatients(false);
                }}
              >
                <span>{name}</span>
              </button>
            ))
          : null}
        <button type="button" className="text-back" onClick={() => navigate('/profile/patients/new')}>
          + Add Patient
        </button>

        <h3 className="profile-section">Payment Method</h3>
        {PAYMENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`menu-row ${activePay === item.id ? 'on' : ''}`}
            onClick={() => setActivePay(item.id)}
          >
            <span>
              {item.title}
              <small>{item.subtitle}</small>
            </span>
            <i className={`loc-radio ${activePay === item.id ? 'on' : ''}`} />
          </button>
        ))}

        <div className="mentor-summary">
          <div className="receipt-price">
            <span>Consultation fee</span>
            <strong>{formatRupee(fee)}</strong>
          </div>
          <div className="receipt-price">
            <span>Promo applied</span>
            <strong>- {formatRupee(discount)}</strong>
          </div>
          <hr />
          <div className="receipt-total">
            <span>Grand total</span>
            <strong>{formatRupee(total)}</strong>
          </div>
          <button type="button" className="cta" onClick={() => setShowEmi(true)}>
            Choose Plan
          </button>
        </div>
      </section>

      {showEmi ? (
        <div className="web-modal" role="dialog">
          <div className="web-modal-card loc-sheet-card">
            <div className="loc-sheet-head">
              <h3>Payment Plan</h3>
              <button type="button" className="text-back" onClick={() => setShowEmi(false)}>
                Close
              </button>
            </div>
            <p className="muted">AMOUNT TO PAY</p>
            <h2 className="mentor-emi-amount">{formatRupee(total)}</h2>
            <p className="mentor-secure">Secure medical transaction</p>
            <h3>Select EMI Tenure</h3>
            <p className="muted">Choose a plan that fits your recovery journey.</p>
            {EMI_PLANS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`mentor-emi ${emiPlan === item.id ? 'on' : ''}`}
                onClick={() => setEmiPlan(item.id)}
              >
                {item.recommended ? <em>Recommended</em> : null}
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.sub}</small>
                </span>
                <b>
                  {formatRupee(item.monthlyAmount)}
                  <small>/mo</small>
                </b>
              </button>
            ))}
            <p className="muted">
              Your payment plan is encrypted. EMI conversion might take up to 3–4 working days depending on your bank’s policy.
            </p>
            <button type="button" className="cta" onClick={confirmPlan}>
              Confirm Plan
            </button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

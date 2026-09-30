import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { formatRupee } from '../home/catalog';
import {
  MENTOR,
  MENTOR_SERVICES,
  MENTOR_SLOTS,
  generateMentorDates,
  saveMentorBooking,
} from '../mentor/data';
import { requireAuth } from '../services/guestAuth';
import { showSuccessToast } from '../config/key';

export default function ConsultMentor() {
  const navigate = useNavigate();
  const dates = useMemo(() => generateMentorDates(), []);
  const [selectedService, setSelectedService] = useState(0);
  const [selectedDate, setSelectedDate] = useState(dates.find((d) => d.isToday)?.fullDate);
  const [selectedTime, setSelectedTime] = useState('');

  const confirm = async () => {
    if (!selectedTime) {
      showSuccessToast('Please select a time slot', 'error');
      return;
    }
    if (!(await requireAuth('Please login to book a mentor session'))) return;
    const service = MENTOR_SERVICES[selectedService];
    saveMentorBooking({
      service,
      date: selectedDate,
      time: selectedTime,
    });
    navigate('/mentor/checkout');
  };

  return (
    <AppShell tab="consult">
      <section className="catalog-page mentor-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>Consult Mentor</h1>
            <p>Book a session with {MENTOR.name}</p>
          </div>
        </header>

        <div className="mentor-layout">
        <div className="mentor-main">
        <div className="hero-doc">
          <div className="doctor-photo">
            <span>{MENTOR.name.charAt(0)}</span>
          </div>
          <div>
            <h2>{MENTOR.name}</h2>
            <p>{MENTOR.role}</p>
            <p>★★★★★ {MENTOR.rating} ({MENTOR.reviews} reviews)</p>
          </div>
        </div>

        <h3 className="profile-section">Select Services</h3>
        {MENTOR_SERVICES.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`mentor-service ${selectedService === index ? 'on' : ''}`}
            onClick={() => setSelectedService(index)}
          >
            <strong>{item.title}</strong>
            <small>{item.desc}</small>
            <em>{formatRupee(item.price)}</em>
          </button>
        ))}

        </div>
        <aside className="mentor-side">
        <h3 className="profile-section">Availability</h3>
        <div className="home-rail">
          {dates.map((item) => (
            <button
              key={item.fullDate}
              type="button"
              className={`date-chip ${selectedDate === item.fullDate ? 'on' : ''}`}
              onClick={() => setSelectedDate(item.fullDate)}
            >
              <small>{item.isToday ? 'Today' : item.day}</small>
              <strong>{item.date}</strong>
            </button>
          ))}
        </div>

        {MENTOR_SLOTS.map((group) => (
          <div key={group.title}>
            <p className="muted">{group.title}</p>
            <div className="slot-grid">
              {group.slots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.available}
                  className={`chip ${selectedTime === slot.time ? 'on' : ''}`}
                  onClick={() => slot.available && setSelectedTime(slot.time)}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button type="button" className="cta" onClick={confirm}>
          Confirm and Pay
        </button>
        <p className="loc-hint">
          By booking, you agree to the Consult Sanctuary Terms of Clinical Conduct and cancellation policy.
        </p>
        </aside>
        </div>
      </section>
    </AppShell>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { MENTOR, MENTOR_REVIEWS, MENTOR_SESSIONS } from '../mentor/data';

export default function MentorProfile() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState(MENTOR_SESSIONS[0]?.id);

  return (
    <AppShell tab="consult">
      <section className="catalog-page mentor-profile">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>Mentor Profile</h1>
            <p>Find your wellness mentor</p>
          </div>
        </header>

        <div className="mentor-hero">
          <div className="mentor-avatar">{MENTOR.name.charAt(0)}</div>
          <span className="mentor-badge">Expert Mentor</span>
          <h2>{MENTOR.name}</h2>
          <p>{MENTOR.specialty}</p>
          <div className="variant-row">
            {MENTOR.chips.map((item) => (
              <span key={item} className="chip">
                {item}
              </span>
            ))}
          </div>
          <div className="mentor-stats">
            <div>
              <strong>{MENTOR.rating}</strong>
              <small>Rating</small>
            </div>
            <div>
              <strong>{MENTOR.years}</strong>
              <small>Years EXP.</small>
            </div>
            <div>
              <strong>{MENTOR.students}</strong>
              <small>Students</small>
            </div>
          </div>
          <p className="mentor-quote">
            “{MENTOR.quote}” {MENTOR.bio}
          </p>
        </div>

        <div className="checkout-card">
          <h3>Philosophy & Experience</h3>
          <p>{MENTOR.philosophy}</p>
          <div className="mentor-creds">
            {MENTOR.credentials.map((item) => (
              <div key={item.title} className="mentor-cred">
                <span>{item.icon}</span>
                <strong>{item.title}</strong>
                <small>{item.sub}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="checkout-card">
          <h3>Next Sessions</h3>
          {MENTOR_SESSIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`menu-row ${activeId === item.id ? 'on' : ''}`}
              onClick={() => setActiveId(item.id)}
            >
              <span>
                {item.title}
                <small>{item.time}</small>
              </span>
              <em>›</em>
            </button>
          ))}
          <button type="button" className="ghost" onClick={() => navigate('/yoga')}>
            View Schedule
          </button>
        </div>

        <div className="checkout-card">
          <h3>Reviews</h3>
          {MENTOR_REVIEWS.map((item) => (
            <div key={item.id} className="mentor-review">
              <strong>{item.name}</strong>
              <small>{'★'.repeat(item.rating)}</small>
              <p>{item.review}</p>
            </div>
          ))}
        </div>

        <button type="button" className="cta" onClick={() => navigate('/mentor/consult')}>
          Consult mentor
        </button>
      </section>
    </AppShell>
  );
}

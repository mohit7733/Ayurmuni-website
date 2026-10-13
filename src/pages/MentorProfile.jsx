import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, CalendarDays, ChevronRight, Clock3, Quote, Star } from 'lucide-react';
import AppShell from '../components/AppShell';
import { MENTOR, MENTOR_REVIEWS, MENTOR_SESSIONS } from '../mentor/data';
import '../design/pages/mentor-profile.css';

export default function MentorProfile() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState(MENTOR_SESSIONS[0]?.id);

  return (
    <AppShell tab="consult">
      <section className="catalog-page mentor-profile">
        <header className="catalog-head mentor-profile__head">
          <button type="button" className="text-back" onClick={() => navigate(-1)} aria-label="Go back">
            ← Back
          </button>
          <div>
            <span className="mentor-profile__eyebrow">YOUR WELLNESS JOURNEY</span>
            <h1>Meet your mentor</h1>
            <p>Expert guidance to help you feel your best.</p>
          </div>
        </header>

        <article className="mentor-hero">
          <div className="mentor-hero__main">
            <div className="mentor-avatar" aria-hidden="true">{MENTOR.name.charAt(0)}</div>
            <div className="mentor-hero__identity">
              <span className="mentor-badge"><BadgeCheck size={15} aria-hidden="true" /> Expert mentor</span>
              <h2>{MENTOR.name}</h2>
              <p className="mentor-hero__specialty">{MENTOR.specialty} <span>·</span> {MENTOR.role}</p>
              <div className="variant-row">
                {MENTOR.chips.map((item) => (
                  <span key={item} className="chip">{item}</span>
                ))}
              </div>
              <div className="mentor-hero__rating">
                <Star size={16} fill="currentColor" aria-hidden="true" />
                <strong>{MENTOR.rating}</strong>
                <span>({MENTOR.reviews} reviews)</span>
              </div>
            </div>
          </div>
          <div className="mentor-stats">
            <div><strong>{MENTOR.years}</strong><small>Years experience</small></div>
            <div><strong>{MENTOR.students}</strong><small>Students guided</small></div>
          </div>
          <blockquote className="mentor-quote">
            <Quote size={21} aria-hidden="true" />
            <div>
              <p>“{MENTOR.quote}”</p>
              <cite>{MENTOR.bio}</cite>
            </div>
          </blockquote>
        </article>

        <div className="mentor-profile__content">
          <section className="checkout-card mentor-profile__card">
            <div className="mentor-profile__section-heading">
              <span className="mentor-profile__icon"><Quote size={18} aria-hidden="true" /></span>
              <div><span className="mentor-profile__eyebrow">HER APPROACH</span><h3>Philosophy &amp; experience</h3></div>
            </div>
            <p className="mentor-profile__philosophy">{MENTOR.philosophy}</p>
            <div className="mentor-creds">
              {MENTOR.credentials.map((item) => (
                <div key={item.title} className="mentor-cred">
                  <span className="mentor-cred__icon" aria-hidden="true">{item.icon}</span>
                  <strong>{item.title}</strong>
                  <small>{item.sub}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="checkout-card mentor-profile__card mentor-profile__sessions">
            <div className="mentor-profile__section-heading">
              <span className="mentor-profile__icon"><CalendarDays size={18} aria-hidden="true" /></span>
              <div><span className="mentor-profile__eyebrow">SAVE YOUR SPOT</span><h3>Upcoming sessions</h3></div>
            </div>
            <div className="mentor-profile__session-list">
              {MENTOR_SESSIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`menu-row ${activeId === item.id ? 'on' : ''}`}
                  onClick={() => setActiveId(item.id)}
                  aria-pressed={activeId === item.id}
                >
                  <span className="mentor-profile__session-info">
                    <strong>{item.title}</strong>
                    <small><Clock3 size={14} aria-hidden="true" />{item.time}</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              ))}
            </div>
            <button type="button" className="ghost mentor-profile__schedule" onClick={() => navigate('/yoga')}>
              View full schedule <ChevronRight size={16} aria-hidden="true" />
            </button>
          </section>
        </div>

        <section className="checkout-card mentor-profile__card mentor-profile__reviews">
          <div className="mentor-profile__section-heading">
            <span className="mentor-profile__icon mentor-profile__icon--gold"><Star size={18} fill="currentColor" aria-hidden="true" /></span>
            <div><span className="mentor-profile__eyebrow">KIND WORDS</span><h3>What students say</h3></div>
            <div className="mentor-profile__review-summary"><Star size={15} fill="currentColor" aria-hidden="true" /><strong>{MENTOR.rating}</strong><span> · {MENTOR.reviews} reviews</span></div>
          </div>
          <div className="mentor-profile__review-list">
            {MENTOR_REVIEWS.map((item) => (
              <article key={item.id} className="mentor-review">
                <div className="mentor-review__top">
                  <span className="mentor-review__avatar" aria-hidden="true">{item.name.charAt(0)}</span>
                  <div><strong>{item.name}</strong><small>{'★'.repeat(item.rating)}<span className="mentor-review__rating-label"> {item.rating}.0</span></small></div>
                </div>
                <p>{item.review}</p>
              </article>
            ))}
          </div>
        </section>

        <button type="button" className="cta mentor-profile__cta" onClick={() => navigate('/mentor/consult')}>
          Book a consultation <ChevronRight size={18} aria-hidden="true" />
        </button>
      </section>
    </AppShell>
  );
}

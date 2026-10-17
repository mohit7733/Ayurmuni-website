import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, UserRound, X } from 'lucide-react';
import {
  getOnboardingEntryScreen,
  markAsGuest,
  resolveAccessLikeProfile,
} from '../services/guestAuth';

const DEFAULT_REASON =
  'Complete your profile and prakriti assessment to continue.';

export default function CompleteDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const reason = location.state?.reason || DEFAULT_REASON;
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const leaveGate = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/home', { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setChecking(true);
        const { isComplete } = await resolveAccessLikeProfile();
        if (!cancelled && isComplete) {
          leaveGate();
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onComplete = async () => {
    try {
      setLoading(true);
      const { isComplete } = await resolveAccessLikeProfile();
      if (isComplete) {
        leaveGate();
        return;
      }
      await markAsGuest();
      const next = await getOnboardingEntryScreen();
      if (next === '/assessment') {
        navigate('/assessment', { state: { form: 'all' } });
      } else {
        navigate('/onboarding');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <section className="complete-gate checking">
        <div className="complete-panel complete-panel--checking">
          <p className="muted">Checking your profile…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="complete-gate">
      <div className="complete-panel">
        <section className="complete-intro">
          <div className="complete-icon" aria-hidden="true">
            <ClipboardCheck size={28} strokeWidth={1.8} />
          </div>
          <p className="complete-eyebrow">Your Ayurmuni profile</p>
          <h1>Complete your details to continue</h1>
          <p className="complete-reason">{reason}</p>
        </section>

        <div className="complete-content">
          <button
            type="button"
            className="complete-close"
            onClick={leaveGate}
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
          <div className="complete-steps">
            <p className="complete-steps__eyebrow">Just two steps to go</p>
            <h2>What you’ll complete</h2>
            <div className="complete-step">
              <span className="complete-step__icon" aria-hidden="true">
                <UserRound size={20} strokeWidth={1.8} />
              </span>
              <span className="complete-step__copy">
                <strong>Customer profile</strong>
                <small>Name, date of birth and gender</small>
              </span>
              <span className="complete-step__number">01</span>
            </div>
            <div className="complete-step">
              <span className="complete-step__icon" aria-hidden="true">
                <ClipboardCheck size={20} strokeWidth={1.8} />
              </span>
              <span className="complete-step__copy">
                <strong>Prakriti assessment</strong>
                <small>Personalize your Ayurvedic care</small>
              </span>
              <span className="complete-step__number">02</span>
            </div>
          </div>

          <div className="complete-actions">
            <button type="button" className="cta" disabled={loading} onClick={onComplete}>
              {loading ? 'Please wait…' : 'Complete details'}
              {!loading && <ArrowRight size={18} aria-hidden="true" />}
            </button>
            <button type="button" className="ghost" disabled={loading} onClick={leaveGate}>
              Keep browsing
            </button>
          </div>
          <p className="complete-note">Your information helps tailor care to your needs.</p>
        </div>
      </div>
    </section>
  );
}

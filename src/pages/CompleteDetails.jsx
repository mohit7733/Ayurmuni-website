import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
        <p className="muted">Checking your profile…</p>
      </section>
    );
  }

  return (
    <section className="complete-gate">
      <button type="button" className="complete-close" onClick={leaveGate} aria-label="Close">
        ×
      </button>
      <div className="complete-icon">☰</div>
      <h1>Complete details to proceed</h1>
      <p className="complete-reason">{reason}</p>
      <div className="complete-steps">
        <h3>What you’ll finish</h3>
        <p>
          <span>1</span>
          Customer profile (name, DOB, gender)
        </p>
        <p>
          <span>2</span>
          Prakriti assessment
        </p>
      </div>
      <button type="button" className="cta" disabled={loading} onClick={onComplete}>
        {loading ? 'Please wait…' : 'Complete details'}
      </button>
      <button type="button" className="ghost" disabled={loading} onClick={leaveGate}>
        Keep browsing
      </button>
    </section>
  );
}

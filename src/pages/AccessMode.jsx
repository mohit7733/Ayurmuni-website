import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Leaf, Package, Phone, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import leaf1Img from '/images/leaf1.png';
import logoImg from '/greenlogo.png';
import { Utils } from '../common/utils';
import { useLocation as useDeliveryLocation } from '../context/LocationContext';
import {
  isProfileComplete,
  markAsGuest,
  resolveAccessLikeProfile,
} from '../services/guestAuth';
import { Button, Modal } from '../components/ui';
import { AUTH_COPY as T } from '../content/auth';
import '../design/brand.css';
import '../design/pages/access-mode.css';

const SHOWCASE_ICONS = [UserRound, Stethoscope, Package, Leaf];

export default function AccessMode() {
  const navigate = useNavigate();
  const { clearLocationSession } = useDeliveryLocation();
  const [loading, setLoading] = useState(null);
  const [checking, setChecking] = useState(true);
  const [signOutOpen, setSignOutOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let leaving = false;
      try {
        const { isComplete, profile } = await resolveAccessLikeProfile();
        const cached = (await Utils.getData('_USER_INFO')) || profile;
        if (cancelled) return;
        if (isComplete || isProfileComplete(cached)) {
          leaving = true;
          navigate('/home', { replace: true });
          return;
        }
      } catch {
        // Stay on access mode when the profile check fails.
      } finally {
        if (!cancelled && !leaving) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const skipToHome = async () => {
    try {
      setLoading('skip');
      await markAsGuest();
      navigate('/home', { replace: true });
    } finally {
      setLoading(null);
    }
  };

  const startOnboarding = async () => {
    try {
      setLoading('onboard');
      await markAsGuest();
      navigate('/onboarding');
    } finally {
      setLoading(null);
    }
  };

  const confirmSignOut = async () => {
    try {
      setLoading('signout');
      setSignOutOpen(false);
      try {
        await clearLocationSession();
      } catch {
        // Session storage still has to clear.
      }
      await Utils.clearAllData();
      navigate('/welcome', { replace: true });
    } finally {
      setLoading(null);
    }
  };

  if (checking) {
    return (
      <section className="au-page ax-page" aria-busy="true" aria-label="Checking your profile">
        <div className="ax-boot">
          <span className="ax-boot__dot" aria-hidden />
          <p>Checking your profile…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="au-page ax-page" aria-labelledby="ax-title">
      <div className="ax-shell">
        <div className="ax-brand">
          <img className="ax-brand__leaf" src={leaf1Img} alt="" aria-hidden />
          <div className="ax-brand__id">
            <span className="ax-brand__logo">
              <img src={logoImg} alt="Ayurmuni" />
            </span>
            <span className="ax-brand__tag">{T.accessBrandLine}</span>
          </div>

          <h1 id="ax-title">{T.accessTitle}</h1>
          <p className="ax-brand__lede">{T.accessText}</p>

          <p className="ax-label">{T.unlockLabel}</p>
          <ul className="ax-features">
            {T.showcase.map((item, index) => {
              const Icon = SHOWCASE_ICONS[index] || Leaf;
              return (
                <li className="ax-feature" key={item.title} style={{ '--i': index }}>
                  <span className="ax-feature__icon" aria-hidden>
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <span className="ax-feature__copy">
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="ax-panel">
          <div className="ax-panel__top">
            <span className="ax-verified">
              <ShieldCheck size={14} aria-hidden />
              {T.accessVerified}
            </span>
            <button type="button" className="ax-skip" disabled={!!loading} onClick={skipToHome}>
              {loading === 'skip' ? '…' : T.accessSkip}
            </button>
          </div>

          <button
            type="button"
            className="ax-setup"
            disabled={!!loading}
            onClick={startOnboarding}
          >
            <span className="ax-setup__copy">
              <strong>{T.setupTitle}</strong>
              <small>{T.setupSubtitle}</small>
            </span>
            <span className="ax-setup__arrow" aria-hidden>
              {loading === 'onboard' ? '…' : <ArrowRight size={20} />}
            </span>
          </button>

          <p className="ax-note">{T.accessNote}</p>

          <ul className="ax-trust">
            {T.trust.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>

          <Button
            className="ax-change"
            variant="ghost"
            block
            disabled={!!loading}
            loading={loading === 'signout'}
            leadingIcon={loading === 'signout' ? null : <Phone size={15} aria-hidden />}
            onClick={() => setSignOutOpen(true)}
          >
            {T.changeNumber}
          </Button>
        </div>
      </div>

      <Modal
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title={T.changeNumberTitle}
        description={T.changeNumberText}
        footer={
          <>
            <Button variant="primary" onClick={confirmSignOut} disabled={!!loading}>
              {T.changeSignOut}
            </Button>
            <Button variant="secondary" onClick={() => setSignOutOpen(false)} disabled={!!loading}>
              {T.changeStay}
            </Button>
          </>
        }
      />
    </section>
  );
}

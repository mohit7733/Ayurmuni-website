import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Leaf, Package, Phone, Stethoscope, UserRound } from 'lucide-react';
import leaf1Img from '/images/leaf1.png';
import logoImg from '/greenlogo.png';
import { Utils } from '../common/utils';
import { useLocation as useDeliveryLocation } from '../context/LocationContext';
import {
  isProfileComplete,
  markAsGuest,
  resolveAccessLikeProfile,
} from '../services/guestAuth';
import { Badge, Button, Modal } from '../components/ui';
import { AUTH_COPY as T } from '../content/auth';
import '../design/pages/auth.css';

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
      <section className="au-page au-access" aria-busy="true" aria-label="Checking your profile">
        <div className="au-access__hero au-access__boot">
          <p>Checking your profile…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="au-page au-access">
      <div className="au-access__hero">
        <img className="au-access__leaf" src={leaf1Img} alt="" />
        <div className="au-access__hero-inner">
          <div className="au-access__top">
            <Badge tone="success">{T.accessVerified}</Badge>
            <Button variant="ghost" size="sm" disabled={!!loading} onClick={skipToHome}>
              {loading === 'skip' ? '…' : T.accessSkip}
            </Button>
          </div>

          <div className="au-access__brand">
            <div className="au-access__logo">
              <img src={logoImg} alt="Ayurmuni" />
            </div>
            <div>
              <strong>Ayurmuni</strong>
              <span>{T.accessBrandLine}</span>
            </div>
          </div>

          <h1>
            Your wellness,
            <br />
            tuned to you
          </h1>
          <p>{T.accessText}</p>
        </div>
      </div>

      <div className="au-access__sheet">
        <p className="au-access__label">{T.unlockLabel}</p>
        <div className="au-access__grid">
          {T.showcase.map((item, index) => {
            const Icon = SHOWCASE_ICONS[index] || Leaf;
            return (
              <article className="au-access__feature" key={item.title}>
                <Icon className="au-access__feature-icon" size={18} aria-hidden />
                <h3>{item.title}</h3>
                <p>{item.subtitle}</p>
              </article>
            );
          })}
        </div>

        <div className="au-access__trust">
          {T.trust.map((label) => (
            <Badge key={label} tone="neutral">
              {label}
            </Badge>
          ))}
        </div>

        <button
          type="button"
          className="au-access__setup"
          disabled={!!loading}
          onClick={startOnboarding}
        >
          <div>
            <h3>{T.setupTitle}</h3>
            <p>{T.setupSubtitle}</p>
          </div>
          <span aria-hidden>
            {loading === 'onboard' ? '…' : <ArrowRight size={20} />}
          </span>
        </button>

        <Button
          variant="ghost"
          block
          disabled={!!loading}
          loading={loading === 'signout'}
          leadingIcon={loading === 'signout' ? null : <Phone size={15} aria-hidden />}
          onClick={() => setSignOutOpen(true)}
        >
          {T.changeNumber}
        </Button>

        <p className="au-access__note">{T.accessNote}</p>
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

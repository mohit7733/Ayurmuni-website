import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Leaf, Package, Stethoscope, UserRound } from 'lucide-react';
import { Images } from '../common/images';
import { markAsGuest } from '../services/guestAuth';
import { Badge, Button } from '../components/ui';
import { AUTH_COPY as T } from '../content/auth';
import '../design/pages/auth.css';

const SHOWCASE_ICONS = [UserRound, Stethoscope, Package, Leaf];

export default function AccessMode() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);

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

  return (
    <section className="au-page au-access">
      <div className="au-access__hero">
        <img className="au-access__leaf" src={Images.leaf1} alt="" />
        <div className="au-access__hero-inner">
          <div className="au-access__top">
            <Badge tone="success">{T.accessVerified}</Badge>
            <Button variant="ghost" size="sm" disabled={!!loading} onClick={skipToHome}>
              {loading === 'skip' ? '…' : T.accessSkip}
            </Button>
          </div>

          <div className="au-access__brand">
            <div className="au-access__logo">
              <img src={Images.FinalLogo2} alt="Ayurmuni" />
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

        <p className="au-access__note">{T.accessNote}</p>
      </div>
    </section>
  );
}

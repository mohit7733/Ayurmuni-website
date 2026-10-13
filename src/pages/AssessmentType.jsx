import { useState } from 'react';
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  HeartPulse,
  Leaf,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import PrakritiNoteModal from '../components/PrakritiNoteModal';
import { showSuccessToast } from '../config/key';
import { markAsGuest } from '../services/guestAuth';
import * as AssessService from '../services/assessmentService';

export default function AssessmentType() {
  const navigate = useNavigate();
  const location = useLocation();
  const form = location.state?.form || 'all';
  const showMedical = form === 'medical' || form === 'all';
  const showPrakriti = form === 'prakriti' || form === 'all';
  const [prakritiNoteVisible, setPrakritiNoteVisible] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const handleSkip = async () => {
    if (skipping) return;
    setSkipping(true);
    try {
      const response = await AssessService.SkipAssesment({ is_skipped: true });
      if (!response?.success) {
        showSuccessToast(response?.message || 'Something went wrong', 'error');
        return;
      }
      await markAsGuest();
      navigate('/home', { replace: true });
    } catch {
      showSuccessToast('Network Error', 'error');
    } finally {
      setSkipping(false);
    }
  };

  const startPrakriti = () => {
    setPrakritiNoteVisible(false);
    navigate('/patient-faq', {
      state: { allowBack: true, noteSeen: true, allowIncompleteProfile: true },
    });
  };

  return (
    <section className="assess">
      <div className="assess-hero">
        <div className="assess-hero__inner">
          <div className="assess-row">
            <span className="assess-step">
              <Sparkles size={15} aria-hidden /> YOUR CARE, YOUR WAY
            </span>
            <button type="button" className="skip-link" onClick={handleSkip} disabled={skipping}>
              {skipping ? 'Saving…' : 'Skip for now'}
            </button>
          </div>
          <div className="assess-hero__copy">
            <span className="assess-hero__icon"><HeartPulse size={25} aria-hidden /></span>
            <div>
              <h1>Personalize your care</h1>
              <p>Choose a short assessment and get recommendations shaped around you.</p>
            </div>
          </div>
          <div className="assess-hero__promise">
            <span><ShieldCheck size={16} aria-hidden /> Your answers stay private</span>
            <span><Check size={16} aria-hidden /> You can finish either assessment later</span>
          </div>
        </div>
      </div>

      <div className="assess-sheet">
        <div className="assess-sheet__heading">
          <span>CHOOSE YOUR STARTING POINT</span>
          <h2>A little about you goes a long way.</h2>
          <p>There’s no right or wrong answer. Pick one to get started.</p>
        </div>

        <div className={`assess-options ${showPrakriti && showMedical ? '' : 'assess-options--single'}`}>
          {showPrakriti ? (
            <button
              type="button"
              className="assess-card prakriti"
              onClick={() => setPrakritiNoteVisible(true)}
              aria-haspopup="dialog"
            >
              <span className="assess-card__icon"><Leaf size={23} aria-hidden /></span>
              <span className="assess-card__time">About 5 minutes</span>
              <span className="assess-card__copy">
                <strong>Discover your Prakriti</strong>
                <span>
                  Explore your natural Ayurvedic constitution — Vata, Pitta, and Kapha — for
                  guidance that feels like you.
                </span>
              </span>
              <span className="assess-card__tags">
                <span><Check size={14} aria-hidden /> Lifestyle insights</span>
                <span><Check size={14} aria-hidden /> Personalised guidance</span>
              </span>
              <span className="assess-card__action">
                Start Prakriti assessment <ArrowRight size={17} aria-hidden />
              </span>
            </button>
          ) : null}

          {showMedical ? (
            <button
              type="button"
              className="assess-card medical"
              onClick={() => navigate('/assessment-medical')}
            >
              <span className="assess-card__icon"><ClipboardCheck size={23} aria-hidden /></span>
              <span className="assess-card__time">
                <ShieldCheck size={14} aria-hidden /> Private &amp; secure
              </span>
              <span className="assess-card__copy">
                <strong>Check in on your health</strong>
                <span>
                  Share relevant health details to help tailor your wellness plan and care
                  recommendations.
                </span>
              </span>
              <span className="assess-card__tags">
                <span><Check size={14} aria-hidden /> Health history</span>
                <span><Check size={14} aria-hidden /> Better care context</span>
              </span>
              <span className="assess-card__action">
                Start health assessment <ArrowRight size={17} aria-hidden />
              </span>
            </button>
          ) : null}
        </div>

        <div className="assess-tip">
          <span className="assess-tip__icon"><Sparkles size={19} aria-hidden /></span>
          <p>
            <strong>Why take an assessment?</strong> Your answers help make doctor, product, and
            daily wellness recommendations more relevant. You can complete either assessment
            later from your profile.
          </p>
        </div>

        <button type="button" className="skip-btn" onClick={handleSkip} disabled={skipping}>
          {skipping ? 'Saving your choice…' : 'I’ll do this later'}
          {!skipping ? <ArrowRight size={16} aria-hidden /> : null}
        </button>
      </div>

      <PrakritiNoteModal
        visible={prakritiNoteVisible}
        onClose={() => setPrakritiNoteVisible(false)}
        onBegin={startPrakriti}
      />
    </section>
  );
}

import { useState } from 'react';
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

  const handleSkip = async () => {
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
        <div className="assess-row">
          <span className="step-pill">Step 2 of 2</span>
          <button type="button" className="skip-link" onClick={handleSkip}>
            Skip
          </button>
        </div>
        <h1>Personalize your care</h1>
        <p>Pick an assessment to tailor doctors, products, and daily guidance.</p>
      </div>

      <div className="assess-sheet">
        {showPrakriti ? (
          <button
            type="button"
            className="assess-card prakriti"
            onClick={() => setPrakritiNoteVisible(true)}
          >
            <div className="assess-card-top">
              <span>◎</span>
              <em>~5 min</em>
            </div>
            <h2>Prakriti Assessment</h2>
            <p>
              Discover your Ayurvedic constitution — Vata, Pitta, Kapha — and get
              guidance that fits you.
            </p>
            <strong>Begin →</strong>
          </button>
        ) : null}

        {showMedical ? (
          <button
            type="button"
            className="assess-card medical"
            onClick={() => navigate('/assessment-medical')}
          >
            <div className="assess-card-top">
              <span>+</span>
              <em>Secure</em>
            </div>
            <h2>Vikriti assessment</h2>
            <p>Gut and metabolic evaluation/constitution.</p>
            <strong>Begin →</strong>
          </button>
        ) : null}

        <div className="tip-box assess-tip">
          Completing both unlocks sharper product and doctor recommendations. You
          can finish either path later from Profile.
        </div>

        <button type="button" className="skip-btn" onClick={handleSkip}>
          Skip for now · Browse home
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

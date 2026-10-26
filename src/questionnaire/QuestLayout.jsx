import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Volume2, VolumeX } from 'lucide-react';
import yesHumanImg from '/images/Yes.webp';
import noHumanImg from '/images/No.webp';
import { DOSHA } from './configs';
import { computeDoshaScores, dominantDosha } from './doshaScoreUtils';
import { getStepKey } from './utils';
import BasicInfoForm from './BasicInfoForm';
import { isQuestMuted, playQuestSound, questHaptic, setQuestMuted } from './questSound';

// T125: game-like journey. Milestone lines are encouragement only (no claims).
const MILESTONES = [
  { at: 25, text: 'A quarter of the way. Keep going!' },
  { at: 50, text: 'Halfway through your journey.' },
  { at: 75, text: 'Final stretch. Almost there!' },
];
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 53) % 40) / 100,
  dur: 1.1 + ((i * 29) % 50) / 100,
  rot: (i * 47) % 360,
  drift: ((i * 61) % 80) - 40,
  gold: i % 3 !== 0,
}));
// T126: inline SVG ornaments (no external assets).
const ELEMENT_ICONS = {
  // Vata = air, Pitta = fire, Kapha = earth/water
  vata: (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M2 6h8a2 2 0 1 0-2-2M2 9h10a2 2 0 1 1-2 2M2 12h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  pitta: (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M8 1.5c.5 2.5 3.5 4 3.5 7.5a3.5 3.5 0 0 1-7 0c0-1.6.8-2.6 1.6-3.4.2 1.2.8 1.9 1.4 2.1C7 5.6 7.4 3.4 8 1.5Z" fill="currentColor" />
    </svg>
  ),
  kapha: (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M8 1.8C10 5 12 7.2 12 9.8a4 4 0 0 1-8 0C4 7.2 6 5 8 1.8Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 14.2h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

const Lotus = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M12 4c2 2.2 2.6 5 2 8-1 .6-1.4.8-2 1-.6-.2-1-.4-2-1-.6-3 0-5.8 2-8Z" fill="currentColor" />
    <path d="M5 8.5c2.6.4 4.6 2 5.6 4.8-.4.8-.6 1.2-.8 1.7C7.2 14.6 5.4 12.4 5 8.5Zm14 0c-2.6.4-4.6 2-5.6 4.8.4.8.6 1.2.8 1.7 2.6-.4 4.4-2.6 4.8-6.5Z" fill="currentColor" opacity=".8" />
    <path d="M3 13.5c3 .2 5.6 1.4 9 3.5 3.4-2.1 6-3.3 9-3.5-1.6 3.6-5 5.5-9 5.5s-7.4-1.9-9-5.5Z" fill="currentColor" opacity=".6" />
  </svg>
);

const Mandala = () => (
  <svg className="quest-mandala" viewBox="0 0 200 200" aria-hidden>
    <g fill="none" stroke="currentColor" strokeWidth=".6">
      {Array.from({ length: 16 }, (_, i) => (
        <ellipse key={i} cx="100" cy="58" rx="14" ry="42" transform={`rotate(${i * 22.5} 100 100)`} />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <path key={`p${i}`} d="M100 10c8 10 8 22 0 32-8-10-8-22 0-32Z" transform={`rotate(${i * 45} 100 100)`} />
      ))}
      <circle cx="100" cy="100" r="96" />
      <circle cx="100" cy="100" r="74" />
      <circle cx="100" cy="100" r="22" />
      <circle cx="100" cy="100" r="12" />
    </g>
  </svg>
);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function QuestLayout({ flow, onExit }) {
  const {
    loading,
    submitting,
    loadError,
    step,
    steps,
    currentStep,
    progress,
    answers,
    isDisabled,
    showSkip,
    isLastStep,
    handleSelect,
    handleNext,
    handleBack,
    handleSkip,
    retryLoad,
    isSelected,
    streak,
    xp,
    mode,
    basicInfoStep,
    rawQuestions,
    handleBasicInfoChange,
    handleTextChange,
  } = flow;

  const isMedical = mode === 'medical';
  const scores = computeDoshaScores(answers, steps);
  const lead = dominantDosha(scores);
  const level = Math.min(step + 1, Math.max(steps.length, 1));
  const totalLevels = Math.max(steps.length, 1);

  const [muted, setMuted] = useState(isQuestMuted);
  const [milestone, setMilestone] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const prevStep = useRef(step);
  const milestoneTimer = useRef(null);
  const celebrateTimer = useRef(null);

  useEffect(() => {
    const prev = prevStep.current;
    prevStep.current = step;
    if (step <= prev || totalLevels < 4) {
      if (step > prev) playQuestSound('next');
      return;
    }
    const before = (prev / totalLevels) * 100;
    const now = (step / totalLevels) * 100;
    const hit = MILESTONES.filter((m) => before < m.at && now >= m.at).pop();
    if (hit) {
      playQuestSound('levelUp');
      questHaptic([12, 40, 12]);
      setMilestone(hit);
      clearTimeout(milestoneTimer.current);
      milestoneTimer.current = setTimeout(() => setMilestone(null), 2200);
    } else {
      playQuestSound('next');
    }
  }, [step, totalLevels]);

  useEffect(
    () => () => {
      clearTimeout(milestoneTimer.current);
      clearTimeout(celebrateTimer.current);
    },
    [],
  );

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setQuestMuted(next);
    if (!next) playQuestSound('tap');
  };

  const onChoose = (item) => {
    playQuestSound('tap');
    questHaptic(10);
    handleSelect(item);
  };

  // Completion: celebrate briefly, then run the existing submit + navigation.
  const onFinish = () => {
    if (!isLastStep || isDisabled || submitting) {
      handleNext();
      return;
    }
    setCelebrating(true);
    playQuestSound('fanfare');
    questHaptic([20, 60, 20, 60, 40]);
    clearTimeout(celebrateTimer.current);
    celebrateTimer.current = setTimeout(
      () => {
        handleNext();
        celebrateTimer.current = setTimeout(() => setCelebrating(false), 1800);
      },
      prefersReducedMotion() ? 250 : 1100,
    );
  };

  const resolveImage = (item) => {
    if (currentStep?.key === 'knowPrakriti' && item?.value === 'Yes') {
      return yesHumanImg;
    }
    if (currentStep?.key === 'knowPrakriti' && item?.value === 'No') {
      return noHumanImg;
    }
    return item?.image_path || '';
  };

  const onHeaderBack = () => {
    if (step === 0) {
      onExit();
      return;
    }
    handleBack();
  };

  if (loading && !currentStep) {
    return (
      <section className={`quest ${isMedical ? 'medical' : 'prakriti'}`}>
        <div className="quest-loader" role="status" aria-live="polite">
          {isMedical ? 'Preparing your health quest…' : 'Opening the temple gates…'}
        </div>
      </section>
    );
  }

  if (loadError && !currentStep) {
    return (
      <section className={`quest ${isMedical ? 'medical' : 'prakriti'}`}>
        <div className="quest-loader" role="alert">
          <p>{loadError}</p>
          <button className="cta" type="button" onClick={retryLoad}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!currentStep) return null;

  const choices = currentStep.choices ?? [];
  const stepKey = getStepKey(currentStep);

  return (
    <section className={`quest ${isMedical ? 'medical' : 'prakriti'}`}>
      <div className="quest-backdrop" aria-hidden>
        <Mandala />
        <Mandala />
      </div>
      <header className="quest-top">
        <button type="button" onClick={onHeaderBack} aria-label="Go back">
          <ArrowLeft size={19} aria-hidden />
        </button>
        <div>
          <strong>{isMedical ? 'Health Quest' : 'Prakriti Quest'}</strong>
          <small>{isMedical ? 'Your Wellness Path' : 'The Temple Journey'}</small>
        </div>
        <button
          type="button"
          className="quest-mute"
          onClick={toggleMute}
          aria-pressed={!muted}
          aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
        >
          {muted ? <VolumeX size={17} aria-hidden /> : <Volume2 size={17} aria-hidden />}
        </button>
        <span className="xp-badge" key={xp}>
          {xp} XP
        </span>
      </header>

      <div className="quest-hud">
        {isMedical ? (
          <>
            <span className="pill">Health</span>
            <span className="pill">Private</span>
            <span className="pill">Level {level}</span>
          </>
        ) : (
          ['vata', 'pitta', 'kapha'].map((key) => (
            <span
              key={`${key}-${scores[key]}`}
              className={`pill ${lead === key ? 'lead' : ''} ${scores[key] ? 'pulse' : ''}`}
            >
              <i className={`pill-ico ${key}`}>{ELEMENT_ICONS[key]}</i>
              {DOSHA[key].label}
              <b>{scores[key]}</b>
            </span>
          ))
        )}
        {streak > 1 ? <span className="streak">{streak}x</span> : null}
      </div>

      <div
        className="track"
        role="progressbar"
        aria-label="Assessment progress"
        aria-valuemin={0}
        aria-valuemax={totalLevels}
        aria-valuenow={level}
        aria-valuetext={`Question ${level} of ${totalLevels}`}
      >
        <div className="track-head">
          <span>
            LEVEL {level} OF {totalLevels}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="track-bar">
          <i style={{ width: `${progress}%` }} />
        </div>
        {totalLevels > 1 ? (
          <ol className={`quest-map ${totalLevels > 16 ? 'dense' : ''}`} aria-hidden>
            {steps.map((s, i) => (
              <li
                key={getStepKey(s) || i}
                className={i < step ? 'done' : i === step ? 'here' : ''}
              >
                <span>
                  {i < step ? <Check size={9} strokeWidth={3.5} /> : i === step ? <Lotus /> : null}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {milestone ? (
        <div className="quest-milestone" role="status" key={milestone.at}>
          <strong>{milestone.at}%</strong>
          <span>{milestone.text}</span>
        </div>
      ) : null}

      {celebrating ? (
        <div className="quest-celebrate" role="status">
          <div className="quest-confetti" aria-hidden>
            {CONFETTI.map((c, i) => (
              <i
                key={i}
                className={c.gold ? 'gold' : 'green'}
                style={{
                  left: `${c.left}%`,
                  animationDelay: `${c.delay}s`,
                  animationDuration: `${c.dur}s`,
                  '--rot': `${c.rot}deg`,
                  '--drift': `${c.drift}px`,
                }}
              />
            ))}
          </div>
          <div className="quest-celebrate__card">
            <span className="quest-celebrate__badge">
              <span className="quest-celebrate__rays" aria-hidden />
              <span className="quest-celebrate__medal">
                <Lotus />
              </span>
            </span>
            <span className="quest-eyebrow">{isMedical ? 'HEALTH JOURNEY' : 'PRAKRITI JOURNEY'}</span>
            <strong>Journey complete!</strong>
            <small>All {totalLevels} levels done. Preparing your results…</small>
          </div>
        </div>
      ) : null}

      <div className="quest-stage" key={step}>
        <div className="level-badge">
          <span>LEVEL {level}</span>
          <i className="quest-ornament" aria-hidden>
            <svg viewBox="0 0 60 8">
              <path d="M0 4h24M36 4h24" stroke="currentColor" strokeWidth=".8" />
              <path d="M30 0l4 4-4 4-4-4z" fill="currentColor" />
            </svg>
          </i>
        </div>
        <h2 id="quest-question" aria-live="polite">
          {basicInfoStep ? 'Share your basic information' : currentStep.question}
        </h2>
        {currentStep.answer_type === 'multi_choice' ? (
          <p className="multi-hint">Select all that apply</p>
        ) : currentStep.answer_type !== 'text' && !basicInfoStep ? (
          <p className="multi-hint">Choose the answer that feels most like you</p>
        ) : null}

        {basicInfoStep && rawQuestions && handleBasicInfoChange ? (
          <>
            <BasicInfoForm
              questions={rawQuestions}
              selectedAnswers={answers}
              onChange={handleBasicInfoChange}
            />
            <button
              className="cta"
              type="button"
              disabled={isDisabled || submitting || celebrating}
              onClick={onFinish}
            >
              {submitting ? 'Please wait…' : 'Continue'}
            </button>
          </>
        ) : currentStep.answer_type === 'text' && handleTextChange ? (
          <>
            <textarea
              placeholder="Write your answer..."
              value={answers[stepKey] ?? ''}
              onChange={(e) => handleTextChange(e.target.value)}
            />
            <button
              className="cta"
              type="button"
              disabled={isDisabled || submitting || celebrating}
              onClick={onFinish}
            >
              {submitting ? 'Please wait…' : isLastStep ? 'Complete Quest' : 'Continue'}
            </button>
          </>
        ) : (
          <>
            <div className="quest-options" role="group" aria-labelledby="quest-question">
              {choices.map((item, index) => {
                const full = String(item?.value ?? '');
                const [optTitle, ...rest] = full.split(' - ');
                const active = isSelected(item);
                const img = resolveImage(item);
                // T124: one fixed option UI for every question (no per-dosha colours).
                return (
                  <button
                    type="button"
                    key={`${item?.index}-${index}`}
                    className={`quest-opt ${active ? 'on' : ''} ${img ? 'has-img' : ''}`}
                    aria-pressed={active}
                    onClick={() => onChoose(item)}
                  >
                    <span className="opt-num" aria-hidden>
                      {index + 1}
                    </span>
                    {img ? <img src={img} alt="" /> : null}
                    <span className="opt-copy">
                      <strong>{optTitle || full || `Option ${index + 1}`}</strong>
                      {rest.length ? <small>{rest.join(' - ')}</small> : null}
                    </span>
                    <span className="opt-check" aria-hidden>
                      {active ? <Check size={13} strokeWidth={3} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {(currentStep.answer_type === 'multi_choice' || isLastStep) && (
              <button
                className="cta"
                type="button"
                disabled={isDisabled || submitting || celebrating}
                onClick={onFinish}
              >
                {submitting ? 'Please wait…' : isLastStep ? 'Complete Quest' : 'Continue'}
              </button>
            )}
          </>
        )}
      </div>

      <footer className="quest-foot">
        <button type="button" onClick={onHeaderBack}>
          {step === 0 ? 'Back' : 'Previous'}
        </button>
        <div>
          {showSkip ? (
            <button type="button" onClick={handleSkip}>
              Skip
            </button>
          ) : null}
          <button type="button" className="exit" onClick={onExit}>
            Exit Quest
          </button>
        </div>
      </footer>
    </section>
  );
}

import { Images } from '../common/images';
import { DOSHA } from './configs';
import { computeDoshaScores, dominantDosha } from './doshaScoreUtils';
import { getStepKey } from './utils';
import BasicInfoForm from './BasicInfoForm';

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
  const accent = isMedical ? '#0D7A6F' : DOSHA[lead].color;
  const level = Math.min(step + 1, Math.max(steps.length, 1));
  const totalLevels = Math.max(steps.length, 1);

  const resolveImage = (item) => {
    if (currentStep?.key === 'knowPrakriti' && item?.value === 'Yes') {
      return Images.yesHuman;
    }
    if (currentStep?.key === 'knowPrakriti' && item?.value === 'No') {
      return Images.noHuman;
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
      <section className={`quest ${isMedical ? 'medical' : ''}`}>
        <div className="quest-loader">
          {isMedical ? 'Preparing your health quest…' : 'Opening the temple gates…'}
        </div>
      </section>
    );
  }

  if (loadError && !currentStep) {
    return (
      <section className={`quest ${isMedical ? 'medical' : ''}`}>
        <div className="quest-loader">
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
    <section className={`quest ${isMedical ? 'medical' : ''}`}>
      <header className="quest-top">
        <button type="button" onClick={onHeaderBack}>
          ←
        </button>
        <div>
          <strong>{isMedical ? 'Health Quest' : 'Prakriti Quest'}</strong>
          <small>{isMedical ? 'Your Wellness Path' : 'The Temple Journey'}</small>
        </div>
        <span className="xp-badge">{xp} XP</span>
      </header>

      <div className="quest-hud">
        {isMedical ? (
          <>
            <span className="pill">Health</span>
            <span className="pill">Private</span>
            <span className="pill">Step {level}</span>
          </>
        ) : (
          ['vata', 'pitta', 'kapha'].map((key) => (
            <span
              key={key}
              className={`pill ${lead === key ? 'lead' : ''}`}
              style={{ color: DOSHA[key].color, background: DOSHA[key].soft }}
            >
              {DOSHA[key].label} {scores[key]}
            </span>
          ))
        )}
        {streak > 1 ? <span className="streak">{streak}x</span> : null}
      </div>

      <div className="track">
        <div>
          LEVEL {level} OF {totalLevels}
        </div>
        <div className="track-bar">
          <i style={{ width: `${progress}%`, background: accent }} />
        </div>
      </div>

      <div className="quest-stage">
        <div className="level-badge" style={{ background: accent }}>
          LEVEL {level}
        </div>
        <h2>
          {basicInfoStep ? 'Share your basic information' : currentStep.question}
        </h2>
        {currentStep.answer_type === 'multi_choice' ? (
          <p className="multi-hint">Select all that apply</p>
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
              disabled={isDisabled || submitting}
              onClick={handleNext}
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
              disabled={isDisabled || submitting}
              onClick={handleNext}
            >
              {submitting ? 'Please wait…' : isLastStep ? 'Complete Quest' : 'Continue'}
            </button>
          </>
        ) : (
          <>
            <div className="quest-options">
              {choices.map((item, index) => {
                const full = String(item?.value ?? '');
                const [optTitle, ...rest] = full.split(' - ');
                const active = isSelected(item);
                const color = isMedical
                  ? accent
                  : index % 3 === 0
                    ? DOSHA.vata.color
                    : index % 3 === 1
                      ? DOSHA.pitta.color
                      : DOSHA.kapha.color;
                const img = resolveImage(item);
                return (
                  <button
                    type="button"
                    key={`${item?.index}-${index}`}
                    className={`quest-opt ${active ? 'on' : ''}`}
                    style={{ borderColor: active ? color : undefined }}
                    onClick={() => handleSelect(item)}
                  >
                    <span className="opt-num" style={{ background: active ? color : '#eee' }}>
                      {index + 1}
                    </span>
                    {img ? <img src={img} alt="" /> : null}
                    <span className="opt-copy">
                      <strong>{optTitle || full || `Option ${index + 1}`}</strong>
                      {rest.length ? <small>{rest.join(' - ')}</small> : null}
                    </span>
                    {active ? <span className="opt-check">✓</span> : null}
                  </button>
                );
              })}
            </div>
            {(currentStep.answer_type === 'multi_choice' || isLastStep) && (
              <button
                className="cta"
                type="button"
                disabled={isDisabled || submitting}
                onClick={handleNext}
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

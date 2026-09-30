import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showSuccessToast } from '../config/key';
import { QUESTIONNAIRE_SETUP, STREAK_BONUS, XP_PER_LEVEL } from './configs';
import {
  buildPrakritiAnswers,
  buildPrakritiSteps,
  buildPrakritiTypeStep,
  KNOW_PRAKRITI_STEP,
  loadQuestionnaire,
} from './loadQuestionnaire';
import {
  submitKnowPrakriti,
  submitPrakritiType,
  submitQuestionnaire,
} from './questionnaireApi';
import {
  findBasicQuestions,
  formatMedicalAnswers,
  getStepKey,
  isAnswerEmpty,
  isBasicInfoStep,
  isChoiceSelected,
  toggleAnswer,
} from './utils';
import { promoteToFullUser, resolveAccessLikeProfile } from '../services/guestAuth';

export const useQuestionnaireFlow = (mode) => {
  const navigate = useNavigate();
  const isPrakriti = mode === 'prakriti';
  const setup = QUESTIONNAIRE_SETUP[mode];

  const [rawQuestions, setRawQuestions] = useState([]);
  const [steps, setSteps] = useState([]);
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [streak, setStreak] = useState(0);

  const cachedPrakritiQuestions = useRef([]);
  const isSelectingKnowPrakriti = useRef(false);
  const pendingAdvanceRef = useRef(false);
  const prevStepRef = useRef(0);

  const basics = useMemo(() => findBasicQuestions(rawQuestions), [rawQuestions]);
  const currentStep = steps[step];
  const progress = steps.length ? ((step + 1) / steps.length) * 100 : 0;
  const isLastStep = step === steps.length - 1;
  const basicInfoStep = !isPrakriti && isBasicInfoStep(currentStep, basics);

  const isDisabled = useMemo(
    () => isAnswerEmpty(answers, currentStep, isPrakriti ? undefined : basics),
    [answers, basics, currentStep, isPrakriti],
  );

  const applyLoadResult = useCallback((result) => {
    cachedPrakritiQuestions.current = result.cachedPrakritiQuestions;
    setRawQuestions(result.rawQuestions);
    setAnswers(result.answers);
    setSteps(result.steps);
    setLoadError(result.error);
  }, []);

  const fetchData = useCallback(
    async (resetStep = false) => {
      setLoading(true);
      setLoadError('');
      const result = await loadQuestionnaire(mode);
      applyLoadResult(result);
      if (resetStep) setStep(0);
      setLoading(false);
    },
    [applyLoadResult, mode],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleKnowPrakriti = useCallback(async (value) => {
    if (isSelectingKnowPrakriti.current) return;
    isSelectingKnowPrakriti.current = true;
    setAnswers((prev) => ({ ...prev, knowPrakriti: value }));
    setSubmitting(true);
    try {
      if (value === 'Yes') {
        const response = await submitKnowPrakriti(true);
        const options = response?.data?.prakriti_result_options ?? [];
        if (!options.length) {
          showSuccessToast('No prakriti options found', 'error');
          return;
        }
        setSteps([KNOW_PRAKRITI_STEP, buildPrakritiTypeStep(options)]);
        setStep(1);
        return;
      }

      const questions = cachedPrakritiQuestions.current;
      if (!questions.length) {
        showSuccessToast('No prakriti questions found', 'error');
        return;
      }
      setAnswers((prev) => ({ ...prev, ...buildPrakritiAnswers(questions) }));
      setSteps(buildPrakritiSteps(questions));
      setStep(1);
    } catch {
      showSuccessToast('Something went wrong', 'error');
    } finally {
      setSubmitting(false);
      isSelectingKnowPrakriti.current = false;
    }
  }, []);

  const handleSelect = useCallback(
    (choice) => {
      if (submitting) return;
      if (isPrakriti && currentStep?.key === 'knowPrakriti') {
        handleKnowPrakriti(String(choice?.value ?? choice?.index));
        return;
      }
      const key = getStepKey(currentStep);
      const isMulti = currentStep?.answer_type === 'multi_choice';
      setAnswers((prev) => toggleAnswer(prev, key, choice?.index, isMulti));
      if (
        !isMulti &&
        currentStep?.key !== 'knowPrakriti' &&
        currentStep?.answer_type !== 'text'
      ) {
        pendingAdvanceRef.current = true;
      }
    },
    [currentStep, handleKnowPrakriti, isPrakriti, submitting],
  );

  const submitAnswers = useCallback(async () => {
    if (isPrakriti && answers.knowPrakriti === 'Yes') {
      if (!answers.prakritiType) {
        showSuccessToast('Please select your prakriti', 'error');
        return false;
      }
      const response = await submitPrakritiType(answers.prakritiType);
      return !!response?.success;
    }
    const experienceType = isPrakriti ? 'prakriti' : 'medical_history';
    const payload = isPrakriti
      ? answers
      : formatMedicalAnswers(answers, basics.height?.id);
    const response = await submitQuestionnaire(experienceType, payload);
    return !!response?.success;
  }, [answers, basics.height?.id, isPrakriti]);

  const handleNext = useCallback(async () => {
    if (isDisabled || submitting) {
      if (!pendingAdvanceRef.current) {
        showSuccessToast(
          isPrakriti ? 'Please select option' : 'Please complete this step',
          'error',
        );
      }
      return;
    }
    if (isPrakriti && currentStep?.key === 'knowPrakriti') return;
    if (!isLastStep) {
      setStep((prev) => prev + 1);
      return;
    }
    setSubmitting(true);
    try {
      const success = await submitAnswers();
      if (!success) {
        showSuccessToast('Submission failed', 'error');
        return;
      }
      if (isPrakriti) {
        await promoteToFullUser();
        await resolveAccessLikeProfile();
      }
      navigate(setup.finishRoute, {
        replace: true,
        state: setup.finishParams,
      });
    } catch {
      showSuccessToast('Something went wrong', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [
    currentStep?.key,
    isDisabled,
    isLastStep,
    isPrakriti,
    navigate,
    setup.finishParams,
    setup.finishRoute,
    submitAnswers,
    submitting,
  ]);

  useEffect(() => {
    if (!pendingAdvanceRef.current) return;
    if (isDisabled || submitting) return;
    if (basicInfoStep || currentStep?.answer_type === 'text') {
      pendingAdvanceRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      handleNext();
      pendingAdvanceRef.current = false;
    }, 280);
    return () => clearTimeout(t);
  }, [answers, basicInfoStep, currentStep?.answer_type, handleNext, isDisabled, submitting]);

  useEffect(() => {
    if (step > prevStepRef.current) setStreak((s) => s + 1);
    else if (step < prevStepRef.current) setStreak(0);
    prevStepRef.current = step;
  }, [step]);

  const xp = useMemo(() => {
    const answered = Math.max(0, step);
    return answered * XP_PER_LEVEL + Math.max(0, streak - 1) * STREAK_BONUS;
  }, [step, streak]);

  const handleBack = useCallback(() => {
    pendingAdvanceRef.current = false;
    if (step === 0) {
      if (window.history.length > 1) navigate(-1);
      else navigate('/assessment');
      return;
    }
    setStep((prev) => prev - 1);
  }, [navigate, step]);

  const handleSkip = useCallback(() => {
    if (step >= steps.length - 1) return;
    setStep((prev) => prev + 1);
  }, [step, steps.length]);

  const retryLoad = useCallback(() => {
    setAnswers({});
    fetchData(true);
  }, [fetchData]);

  const handleBasicInfoChange = useCallback((key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleTextChange = useCallback(
    (text) => {
      const key = getStepKey(currentStep);
      setAnswers((prev) => ({ ...prev, [key]: text }));
    },
    [currentStep],
  );

  const isSelected = useCallback(
    (item) => isChoiceSelected(answers, currentStep, item?.index),
    [answers, currentStep],
  );

  return {
    loading,
    submitting,
    loadError,
    step,
    steps,
    currentStep,
    progress,
    answers,
    rawQuestions: isPrakriti ? undefined : rawQuestions,
    basicInfoStep,
    isDisabled,
    showSkip: step < steps.length - 1,
    isLastStep,
    streak,
    xp,
    mode,
    handleSelect,
    handleNext,
    handleBack,
    handleSkip,
    retryLoad,
    handleBasicInfoChange: isPrakriti ? undefined : handleBasicInfoChange,
    handleTextChange: isPrakriti ? undefined : handleTextChange,
    isSelected,
  };
};

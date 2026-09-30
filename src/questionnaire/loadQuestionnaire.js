import { fetchQuestions } from './questionnaireApi';
import {
  buildMedicalInitialAnswers,
  collapseBasicInfoSteps,
  getPrefilledAnswers,
  normalizeApiQuestion,
} from './utils';
import { PRAKRITI_IMAGES } from './configs';

export const KNOW_PRAKRITI_STEP = {
  key: 'knowPrakriti',
  question: 'Do you know your Prakriti?',
  answer_type: 'choice',
  choices: [
    { index: 'No', value: 'No' },
    { index: 'Yes', value: 'Yes' },
  ],
};

export const loadQuestionnaire = async (mode) => {
  const isPrakriti = mode === 'prakriti';
  const empty = {
    steps: [],
    rawQuestions: [],
    answers: {},
    cachedPrakritiQuestions: [],
    error: '',
  };

  try {
    const response = await fetchQuestions(
      isPrakriti ? 'prakriti' : 'medical_history',
    );
    const questions = response?.data?.questions ?? [];

    if (!questions.length && !isPrakriti) {
      return { ...empty, error: 'No questions available right now.' };
    }

    if (isPrakriti) {
      return {
        ...empty,
        steps: [KNOW_PRAKRITI_STEP],
        cachedPrakritiQuestions: questions,
      };
    }

    return {
      ...empty,
      rawQuestions: questions,
      answers: buildMedicalInitialAnswers(questions),
      steps: collapseBasicInfoSteps(questions),
    };
  } catch {
    return {
      ...empty,
      steps: isPrakriti ? [KNOW_PRAKRITI_STEP] : [],
      error: 'Failed to load questions. Please try again.',
    };
  }
};

export const buildPrakritiTypeStep = (options) => ({
  key: 'prakritiType',
  question: 'Select your Prakriti',
  answer_type: 'choice',
  choices: options.map((item) => ({
    index: item,
    value: item,
    image_path: PRAKRITI_IMAGES[item] || '',
  })),
});

export const buildPrakritiSteps = (questions) => [
  KNOW_PRAKRITI_STEP,
  ...questions.map(normalizeApiQuestion),
];

export const buildPrakritiAnswers = (questions) => getPrefilledAnswers(questions);

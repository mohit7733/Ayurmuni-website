/** Vikriti (current imbalance) outcomes derived from medical_history answers. */

export const GUT_CONSTITUTION_OUTCOMES = [
  {
    id: 'krura',
    name: 'Krura Koshtha',
    trait: 'Vata dominant gut',
    guidance:
      'Stay hydrated, go for fibre rich and unctuous meals. Practice nabhi purana (oil application over naval) at bedtime.',
    match: ['krura', 'vata dominant gut', 'vata dominant', 'constipated', 'hard stools'],
  },
  {
    id: 'mridu',
    name: 'Mridu Koshtha',
    trait: 'Pitta dominant gut',
    guidance:
      'Avoid hot, spicy, acidic foods. Go for soothing food articles like Gulkand, ash guard, amla to pacify pitta.',
    match: ['mridu', 'pitta dominant gut', 'pitta dominant', 'loose stools', 'frequent stools'],
  },
  {
    id: 'madhya',
    name: 'Madhya Koshtha',
    trait: 'Kapha dominant gut',
    guidance: 'No intervention required as bowel movements are regular.',
    match: ['madhya', 'kapha dominant', 'regular', 'normal bowel'],
  },
];

export const AGNI_OUTCOMES = [
  {
    id: 'teekshna',
    name: 'Teekshna Agni',
    trait: 'Strong, quick digestion',
    guidance:
      'Avoid prolonged fasting, take fibre rich and voluminous foods like chia seeds, steamed salads with meals.',
    match: ['teekshna', 'strong', 'frequently hungry', 'digest food quickly'],
  },
  {
    id: 'manda',
    name: 'Manda Agni',
    trait: 'Slow digestion',
    guidance:
      'Avoid heavy meals, overeating and frequent meals. Go for light, warm and freshly cooked food. Avoid raw foods. Add condiments and seasoning for improve digestion.',
    match: ['manda', 'slow', 'sluggish', 'weak digestion', 'low appetite'],
  },
  {
    id: 'visham',
    name: 'Visham Agni',
    trait: 'Irregular digestion',
    guidance:
      'Maintain strict dietary routine, align meal time as per body requirements, go for pranayama and relaxation yoga.',
    match: ['visham', 'irregular', 'variable', 'unpredictable'],
  },
  {
    id: 'sama',
    name: 'Sama Agni',
    trait: 'Balanced digestion',
    guidance: 'Normal state of digestion, no intervention required.',
    match: ['sama', 'balanced', 'normal', 'steady digestion'],
  },
];

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const answerText = (answer) => {
  if (answer == null) return '';
  if (typeof answer === 'string') return answer;
  if (Array.isArray(answer)) {
    return answer.map((item) => answerText(item)).filter(Boolean).join(' ');
  }
  if (typeof answer === 'object') {
    return String(answer.value ?? answer.label ?? answer.text ?? '');
  }
  return String(answer);
};

const questionText = (item) => normalize(item?.question || item?.title || '');

export const findMedicalAnswer = (questions, predicates) => {
  if (!Array.isArray(questions) || !questions.length) return '';
  const matchers = Array.isArray(predicates) ? predicates : [predicates];
  const hit = questions.find((item) => {
    const q = questionText(item);
    return matchers.some((pred) =>
      typeof pred === 'function' ? pred(q, item) : q.includes(normalize(pred)),
    );
  });
  return answerText(hit?.answer);
};

export const matchOutcome = (answer, outcomes) => {
  const text = normalize(answer);
  if (!text || !Array.isArray(outcomes)) return null;
  let best = null;
  let bestScore = 0;
  for (const outcome of outcomes) {
    const score = (outcome.match || []).reduce((sum, token) => {
      const needle = normalize(token);
      return needle && text.includes(needle) ? sum + needle.length : sum;
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      best = outcome.id;
    }
  }
  return best;
};

export const buildVikritiFromMedicalHistory = (medicalHistory) => {
  const questions = Array.isArray(medicalHistory?.questions)
    ? medicalHistory.questions
    : Array.isArray(medicalHistory)
      ? medicalHistory
      : [];

  if (!questions.length) return null;

  const gutAnswer = findMedicalAnswer(questions, [
    'gut constitution',
    'koshtha',
  ]);
  const agniAnswer = findMedicalAnswer(questions, [
    'digestive and metabolic',
    'agni',
    'metabolic health',
  ]);

  const selectedGutId = matchOutcome(gutAnswer, GUT_CONSTITUTION_OUTCOMES);
  const selectedAgniId = matchOutcome(agniAnswer, AGNI_OUTCOMES);

  if (!selectedGutId && !selectedAgniId) return null;

  return {
    gut: selectedGutId
      ? {
          answer: gutAnswer,
          selectedId: selectedGutId,
          outcomes: GUT_CONSTITUTION_OUTCOMES.map((item) => ({
            ...item,
            selected: item.id === selectedGutId,
          })),
        }
      : null,
    agni: selectedAgniId
      ? {
          answer: agniAnswer,
          selectedId: selectedAgniId,
          outcomes: AGNI_OUTCOMES.map((item) => ({
            ...item,
            selected: item.id === selectedAgniId,
          })),
        }
      : null,
  };
};

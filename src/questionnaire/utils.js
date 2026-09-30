export const getStepKey = (step) => step?.key ?? String(step?.id ?? '');

export const normalizeApiQuestion = (item) => ({
  id: item?.id,
  key: String(item?.id ?? item?.key),
  question: item?.question ?? '',
  answer_type: item?.answer_type ?? 'choice',
  choices: item?.choices ?? [],
  answer: item?.answer,
});

export const getPrefilledAnswers = (questions) => {
  const prefilled = {};
  questions.forEach((question) => {
    const key = String(question?.id ?? question?.key);
    if (question?.answer_type === 'multi_choice') {
      prefilled[key] =
        question?.choices
          ?.filter((c) => c?.is_selected)
          ?.map((c) => c?.index) ?? [];
      return;
    }
    if (question?.answer_type === 'text') {
      prefilled[key] = question?.answer ?? '';
      return;
    }
    const selected = question?.choices?.find((c) => c?.is_selected);
    if (selected) prefilled[key] = selected.index;
  });
  return prefilled;
};

export const buildMedicalInitialAnswers = (questions) => {
  const answers = getPrefilledAnswers(questions);
  questions.forEach((question) => {
    const q = String(question?.question ?? '').toLowerCase();
    if (!q.includes('height') && !q.includes('weight') && !q.includes('body')) {
      return;
    }
    const id = String(question.id);
    const value = String(question?.answer ?? '');
    if (!value) return;
    const [height = '', weight = ''] = value.split(',');
    answers[`${id}_height`] = height.replace(/cm/gi, '').trim();
    answers[`${id}_weight`] = weight.replace(/kg/gi, '').trim();
  });
  return answers;
};

export const findBasicQuestions = (questions) => {
  const find = (keyword) =>
    questions.find((q) => q?.question?.toLowerCase().includes(keyword));
  const height =
    find('height') || find('weight') || find('body type') || find('body');
  return {
    age: undefined,
    gender: undefined,
    height,
    weight: find('weight'),
  };
};

export const collapseBasicInfoSteps = (questions) => {
  const basics = findBasicQuestions(questions);
  const basicIds = new Set(
    [basics.age?.id, basics.gender?.id, basics.height?.id, basics.weight?.id]
      .filter((id) => id != null && String(id).trim() !== '')
      .map((id) => String(id)),
  );
  let basicAdded = false;
  return questions
    .filter((item) => {
      const id = String(item?.id ?? '');
      if (!basicIds.has(id)) return true;
      if (basicAdded) return false;
      basicAdded = true;
      return true;
    })
    .map(normalizeApiQuestion);
};

export const isBasicInfoStep = (step, basics) => {
  if (!step || !basics) return false;
  const stepId = String(step.id ?? '');
  return [basics.age?.id, basics.gender?.id, basics.height?.id, basics.weight?.id]
    .filter((id) => id != null)
    .map((id) => String(id))
    .includes(stepId);
};

export const toggleAnswer = (prev, key, choiceIndex, isMulti) => {
  if (!isMulti) return { ...prev, [key]: choiceIndex };
  const current = prev[key] ?? [];
  const exists = current.includes(choiceIndex);
  return {
    ...prev,
    [key]: exists
      ? current.filter((v) => v !== choiceIndex)
      : [...current, choiceIndex],
  };
};

export const isChoiceSelected = (answers, step, choiceIndex) => {
  const key = getStepKey(step);
  const selected = answers[key];
  if (step?.answer_type === 'multi_choice') {
    return Array.isArray(selected) && selected.includes(choiceIndex);
  }
  return selected === choiceIndex;
};

export const isAnswerEmpty = (answers, step, basics) => {
  if (!step) return true;
  if (isBasicInfoStep(step, basics)) {
    const heightId =
      basics?.height?.id != null
        ? String(basics.height.id)
        : basics?.weight?.id != null
          ? String(basics.weight.id)
          : '';
    if (heightId) {
      if (!answers[`${heightId}_height`]) return true;
      if (!answers[`${heightId}_weight`]) return true;
    }
    return false;
  }
  const key = getStepKey(step);
  const value = answers[key];
  if (step.answer_type === 'text') return !value?.trim?.();
  if (step.answer_type === 'multi_choice') {
    return !Array.isArray(value) || value.length === 0;
  }
  return value === undefined;
};

export const formatMedicalAnswers = (answers, heightQuestionId) => {
  if (!heightQuestionId) return { ...answers };
  const heightId = String(heightQuestionId);
  const formatted = { ...answers };
  const height = formatted[`${heightId}_height`];
  const weight = formatted[`${heightId}_weight`];
  if (height || weight) {
    formatted[heightId] = `${height || ''} cm, ${weight || ''} kg`;
    delete formatted[`${heightId}_height`];
    delete formatted[`${heightId}_weight`];
  }
  return formatted;
};

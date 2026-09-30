import { getStepKey } from './utils';

const emptyDoshaScores = () => ({ vata: 0, pitta: 0, kapha: 0 });
const DOSHA_ORDER = ['vata', 'pitta', 'kapha'];

const detectDoshaFromText = (text) => {
  const v = text.toLowerCase();
  if (v.includes('vata')) return 'vata';
  if (v.includes('pitta')) return 'pitta';
  if (v.includes('kapha')) return 'kapha';
  return null;
};

const bumpFromChoice = (scores, choice, fallbackIndex) => {
  const fromText = detectDoshaFromText(String(choice?.value ?? choice?.index ?? ''));
  if (fromText) {
    scores[fromText] += 1;
    return;
  }
  scores[DOSHA_ORDER[fallbackIndex % 3]] += 1;
};

export const computeDoshaScores = (answers, steps) => {
  const scores = emptyDoshaScores();
  steps.forEach((step) => {
    if (!step || step.key === 'knowPrakriti') return;
    const key = getStepKey(step);
    const selected = answers[key];
    if (selected === undefined || selected === null || selected === '') return;

    if (step.key === 'prakritiType') {
      String(selected)
        .split(/[-/,&+]+/)
        .map((s) => s.trim())
        .forEach((part) => {
          const d = detectDoshaFromText(part);
          if (d) scores[d] += 1;
        });
      return;
    }

    const choices = step.choices ?? [];
    if (step.answer_type === 'multi_choice' && Array.isArray(selected)) {
      selected.forEach((idx) => {
        const i = choices.findIndex((c) => c.index === idx);
        if (i >= 0) bumpFromChoice(scores, choices[i], i);
      });
      return;
    }

    const i = choices.findIndex((c) => c.index === selected);
    if (i >= 0) bumpFromChoice(scores, choices[i], i);
  });
  return scores;
};

export const dominantDosha = (scores) => {
  let best = 'vata';
  let max = -1;
  Object.keys(scores).forEach((key) => {
    if (scores[key] > max) {
      max = scores[key];
      best = key;
    }
  });
  return best;
};

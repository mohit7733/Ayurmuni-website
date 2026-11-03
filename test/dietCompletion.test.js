import { describe, it, expect } from 'vitest';
import {
  buildCompletionEntries,
  buildDietReviewState,
  dietStatusFallbackMessage,
  extractCompletionJson,
  formatCompletionLabel,
  getDietHealthFocus,
  isDietPlanFullyComplete,
  loadCompletionJson,
  saveCompletionJson,
} from '../src/diet/utils';

const memoryStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
};

describe('diet completion helpers', () => {
  it('extracts complete_json from several envelopes', () => {
    expect(extractCompletionJson({ complete_json: { a: 1 } })).toEqual({ a: 1 });
    expect(extractCompletionJson({ data: { complete_json: { b: 2 } } })).toEqual({ b: 2 });
    expect(extractCompletionJson({ success: true })).toBeNull();
  });

  it('formats labels and builds summary rows', () => {
    expect(formatCompletionLabel('total_meals_done')).toBe('Total Meals Done');
    const rows = buildCompletionEntries(
      { total_meals_done: 21, notes: '', days: [1, 2, 3], nested: { a: 1 }, ok: true },
      12,
    );
    expect(rows.map((r) => r.value)).toEqual(['21', '3 items', '{"a":1}', 'true']);
    expect(buildCompletionEntries(null)).toEqual([]);
    expect(buildCompletionEntries({ a: 1, b: 2, c: 3 }, 2)).toHaveLength(2);
  });

  it('provides backend-safe fallback toast copy', () => {
    expect(dietStatusFallbackMessage('reset')).toBe('Plan reset to Day 1');
    expect(dietStatusFallbackMessage('stop')).toBe('Plan stopped');
    expect(dietStatusFallbackMessage('complete')).toMatch(/completed/i);
    for (const a of ['pause', 'resume', 'stop', 'reset', 'repeat', 'complete']) {
      expect(dietStatusFallbackMessage(a)).not.toMatch(/(resetd|stopd|repeatd)/);
    }
  });

  it('derives health focus from diseases, then description', () => {
    expect(
      getDietHealthFocus({ health_diseases: [{ name: 'Diabetes' }, { name: 'PCOS' }] }),
    ).toBe('Diabetes, PCOS');
    expect(getDietHealthFocus(null, { short_description: ' Gentle detox ' })).toBe('Gentle detox');
    expect(getDietHealthFocus(null, {})).toBe('');
  });

  it('builds the rating hand-off state', () => {
    expect(
      buildDietReviewState({ plan: { name: 'Detox' }, assignmentId: 7, catalogPlanId: 3 }),
    ).toEqual({
      entityType: 'diet_plan',
      entityName: 'Detox',
      entitySubtitle: 'How was this diet plan?',
      patientDietPlanId: '7',
      dietPlanId: '3',
    });
    expect(buildDietReviewState({ plan: null, assignmentId: 1 }).entityName).toBe('Diet Plan');
  });

  it('detects a fully tracked plan', () => {
    expect(isDietPlanFullyComplete(null, [], true)).toBe(false);
    expect(isDietPlanFullyComplete({}, [], false)).toBe(false);
  });

  it('persists the completion summary per assignment', () => {
    const storage = memoryStorage();
    expect(saveCompletionJson(9, { a: 1 }, storage)).toBe(true);
    expect(loadCompletionJson(9, storage)).toEqual({ a: 1 });
    expect(loadCompletionJson(10, storage)).toBeNull();
    expect(saveCompletionJson(null, { a: 1 }, storage)).toBe(false);
    expect(saveCompletionJson(9, null, storage)).toBe(false);
    expect(loadCompletionJson(9, null)).toBeNull();
  });
});
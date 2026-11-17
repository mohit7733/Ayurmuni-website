import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/questionnaire/configs', () => ({
  PRAKRITI_IMAGES: { Vata: 'https://img.test/vata.png', 'Vata-Pitta': 'https://img.test/vp.png' },
}));
vi.mock('../src/services/profileService', () => ({ get_prakriti_info: vi.fn() }));
vi.mock('../src/services/guestAuth', () => ({ requireAuth: vi.fn() }));

import { formatPrakritiData, hasValidPrakritiPayload } from '../src/pages/PrakritiProfile.jsx';

describe('formatPrakritiData', () => {
  it('maps API percentages, labels, and Vata title', () => {
    const data = formatPrakritiData({
      result: 'Vata',
      vata: 100,
      pitta: 0,
      kapha: 0,
      content: {
        core_essence: 'Air and Space.',
        lifestyle: { "do's": ['Eat warm meals'], "don'ts": ['Skip meals'] },
      },
    });
    expect(data.dominantLabel).toBe('Vata');
    expect(data.coreEssence.title).toBe('The Visionary');
    expect(data.coreEssence.description).toBe('Air and Space.');
    expect(data.doshas.map((d) => [d.name, d.percentage, d.label])).toEqual([
      ['VATA', 100, 'Air & Space'],
      ['PITTA', 0, 'Fire & Water'],
      ['KAPHA', 0, 'Earth & Water'],
    ]);
    expect(data.lifestyleGuidelines.doList).toEqual(['Eat warm meals']);
    expect(data.lifestyleGuidelines.dontList).toEqual(['Skip meals']);
    expect(data.imageUrl).toBe('https://img.test/vata.png');
  });

  it('formats a mixed constitution and title', () => {
    const data = formatPrakritiData({ result: 'Vata-Pitta', vata: 50, pitta: 30, kapha: 20 });
    expect(data.dominantLabel).toBe('Vata-Pitta');
    expect(data.coreEssence.title).toBe('The Dynamic Creator');
    expect(data.doshas.map((d) => d.percentage)).toEqual([50, 30, 20]);
    expect(data.lifestyleGuidelines.doList).toEqual([]);
  });
});

describe('hasValidPrakritiPayload', () => {
  it('accepts a successful result payload', () => {
    expect(hasValidPrakritiPayload({ success: true, data: { result: 'Vata', vata: 100 } })).toBe(true);
  });

  it('rejects an empty or failed payload', () => {
    expect(hasValidPrakritiPayload({ success: false, data: { result: 'Vata' } })).toBe(false);
    expect(hasValidPrakritiPayload({ success: true, data: {} })).toBe(false);
  });
});

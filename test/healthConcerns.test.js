import { describe, expect, it } from 'vitest';
import { diseaseIdsOf, resolveDiseaseList } from '../src/profile/healthConcerns.js';

describe('resolveDiseaseList', () => {
  it('returns an empty list when the profile has no concerns', () => {
    expect(resolveDiseaseList(null)).toEqual([]);
    expect(resolveDiseaseList({})).toEqual([]);
    expect(resolveDiseaseList({ health_diseases: [] })).toEqual([]);
  });

  it('maps health_diseases objects (id / health_disease_id + name / title)', () => {
    expect(
      resolveDiseaseList({
        health_diseases: [
          { id: '11', name: 'Menstrual Problem' },
          { health_disease_id: '22', title: 'Nutrition' },
          { id: '33', disease_name: 'Diabetes' },
        ],
      }),
    ).toEqual([
      { id: '11', name: 'Menstrual Problem' },
      { id: '22', name: 'Nutrition' },
      { id: '33', name: 'Diabetes' },
    ]);
  });

  it('accepts string entries and drops blank rows', () => {
    expect(
      resolveDiseaseList({
        health_diseases: ['Hair Fall', '', { id: '', name: '' }, { id: '44', name: 'Stress' }],
      }),
    ).toEqual([
      { id: 'Hair Fall', name: 'Hair Fall' },
      { id: '44', name: 'Stress' },
    ]);
  });

  it('falls back to health_disease_ids when health_diseases is missing', () => {
    expect(
      resolveDiseaseList({
        health_disease_ids: ['11', { id: '22', name: 'Nutrition' }],
      }),
    ).toEqual([
      { id: '11', name: '11' },
      { id: '22', name: 'Nutrition' },
    ]);
  });

  it('prefers health_diseases over ids when both are present', () => {
    expect(
      resolveDiseaseList({
        health_diseases: [{ id: '11', name: 'Menstrual Problem' }],
        health_disease_ids: ['99'],
      }),
    ).toEqual([{ id: '11', name: 'Menstrual Problem' }]);
  });

  it('collects selected ids for the edit modal', () => {
    expect(diseaseIdsOf(resolveDiseaseList({
      health_diseases: [{ id: '11', name: 'Menstrual Problem' }, { id: '22', name: 'Nutrition' }],
    }))).toEqual(['11', '22']);
  });
});

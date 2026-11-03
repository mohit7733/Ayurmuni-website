import { describe, expect, it } from 'vitest';
import {
  buildPhotoOptions,
  buildProfilePayload,
  buildProfileStats,
  formatStatCount,
  resolveCount,
} from '../src/profile/dashboardStats.js';

describe('profile dashboard stats', () => {
  it('pads counts to two digits and never goes negative', () => {
    expect(formatStatCount(3)).toBe('03');
    expect(formatStatCount(12)).toBe('12');
    expect(formatStatCount(-4)).toBe('00');
    expect(formatStatCount(undefined)).toBe('00');
  });

  it('prefers count, then falls back to list length', () => {
    expect(resolveCount({ count: 7, results: [1] })).toBe(7);
    expect(resolveCount({ data: { count: 5 } })).toBe(5);
    expect(resolveCount({ results: [1, 2] })).toBe(2);
    expect(resolveCount({ data: [1, 2, 3] })).toBe(3);
    expect(resolveCount([1])).toBe(1);
    expect(resolveCount(null)).toBe(0);
  });

  it('builds the three chips and zeroes failed requests', () => {
    const stats = buildProfileStats([
      { status: 'fulfilled', value: { count: 4 } },
      { status: 'rejected', reason: new Error('x') },
      { status: 'fulfilled', value: { data: [{}, {}] } },
    ]);
    expect(stats.map((s) => [s.label, s.value])).toEqual([
      ['CONSULTS', '04'],
      ['ORDERS', '00'],
      ['REPORTS', '02'],
    ]);
    expect(stats.map((s) => s.to)).toEqual(['/profile/appointments', '/profile/orders', '/profile/records']);
  });

  it('keeps existing profile fields when only the photo changes', () => {
    expect(
      buildProfilePayload(
        { first_name: 'Asha', last_name: ' Rao ', email: 'a@b.c', gender: 'Female', date_of_birth: '1990-01-01', profile_picture: 'old' },
        '',
      ),
    ).toEqual({
      first_name: 'Asha',
      last_name: 'Rao',
      email: 'a@b.c',
      secondary_number: '',
      gender: 'female',
      date_of_birth: '1990-01-01',
      profile_picture: '',
    });
  });

  it('offers view/change/remove only when a photo exists', () => {
    expect(buildPhotoOptions(true).map((o) => o.key)).toEqual(['view', 'change', 'remove']);
    expect(buildPhotoOptions(false).map((o) => [o.key, o.label])).toEqual([['change', 'Add photo']]);
  });
});

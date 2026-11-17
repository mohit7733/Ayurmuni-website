import { describe, expect, it } from 'vitest';
import {
  isPackageCountExpired,
  packageCountLabel,
  packageCountProgress,
  readPackageQuantity,
} from '../src/utils/packageCount.js';

describe('readPackageQuantity', () => {
  it('reads remaining and total from either naming style', () => {
    expect(readPackageQuantity({ remaining: 3, total: 5 })).toEqual({ remaining: 3, total: 5 });
    expect(readPackageQuantity({ quantity_remaining: '10', quantity_total: '12' })).toEqual({
      remaining: 10,
      total: 12,
    });
    expect(readPackageQuantity({ remaining: 0, sessions: 5 })).toEqual({ remaining: 0, total: 5 });
    expect(readPackageQuantity({})).toEqual({ remaining: null, total: null });
  });
});

describe('packageCountLabel', () => {
  it('formats remaining of total, with optional unit and correct singular/plural', () => {
    expect(packageCountLabel({ remaining: 3, total: 5 })).toBe('3 of 5 left');
    expect(packageCountLabel({ remaining: 10, total: 12 })).toBe('10 of 12 left');
    expect(packageCountLabel({ remaining: 1, total: 5 })).toBe('1 of 5 left');
    expect(packageCountLabel({ remaining: 3, total: 5 }, { includeUnit: true })).toBe(
      '3 of 5 consultations left',
    );
    expect(packageCountLabel({ remaining: 1, total: 5 }, { includeUnit: true })).toBe(
      '1 of 5 consultations left',
    );
    expect(packageCountLabel({ remaining: 1, total: 1 }, { includeUnit: true })).toBe(
      '1 of 1 consultation left',
    );
  });

  it('formats a remaining-only count and hides missing data', () => {
    expect(packageCountLabel({ remaining: 3 }, { includeUnit: true })).toBe('3 consultations left');
    expect(packageCountLabel({ remaining: 1 }, { includeUnit: true })).toBe('1 consultation left');
    expect(packageCountLabel({ remaining: 3 })).toBe('3 left');
    expect(packageCountLabel({ remaining: 1 })).toBe('1 left');
    expect(packageCountLabel({})).toBe('');
    expect(packageCountLabel({ total: 5 })).toBe('');
  });

  it('uses muted All used / Expired states', () => {
    expect(packageCountLabel({ remaining: 0, total: 5 })).toBe('All used');
    expect(packageCountLabel({ remaining: 0 })).toBe('All used');
    expect(packageCountLabel({ remaining: 3, total: 5, expired: true })).toBe('Expired');
    expect(packageCountLabel({ remaining: 10, total: 12 }, { expired: true })).toBe('Expired');
  });
});

describe('packageCountProgress', () => {
  it('returns a clamped 0–1 ratio when both counts exist', () => {
    expect(packageCountProgress({ remaining: 3, total: 5 })).toBeCloseTo(0.6);
    expect(packageCountProgress({ remaining: 0, total: 5 })).toBe(0);
    expect(packageCountProgress({ remaining: 5, total: 5 })).toBe(1);
    expect(packageCountProgress({ remaining: 10, total: 12 })).toBeCloseTo(10 / 12);
    expect(packageCountProgress({ remaining: 12, total: 5 })).toBe(1);
    expect(packageCountProgress({ remaining: 3 })).toBeNull();
    expect(packageCountProgress({})).toBeNull();
  });
});

describe('isPackageCountExpired', () => {
  const now = new Date('2026-11-16T12:00:00+05:30').getTime();

  it('honours an explicit flag, expired status, or a past valid-until date', () => {
    expect(isPackageCountExpired({ expired: true }, now)).toBe(true);
    expect(isPackageCountExpired({ status: 'expired' }, now)).toBe(true);
    expect(isPackageCountExpired({ valid_until: '2026-10-01T10:00:00+05:30' }, now)).toBe(true);
    expect(isPackageCountExpired({ expiresAt: '2026-12-15T10:00:00+05:30' }, now)).toBe(false);
    expect(isPackageCountExpired({}, now)).toBe(false);
  });
});

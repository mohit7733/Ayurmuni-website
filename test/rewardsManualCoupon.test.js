import { describe, expect, it } from 'vitest';
import { resolveManualCoupon } from '../src/rewards/utils.js';

describe('resolveManualCoupon (Add coupon sheet)', () => {
  const rewards = [{ id: 'r1', title: 'Welcome', coupon: { code: 'WELCOME10' } }];
  it('rejects empty input', () => {
    expect(resolveManualCoupon('   ', rewards).kind).toBe('empty');
  });
  it('claims a code that matches a reward, case-insensitively', () => {
    const out = resolveManualCoupon(' welcome10 ', rewards);
    expect(out.kind).toBe('known');
    expect(out.reward.id).toBe('r1');
    expect(out.code).toBe('WELCOME10');
  });
  it('saves an unknown code upper-cased', () => {
    expect(resolveManualCoupon('abc50', rewards)).toEqual({ kind: 'saved', code: 'ABC50' });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClient = vi.fn();
const invalidateApiCache = vi.fn();
vi.mock('../src/services/apiClient', () => ({
  apiClient: (...args) => apiClient(...args),
  invalidateApiCache: (...args) => invalidateApiCache(...args),
}));

const svc = await import('../src/services/packageService.js');
const utils = await import('../src/utils/planUtils.js');

beforeEach(() => {
  apiClient.mockReset();
  invalidateApiCache.mockReset();
  svc.invalidateActivePlans();
});

describe('getMyPackages', () => {
  it('builds packages/my/ with page and optional filters', async () => {
    apiClient.mockResolvedValue({ success: true });
    await svc.getMyPackages();
    await svc.getMyPackages({ page: 2, status: 'active', search: 'vata plan', doctor_id: 'd1', id: 'p1' });
    expect(apiClient.mock.calls[0][0]).toBe('packages/my/?page=1');
    expect(apiClient.mock.calls[1][0]).toBe('packages/my/?page=2&status=active&search=vata+plan&id=p1&doctor_id=d1');
    expect(apiClient.mock.calls[1][1]).toEqual({ method: 'GET' });
  });
});

describe('plan identity helpers', () => {
  it('reads the catalog package id from package_id, package or snapshot', () => {
    expect(svc.getPurchasedPackageId({ package_id: 7 })).toBe('7');
    expect(svc.getPurchasedPackageId({ package: 'abc' })).toBe('abc');
    expect(svc.getPurchasedPackageId({ package_snapshot: { id: 'z' } })).toBe('z');
    expect(svc.getPurchasedPackageId(null)).toBe('');
  });

  it('isSamePackage compares trimmed ids and rejects empties', () => {
    expect(svc.isSamePackage({ package_id: 'a' }, ' a ')).toBe(true);
    expect(svc.isSamePackage({ package_id: 'a' }, 'b')).toBe(false);
    expect(svc.isSamePackage({}, 'a')).toBe(false);
    expect(svc.isSamePackage({ package_id: 'a' }, '')).toBe(false);
  });

  it('isPlanExpired follows status or an elapsed expiry', () => {
    expect(svc.isPlanExpired({ status: 'expired' })).toBe(true);
    expect(svc.isPlanExpired({ status: 'active', expires_at: '2000-01-01T00:00:00Z' })).toBe(true);
    expect(svc.isPlanExpired({ status: 'active', expires_at: '2999-01-01T00:00:00Z' })).toBe(false);
    expect(svc.isPlanExpired({ status: 'active' })).toBe(false);
    expect(svc.isPlanExpired(null)).toBe(false);
  });
});

describe('fetchActivePlans', () => {
  it('requests status=active, keeps only active rows and caches for a minute', async () => {
    apiClient.mockResolvedValue({
      success: true,
      data: { results: [{ id: '1', status: 'active' }, { id: '2', status: 'pending' }] },
    });
    const first = await svc.fetchActivePlans();
    const second = await svc.fetchActivePlans();
    expect(first).toEqual([{ id: '1', status: 'active' }]);
    expect(second).toBe(first);
    expect(apiClient).toHaveBeenCalledTimes(1);
    expect(apiClient.mock.calls[0][0]).toBe('packages/my/?page=1&status=active');
    await svc.fetchActivePlans(true);
    expect(apiClient).toHaveBeenCalledTimes(2);
  });

  it('falls back to an empty list on failure and refreshPackageCache drops the cache', async () => {
    apiClient.mockResolvedValue({ success: false, message: 'no' });
    expect(await svc.fetchActivePlans(true)).toEqual([]);
    apiClient.mockResolvedValue({ success: true, data: [{ id: '3', status: 'active' }] });
    expect(await svc.fetchActivePlans(true)).toHaveLength(1);
    svc.refreshPackageCache();
    expect(invalidateApiCache).toHaveBeenCalledWith(['packages/']);
    await svc.fetchActivePlans();
    expect(apiClient).toHaveBeenCalledTimes(3);
  });
});

describe('getActivePatientId', () => {
  it('returns the active profile id or null', async () => {
    apiClient.mockResolvedValueOnce({ success: true, data: { results: [{ id: 'p1' }, { id: 'p2', is_active_profile: true }] } });
    expect(await svc.getActivePatientId()).toBe('p2');
    apiClient.mockResolvedValueOnce({ success: true, data: { results: [{ id: 'p1' }] } });
    expect(await svc.getActivePatientId()).toBeNull();
    apiClient.mockRejectedValueOnce(new Error('x'));
    expect(await svc.getActivePatientId()).toBeNull();
  });
});

describe('planUtils', () => {
  it('maps status with expiry taking priority', () => {
    expect(utils.getPlanStatus({ status: 'active' }).label).toBe('Active');
    expect(utils.getPlanStatusKey({ status: 'active', expires_at: '2000-01-01' })).toBe('expired');
    expect(utils.getPlanStatus({ status: 'on_hold' }).label).toBe('On hold');
  });

  it('computes amounts and savings', () => {
    expect(utils.getPlanAmounts({ paid_price: '800', original_price: '1000' })).toEqual({ amount: 800, saved: 200, original: 1000 });
    expect(utils.getPlanAmounts({ paid_price: '0', original_price: '1000' })).toEqual({ amount: 1000, saved: 0, original: 1000 });
  });

  it('daysLeft rounds up and floors at zero', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(utils.daysLeft('2026-01-03T01:00:00Z', now)).toBe(3);
    expect(utils.daysLeft('2025-12-01T00:00:00Z', now)).toBe(0);
    expect(utils.daysLeft(null, now)).toBeNull();
  });

  it('readPlanPage handles paged, array and empty bodies', () => {
    expect(utils.readPlanPage({ data: { results: [1], next: 'n' } })).toEqual({ list: [1], next: 'n' });
    expect(utils.readPlanPage({ data: [1, 2] })).toEqual({ list: [1, 2], next: null });
    expect(utils.readPlanPage({})).toEqual({ list: [], next: null });
  });

  it('buildPlanNameMap and benefit icons', () => {
    expect(utils.buildPlanNameMap([{ id: 'a', name: 'A' }, { name: 'x' }])).toEqual({ a: 'A' });
    expect(utils.planBenefitIcon('Doctor consultation')).toBe('consult');
    expect(utils.planBenefitIcon('Diet chart')).toBe('diet');
    expect(utils.planBenefitIcon('Something else')).toBe('leaf');
  });
});
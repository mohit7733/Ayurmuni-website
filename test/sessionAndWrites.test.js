import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map();
vi.mock('../src/common/utils', () => ({
  Utils: {
    getData: async (k) => (store.has(k) ? store.get(k) : null),
    storeData: async (k, v) => void store.set(k, v),
  },
}));
vi.mock('../src/config/key', () => ({ BaseUrl: { base_url: 'https://api.test/' }, showSuccessToast: () => {} }));

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  store.clear();
  vi.resetModules();
  vi.useRealTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('account change detection', () => {
  it('first login before any API call still notifies session listeners', async () => {
    const api = await import('../src/services/apiClient.js');
    await flush(); // identity seeded from storage: signed out
    const seen = vi.fn();
    api.subscribeApiSession(seen);
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: 1 })));
    store.set('_TOKEN', 'token-new-user');
    await api.apiClient('cart/');
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('reviewed diet plans of the previous account are dropped on account change', async () => {
    store.set('_TOKEN', 'token-a');
    const api = await import('../src/services/apiClient.js');
    const diet = await import('../src/utils/reviewedDietPlans.js');
    await flush();
    await diet.markDietPlanAssignmentReviewed('plan-1');
    expect(diet.isDietPlanAssignmentReviewed('plan-1')).toBe(true);
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: 1 })));
    store.set('_TOKEN', 'token-b');
    await api.apiClient('cart/');
    expect(diet.isDietPlanAssignmentReviewed('plan-1')).toBe(false);
  });
});

describe('save_recent search', () => {
  it('refreshes the cached recent-search list', async () => {
    store.set('_TOKEN', 'token-a');
    const api = await import('../src/services/apiClient.js');
    const search = await import('../src/services/globalSearchService.js');
    const fn = vi.fn(async () => json({ data: { results: [] } }));
    vi.stubGlobal('fetch', fn);
    await api.apiClient('customers/search/recent/?limit=10');
    await search.globalSearch({ search: 'ashwagandha', save_recent: true });
    await api.apiClient('customers/search/recent/?limit=10');
    const recentCalls = fn.mock.calls.filter(([url]) => String(url).includes('customers/search/recent/'));
    expect(recentCalls.length).toBe(2);
  });
});

describe('write requests have no default client timeout', () => {
  it('a slow order POST is not aborted after the read deadline; a slow GET is', async () => {
    store.set('_TOKEN', 'token-a');
    const api = await import('../src/services/apiClient.js');
    vi.useFakeTimers();
    const signals = {};
    vi.stubGlobal(
      'fetch',
      vi.fn((url, init) => {
        signals[(init.method || 'GET') + ' ' + url] = init.signal;
        return new Promise(() => {});
      }),
    );
    api.apiClient('order/', { method: 'POST', body: '{}' });
    api.apiClient('order/');
    await vi.advanceTimersByTimeAsync(api.DEFAULT_TIMEOUT_MS + 1000);
    expect(signals['POST https://api.test/order/'].aborted).toBe(false);
    expect(signals['GET https://api.test/order/'].aborted).toBe(true);
  });
});

describe('review invalidation', () => {
  it('a product review refreshes the cached order (its items carry is_reviewed)', async () => {
    store.set('_TOKEN', 'token-a');
    const api = await import('../src/services/apiClient.js');
    const fn = vi.fn(async () => json({ ok: 1 }));
    vi.stubGlobal('fetch', fn);
    await api.apiClient('order/42/');
    await api.apiClient('review/?entity_type=product', { method: 'POST', body: '{}' });
    await api.apiClient('order/42/');
    expect(fn.mock.calls.filter(([u]) => String(u).endsWith('order/42/')).length).toBe(2);
  });
});

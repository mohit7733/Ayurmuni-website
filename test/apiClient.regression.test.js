import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map();
vi.mock('../src/common/utils', () => ({
  Utils: {
    getData: async (k) => (store.has(k) ? store.get(k) : null),
    storeData: async (k, v) => void store.set(k, v),
  },
}));
vi.mock('../src/config/key', () => ({ BaseUrl: { base_url: 'https://api.test/' } }));

const { apiClient, clearApiCache } = await import('../src/services/apiClient.js');
const { getNotification } = await import('../src/services/notificationService.js');

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const deferredFetch = () => {
  const calls = [];
  const fn = vi.fn((url, init) => new Promise((resolve) => calls.push({ url, init, resolve })));
  return { fn, calls };
};

beforeEach(() => {
  store.clear();
  store.set('_TOKEN', 'token-user-a');
  clearApiCache();
});
afterEach(() => vi.unstubAllGlobals());

describe('apiClient epoch / in-flight regressions', () => {
  it('callers arriving after an invalidation start a fresh request instead of joining the stale one', async () => {
    const f = deferredFetch();
    vi.stubGlobal('fetch', f.fn);
    const stale = apiClient('cart/');
    await vi.waitFor(() => expect(f.calls.length).toBe(1));
    clearApiCache();
    const fresh = apiClient('cart/');
    await vi.waitFor(() => expect(f.calls.length).toBe(2));
    f.calls[1].resolve(json({ v: 'fresh' }));
    f.calls[0].resolve(json({ v: 'stale' }));
    expect((await fresh).v).toBe('fresh');
    expect((await stale).v).toBe('stale');
  });

  it("a stale request's cleanup does not evict the newer in-flight entry", async () => {
    const f = deferredFetch();
    vi.stubGlobal('fetch', f.fn);
    const stale = apiClient('k/');
    await vi.waitFor(() => expect(f.calls.length).toBe(1));
    clearApiCache();
    const newer = apiClient('k/');
    await vi.waitFor(() => expect(f.calls.length).toBe(2));
    f.calls[0].resolve(json({ v: 'stale' }));
    await stale;
    const joiner = apiClient('k/');
    await new Promise((r) => setTimeout(r, 20));
    expect(f.calls.length).toBe(2);
    f.calls[1].resolve(json({ v: 'new' }));
    expect((await newer).v).toBe('new');
    expect((await joiner).v).toBe('new');
  });

  it('a stale response resolving last never overwrites the newer cache entry', async () => {
    const f = deferredFetch();
    vi.stubGlobal('fetch', f.fn);
    const stale = apiClient('k/');
    await vi.waitFor(() => expect(f.calls.length).toBe(1));
    clearApiCache();
    const newer = apiClient('k/');
    await vi.waitFor(() => expect(f.calls.length).toBe(2));
    f.calls[1].resolve(json({ v: 'new' }));
    await newer;
    f.calls[0].resolve(json({ v: 'stale' }));
    await stale;
    expect((await apiClient('k/')).v).toBe('new');
    expect(f.calls.length).toBe(2);
  });

  it('overlapping mutations: a GET between them is not cached once the second mutation lands', async () => {
    const f = deferredFetch();
    vi.stubGlobal('fetch', f.fn);
    const m1 = apiClient('cart/?a=1', { method: 'POST' });
    const m2 = apiClient('order/', { method: 'POST' });
    await vi.waitFor(() => expect(f.calls.length).toBe(2));
    f.calls[0].resolve(json({}));
    await m1;
    const g = apiClient('order/');
    await vi.waitFor(() => expect(f.calls.length).toBe(3));
    f.calls[2].resolve(json({ v: 'before-m2' }));
    await g;
    f.calls[1].resolve(json({}));
    await m2;
    const after = apiClient('order/');
    await vi.waitFor(() => expect(f.calls.length).toBe(4));
    f.calls[3].resolve(json({ v: 'after-m2' }));
    expect((await after).v).toBe('after-m2');
  });

  it('a failed mutation still invalidates (finally path)', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(json({ v: 1 }))
      .mockResolvedValueOnce(json({ detail: 'x' }, 500))
      .mockResolvedValue(json({ v: 2 }));
    vi.stubGlobal('fetch', fn);
    await apiClient('p/');
    await apiClient('p/', { method: 'PATCH' });
    expect((await apiClient('p/')).v).toBe(2);
  });

  it('a token change clears cached data even with a request still in flight', async () => {
    const f = deferredFetch();
    vi.stubGlobal('fetch', f.fn);
    const a = apiClient('anon-list/', {}, false);
    await vi.waitFor(() => expect(f.calls.length).toBe(1));
    store.set('_TOKEN', 'token-user-b');
    const b = apiClient('anon-list/', {}, false);
    await vi.waitFor(() => expect(f.calls.length).toBe(2));
    f.calls[0].resolve(json({ v: 'a' }));
    f.calls[1].resolve(json({ v: 'b' }));
    expect((await a).v).toBe('a');
    expect((await b).v).toBe('b');
    expect((await apiClient('anon-list/', {}, false)).v).toBe('b');
  });
});

describe('user-triggered refresh bypass', () => {
  it('getNotification with { cache: false } skips the cache; method stays GET', async () => {
    const fn = vi.fn(async () => json({ results: [] }));
    vi.stubGlobal('fetch', fn);
    await getNotification({ page: 1 });
    await getNotification({ page: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
    await getNotification({ page: 1 }, { cache: false, method: 'POST' });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[1][1].method).toBe('GET');
  });
});

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

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** fetch mock whose responses are released manually. */
const deferredFetch = () => {
  const calls = [];
  const fn = vi.fn((url, init) => new Promise((resolve) => calls.push({ url, init, resolve })));
  return { fn, calls };
};

beforeEach(() => {
  store.clear();
  store.set('_TOKEN', 'token-user-a');
  clearApiCache();
  vi.useRealTimers();
});
afterEach(() => vi.unstubAllGlobals());

describe('apiClient GET dedupe + cache', () => {
  it('concurrent identical GETs share one request and get independent copies', async () => {
    const f = deferredFetch();
    vi.stubGlobal('fetch', f.fn);
    const p1 = apiClient('cart/', { method: 'GET' });
    const p2 = apiClient('cart/', { method: 'GET' });
    await vi.waitFor(() => expect(f.calls.length).toBe(1));
    f.calls[0].resolve(json({ data: { items: [1] } }));
    const [a, b] = await Promise.all([p1, p2]);
    expect(f.fn).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    a.data.items.push(99);
    const c = await apiClient('cart/', { method: 'GET' });
    expect(c.data.items).toEqual([1]);
    expect(f.fn).toHaveBeenCalledTimes(1);
  });

  it('different endpoints, queries and auth modes do not share', async () => {
    const fn = vi.fn(async (url) => json({ url }));
    vi.stubGlobal('fetch', fn);
    await Promise.all([
      apiClient('order/?page=1'),
      apiClient('order/?page=2'),
      apiClient('order/?page=1', {}, false),
    ]);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('cache expires after 10 seconds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const fn = vi.fn(async () => json({ v: 1 }));
    vi.stubGlobal('fetch', fn);
    await apiClient('x/');
    vi.setSystemTime(Date.now() + 9_000);
    await apiClient('x/');
    expect(fn).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 1_500);
    await apiClient('x/');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('failed, unauthorized and network-error responses are not cached', async () => {
    store.delete('_REFRESH_TOKEN');
    const fn = vi
      .fn()
      .mockResolvedValueOnce(json({ detail: 'bad' }, 500))
      .mockResolvedValueOnce(json({ detail: 'no' }, 401))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json({ success: false, message: 'soft fail' }))
      .mockResolvedValue(json({ ok: 1 }));
    vi.stubGlobal('fetch', fn);
    expect((await apiClient('y/')).success).toBe(false);
    expect((await apiClient('y/')).logout).toBe(true);
    expect((await apiClient('y/')).success).toBe(false);
    expect((await apiClient('y/')).success).toBe(false);
    expect((await apiClient('y/')).success).toBe(true);
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('cache:false bypasses the shared layer; a caller signal now shares it (T148)', async () => {
    const fn = vi.fn(async () => json({}));
    vi.stubGlobal('fetch', fn);
    await apiClient('z/');
    await apiClient('z/', { cache: false });
    await apiClient('z/', { signal: new AbortController().signal });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[1][1]).not.toHaveProperty('cache');
  });

  it('a mutation invalidates its related entries only; unknown mutations invalidate all (T148)', async () => {
    const fn = vi.fn(async () => json({}));
    vi.stubGlobal('fetch', fn);
    await apiClient('cart/');
    await apiClient('order/');
    await apiClient('cart/?variant_id=1&quantity=2', { method: 'POST' });
    await apiClient('cart/');
    await apiClient('order/');
    expect(fn).toHaveBeenCalledTimes(4);
    await apiClient('something/new/', { method: 'POST' });
    await apiClient('cart/');
    await apiClient('order/');
    expect(fn).toHaveBeenCalledTimes(7);
  });

  it('a GET in flight across a mutation is neither cached nor joined, and its caller gets fresh data (T148)', async () => {
    const f = deferredFetch();
    vi.stubGlobal('fetch', f.fn);
    const oldGet = apiClient('cart/');
    await vi.waitFor(() => expect(f.calls.length).toBe(1));
    const post = apiClient('cart/?variant_id=1&quantity=1', { method: 'POST' });
    await vi.waitFor(() => expect(f.calls.length).toBe(2));
    f.calls[1].resolve(json({ added: true }));
    await post;
    const freshGet = apiClient('cart/');
    await vi.waitFor(() => expect(f.calls.length).toBe(3));
    f.calls[0].resolve(json({ items: 'stale' }));
    f.calls[2].resolve(json({ items: 'fresh' }));
    expect((await oldGet).items).toBe('fresh');
    expect((await freshGet).items).toBe('fresh');
    expect((await apiClient('cart/')).items).toBe('fresh');
    expect(f.calls.length).toBe(3);
  });

  it('a GET started while a mutation is pending is not cached', async () => {
    const f = deferredFetch();
    vi.stubGlobal('fetch', f.fn);
    const post = apiClient('order/', { method: 'POST', body: '{}' });
    await vi.waitFor(() => expect(f.calls.length).toBe(1));
    const midGet = apiClient('order/');
    await vi.waitFor(() => expect(f.calls.length).toBe(2));
    f.calls[1].resolve(json({ orders: 'before' }));
    await midGet;
    f.calls[0].resolve(json({ id: 1 }));
    await post;
    const after = apiClient('order/');
    await vi.waitFor(() => expect(f.calls.length).toBe(3));
    f.calls[2].resolve(json({ orders: 'after' }));
    expect((await after).orders).toBe('after');
  });

  it('account switch: user B never receives user A data, even from an in-flight request', async () => {
    const f = deferredFetch();
    vi.stubGlobal('fetch', f.fn);
    const aGet = apiClient('customers/profile/');
    await vi.waitFor(() => expect(f.calls.length).toBe(1));
    store.set('_TOKEN', 'token-user-b');
    const bGet = apiClient('customers/profile/');
    await vi.waitFor(() => expect(f.calls.length).toBe(2));
    expect(f.calls[1].init.headers.Authorization).toBe('Bearer token-user-b');
    f.calls[0].resolve(json({ name: 'A' }));
    f.calls[1].resolve(json({ name: 'B' }));
    expect((await aGet).name).toBe('A');
    expect((await bGet).name).toBe('B');
    expect((await apiClient('customers/profile/')).name).toBe('B');
    expect(f.calls.length).toBe(2);
  });

  it('logout clears cached authenticated data', async () => {
    const fn = vi.fn(async () => json({ name: 'A' }));
    vi.stubGlobal('fetch', fn);
    await apiClient('customers/profile/');
    store.delete('_TOKEN');
    await apiClient('customers/profile/');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });
});

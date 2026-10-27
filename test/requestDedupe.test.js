import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map();
vi.mock('../src/common/utils', () => ({
  Utils: {
    getData: async (k) => (store.has(k) ? store.get(k) : null),
    storeData: async (k, v) => void store.set(k, v),
  },
}));
vi.mock('../src/config/key', () => ({ BaseUrl: { base_url: 'https://api.test/' } }));

const api = await import('../src/services/apiClient.js');
const { apiClient, clearApiCache, invalidateApiCache, invalidationPrefixesFor, subscribeApiSession } = api;
const { createLatestRequest } = await import('../src/utils/latestRequest.js');

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const deferredFetch = () => {
  const calls = [];
  const fn = vi.fn(
    (url, init) =>
      new Promise((resolve, reject) => {
        calls.push({ url, init, resolve, reject });
        init?.signal?.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        });
      }),
  );
  return { fn, calls };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  store.clear();
  store.set('_TOKEN', 'token-user-a');
  clearApiCache();
  vi.useRealTimers();
});
afterEach(() => vi.unstubAllGlobals());

describe('request isolation', () => {
  it('different headers never share a request', async () => {
    const fn = vi.fn(async () => json({ ok: 1 }));
    vi.stubGlobal('fetch', fn);
    await Promise.all([
      apiClient('products/', { headers: { 'X-Lang': 'en' } }),
      apiClient('products/', { headers: { 'X-Lang': 'hi' } }),
      apiClient('products/', { headers: { 'x-lang': 'en' } }),
    ]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('account switch never serves the previous account cache and notifies listeners', async () => {
    const fn = vi.fn(async (url, init) => json({ who: init.headers.Authorization }));
    vi.stubGlobal('fetch', fn);
    const seen = vi.fn();
    const off = subscribeApiSession(seen);
    const a = await apiClient('cart/');
    store.set('_TOKEN', 'token-user-b');
    const b = await apiClient('cart/');
    off();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(a).not.toEqual(b);
    expect(seen).toHaveBeenCalled();
  });
});

describe('failures, timeouts and aborts', () => {
  it('failed GETs are never cached', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (++n === 1 ? json({ detail: 'x' }, 500) : json({ ok: 1 }))));
    const first = await apiClient('order/');
    const second = await apiClient('order/');
    expect(first.success).toBe(false);
    expect(second.success).toBe(true);
    expect(n).toBe(2);
  });

  it('timeout aborts the request and is not cached', async () => {
    const f = deferredFetch();
    vi.stubGlobal('fetch', f.fn);
    const res = await apiClient('slow/', { timeoutMs: 20 });
    expect(res).toMatchObject({ success: false, timeout: true });
    expect(f.calls[0].init.signal.aborted).toBe(true);
    const again = apiClient('slow/', { timeoutMs: 20 });
    await vi.waitFor(() => expect(f.calls.length).toBe(2));
    await again;
  });

  it('a caller abort does not cancel a request other callers still wait for', async () => {
    const f = deferredFetch();
    vi.stubGlobal('fetch', f.fn);
    const c1 = new AbortController();
    const p1 = apiClient('doctors/', { signal: c1.signal });
    const p2 = apiClient('doctors/', { signal: new AbortController().signal });
    await vi.waitFor(() => expect(f.calls.length).toBe(1));
    c1.abort();
    await tick();
    f.calls[0].resolve(json({ ok: 1 }));
    expect(await p1).toMatchObject({ aborted: true });
    expect((await p2).success).toBe(true);
    expect(f.fn).toHaveBeenCalledTimes(1);
  });

  it('StrictMode-style abort + immediate replay reuses the same request', async () => {
    const f = deferredFetch();
    vi.stubGlobal('fetch', f.fn);
    const c1 = new AbortController();
    apiClient('notifications/', { signal: c1.signal });
    await vi.waitFor(() => expect(f.calls.length).toBe(1));
    c1.abort();
    const p2 = apiClient('notifications/', { signal: new AbortController().signal });
    await tick();
    await tick();
    f.calls[0].resolve(json({ ok: 1 }));
    expect((await p2).success).toBe(true);
    expect(f.fn).toHaveBeenCalledTimes(1);
  });

  it('last caller abort cancels the network request', async () => {
    const f = deferredFetch();
    vi.stubGlobal('fetch', f.fn);
    const c = new AbortController();
    const p = apiClient('search/?q=a', { signal: c.signal });
    await vi.waitFor(() => expect(f.calls.length).toBe(1));
    c.abort();
    expect(await p).toMatchObject({ aborted: true });
    await tick();
    expect(f.calls[0].init.signal.aborted).toBe(true);
  });
});

describe('targeted invalidation', () => {
  it('read-like POSTs keep the cache; cart mutation only drops cart + coupons', async () => {
    const fn = vi.fn(async () => json({ ok: 1 }));
    vi.stubGlobal('fetch', fn);
    await apiClient('cart/');
    await apiClient('customers/doctors/');
    await apiClient('order/fee-quote/', { method: 'POST', body: '{}' });
    await apiClient('cart/');
    expect(fn).toHaveBeenCalledTimes(3);
    await apiClient('cart/add/', { method: 'POST', body: '{}' });
    await apiClient('cart/');
    await apiClient('customers/doctors/');
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('unknown and auth mutations clear everything', () => {
    expect(invalidationPrefixesFor('something/new/', 'POST')).toEqual(invalidationPrefixesFor('auth/logout/', 'POST'));
  });

  it('invalidateApiCache(prefix) forces only matching GETs to refetch', async () => {
    const fn = vi.fn(async () => json({ ok: 1 }));
    vi.stubGlobal('fetch', fn);
    await apiClient('cart/');
    await apiClient('order/');
    invalidateApiCache('cart/');
    await apiClient('cart/');
    await apiClient('order/');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('cache:false always hits the network (save_recent search, refresh)', async () => {
    const fn = vi.fn(async () => json({ ok: 1 }));
    vi.stubGlobal('fetch', fn);
    await apiClient('search/?q=x&save_recent=true', { cache: false });
    await apiClient('search/?q=x&save_recent=true', { cache: false });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('createLatestRequest', () => {
  it('only the newest token is current and older signals abort', () => {
    const gate = createLatestRequest();
    const a = gate.begin();
    const b = gate.begin();
    expect(a.signal.aborted).toBe(true);
    expect(a.isCurrent()).toBe(false);
    expect(b.isCurrent()).toBe(true);
    gate.cancel();
    expect(b.isCurrent()).toBe(false);
    expect(b.signal.aborted).toBe(true);
  });
});

describe('workflow request counts', () => {
  it('cart page: StrictMode double mount + header badge + fee quote = 1 cart GET', async () => {
    const fn = vi.fn(async () => json({ ok: 1 }));
    vi.stubGlobal('fetch', fn);
    await Promise.all([apiClient('cart/'), apiClient('cart/'), apiClient('cart/')]);
    await apiClient('order/fee-quote/', { method: 'POST', body: '{}' });
    await apiClient('cart/');
    const gets = fn.mock.calls.filter(([, init]) => (init?.method || 'GET') === 'GET');
    expect(gets.length).toBe(1);
  });
});

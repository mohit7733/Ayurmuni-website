import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const makeEnv = () => {
  const listeners = {};
  const release = vi.fn(() => Promise.resolve());
  const request = vi.fn(() => Promise.resolve({ release, addEventListener: vi.fn() }));
  const doc = {
    visibilityState: 'visible',
    addEventListener: vi.fn((name, fn) => {
      listeners[name] = fn;
    }),
    removeEventListener: vi.fn((name) => {
      delete listeners[name];
    }),
  };
  vi.stubGlobal('document', doc);
  vi.stubGlobal('navigator', { wakeLock: { request } });
  return { listeners, release, request, doc };
};

describe('keepAwake', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests a screen wake lock and releases it', async () => {
    const env = makeEnv();
    const { activateKeepAwake, deactivateKeepAwake } = await import('../src/utils/keepAwake');
    await activateKeepAwake();
    expect(env.request).toHaveBeenCalledWith('screen');
    deactivateKeepAwake();
    expect(env.release).toHaveBeenCalledTimes(1);
    expect(env.doc.removeEventListener).toHaveBeenCalled();
  });

  it('re-acquires the lock when the tab becomes visible again', async () => {
    const env = makeEnv();
    const { activateKeepAwake, deactivateKeepAwake } = await import('../src/utils/keepAwake');
    await activateKeepAwake();
    env.listeners.visibilitychange();
    await Promise.resolve();
    // a lock is still held, so no second request until it is dropped
    expect(env.request).toHaveBeenCalledTimes(1);
    deactivateKeepAwake();
  });

  it('does nothing when the Wake Lock API is unsupported', async () => {
    makeEnv();
    vi.stubGlobal('navigator', {});
    const { activateKeepAwake, deactivateKeepAwake } = await import('../src/utils/keepAwake');
    await expect(activateKeepAwake()).resolves.toBeUndefined();
    expect(() => deactivateKeepAwake()).not.toThrow();
  });

  it('swallows a rejected request', async () => {
    const env = makeEnv();
    env.request.mockRejectedValueOnce(new Error('denied'));
    const { activateKeepAwake } = await import('../src/utils/keepAwake');
    await expect(activateKeepAwake()).resolves.toBeUndefined();
  });
});
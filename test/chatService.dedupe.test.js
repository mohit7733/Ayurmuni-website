import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map();

vi.mock('../src/common/utils', () => ({
  Utils: {
    getData: async (k) => (store.has(k) ? store.get(k) : null),
  },
}));

vi.mock('../src/config/key', () => ({ BaseUrl: { base_url: 'https://api.test/' } }));

const okMessages = {
  success: true,
  data: {
    messages: [{ id: 'm1', text: 'hello', sender_role: 'doctor' }],
    chat_access: { can_send: true, can_read: true },
  },
};

const okSend = {
  success: true,
  data: { message: { id: 'm2', text: 'hi', sender_role: 'patient' } },
};

describe('chatService request dedupe', () => {
  let chatService;
  let resetChatServiceDedupe;
  let fetchMock;

  beforeEach(async () => {
    store.clear();
    store.set('_TOKEN', 'token-user-a');
    fetchMock = vi.fn(async (_url, init = {}) => {
      const method = String(init.method || 'GET').toUpperCase();
      return {
        ok: true,
        status: 200,
        json: async () => (method === 'POST' ? okSend : okMessages),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const mod = await import('../src/services/chatService');
    chatService = mod.chatService;
    resetChatServiceDedupe = mod.resetChatServiceDedupe;
    resetChatServiceDedupe();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shares one in-flight GET for identical getMessages calls', async () => {
    const [first, second] = await Promise.all([
      chatService.getMessages('appt-1'),
      chatService.getMessages('appt-1'),
    ]);
    const gets = fetchMock.mock.calls.filter(
      ([, init]) => String(init?.method || 'GET').toUpperCase() === 'GET',
    );
    expect(gets).toHaveLength(1);
    expect(first.messages).toHaveLength(1);
    expect(second.messages).toHaveLength(1);
    expect(second).toBe(first);
  });

  it('does not merge a mark_read GET with a plain GET', async () => {
    await Promise.all([chatService.getMessages('appt-1'), chatService.getMessages('appt-1', 'm1')]);
    const gets = fetchMock.mock.calls.filter(
      ([, init]) => String(init?.method || 'GET').toUpperCase() === 'GET',
    );
    expect(gets).toHaveLength(2);
  });

  it('allows a second GET after the first request finishes', async () => {
    await chatService.getMessages('appt-1');
    await chatService.getMessages('appt-1');
    const gets = fetchMock.mock.calls.filter(
      ([, init]) => String(init?.method || 'GET').toUpperCase() === 'GET',
    );
    expect(gets).toHaveLength(2);
  });

  it('blocks a second in-flight or identical sendMessage', async () => {
    const settled = await Promise.allSettled([
      chatService.sendMessage('appt-1', { text: 'Hello doctor' }),
      chatService.sendMessage('appt-1', { text: 'Hello doctor' }),
    ]);
    const posts = fetchMock.mock.calls.filter(
      ([, init]) => String(init?.method || 'GET').toUpperCase() === 'POST',
    );
    expect(posts).toHaveLength(1);
    expect(settled[0].status).toBe('fulfilled');
    expect(settled[1].status).toBe('rejected');
    expect(settled[1].reason.code).toBe('DUPLICATE_SEND');
  });
});

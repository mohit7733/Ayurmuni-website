import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClient = vi.fn();
vi.mock('../src/services/apiClient', () => ({
  apiClient: (...args) => apiClient(...args),
  invalidateApiCache: vi.fn(),
}));

const svc = await import('../src/services/packageService.js');
const theme = await import('../src/packages/planTheme.js');
const chat = await import('../src/chat/chatAccessUtils.js');

beforeEach(() => {
  apiClient.mockReset();
});

const catalogRow = (id) => ({
  id,
  name: 'Care',
  selling_price: 499,
  purchase_type: 'prepaid_package',
  can_be_purchased: true,
  button_action: 'purchase_package',
  is_purchased: true,
  active_purchase: { id: 'old-buy', status: 'active', remaining_sessions: 1 },
});

describe('catalog stays independently buyable', () => {
  it('does not mark a package owned from a previous purchase or collapse purchases', async () => {
    apiClient.mockImplementation((url) => {
      if (String(url).startsWith('packages/my/')) {
        throw new Error('catalog must not read purchases');
      }
      return {
        success: true,
        data: { results: [catalogRow('pkg-1'), catalogRow('pkg-2')], next: null },
      };
    });
    const plans = await svc.loadPackagesWithStatus();
    expect(plans.map((plan) => plan.purchased)).toEqual([false, false]);
    expect(plans.map((plan) => plan.remaining)).toEqual([null, null]);
    expect(plans.map((plan) => plan.expiresAt)).toEqual(['', '']);
    expect(theme.planCta({ ...plans[0], purchased: true })).toBe('Buy now');
    expect(theme.planCta({ ...plans[0], purchased: true }, { rail: true })).toBe('Buy now');
  });
});

describe('chat access follows only this appointment', () => {
  const followUpTomorrow = { follow_up: { date: '2999-01-01', schedule: true } };

  it('does not open chat from a date window when chat_access is missing', () => {
    expect(chat.isChatSendEnabled(null, '2026-11-18', followUpTomorrow)).toBe(false);
    expect(chat.isChatSendEnabled(undefined, '2026-11-18', { appointment_status: 'confirmed' })).toBe(false);
  });

  it('uses can_send and does not let follow_up_active extend a closed visit', () => {
    expect(chat.isChatSendEnabled({ can_send: true, follow_up_active: false })).toBe(true);
    expect(chat.isChatSendEnabled({ can_send: false, follow_up_active: true })).toBe(false);
    expect(chat.isChatSendEnabled({ follow_up_active: true })).toBe(true);
    expect(chat.isChatSendEnabled({ follow_up_active: false }, '2026-11-18', followUpTomorrow)).toBe(false);
  });
});

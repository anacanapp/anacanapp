import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), platform: 'android', stage: 'bump' as string | null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => mocks.platform, isNativePlatform: () => mocks.platform !== 'web' } }));
vi.mock('@/store/userStore', () => ({ useUserStore: { getState: () => ({ lifeStage: mocks.stage }) } }));

import { funnelHit, normaliseFunnelSource, purchaseIntent, resetFunnelThrottle } from './premium-funnel';

describe('premium funnel client', () => {
  beforeEach(() => { mocks.rpc.mockReset(); mocks.rpc.mockResolvedValue({ data: true, error: null }); resetFunnelThrottle(); mocks.platform = 'android'; mocks.stage = 'bump'; });

  it('normalises sources like the server', () => {
    expect(normaliseFunnelSource('Tool AI')).toBe('tool_ai');
    expect(normaliseFunnelSource('onboarding:paywall')).toBe('onboarding:paywall');
    expect(normaliseFunnelSource('')).toBe('other');
    expect(normaliseFunnelSource(null)).toBe('other');
    expect(normaliseFunnelSource('x'.repeat(80))).toHaveLength(48);
  });

  it('sends the hit with platform and life stage, and throttles paywall_shown per source for 10 minutes', () => {
    funnelHit('paywall_shown', 'tool_ai', 1_000);
    funnelHit('paywall_shown', 'tool_ai', 2_000);
    funnelHit('paywall_shown', 'onboarding', 2_000);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).toHaveBeenCalledWith('premium_funnel_hit_v1', { p_event: 'paywall_shown', p_source: 'tool_ai', p_platform: 'android', p_life_stage: 'bump' });
    funnelHit('paywall_shown', 'tool_ai', 1_000 + 10 * 60_000 + 1);
    expect(mocks.rpc).toHaveBeenCalledTimes(3);
  });

  it('ignores unknown events and never throws when the client fails', () => {
    funnelHit('nope' as never, 'x');
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockImplementation(() => { throw new Error('offline'); });
    expect(() => funnelHit('paywall_clicked', 'x')).not.toThrow();
    mocks.rpc.mockReset();
    mocks.rpc.mockRejectedValue(new Error('offline'));
    expect(() => purchaseIntent('x', 'yearly')).not.toThrow();
  });

  it('records the buy tap with platform and plan; unknown plans become unknown', () => {
    mocks.platform = 'ios'; mocks.stage = null;
    purchaseIntent('Billing', 'yearly', 5_000);
    purchaseIntent('Billing', 'yearly', 5_500);
    purchaseIntent('billing', 'weekly', 9_000);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'premium_purchase_intent_v1', { p_source: 'billing', p_platform: 'ios', p_plan: 'yearly' });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'premium_purchase_intent_v1', { p_source: 'billing', p_platform: 'ios', p_plan: 'unknown' });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it('maps a non-native platform to web', () => {
    mocks.platform = 'electron';
    funnelHit('restore_clicked', 'billing');
    expect(mocks.rpc.mock.calls[0][1].p_platform).toBe('web');
  });
});

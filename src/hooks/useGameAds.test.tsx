import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAdsConfiguration } from '@/lib/ads/config';
const mocks = vi.hoisted(() => ({
  rewarded: vi.fn(), show: vi.fn(async () => true), opportunity: vi.fn(), register: vi.fn(() => vi.fn()),
  config: null as ReturnType<typeof defaultAdsConfiguration> | null, premium: false,
}));
vi.mock('@/components/ads/AdExperienceProvider', () => ({ useAdExperience: () => ({ configuration: mocks.config,
  registerSurface: mocks.register, opportunity: mocks.opportunity, showInterstitial: mocks.show,
  showRewarded: mocks.rewarded, decisionFor: () => ({ allowed: true, reason: 'ready' }), busy: false,
  preview: { enabled: false, premium: false } }) }));
vi.mock('./useSubscription', () => ({ useSubscription: () => ({ isPremium: mocks.premium }) }));
import { useGameAds } from './useGameAds';

beforeEach(() => { vi.clearAllMocks(); mocks.config = defaultAdsConfiguration(); mocks.premium = false; mocks.opportunity.mockReturnValue(false); });
describe('game rewarded revival', () => {
  it('does not restore on close/failure; restores once on reward and enforces per-round limit', async () => {
    const restore = vi.fn(); const { result, rerender } = renderHook(({ phase }) => useGameAds('saglam-sebet', phase, restore), { initialProps: { phase: 'lost' } });
    mocks.rewarded.mockResolvedValueOnce(false);
    await act(async () => { await result.current.revive(); }); expect(restore).not.toHaveBeenCalled();
    mocks.rewarded.mockResolvedValueOnce(true);
    await act(async () => { await result.current.revive(); });
    expect(restore).toHaveBeenCalledWith({ lives: 3, moves: 5, seconds: 15 });
    rerender({ phase: 'lost' });
    await act(async () => { await result.current.revive(); }); expect(restore).toHaveBeenCalledTimes(1);
  });
  it('ignores a delayed reward after leaving the round and only counts terminal round transitions', async () => {
    let finish!: (value: boolean) => void; mocks.rewarded.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const restore = vi.fn(); const hook = renderHook(() => useGameAds('birlesdir', 'lost', restore));
    let pending!: Promise<void>; act(() => { pending = hook.result.current.revive(); }); hook.unmount();
    await act(async () => { finish(true); await pending; }); expect(restore).not.toHaveBeenCalled();
    const next = renderHook(({ phase }) => useGameAds('birlesdir', phase, restore), { initialProps: { phase: 'playing' } });
    const action = vi.fn(); await act(async () => { await next.result.current.transition(action); });
    expect(mocks.opportunity).not.toHaveBeenCalled();
    next.rerender({ phase: 'won' }); mocks.opportunity.mockReturnValueOnce(true);
    await act(async () => { await next.result.current.transition(action); });
    expect(mocks.show).toHaveBeenCalledWith('games_break_interstitial');
  });
});

import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAdsConfiguration } from '@/lib/ads/config';
const mocks = vi.hoisted(() => ({ reward: vi.fn(), config: null as ReturnType<typeof defaultAdsConfiguration> | null }));
vi.mock('@/components/ads/AdExperienceProvider', () => ({ useAdExperience: () => ({ configuration: mocks.config,
  registerSurface: () => () => {}, opportunity: () => false, showInterstitial: async () => false,
  showRewarded: mocks.reward, decisionFor: () => ({ allowed: true, reason: 'ready' }), busy: false,
  preview: { enabled: false, premium: false } }) }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: false }) }));
vi.mock('@/lib/native', () => ({ hapticFeedback: { light: vi.fn(), medium: vi.fn(), heavy: vi.fn() } }));
vi.mock('./saglam-sebet/levelConfig', async importOriginal => {
  const original = await importOriginal<typeof import('./saglam-sebet/levelConfig')>();
  return { ...original, getLevelConfig: (level: number) => ({ ...original.getLevelConfig(level), duration: 1, targetScore: 99999, spawnInterval: 999999 }) };
});
vi.mock('./birlesdir/levelConfig', async importOriginal => {
  const original = await importOriginal<typeof import('./birlesdir/levelConfig')>();
  return { ...original, getLevelConfig: (level: number) => ({ ...original.getLevelConfig(level), movesLimit: 0, targetScore: 99999 }) };
});
import SaglamSebetGame from './saglam-sebet/SaglamSebetGame';
import BirlesdirGame from './birlesdir/BirlesdirGame';
beforeEach(() => { mocks.config = defaultAdsConfiguration(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('reward callbacks restore actual game state', () => {
  it('restores match-game moves without resetting the score; closing an ad grants nothing', async () => {
    render(<BirlesdirGame level={1} onExit={vi.fn()} onLevelComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Başla|Oyna/ }));
    const board = document.querySelector('[data-game-phase]')!;
    expect(board.getAttribute('data-game-phase')).toBe('lost');
    expect(board.getAttribute('data-game-moves')).toBe('0');
    mocks.reward.mockResolvedValueOnce(false);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Videoya bax/ })); });
    expect(board.getAttribute('data-game-moves')).toBe('0');
    mocks.reward.mockResolvedValueOnce(true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Videoya bax/ })); });
    expect(board.getAttribute('data-game-phase')).toBe('playing');
    expect(board.getAttribute('data-game-moves')).toBe('5');
    expect(board.getAttribute('data-game-score')).toBe('0');
  });
  it('restores basket-game lives and usable time after losing', async () => {
    vi.useFakeTimers();
    render(<SaglamSebetGame level={1} onExit={vi.fn()} onLevelComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Başla/ }));
    for (let i = 0; i < 5; i++) await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    const game = document.querySelector('[data-game-phase]')!;
    expect(game.getAttribute('data-game-phase')).toBe('lost');
    mocks.reward.mockResolvedValueOnce(true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Videoya bax/ })); });
    expect(game.getAttribute('data-game-phase')).toBe('playing');
    expect(Number(game.getAttribute('data-game-lives'))).toBeGreaterThan(0);
    expect(game.getAttribute('data-game-score')).toBe('0');
  });
});

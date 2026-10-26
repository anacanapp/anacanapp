import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import MiniGamesHub from './MiniGamesHub';

vi.mock('@/store/userStore', () => ({ useUserStore: (selector: (value: { language: string }) => unknown) => selector({ language: 'en' }) }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: vi.fn(), trackEvent: vi.fn() }));
vi.mock('@/hooks/useScrollToTop', () => ({ useScrollToTop: vi.fn() }));
vi.mock('@/hooks/useLocalGameProgress', () => ({ useLocalGameProgress: () => ({ progress: { unlockedLevel: 1, levels: {}, bestScoreOverall: 0 }, recordLevelResult: vi.fn(), isLevelUnlocked: () => true }) }));
vi.mock('@/hooks/useGameScores', () => ({ useSubmitGameScore: () => ({ mutate: vi.fn() }) }));
vi.mock('./color-sort/useColorSortText', () => ({ useColorSortText: () => ({ t: (key: string) => key }) }));
vi.mock('./color-sort/useColorSortLibrary', () => ({ useColorSortLibrary: () => ({ levelCount: 30, addLevels: vi.fn() }) }));
vi.mock('./color-sort/ColorSortGame', () => ({ default: () => null }));
vi.mock('./color-sort/ColorSortLevels', () => ({ default: () => null }));
vi.mock('./birlesdir/BirlesdirGame', () => ({ default: () => null }));
vi.mock('./birlesdir/BirlesdirLevels', () => ({ default: () => null }));
vi.mock('./saglam-sebet/SaglamSebetGame', () => ({ default: () => null }));
vi.mock('./saglam-sebet/SaglamSebetLevels', () => ({ default: () => null }));
vi.mock('./Leaderboard', () => ({ default: () => null }));
vi.mock('./iki-dost/TwoFriends', () => ({ default: ({ onBack }: { onBack: () => void }) => <button type="button" onClick={onBack}>Friends return</button> }));
afterEach(cleanup);
it('opens the localized Two Friends lazy game and returns to the existing hub', async () => {
  render(<MiniGamesHub onBack={vi.fn()} />);
  expect(document.querySelectorAll('[data-game-id]')).toHaveLength(6);
  fireEvent.click(screen.getByRole('button', { name: /Two Friends/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Friends return' }));
  expect(await screen.findByRole('button', { name: /Two Friends/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Söz bağı/ })).toBeNull();
}, 15000);

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MiniGamesHub from './MiniGamesHub';

const fixture = vi.hoisted(() => ({ language: 'az' }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: (value: { language: string }) => unknown) => selector({ language: fixture.language }) }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: vi.fn(), trackEvent: vi.fn() }));
vi.mock('@/hooks/useScrollToTop', () => ({ useScrollToTop: vi.fn() }));
vi.mock('@/hooks/useLocalGameProgress', () => ({ useLocalGameProgress: () => ({ progress: { unlockedLevel: 1, levels: {}, bestScoreOverall: 0 }, recordLevelResult: vi.fn(), isLevelUnlocked: () => true }) }));
vi.mock('@/hooks/useGameScores', () => ({ useSubmitGameScore: () => ({ mutate: vi.fn() }) }));
vi.mock('./color-sort/useColorSortText', () => ({ useColorSortText: () => ({ t: (key: string) => key === 'title' ? 'Rəng çeşidləmə' : key }) }));
vi.mock('./color-sort/useColorSortLibrary', () => ({ useColorSortLibrary: () => ({ levelCount: 30, addLevels: vi.fn() }) }));
vi.mock('./color-sort/ColorSortGame', () => ({ default: () => null }));
vi.mock('./color-sort/ColorSortLevels', () => ({ default: () => null }));
vi.mock('./birlesdir/BirlesdirGame', () => ({ default: () => null }));
vi.mock('./birlesdir/BirlesdirLevels', () => ({ default: () => null }));
vi.mock('./saglam-sebet/SaglamSebetGame', () => ({ default: () => null }));
vi.mock('./saglam-sebet/SaglamSebetLevels', () => ({ default: () => null }));
vi.mock('./Leaderboard', () => ({ default: () => null }));
vi.mock('./word-garden/WordGarden', () => ({ default: ({ onBack }: { onBack: () => void }) => <button type="button" onClick={onBack}>Bağa qayıt</button> }));

beforeEach(() => { fixture.language = 'az'; });
afterEach(cleanup);
it('opens the Azerbaijani game through its own lazy screen and returns to the existing hub', async () => {
  render(<MiniGamesHub onBack={vi.fn()} />);
  expect(document.querySelectorAll('[data-game-id]')).toHaveLength(7);
  fireEvent.click(screen.getByRole('button', { name: /Söz bağı/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Bağa qayıt' }));
  expect(await screen.findByRole('button', { name: /Söz bağı/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Söz bağı/ }));
  expect(await screen.findByRole('button', { name: 'Bağa qayıt' })).toBeInTheDocument();
});
it.each(['en', 'tr', 'ar'])('preserves the other games and hides the unavailable word library in %s', language => {
  fixture.language = language;
  render(<MiniGamesHub onBack={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /Söz bağı/ })).toBeNull();
  expect(document.querySelectorAll('[data-game-id]')).toHaveLength(6);
});

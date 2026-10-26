import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ColorSortGame from './ColorSortGame';
import ColorSortLevels from './ColorSortLevels';
import { BUNDLED_LEVELS, getFallbackLevel, knownSolutionMove } from './levels';
import { useColorSortLibrary } from './useColorSortLibrary';
import { createSession, saveSession } from './session';
import { MESSAGES } from './messages';

const fixture = vi.hoisted(() => ({ language: 'az', restore: null as null | ((benefits: { moves: number; lives: number; seconds: number }) => void), revive: vi.fn() }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: (state: { language: string }) => unknown) => selector({ language: fixture.language }) }));
vi.mock('@/lib/i18n', () => ({ getCachedTranslation: () => undefined }));
vi.mock('@/lib/native', () => ({ hapticFeedback: { light: vi.fn(), medium: vi.fn(), heavy: vi.fn() } }));
vi.mock('@/hooks/useGameAds', () => ({ useGameAds: (_game: string, phase: string, restore: typeof fixture.restore) => {
  fixture.restore = restore;
  return { waiting: false, busy: false, canOffer: phase === 'lost', canRequest: true, premium: false,
    benefits: { lives: 3, moves: 5, seconds: 15 }, resetRound: vi.fn(), transition: async (action: () => void) => action(),
    revive: fixture.revive, message: '', reason: '', allowedPlacements: phase === 'lost' ? 'game_revive_rewarded games_break_interstitial' : '' };
} }));
vi.mock('./workerClient', () => ({
  loadColorSortLevel: async (level: number) => getFallbackLevel(level),
  requestColorSortHint: async (definition: Parameters<typeof knownSolutionMove>[0], board: Parameters<typeof knownSolutionMove>[1]) => knownSolutionMove(definition, board),
}));
vi.mock('framer-motion', async importOriginal => ({ ...(await importOriginal<typeof import('framer-motion')>()), useReducedMotion: () => true }));

beforeEach(() => { localStorage.clear(); fixture.language = 'az'; fixture.revive.mockReset(); fixture.restore = null; });
afterEach(cleanup);
const tube = (index: number) => document.querySelector<HTMLButtonElement>(`[data-colorsort-tube="${index}"]`)!;
const root = () => screen.getByTestId('colorsort-game');
const ready = async () => { await screen.findByRole('button', { name: 'Başla' }); fireEvent.click(screen.getByRole('button', { name: 'Başla' })); };
async function makeMove(from: number, to: number) {
  fireEvent.click(tube(from)); fireEvent.click(tube(to));
  await waitFor(() => expect(root().getAttribute('data-game-phase') === 'won' || !tube(0).disabled).toBe(true));
}

describe('Color Sort player', () => {
  it.each(['az', 'en', 'tr', 'ru', 'de', 'ar', 'kk', 'uz', 'ka'])('renders the first game screen offline in %s', async language => {
    fixture.language = language;
    render(<ColorSortGame level={1} levelCount={30} onExit={vi.fn()} onLevelComplete={vi.fn()} onNextLevel={vi.fn()} />);
    expect(await screen.findByRole('button', { name: MESSAGES[language].start })).toBeVisible();
    expect(screen.getByText(MESSAGES[language].goal)).toBeVisible();
    expect(root()).toHaveAttribute('lang', language);
    expect(root()).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
  });

  it('plays a real level through the tube controls and reports a win only once', async () => {
    const complete = vi.fn(), next = vi.fn(), exit = vi.fn();
    const view = render(<StrictMode><ColorSortGame level={1} levelCount={30} onExit={exit} onLevelComplete={complete} onNextLevel={next} /></StrictMode>);
    await ready();
    for (const move of BUNDLED_LEVELS[0].solution) await makeMove(move.from, move.to);
    expect(await screen.findByRole('heading', { name: 'Rənglər yerini tapdı!' })).toBeVisible();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ level: 1, passed: true, stars: 3 }));
    view.rerender(<StrictMode><ColorSortGame level={1} levelCount={30} onExit={exit} onLevelComplete={complete} onNextLevel={next} /></StrictMode>);
    expect(complete).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Növbəti səviyyə' }));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('supports undo, one extra tube, pausing and resuming a saved local round', async () => {
    const props = { level: 1, levelCount: 30, onExit: vi.fn(), onLevelComplete: vi.fn(), onNextLevel: vi.fn() };
    const view = render(<ColorSortGame {...props} />); await ready();
    await makeMove(0, 2);
    expect(root()).toHaveAttribute('data-colorsort-moves', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Geri al' }));
    expect(root()).toHaveAttribute('data-colorsort-moves', '0');
    await makeMove(0, 2);
    fireEvent.click(screen.getByRole('button', { name: /Əlavə qab/ }));
    expect(document.querySelectorAll('[data-colorsort-tube]')).toHaveLength(6);
    expect(screen.getByRole('button', { name: /Əlavə qab/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fasilə' }));
    expect(root()).toHaveAttribute('data-game-phase', 'paused');
    expect(tube(0)).toBeDisabled();
    view.unmount();
    render(<ColorSortGame {...props} />);
    const resume = await screen.findByRole('button', { name: 'Saxlanmış oyuna davam et' }); fireEvent.click(resume);
    expect(root()).toHaveAttribute('data-game-phase', 'playing');
    expect(root()).toHaveAttribute('data-colorsort-moves', '1');
    expect(document.querySelectorAll('[data-colorsort-tube]')).toHaveLength(6);
  });

  it('grants extra moves only when the reward callback restores the current lost round', async () => {
    const definition = BUNDLED_LEVELS[6], session = createSession(definition);
    session.moves = definition.moveLimit!; saveSession(session, definition);
    const complete = vi.fn();
    render(<ColorSortGame level={7} levelCount={30} onExit={vi.fn()} onLevelComplete={complete} onNextLevel={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Saxlanmış oyuna davam et' }));
    await screen.findByRole('heading', { name: 'Gedişlər bitdi' });
    fireEvent.click(screen.getByRole('button', { name: /Videoya bax/ }));
    expect(root()).toHaveAttribute('data-game-phase', 'lost');
    fixture.revive.mockImplementation(() => fixture.restore?.({ moves: 5, lives: 3, seconds: 15 }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Videoya bax/ })));
    expect(root()).toHaveAttribute('data-game-phase', 'playing');
    expect(root()).toHaveAttribute('data-colorsort-moves', String(definition.moveLimit));
    expect(complete).not.toHaveBeenCalled();
  });

  it('adds another ten levels without unlocking them or resetting existing progress', async () => {
    const selected = vi.fn();
    function Library() {
      const library = useColorSortLibrary();
      return <ColorSortLevels progress={{ unlockedLevel: 1, levels: {}, bestScoreOverall: 99 }} isLevelUnlocked={level => level === 1}
        onSelectLevel={selected} onBack={vi.fn()} levelCount={library.levelCount} onAddLevels={library.addLevels} />;
    }
    render(<Library />);
    expect(screen.getByRole('button', { name: 'Səviyyə 30' })).toBeDisabled();
    fireEvent.click(screen.getByTestId('colorsort-add-levels'));
    expect(await screen.findByRole('button', { name: 'Səviyyə 40' })).toBeDisabled();
    expect(localStorage.getItem('anacan_colorsort_level_count_v1')).toBe('40');
    expect(selected).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Səviyyə 1' }));
    expect(selected).toHaveBeenCalledWith(1);
  });
});

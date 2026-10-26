import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import WordGarden from './WordGarden';
import LetterWheel from './LetterWheel';
import { selectWheelLetter } from './wheel';
import { gardenText } from './messages';
import { loadGardenLexicon } from './library';
import { generateGardenLevel } from './generator';
import { gardenStorageKey } from './storage';
import { createGardenProfile, createGardenRound } from './state';

const fixture = vi.hoisted(() => ({ language: 'az', restore: null as null | ((value: { moves: number; lives: number; seconds: number }) => void), earned: false, transition: vi.fn() }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: (state: { language: string }) => unknown) => selector({ language: fixture.language }) }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: vi.fn(), trackEvent: vi.fn() }));
vi.mock('@/lib/native', () => ({ hapticFeedback: { light: async () => {}, medium: async () => {} } }));
vi.mock('@/lib/backButton', () => ({ pushBackHandler: () => () => {} }));
vi.mock('@/hooks/useGameAds', () => ({ useGameAds: (_id: string, phase: string, restore: typeof fixture.restore) => {
  fixture.restore = restore;
  return { waiting: false, canOffer: phase === 'lost', canRequest: true, premium: false, benefits: { moves: 5, lives: 3, seconds: 15 },
    resetRound: vi.fn(), transition: async (action: () => void) => { fixture.transition(); action(); },
    revive: async () => { if (fixture.earned) fixture.restore?.({ moves: 5, lives: 3, seconds: 15 }); }, allowedPlacements: phase === 'lost' ? 'game_revive_rewarded games_break_interstitial' : phase === 'won' ? 'games_break_interstitial' : '', reason: '', message: '' };
} }));
vi.mock('./workerClient', async () => ({ disposeGardenWorker: () => {}, loadGardenLevel: async (language: string, level: number, mode: 'calm' | 'timed', _signal: AbortSignal, revision?: string) => generateGardenLevel(await loadGardenLexicon(language, revision), level, mode) }));
beforeAll(async () => { await loadGardenLexicon('az'); });
beforeEach(() => { localStorage.clear(); fixture.language = 'az'; fixture.restore = null; fixture.earned = false; fixture.transition.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function start() {
  fireEvent.click(screen.getByRole('button', { name: /Oyna/ }));
  await screen.findByTestId('wordgarden-wheel');
  const begin = screen.queryByRole('button', { name: 'Oyuna başla' });
  if (begin) fireEvent.click(begin);
  await waitFor(() => expect(screen.getByTestId('wordgarden-game')).toHaveAttribute('data-game-phase', 'playing'));
}
async function word(value: string) {
  const used = new Set<number>();
  for (const letter of value) {
    const nodes = [...document.querySelectorAll<HTMLButtonElement>('[data-letter-index]')];
    const node = nodes.find(node => node.dataset.letter === letter && !used.has(Number(node.dataset.letterIndex)));
    expect(node, letter).toBeTruthy(); used.add(Number(node!.dataset.letterIndex));
    fireEvent.click(node!, { detail: 0 });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Yoxla' }));
}
describe('Word Garden player', () => {
  it('plays the real first crossword, commits one win and unlocks the next level', async () => {
    render(<StrictMode><WordGarden onBack={vi.fn()} /></StrictMode>); await start();
    const definition = generateGardenLevel(await loadGardenLexicon('az'), 1);
    for (const entry of definition.words) await word(entry.word);
    expect(await screen.findByRole('heading', { name: 'Bağın çiçəkləndi!' })).toBeVisible();
    const stored = JSON.parse(localStorage.getItem(gardenStorageKey('az', definition.revision, 'calm'))!);
    expect(stored.progress.unlockedLevel).toBe(2);
    expect(stored.progress.coins).toBe(125);
    expect(stored.progress.totalWords).toBe(definition.words.length);
    fireEvent.click(screen.getByRole('button', { name: 'Növbəti səviyyə' }));
    expect(await screen.findByRole('heading', { name: 'Səviyyə 2' })).toBeVisible();
    expect(fixture.transition).toHaveBeenCalledTimes(1);
  }, 15000);
  it('keeps a half-played board on exit/reopen and spends the free and paid hints correctly', async () => {
    const view = render(<WordGarden onBack={vi.fn()} />); await start();
    const definition = generateGardenLevel(await loadGardenLexicon('az'), 1);
    await word(definition.words[0].word);
    fireEvent.click(screen.getByRole('button', { name: /İpucu/ }));
    const hidden = () => document.querySelector<HTMLButtonElement>('[data-garden-cell][data-revealed="false"]')!;
    fireEvent.click(hidden());
    fireEvent.click(screen.getByRole('button', { name: /İpucu/ })); fireEvent.click(hidden());
    const key = gardenStorageKey('az', definition.revision, 'calm');
    expect(JSON.parse(localStorage.getItem(key)!).progress.coins).toBe(50);
    view.unmount(); render(<WordGarden onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Oyuna davam et/ }));
    await screen.findByTestId('wordgarden-wheel');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(key)!).round.found).toContain(definition.words[0].word));
    expect(JSON.parse(localStorage.getItem(key)!).round.hintsUsed).toBe(2);
  });
  it('persists visual/sound settings and does not unlock future chapter levels', async () => {
    render(<WordGarden onBack={vi.fn()} />);
    await act(async () => { await loadGardenLexicon('az'); });
    expect(screen.getByRole('button', { name: 'Səviyyə 2, bağlıdır' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Oyun parametrləri' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Səslər' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Daha aydın görünüş' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ulduzlu gecə' }));
    expect(screen.getByTestId('wordgarden-screen')).toHaveClass('wg-theme-night', 'wg-high-contrast');
    expect(JSON.parse(localStorage.getItem('anacan_word_garden_preferences_v1')!).sound).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Növbəti bağça' }));
    expect(screen.getByRole('button', { name: 'Səviyyə 21, bağlıdır' })).toBeDisabled();
    expect(localStorage.getItem(gardenStorageKey('az', 'az-202610-v2', 'calm'))).toBeNull();
  });
  it('grants time only on an earned reward and blocks taps when the round is lost', async () => {
    const definition = generateGardenLevel(await loadGardenLexicon('az'), 1, 'timed');
    const profile = { ...createGardenProfile('az', definition.revision, 'timed'), round: { ...createGardenRound(definition), started: true, remainingSeconds: 0 } };
    localStorage.setItem(gardenStorageKey('az', definition.revision, 'timed'), JSON.stringify(profile));
    render(<WordGarden onBack={vi.fn()} />); fireEvent.click(screen.getByRole('button', { name: 'Vaxtlı' }));
    fireEvent.click(screen.getByRole('button', { name: /Oyuna davam et/ }));
    expect(await screen.findByRole('heading', { name: 'Bu dəfə vaxt bitdi' })).toBeVisible();
    expect(document.querySelector<HTMLButtonElement>('[data-letter-index]')).toBeDisabled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Videoya bax/ })));
    expect(screen.getByTestId('wordgarden-game')).toHaveAttribute('data-game-phase', 'lost');
    fixture.earned = true;
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Videoya bax/ })));
    expect(screen.getByTestId('wordgarden-game')).toHaveAttribute('data-game-phase', 'playing');
    expect(JSON.parse(localStorage.getItem(gardenStorageKey('az', definition.revision, 'timed'))!).round.remainingSeconds).toBe(15);
  });
  it('does not load or show Azerbaijani puzzles for another app language', () => {
    fixture.language = 'en'; render(<WordGarden onBack={vi.fn()} />);
    expect(screen.queryByTestId('wordgarden-screen')).toBeNull();
    expect(screen.queryByTestId('wordgarden-wheel')).toBeNull();
  });
  it('debits elapsed time only while playing, pauses for settings and latches a background pause', async () => {
    render(<WordGarden onBack={vi.fn()} />); fireEvent.click(screen.getByRole('button', { name: 'Vaxtlı' })); await start();
    const revision = 'az-202610-v2', key = gardenStorageKey('az', revision, 'timed');
    const remaining = () => JSON.parse(localStorage.getItem(key)!).round.remainingSeconds;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
    // Restart the timer effect after switching into a modal and back so it uses
    // the same monotonic clock as this controlled browser timer.
    fireEvent.click(screen.getByRole('button', { name: 'Oyun parametrləri' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bağla' }));
    const first = remaining();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(remaining()).toBe(first - 2);
    fireEvent.click(screen.getByRole('button', { name: 'Oyun parametrləri' }));
    const paused = remaining();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(remaining()).toBe(paused);
    fireEvent.click(screen.getByRole('button', { name: 'Bağla' }));
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByTestId('wordgarden-game')).toHaveAttribute('data-game-phase', 'paused');
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(remaining()).toBe(paused);
    hidden.mockRestore();
  });
  it('recovers from a malformed saved round without resetting valid aggregate progress', async () => {
    const definition = generateGardenLevel(await loadGardenLexicon('az'), 1);
    const profile = createGardenProfile('az', definition.revision, 'calm');
    localStorage.setItem(gardenStorageKey('az', definition.revision, 'calm'), JSON.stringify({ ...profile, round: { found: [] } }));
    render(<WordGarden onBack={vi.fn()} />); await start();
    expect(screen.getByRole('button', { name: 'Ləçəklər' })).toHaveTextContent('75');
    expect(document.querySelectorAll('[data-garden-cell]')).toHaveLength(definition.cells.length);
  });
  it('waits for the player to start the short timer and makes expiry block input', async () => {
    render(<WordGarden onBack={vi.fn()} />); fireEvent.click(screen.getByRole('button', { name: 'Vaxtlı' }));
    fireEvent.click(screen.getByRole('button', { name: /Oyna/ })); await screen.findByTestId('wordgarden-wheel');
    const key = gardenStorageKey('az', 'az-202610-v2', 'timed');
    const remaining = () => JSON.parse(localStorage.getItem(key)!).round.remainingSeconds;
    expect(remaining()).toBeGreaterThanOrEqual(25); expect(remaining()).toBeLessThanOrEqual(35);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
    const initial = remaining();
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(remaining()).toBe(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Oyuna başla' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(initial * 1000); });
    expect(screen.getByTestId('wordgarden-game')).toHaveAttribute('data-game-phase', 'lost');
    expect(document.querySelector<HTMLButtonElement>('[data-letter-index]')).toBeDisabled();
  });
  it('finishes an old saved puzzle against its original library and then deals a new-revision level', async () => {
    const legacy = generateGardenLevel(await loadGardenLexicon('az', 'az-202610-v1'), 1);
    let profile = { ...createGardenProfile('az', legacy.revision, 'calm'), round: createGardenRound(legacy) };
    profile = { ...profile, progress: { ...profile.progress, coins: 140 } };
    localStorage.setItem(gardenStorageKey('az', legacy.revision, 'calm'), JSON.stringify(profile));
    render(<WordGarden onBack={vi.fn()} />); fireEvent.click(screen.getByRole('button', { name: /Oyuna davam et/ }));
    await screen.findByTestId('wordgarden-wheel');
    const key = gardenStorageKey('az', 'az-202610-v2', 'calm');
    expect(JSON.parse(localStorage.getItem(key)!).round.levelId).toBe(legacy.id);
    for (const entry of legacy.words) await word(entry.word);
    expect(await screen.findByRole('heading', { name: 'Bağın çiçəkləndi!' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Növbəti səviyyə' })); await screen.findByRole('heading', { name: 'Səviyyə 2' });
    await waitFor(() => expect(JSON.parse(localStorage.getItem(key)!).round.levelId).toContain('az:az-202610-v2:calm:2:'));
    expect(JSON.parse(localStorage.getItem(key)!).progress.coins).toBe(190);
    expect(localStorage.getItem(gardenStorageKey('az', legacy.revision, 'calm'))).toBe(JSON.stringify(profile));
  });
  it('highlights a selected answer without revealing letters or spending a hint', async () => {
    render(<WordGarden onBack={vi.fn()} />); await start();
    const before = [...document.querySelectorAll('[data-garden-cell][data-revealed="true"]')].length;
    fireEvent.click(screen.getByRole('button', { name: /1 nömrəli söz/ }));
    expect(document.querySelectorAll('.wg-cell.is-focused').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-garden-cell][data-revealed="true"]').length).toBe(before);
    expect(screen.getByRole('button', { name: 'Ləçəklər' })).toHaveTextContent('75');
  });
});
describe('Word Garden letter input', () => {
  const t = (key: Parameters<typeof gardenText>[1], values = {}) => gardenText('az', key, values);
  it('supports duplicate letters, backtracking, keyboard entry and avoids duplicate submits', () => {
    expect(selectWheelLetter([0, 1, 2], 1)).toEqual([0, 1]);
    expect(selectWheelLetter([0, 1, 2], 0)).toEqual([0, 1, 2]);
    const submit = vi.fn();
    render(<LetterWheel letters={['a', 'l', 'm', 'a']} locale="az-AZ" t={t} resetKey="first" disabled={false} onPick={vi.fn()} onSubmit={submit} onShuffle={vi.fn()} />);
    for (const key of 'alma') fireEvent.keyDown(window, { key });
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(submit).toHaveBeenCalledExactlyOnceWith('alma');
  });
});

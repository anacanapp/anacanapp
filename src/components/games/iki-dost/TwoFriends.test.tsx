import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TwoFriends from './TwoFriends';
import { friendsLevel } from './levels';
import { createFriendsProfile, createFriendsRound, FRIENDS_STORAGE_KEY, writeFriendsProfile } from './state';
import { FRIEND_DIRECTIONS, type FriendDirection } from './model';
import { initialFriendsState, moveFriends, friendsStateKey } from './engine';

const fixture = vi.hoisted(() => ({ language: 'az', transition: vi.fn() }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: (state: { language: string }) => unknown) => selector({ language: fixture.language }) }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ trackEvent: vi.fn(), useScreenAnalytics: vi.fn() }));
vi.mock('@/lib/native', () => ({ hapticFeedback: { light: async () => {}, medium: async () => {} } }));
vi.mock('@/lib/backButton', () => ({ pushBackHandler: () => () => {} }));
vi.mock('@/hooks/useGameAds', () => ({ useGameAds: () => ({ waiting: false, allowedPlacements: '', resetRound: vi.fn(), transition: async (callback: () => void) => { fixture.transition(); callback(); } }) }));
beforeEach(() => { localStorage.clear(); fixture.language = 'az'; fixture.transition.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
const start = () => fireEvent.click(screen.getByRole('button', { name: /Oyna/ }));
async function move(direction: string) {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 140)); });
  fireEvent.click(document.querySelector<HTMLButtonElement>(`[data-friends-direction="${direction}"]`)!);
}
describe('Two Friends player', () => {
  it('wins with a single shared controller and counts the rescue once under StrictMode', async () => {
    render(<StrictMode><TwoFriends onBack={vi.fn()} /></StrictMode>); start();
    for (const direction of friendsLevel(1).solution) await move(direction);
    expect(await screen.findByRole('heading', { name: 'İki dost da evdədir!' })).toBeVisible();
    const saved = JSON.parse(localStorage.getItem(FRIENDS_STORAGE_KEY)!);
    expect(saved.progress.unlocked).toBe(2); expect(saved.progress.totalRescues).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Növbəti səviyyə' }));
    expect(screen.getByRole('heading', { name: 'Səviyyə 2' })).toBeVisible();
    expect(fixture.transition).toHaveBeenCalledOnce();
  });
  it('resumes a saved path, undoes a shared move and blocks movement while paused', async () => {
    const view = render(<TwoFriends onBack={vi.fn()} />); start(); await move(friendsLevel(1).solution[0]);
    const before = JSON.parse(localStorage.getItem(FRIENDS_STORAGE_KEY)!).round.path;
    view.unmount(); render(<TwoFriends onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Davam et/ }));
    expect(JSON.parse(localStorage.getItem(FRIENDS_STORAGE_KEY)!).round.path).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: 'Fasilə' }));
    expect(document.querySelector('[data-friends-direction="right"]')).toBeDisabled();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(JSON.parse(localStorage.getItem(FRIENDS_STORAGE_KEY)!).round.path).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: 'Davam et' }));
    fireEvent.click(screen.getByRole('button', { name: 'Geri al' }));
    expect(JSON.parse(localStorage.getItem(FRIENDS_STORAGE_KEY)!).round.path).toEqual([]);
    expect(JSON.parse(localStorage.getItem(FRIENDS_STORAGE_KEY)!).round.moves).toBe(1);
  });
  it('gets an actual solver hint, persists settings and keeps future levels locked', async () => {
    render(<TwoFriends onBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Səviyyə 2' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Parametrlər' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Səslər' }));
    fireEvent.keyDown(window, { key: 'Escape' }); start();
    fireEvent.click(screen.getByRole('button', { name: /İpucu/ }));
    await waitFor(() => expect(document.querySelector('.tf-direction.is-hint')).toHaveAttribute('data-friends-direction', friendsLevel(1).solution[0]));
    expect(JSON.parse(localStorage.getItem(FRIENDS_STORAGE_KEY)!).round.hints).toBe(1);
    expect(screen.getByRole('button', { name: /Geri al/ })).toBeDisabled();
  });
  it('pauses when backgrounded and keeps Arabic UI with physical directions unchanged', async () => {
    fixture.language = 'ar'; render(<TwoFriends onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /العب/ }));
    expect(screen.getByTestId('two-friends-screen')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByTestId('friends-boards')).toHaveAttribute('dir', 'ltr');
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByTestId('two-friends-screen')).toHaveAttribute('data-game-phase', 'paused');
    expect(screen.getByRole('button', { name: 'يمين' })).toBeDisabled(); hidden.mockRestore();
  });
  it('offers an undo after a river mistake without clearing the current journey', async () => {
    const level = friendsLevel(40), profile = createFriendsProfile();
    const queue: { state: ReturnType<typeof initialFriendsState>; path: FriendDirection[] }[] = [{ state: initialFriendsState(level), path: [] }];
    const seen = new Set<string>(), lostPath: FriendDirection[] = [];
    for (let index = 0; index < queue.length && !lostPath.length; index++) {
      for (const direction of FRIEND_DIRECTIONS) {
        const current = queue[index], move = moveFriends(level, current.state, direction);
        if (move.lost) { lostPath.push(...current.path, direction); break; }
        const key = friendsStateKey(move.state); if (!move.changed || seen.has(key)) continue;
        seen.add(key); queue.push({ state: move.state, path: [...current.path, direction] });
      }
    }
    expect(lostPath.length).toBeGreaterThan(0);
    profile.progress.unlocked = 40; profile.round = { ...createFriendsRound(40), path: lostPath.slice(0, -1), moves: lostPath.length - 1 }; writeFriendsProfile(profile);
    render(<TwoFriends onBack={vi.fn()} />); fireEvent.click(screen.getByRole('button', { name: /Davam et/ }));
    await move(lostPath.at(-1)!);
    expect(await screen.findByRole('heading', { name: 'Bir dost çaya düşdü' })).toBeVisible();
    fireEvent.click(screen.getAllByRole('button', { name: 'Geri al' }).at(-1)!);
    expect(screen.getByTestId('two-friends-screen')).toHaveAttribute('data-game-phase', 'playing');
    expect(JSON.parse(localStorage.getItem(FRIENDS_STORAGE_KEY)!).progress.unlocked).toBe(40);
    expect(JSON.parse(localStorage.getItem(FRIENDS_STORAGE_KEY)!).round.path).toEqual(lostPath.slice(0, -1));
  });
});

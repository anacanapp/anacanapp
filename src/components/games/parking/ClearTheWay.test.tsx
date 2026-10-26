import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClearTheWay from './ClearTheWay';
import { parkingLevel } from './levels';
import { casualStorageKey } from '../casual/storage';
import { PARKING_ID, PARKING_REVISION } from './model';

vi.mock('@/store/userStore', () => ({ useUserStore: (selector: (value: { language: string }) => unknown) => selector({ language: 'az' }) }));
vi.mock('@/lib/native', () => ({ hapticFeedback: { light: async () => {}, medium: async () => {} } }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: vi.fn(), trackEvent: vi.fn() }));
vi.mock('@/lib/backButton', () => ({ pushBackHandler: () => () => {} }));
vi.mock('@/hooks/useGameAds', () => ({ useGameAds: () => ({ waiting: false, resetRound: vi.fn(), allowedPlacements: '', transition: async (callback: () => void) => callback() }) }));
beforeEach(() => localStorage.clear()); afterEach(cleanup);
const key = casualStorageKey(PARKING_ID, PARKING_REVISION);
function start() { fireEvent.click(screen.getByRole('button', { name: /Oyna/ })); }
function shift(car: number, to: number) {
  const button = document.querySelector<HTMLButtonElement>(`[data-parking-car="${car}"]`)!;
  fireEvent.click(button, { detail: 0 });
  const level = parkingLevel(1), axis = level.cars[car].axis;
  while (Number(button.dataset.carPosition) !== to && to !== 6) {
    const from = Number(button.dataset.carPosition), code = axis === 'h' ? to > from ? 'ArrowRight' : 'ArrowLeft' : to > from ? 'ArrowDown' : 'ArrowUp';
    fireEvent.keyDown(window, { key: code });
  }
  if (to === 6) fireEvent.click(screen.getByRole('button', { name: 'Çıxış' }));
}
describe('Qucaq parking player', () => {
  it('solves the actual first layout, records one result and opens the next level', async () => {
    render(<StrictMode><ClearTheWay onBack={vi.fn()} /></StrictMode>); start();
    expect(screen.getByRole('button', { name: 'Çıxış' })).toBeDisabled();
    for (const move of parkingLevel(1).solution) shift(move.car, move.to);
    expect(await screen.findByRole('heading', { name: 'Qucaq yola çıxdı!' })).toBeVisible();
    const saved = JSON.parse(localStorage.getItem(key)!);
    expect(saved.unlocked).toBe(2); expect(saved.round).toBeNull(); expect(Object.keys(saved.levels)).toEqual(['1']);
    fireEvent.click(screen.getByRole('button', { name: 'Növbəti səviyyə' })); expect(screen.getByRole('heading', { name: 'Səviyyə 2' })).toBeVisible();
  });
  it('gets a real solver hint, preserves a moved car on reopen and undo does not reset hint statistics', async () => {
    const view = render(<ClearTheWay onBack={vi.fn()} />); start();
    fireEvent.click(screen.getByRole('button', { name: /İpucu/ }));
    await waitFor(() => expect(document.querySelector('.parking-car.is-hint')).not.toBeNull());
    const first = parkingLevel(1).solution[0]; shift(first.car, first.to);
    const saved = JSON.parse(localStorage.getItem(key)!).round;
    view.unmount(); render(<ClearTheWay onBack={vi.fn()} />); fireEvent.click(screen.getByRole('button', { name: /Davam et/ }));
    expect(JSON.parse(localStorage.getItem(key)!).round).toEqual(saved);
    fireEvent.click(screen.getByRole('button', { name: 'Geri al' }));
    const undone = JSON.parse(localStorage.getItem(key)!).round; expect(undone.path.length).toBe(saved.path.length - 1); expect(undone.hints).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Fasilə' })); expect(document.querySelector('[data-parking-car="0"]')).toBeDisabled();
  });
});

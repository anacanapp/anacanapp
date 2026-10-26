import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LeafFlight from './LeafFlight';
import { casualStorageKey } from '../casual/storage';
import { LEAF_FLIGHT_ID, LEAF_FLIGHT_REVISION } from './model';

const fixture = vi.hoisted(() => ({ language: 'az' }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: (value: { language: string }) => unknown) => selector({ language: fixture.language }) }));
vi.mock('@/lib/native', () => ({ hapticFeedback: { light: async () => {}, medium: async () => {} } }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: vi.fn(), trackEvent: vi.fn() }));
vi.mock('@/lib/backButton', () => ({ pushBackHandler: () => () => {} }));
vi.mock('@/hooks/useGameAds', () => ({ useGameAds: () => ({ waiting: false, resetRound: vi.fn(), allowedPlacements: '', transition: async (callback: () => void) => callback() }) }));
vi.mock('./FlightCanvas', () => ({ default: () => <div data-testid="flight-canvas" /> }));
let now = 0, sequence = 0, callbacks = new Map<number, FrameRequestCallback>();
beforeEach(() => {
  localStorage.clear(); fixture.language = 'az'; now = 0; sequence = 0; callbacks = new Map();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number; isPrimary: boolean;
    constructor(type: string, options: PointerEventInit = {}) { super(type, options); this.pointerId = options.pointerId || 0; this.isPrimary = options.isPrimary !== false; }
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.set(++sequence, callback); return sequence; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function frames(count: number) {
  for (let n = 0; n < count; n++) await act(async () => { now += 1000 / 60; const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(now)); });
}
const key = casualStorageKey(LEAF_FLIGHT_ID, LEAF_FLIGHT_REVISION);
function start() { fireEvent.click(screen.getByRole('button', { name: /Oyna/ })); fireEvent.click(screen.getByRole('dialog').querySelector<HTMLButtonElement>('[data-autofocus]')!); }
describe('Tumurcuq flight input and saving', () => {
  it('starts only on Play, releases a cancelled touch and saves the live position on pause', async () => {
    render(<StrictMode><LeafFlight onBack={vi.fn()} /></StrictMode>);
    fireEvent.click(screen.getByRole('button', { name: /Oyna/ }));
    await frames(30); expect(JSON.parse(localStorage.getItem(key)!).round.distance).toBe(0);
    fireEvent.click(screen.getByRole('dialog').querySelector<HTMLButtonElement>('[data-autofocus]')!);
    const hold = screen.getByRole('button', { name: 'Yüksəl' });
    fireEvent.pointerDown(hold, { pointerId: 1, button: 0 });
    expect(hold).toHaveAttribute('aria-pressed', 'true'); await frames(35);
    fireEvent.pointerCancel(hold, { pointerId: 1 }); expect(hold).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Fasilə' }));
    const paused = JSON.parse(localStorage.getItem(key)!).round;
    expect(paused.y).toBeLessThan(360); expect(paused.distance).toBeGreaterThan(0);
    await frames(120); expect(JSON.parse(localStorage.getItem(key)!).round).toEqual(paused);
  });
  it('background-pauses a keyboard hold and restores a half-played flight after remount', async () => {
    const view = render(<LeafFlight onBack={vi.fn()} />); start();
    fireEvent.keyDown(window, { key: 'ArrowUp' }); await frames(25);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByTestId('leaf-flight-screen')).toHaveAttribute('data-game-phase', 'paused');
    const saved = JSON.parse(localStorage.getItem(key)!).round; hidden.mockRestore();
    view.unmount(); render(<LeafFlight onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Davam et/ }));
    expect(JSON.parse(localStorage.getItem(key)!).round).toEqual(saved);
    expect(screen.getByRole('button', { name: 'Yüksəl' })).toBeDisabled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

const native = vi.hoisted(() => ({ listener: null as null | (() => void), exitApp: vi.fn(), toast: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } }));
vi.mock('@capacitor/app', () => ({ App: {
  addListener: (_event: string, cb: () => void) => { native.listener = cb; return Promise.resolve({ remove: vi.fn() }); },
  exitApp: native.exitApp } }));
vi.mock('sonner', () => ({ toast: native.toast }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));

import { __resetBackHandlersForTests, dispatchBack, initBackButtonHandler, pushBackHandler } from './backButton';
import { useOverlayBackHandler } from '@/hooks/useOverlayBackHandler';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

beforeEach(() => { __resetBackHandlersForTests(); native.exitApp.mockReset(); native.toast.mockReset(); });
afterEach(() => { __resetBackHandlersForTests(); });

describe('back handler stack', () => {
  it('asks overlays before screens and screens before root, regardless of registration order', () => {
    const calls: string[] = [];
    pushBackHandler(() => { calls.push('root'); return true; }, 'root');
    const releaseOverlay = pushBackHandler(() => { calls.push('overlay'); return true; }, 'overlay');
    pushBackHandler(() => { calls.push('screen'); return true; });
    expect(dispatchBack()).toBe(true);
    releaseOverlay();
    expect(dispatchBack()).toBe(true);
    expect(calls).toEqual(['overlay', 'screen']);
  });

  it('closes the top-most overlay first (last opened wins)', () => {
    const closed: string[] = [];
    const releaseA = pushBackHandler(() => { closed.push('a'); return true; }, 'overlay');
    const releaseB = pushBackHandler(() => { closed.push('b'); return true; }, 'overlay');
    dispatchBack(); releaseB();
    dispatchBack(); releaseA();
    expect(closed).toEqual(['b', 'a']);
  });

  it('falls through handlers that decline and tolerates throwing handlers', () => {
    const screen = vi.fn(() => true);
    pushBackHandler(screen);
    pushBackHandler(() => { throw new Error('boom'); }, 'overlay');
    pushBackHandler(() => false, 'overlay');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(dispatchBack()).toBe(true);
    expect(screen).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('only exits the app on a second back within 2s when nothing consumes it', () => {
    initBackButtonHandler();
    expect(native.listener).toBeTypeOf('function');
    const overlay = vi.fn(() => true);
    const release = pushBackHandler(overlay, 'overlay');
    native.listener!();
    expect(overlay).toHaveBeenCalledOnce();
    expect(native.toast).not.toHaveBeenCalled();
    release();
    native.listener!();
    expect(native.toast).toHaveBeenCalledOnce();
    native.listener!();
    expect(native.exitApp).toHaveBeenCalledOnce();
  });
});

describe('overlay hooks', () => {
  function FormWithOverlay({ onScreenBack }: { onScreenBack: () => void }) {
    const [open, setOpen] = useState(true);
    const [text, setText] = useState('');
    useOverlayBackHandler(open, () => setOpen(false));
    // Screen-level handler registered after the overlay (e.g. re-registered on state change).
    pushBackHandlerOnce(onScreenBack);
    return <div><input aria-label="note" value={text} onChange={(e) => setText(e.target.value)} />{open && <p>overlay</p>}</div>;
  }
  let registered = false;
  function pushBackHandlerOnce(fn: () => void) { if (!registered) { registered = true; pushBackHandler(() => { fn(); return true; }); } }

  it('back closes the overlay only and keeps typed text; next back reaches the screen', () => {
    registered = false;
    const onScreenBack = vi.fn();
    render(<FormWithOverlay onScreenBack={onScreenBack} />);
    fireEvent.change(screen.getByLabelText('note'), { target: { value: 'typed' } });
    act(() => { dispatchBack(); });
    expect(screen.queryByText('overlay')).toBeNull();
    expect((screen.getByLabelText('note') as HTMLInputElement).value).toBe('typed');
    expect(onScreenBack).not.toHaveBeenCalled();
    act(() => { dispatchBack(); });
    expect(onScreenBack).toHaveBeenCalledOnce();
  });

  it('ui Dialog (controlled) closes via onOpenChange(false) on back', () => {
    const onOpenChange = vi.fn();
    render(<Dialog open onOpenChange={onOpenChange}><DialogContent aria-describedby={undefined}><DialogTitle>t</DialogTitle></DialogContent></Dialog>);
    act(() => { expect(dispatchBack()).toBe(true); });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('ui Dialog (uncontrolled) closes itself and unregisters', () => {
    render(<Dialog defaultOpen><DialogContent aria-describedby={undefined}><DialogTitle>Hello</DialogTitle></DialogContent></Dialog>);
    expect(screen.getByText('Hello')).toBeTruthy();
    act(() => { dispatchBack(); });
    expect(screen.queryByText('Hello')).toBeNull();
    expect(dispatchBack()).toBe(false);
  });

  it('closed dialogs do not register', () => {
    render(<Dialog open={false}><DialogContent aria-describedby={undefined}><DialogTitle>x</DialogTitle></DialogContent></Dialog>);
    expect(dispatchBack()).toBe(false);
  });
});

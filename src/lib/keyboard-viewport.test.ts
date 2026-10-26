import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installKeyboardViewport, isKeyboardEditable, revealKeyboardField } from './keyboard-viewport';

let uninstall: (() => void) | undefined;
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { uninstall?.(); uninstall = undefined; document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('recognizes editable controls without moving readonly, disabled or non-text fields', () => {
  const input = document.createElement('input'); input.type = 'email'; expect(isKeyboardEditable(input)).toBe(true);
  input.readOnly = true; expect(isKeyboardEditable(input)).toBe(false); input.readOnly = false; input.disabled = true; expect(isKeyboardEditable(input)).toBe(false);
  input.disabled = false; input.type = 'checkbox'; expect(isKeyboardEditable(input)).toBe(false);
  expect(isKeyboardEditable(document.createElement('textarea'))).toBe(true);
});
it('reveals a field clipped by a nested scroller even when it fits inside the outer viewport', () => {
  const scroller = document.createElement('div'), field = document.createElement('textarea'); scroller.style.overflowY = 'auto'; scroller.append(field); document.body.append(scroller);
  Object.defineProperty(scroller, 'scrollHeight', { value: 900 }); Object.defineProperty(scroller, 'clientHeight', { value: 200 });
  scroller.getBoundingClientRect = () => ({ top: 100, bottom: 300, height: 200 }) as DOMRect;
  field.getBoundingClientRect = () => ({ top: 350 - scroller.scrollTop, bottom: 400 - scroller.scrollTop, height: 50 }) as DOMRect;
  field.value = 'Typed text stays in the real field'; field.setSelectionRange(7, 7);
  revealKeyboardField(field, 0, 600);
  expect(scroller.scrollTop).toBe(116); expect(field.selectionStart).toBe(7); expect(field.value).toContain('real field'); expect(scroller.children).toHaveLength(1);
});
it('tracks iOS overlay and Android resized keyboards without double inset, then removes listeners', () => {
  const viewport = new EventTarget() as EventTarget & { height: number; offsetTop: number; scale: number };
  Object.assign(viewport, { height: 800, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport); vi.stubGlobal('innerHeight', 800);
  const input = document.createElement('input'); document.body.append(input); uninstall = installKeyboardViewport(); input.focus();
  viewport.height = 400; viewport.dispatchEvent(new Event('resize')); vi.advanceTimersByTime(350);
  expect(document.documentElement.dataset.keyboardOpen).toBe('true'); expect(document.documentElement.style.getPropertyValue('--app-keyboard-inset')).toBe('400px');
  vi.stubGlobal('innerHeight', 400); window.dispatchEvent(new Event('resize')); vi.advanceTimersByTime(50);
  expect(document.documentElement.style.getPropertyValue('--app-keyboard-inset')).toBe('0px'); expect(document.documentElement.dataset.keyboardOpen).toBe('true');
  uninstall(); uninstall = undefined; viewport.dispatchEvent(new Event('resize')); vi.advanceTimersByTime(350);
  expect(document.documentElement.dataset.keyboardOpen).toBeUndefined(); expect(document.documentElement.style.getPropertyValue('--app-visual-height')).toBe('');
  vi.unstubAllGlobals();
});

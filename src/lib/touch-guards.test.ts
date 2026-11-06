import { afterEach, expect, it } from 'vitest';
import { guardHoldSurface, installTouchGuards, releaseTextFocus } from './touch-guards';

let uninstall: (() => void) | undefined;
afterEach(() => { uninstall?.(); uninstall = undefined; document.body.replaceChildren(); document.body.classList.remove('native-app'); });
const cancelable = (type: string) => new Event(type, { bubbles: true, cancelable: true });

it('blurs a leftover text field when a game screen is mounted', async () => {
  uninstall = installTouchGuards();
  const input = document.createElement('input'); document.body.append(input); input.focus();
  expect(document.activeElement).toBe(input);
  const game = document.createElement('div'); game.className = 'cg-screen'; document.body.append(game);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.activeElement).not.toBe(input);
});
it('prevents copy menus and selection inside games, keeps them in text fields and articles', () => {
  uninstall = installTouchGuards(); document.body.classList.add('native-app');
  const game = document.createElement('div'); game.dataset.gamePhase = 'playing'; const stage = document.createElement('div'); game.append(stage);
  const article = document.createElement('div'); article.className = 'prose'; const text = document.createElement('p'); article.append(text);
  const field = document.createElement('textarea'), image = document.createElement('img');
  document.body.append(game, article, field, image);
  for (const type of ['contextmenu', 'selectstart', 'dragstart']) { const event = cancelable(type); stage.dispatchEvent(event); expect(event.defaultPrevented).toBe(true); }
  const menu = cancelable('contextmenu'); image.dispatchEvent(menu); expect(menu.defaultPrevented).toBe(true);
  for (const target of [text, field]) { const event = cancelable('contextmenu'); target.dispatchEvent(event); expect(event.defaultPrevented).toBe(false); }
});
it('cancels touchstart only on hold surfaces and releases text focus', () => {
  const root = document.createElement('div'), stage = document.createElement('div'), menu = document.createElement('button');
  stage.className = 'flight-stage'; root.append(stage, menu); document.body.append(root);
  const cleanup = guardHoldSurface(root, '.flight-stage');
  const held = cancelable('touchstart'); stage.dispatchEvent(held); expect(held.defaultPrevented).toBe(true);
  const tap = cancelable('touchstart'); menu.dispatchEvent(tap); expect(tap.defaultPrevented).toBe(false);
  cleanup(); const after = cancelable('touchstart'); stage.dispatchEvent(after); expect(after.defaultPrevented).toBe(false);
  const input = document.createElement('input'); document.body.append(input); input.focus(); releaseTextFocus(); expect(document.activeElement).not.toBe(input);
});

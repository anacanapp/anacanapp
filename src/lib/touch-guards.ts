/** Native-feel touch guards: no text selection, copy/look-up callouts, image
 * save menus, drag ghosts or QuickType/AutoFill bars on game and control
 * surfaces. Text fields and readable content keep the OS behaviour. */

/** Every mini-game root (casual games, Two Friends, Word Garden, Color Sort and
 * the Tailwind games that only expose `data-game-phase`). */
export const GAME_SCREEN_SELECTOR = '.cg-screen,.tf-screen,.wg-screen,.colorsort-screen,[data-game-phase]';
const EDITABLE_SELECTOR = 'input,textarea,select,[contenteditable]:not([contenteditable="false"])';
const SELECTABLE_SELECTOR = `${EDITABLE_SELECTOR},.prose,[data-selectable]`;
const CONTROL_SELECTOR = 'img,svg,video,canvas,button,a,[role="button"]';

function elementOf(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  return target instanceof Node ? target.parentElement : null;
}
export function isInGameScreen(target: EventTarget | null): boolean {
  return !!elementOf(target)?.closest(GAME_SCREEN_SELECTOR);
}

/** Closes the iOS keyboard / QuickType / AutoFill bar left over from a field on
 * the previous screen and drops any stray selection, so a press-and-hold in a
 * game cannot show "Paste / AutoFill / Copy". */
export function releaseTextFocus(): void {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body && active.matches(EDITABLE_SELECTOR)) active.blur();
  try {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) selection.removeAllRanges();
  } catch { /* Selection API is optional. */ }
}

/** Press-and-hold play surfaces: a non-passive touchstart is the only thing that
 * reliably stops the iOS long-press loupe/edit menu. Pointer events (the game
 * input) are still delivered; only compatibility mouse/click events are dropped,
 * so `surfaces` must not contain elements that rely on onClick. */
export function guardHoldSurface(root: HTMLElement | null, surfaces: string): () => void {
  if (!root) return () => {};
  const touchstart = (event: TouchEvent) => {
    if (event.cancelable && elementOf(event.target)?.closest(surfaces)) event.preventDefault();
  };
  root.addEventListener('touchstart', touchstart, { passive: false });
  return () => root.removeEventListener('touchstart', touchstart);
}

let installed = false;
/** Installs once, app-wide. Only non-scrolling events are listened to at the
 * document level, so scrolling performance is not affected. */
export function installTouchGuards(): () => void {
  if (installed || typeof document === 'undefined') return () => {};
  installed = true;
  const native = () => document.body?.classList.contains('native-app') ?? false;
  const contextmenu = (event: Event) => {
    const element = elementOf(event.target);
    if (!element || element.closest(EDITABLE_SELECTOR)) return;
    if (element.closest(GAME_SCREEN_SELECTOR)) { event.preventDefault(); return; }
    // Long-press on an image, icon or button must not offer "Save / Copy / Open".
    // Components with their own long-press menu still receive the event.
    if (native() && element.closest(CONTROL_SELECTOR) && !element.closest('.prose,[data-selectable]')) event.preventDefault();
  };
  const selectstart = (event: Event) => {
    const element = elementOf(event.target);
    if (element?.closest(GAME_SCREEN_SELECTOR) && !element.closest(SELECTABLE_SELECTOR)) event.preventDefault();
  };
  const dragstart = (event: Event) => {
    const element = elementOf(event.target);
    if (!element || element.closest(EDITABLE_SELECTOR) || element.closest('[draggable="true"]')) return;
    if (element.closest(GAME_SCREEN_SELECTOR) || (native() && element.closest('img,svg,a'))) event.preventDefault();
  };
  document.addEventListener('contextmenu', contextmenu, true);
  document.addEventListener('selectstart', selectstart, true);
  document.addEventListener('dragstart', dragstart, true);
  // Games are portalled into <body>; only its direct children are watched.
  const observer = typeof MutationObserver === 'function' ? new MutationObserver(records => {
    for (const record of records) for (const node of Array.from(record.addedNodes)) {
      if (node instanceof Element && (node.matches(GAME_SCREEN_SELECTOR) || node.querySelector(GAME_SCREEN_SELECTOR))) { releaseTextFocus(); return; }
    }
  }) : null;
  if (document.body) observer?.observe(document.body, { childList: true });
  return () => {
    installed = false; observer?.disconnect();
    document.removeEventListener('contextmenu', contextmenu, true);
    document.removeEventListener('selectstart', selectstart, true);
    document.removeEventListener('dragstart', dragstart, true);
  };
}

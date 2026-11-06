const EDITABLE_TYPES = new Set(['text','search','email','url','tel','password','number','date','datetime-local','month','time','week']);
export function isKeyboardEditable(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly;
  if (element instanceof HTMLInputElement) return !element.disabled && !element.readOnly && EDITABLE_TYPES.has(element.type);
  return element.isContentEditable;
}
export function revealKeyboardField(element: HTMLElement, top: number, height: number): void {
  const margin = 16, bottom = top + height - margin;
  let parent: HTMLElement | null = element.parentElement;
  while (parent) {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(parent);
    if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight) {
      const parentBox = parent.getBoundingClientRect();
      const availableTop = Math.max(top + margin, parentBox.top + margin);
      const availableBottom = Math.min(bottom, parentBox.bottom - margin);
      if (availableBottom <= availableTop || box.top >= availableTop && box.bottom <= availableBottom) { parent = parent.parentElement; continue; }
      const delta = box.height > availableBottom - availableTop ? box.top - availableTop
        : box.bottom > availableBottom ? box.bottom - availableBottom : box.top - availableTop;
      if (Math.abs(delta) > 1) parent.scrollTop += delta;
    }
    parent = parent.parentElement;
  }
  const box = element.getBoundingClientRect();
  // A field that fits is centred (it stays clear of the QuickType/suggestion bar);
  // a textarea taller than the visible area only scrolls to its nearest edge.
  if (box.bottom > bottom || box.top < top + margin) element.scrollIntoView?.({ block: box.height < bottom - top - margin ? 'center' : 'nearest', inline: 'nearest', behavior: 'auto' });
}

/** Fixed layers that already follow the visual viewport themselves. */
const SELF_MANAGED = '[data-keyboard-surface],[data-app-viewport],[data-vaul-drawer],[vaul-drawer],[data-radix-popper-content-wrapper],[data-keyboard-ignore]';
type LiftMode = 'fill' | 'bottom';
/** Finds the position:fixed overlays/bars around a focused field that iOS leaves
 * under the keyboard (its layout viewport does not shrink). Full-screen layers are
 * resized to the visible area, bottom-anchored bars/sheets sit on the keyboard.
 * Android resizes the WebView, so nothing is occluded and nothing is returned. */
export function keyboardLiftTargets(element: HTMLElement, top: number, height: number, layoutHeight: number): Map<HTMLElement, LiftMode> {
  const targets = new Map<HTMLElement, LiftMode>();
  const visibleBottom = top + height;
  for (let node: HTMLElement | null = element.parentElement; node && node !== document.body; node = node.parentElement) {
    if (node.matches(SELF_MANAGED)) break;
    if (getComputedStyle(node).position !== 'fixed') continue;
    const mode = node.dataset.keyboardLifted as LiftMode | undefined;
    if (mode) { targets.set(node, mode); continue; }
    const box = node.getBoundingClientRect();
    // Only layers anchored to the layout viewport's bottom edge are occluded.
    if (box.bottom <= visibleBottom + 1 || Math.abs(box.bottom - layoutHeight) > 2) continue;
    targets.set(node, box.top <= 1 ? 'fill' : 'bottom');
  }
  return targets;
}

/** One viewport/focus handler for every form, dialog and rich-text editor. The
 * real field is scrolled, never cloned or moved outside its form. Chat and
 * onboarding already size their own viewports and are not translated twice. */
export function installKeyboardViewport(): () => void {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let baseline = window.innerHeight, frame = 0;
  const delayed = new Set<ReturnType<typeof setTimeout>>();
  const lifted = new Set<HTMLElement>();
  const lift = (next: Map<HTMLElement, LiftMode>, focused: Element | null) => {
    for (const node of lifted) {
      const kept = next.has(node);
      if (!kept) { delete node.dataset.keyboardLifted; lifted.delete(node); }
      for (const child of Array.from(node.children)) if (child instanceof HTMLElement && (!kept || !child.contains(focused))) delete child.dataset.keyboardLiftedChild;
    }
    for (const [node, mode] of next) {
      if (node.dataset.keyboardLifted !== mode) node.dataset.keyboardLifted = mode;
      lifted.add(node);
      if (mode !== 'fill' || /(auto|scroll)/.test(getComputedStyle(node).overflowY)) continue;
      const child = Array.from(node.children).find(item => item.contains(focused));
      if (child instanceof HTMLElement) child.dataset.keyboardLiftedChild = 'true';
    }
  };
  const update = () => {
    frame = 0;
    const focused = document.activeElement;
    const editable = isKeyboardEditable(focused);
    const height = viewport?.height || window.innerHeight;
    const top = viewport?.offsetTop || 0;
    if (!editable) baseline = Math.max(baseline, window.innerHeight);
    // Android can resize the layout viewport, while iOS often leaves it intact.
    // Only the occluded part of the current layout may lift a bottom sheet.
    const inset = Math.max(0, window.innerHeight - height - top);
    const keyboardVisible = baseline - height * (viewport?.scale || 1) > 80;
    root.style.setProperty('--app-visual-height', `${height}px`);
    root.style.setProperty('--app-visual-top', `${top}px`);
    root.style.setProperty('--app-keyboard-inset', `${inset}px`);
    root.dataset.keyboardOpen = editable && keyboardVisible ? 'true' : 'false';
    // Lift occluded fixed overlays first, then scroll the field inside them.
    lift(editable && keyboardVisible && inset > 0 ? keyboardLiftTargets(focused, top, height, window.innerHeight) : new Map(), focused);
    if (editable) revealKeyboardField(focused, top, height);
  };
  const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
  const focus = () => {
    queue();
    for (const ms of [80, 300]) { const timer = setTimeout(() => { delayed.delete(timer); queue(); }, ms); delayed.add(timer); }
  };
  const orientation = () => { baseline = window.innerHeight; queue(); };
  document.addEventListener('focusin', focus); document.addEventListener('focusout', queue);
  document.addEventListener('input', queue); window.addEventListener('resize', queue); window.addEventListener('orientationchange', orientation);
  viewport?.addEventListener('resize', queue); viewport?.addEventListener('scroll', queue); update();
  return () => {
    cancelAnimationFrame(frame); delayed.forEach(clearTimeout);
    document.removeEventListener('focusin', focus); document.removeEventListener('focusout', queue); document.removeEventListener('input', queue);
    window.removeEventListener('resize', queue); window.removeEventListener('orientationchange', orientation);
    viewport?.removeEventListener('resize', queue); viewport?.removeEventListener('scroll', queue);
    lift(new Map(), null); delete root.dataset.keyboardOpen;
    for (const key of ['--app-visual-height','--app-visual-top','--app-keyboard-inset']) root.style.removeProperty(key);
  };
}

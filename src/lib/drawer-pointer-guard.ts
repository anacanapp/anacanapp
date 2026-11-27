import { useCallback, useRef, type ForwardedRef } from 'react';

/**
 * vaul 0.9.x Drawer.Content ends a drag on `pointerout` / `contextmenu` with the LAST pointermove event it
 * saw. When the pointer leaves (or a long press opens the context menu) before any pointermove reached the
 * drawer, that event is null and vaul reads `null.target`, crashing the screen
 * ("TypeError: null is not an object (evaluating 'fe.target')" from onPointerOut).
 *
 * Without a pointermove there is no drag to end, so those events are stopped at the drawer node before
 * React's root listener dispatches them to vaul. pointerup / pointercancel still end every gesture.
 */
export function guardDrawerPointerOut(node: HTMLElement): () => void {
  let moved = false;
  const onDown = () => { moved = false; };
  const onMove = () => { moved = true; };
  const onOutOrMenu = (event: Event) => { if (!moved) event.stopPropagation(); };
  node.addEventListener('pointerdown', onDown, true);
  node.addEventListener('pointermove', onMove, true);
  node.addEventListener('pointerout', onOutOrMenu);
  node.addEventListener('contextmenu', onOutOrMenu);
  return () => {
    node.removeEventListener('pointerdown', onDown, true);
    node.removeEventListener('pointermove', onMove, true);
    node.removeEventListener('pointerout', onOutOrMenu);
    node.removeEventListener('contextmenu', onOutOrMenu);
  };
}

/** Callback ref for a vaul Drawer.Content that installs the guard and forwards the node to `forwarded`. */
export function useDrawerPointerGuard<T extends HTMLElement>(forwarded?: ForwardedRef<T>) {
  const cleanup = useRef<(() => void) | null>(null);
  return useCallback((node: T | null) => {
    cleanup.current?.();
    cleanup.current = node ? guardDrawerPointerOut(node) : null;
    if (typeof forwarded === 'function') forwarded(node);
    else if (forwarded) forwarded.current = node;
  }, [forwarded]);
}

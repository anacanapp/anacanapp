import { describe, expect, it, vi } from 'vitest';
import { guardDrawerPointerOut } from './drawer-pointer-guard';

const pointer = (type: string) => new Event(type, { bubbles: true });

describe('guardDrawerPointerOut', () => {
  it('stops pointerout/contextmenu before any pointermove (vaul null.target crash) and lets them through after a move', () => {
    const parent = document.createElement('div');
    const node = document.createElement('div');
    const child = document.createElement('span');
    node.appendChild(child); parent.appendChild(node); document.body.appendChild(parent);
    const seen = vi.fn();
    parent.addEventListener('pointerout', seen);
    parent.addEventListener('contextmenu', seen);
    const cleanup = guardDrawerPointerOut(node);

    child.dispatchEvent(pointer('pointerdown'));
    child.dispatchEvent(pointer('pointerout'));
    child.dispatchEvent(pointer('contextmenu'));
    expect(seen).not.toHaveBeenCalled();

    child.dispatchEvent(pointer('pointermove'));
    child.dispatchEvent(pointer('pointerout'));
    expect(seen).toHaveBeenCalledTimes(1);

    child.dispatchEvent(pointer('pointerdown'));
    child.dispatchEvent(pointer('pointerout'));
    expect(seen).toHaveBeenCalledTimes(1);

    cleanup();
    child.dispatchEvent(pointer('pointerout'));
    expect(seen).toHaveBeenCalledTimes(2);
    parent.remove();
  });
});

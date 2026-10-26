import { useLayoutEffect } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelScrollRestoration, clearScroll, restoreScroll, saveScroll } from './scrollMemory';
import { useScrollToTop } from '@/hooks/useScrollToTop';

const Reader = ({ id }: { id: string }) => {
  useLayoutEffect(() => { cancelScrollRestoration(); }, [id]);
  useScrollToTop([id]);
  return <article>{id}</article>;
};
let root: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(0), 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  root = document.createElement('div');
  root.setAttribute('data-scroll-container', '');
  document.body.appendChild(root);
});
afterEach(() => { cleanup(); root.remove(); cancelScrollRestoration(); clearScroll('blog'); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('blog reader scroll contract', () => {
  it('opens at the top and does not inherit a related article scroll position', () => {
    root.scrollTop = 760;
    const view = render(<Reader id="first" />, { container: root });
    expect(root.scrollTop).toBe(0);
    root.scrollTop = 940;
    view.rerender(<Reader id="related" />);
    expect(root.scrollTop).toBe(0);
  });

  it('cancels a pending list restore instead of jumping to the middle after opening a reader', () => {
    root.scrollTop = 640;
    saveScroll('blog', root);
    root.scrollTop = 0;
    restoreScroll('blog', root);
    render(<Reader id="new-post" />, { container: root });
    act(() => vi.advanceTimersByTime(250));
    expect(root.scrollTop).toBe(0);
  });

  it('still restores the previous list position when actually returning to the list', () => {
    root.scrollTop = 640;
    saveScroll('blog', root);
    root.scrollTop = 0;
    restoreScroll('blog', root);
    act(() => vi.advanceTimersByTime(250));
    expect(root.scrollTop).toBe(640);
  });
});

import { DependencyList, useLayoutEffect } from 'react';
import { resetAppScrollPosition } from '@/lib/scroll';

/**
 * Hook that scrolls to top on mount or when provided dependencies change.
 */
export const useScrollToTop = (deps: DependencyList = []) => {
  useLayoutEffect(() => {
    resetAppScrollPosition();

    const rafId = requestAnimationFrame(() => {
      resetAppScrollPosition();
    });

    const timeoutId = window.setTimeout(() => {
      resetAppScrollPosition();
    }, 60);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, deps);
};

export default useScrollToTop;

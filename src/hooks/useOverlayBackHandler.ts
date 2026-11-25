import { useCallback, useEffect, useRef, useState } from 'react';
import { pushBackHandler } from '@/lib/backButton';

/**
 * While `open`, Android hardware back closes this overlay first (overlay layer of
 * the back stack). `close` is read through a ref so re-renders (e.g. typing in a
 * form inside the overlay) never re-order the stack.
 * Pass `close = null` to swallow back without closing (non-dismissible overlays).
 */
export function useOverlayBackHandler(open: boolean, close: (() => void) | null): void {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return undefined;
    return pushBackHandler(() => {
      closeRef.current?.();
      return true;
    }, 'overlay');
  }, [open]);
}

interface RootOpenProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Makes a Radix/vaul Root back-aware for both controlled and uncontrolled use:
 * tracks the effective open state and closes through the same onOpenChange path
 * the close button / Escape use.
 */
export function useBackClosableRoot<P extends RootOpenProps>(props: P, dismissible = true): P {
  const { open, defaultOpen, onOpenChange } = props;
  const controlled = open !== undefined;
  const [inner, setInner] = useState(defaultOpen ?? false);
  const effective = controlled ? open : inner;
  const changeRef = useRef(onOpenChange);
  changeRef.current = onOpenChange;
  const handleOpenChange = useCallback((next: boolean) => {
    if (!controlled) setInner(next);
    changeRef.current?.(next);
  }, [controlled]);
  useOverlayBackHandler(effective, dismissible ? () => handleOpenChange(false) : null);
  return { ...props, open: effective, onOpenChange: handleOpenChange };
}

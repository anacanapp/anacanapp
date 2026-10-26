import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { pushBackHandler } from '@/lib/backButton';

export default function GardenDialog({ title, closeLabel, onClose, children, className = '', allowedPlacements = '' }: {
  title: string; closeLabel: string; onClose: () => void; children: ReactNode; className?: string; allowedPlacements?: string;
}) {
  const ref = useRef<HTMLDivElement>(null), close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const layer = ref.current;
    const shell = layer?.parentElement?.querySelector<HTMLElement>('.wg-shell');
    shell?.setAttribute('inert', '');
    const focusable = () => [...(layer?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,[tabindex="0"]') || [])];
    (layer?.querySelector<HTMLElement>('[data-autofocus]') || focusable()[0] || layer)?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      if (event.key === 'Tab') {
        const items = focusable(), first = items[0], last = items.at(-1);
        if (!items.length) { event.preventDefault(); layer?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === layer)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', keyboard, true);
    const release = pushBackHandler(() => { close.current(); return true; });
    return () => { release(); window.removeEventListener('keydown', keyboard, true); shell?.removeAttribute('inert'); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className={`wg-modal ${className}`} ref={ref} role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="wg-dialog-title"
    data-ad-block="true" data-ad-allow={allowedPlacements}>
    <div className="wg-modal-panel">
      <button type="button" className="wg-modal-close wg-icon" aria-label={closeLabel} onClick={onClose}><X size={18} /></button>
      <h2 id="wg-dialog-title">{title}</h2>{children}
    </div>
  </div>;
}

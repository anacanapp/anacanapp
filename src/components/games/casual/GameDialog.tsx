import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { pushBackHandler } from '@/lib/backButton';

export default function GameDialog({ title, closeLabel, onClose, children, allowedPlacements = '' }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode; allowedPlacements?: string }) {
  const layer = useRef<HTMLDivElement>(null), close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, shell = layer.current?.parentElement?.querySelector('.cg-shell');
    shell?.setAttribute('inert', '');
    const items = () => [...(layer.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]') || [])];
    (layer.current?.querySelector<HTMLElement>('[data-autofocus]') || items()[0])?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      if (event.key === 'Tab') { const first = items()[0], last = items().at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const release = pushBackHandler(() => { close.current(); return true; }); window.addEventListener('keydown', keyboard, true);
    return () => { release(); shell?.removeAttribute('inert'); window.removeEventListener('keydown', keyboard, true); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="cg-modal" ref={layer} role="dialog" aria-modal="true" aria-labelledby="cg-dialog-title" data-ad-block="true" data-ad-allow={allowedPlacements}>
    <div className="cg-modal-panel"><button type="button" className="cg-icon cg-modal-close" aria-label={closeLabel} onClick={onClose}><X size={19} /></button><h2 id="cg-dialog-title">{title}</h2>{children}</div>
  </div>;
}

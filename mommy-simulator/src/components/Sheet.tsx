import { useEffect, useRef } from 'react';
import { t } from '../game/i18n';
import type { Language } from '../game/types';
import { Icon } from './Icon';

export function Sheet({ title, subtitle, icon, onClose, language, children, wide = false, className = '' }: {
  title: string; subtitle?: string; icon: string; onClose(): void; language: Language; children: React.ReactNode; wide?: boolean; className?: string;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('button, input, select')?.focus({ preventScroll: true });
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const elements = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, a[href], [tabindex="0"]') ?? [])].filter(e => e.offsetParent !== null);
        if (!elements.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus({ preventScroll: true }); };
  }, [onClose]);

  return <div className={`sheet-backdrop ${wide ? 'wide' : ''} ${className}`} onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="sheet" ref={dialog} role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-grip" /><header className="sheet-header"><div className="sheet-title"><span className="sheet-title-icon"><Icon name={icon} size={23} /></span><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div><button className="icon-button" onClick={onClose} aria-label={t('close', language)} data-testid="sheet-close"><Icon name="close" /></button></header>
      <div className="sheet-content">{children}</div>
    </section>
  </div>;
}

import type { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { ChevronLeft, X } from 'lucide-react';
import { rd } from '@/lib/redesign-i18n';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Sticky bar under the scrolling body (e.g. "Add to cart"). */
  footer?: ReactNode;
  /** Extra buttons in the header, after the title. */
  actions?: ReactNode;
  /** Shows a back chevron instead of close; called on tap. */
  onBack?: () => void;
  full?: boolean;
  bodyRef?: React.Ref<HTMLDivElement>;
}

/**
 * iOS-style bottom sheet: drag the grabber/header down to dismiss, the app layer
 * behind recedes (vaul `shouldScaleBackground`, needs `[vaul-drawer-wrapper]`).
 */
export function Sheet({ open, onClose, title, children, footer, actions, onBack, full = true, bodyRef }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="a3-sheet-overlay" />
        <Drawer.Content className={`a3-sheet a-scope${full ? ' full' : ''}`} aria-describedby={undefined}>
          <div className="a3-grabber" aria-hidden="true" />
          <div className="a3-sheet-head">
            <button type="button" className="a3-icon-btn solid" onClick={onBack || onClose} aria-label={onBack ? rd('back') : rd('close')}>
              {onBack ? <ChevronLeft size={18} className="rtl:rotate-180" /> : <X size={18} />}
            </button>
            <Drawer.Title asChild><h2>{title}</h2></Drawer.Title>
            {actions}
          </div>
          <div className="a3-sheet-body" ref={bodyRef} data-vaul-no-drag>
            {children}
          </div>
          {footer && <div className="a3-sheet-bar">{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

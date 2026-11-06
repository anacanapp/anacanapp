import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobileAdmin } from './hooks';

export interface SideDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Replace the default Save/Cancel footer. Pass `null` for no footer. */
  footer?: ReactNode | null;
  onSave?: () => void;
  saveLabel?: string;
  saving?: boolean;
  saveDisabled?: boolean;
  cancelLabel?: string;
  /** When true, closing asks for confirmation (unsaved changes guard). */
  dirty?: boolean;
  size?: 'md' | 'lg' | 'xl';
  testId?: string;
}

/**
 * Form editor surface: right-side panel on desktop, bottom sheet on phones.
 * Header and footer are sticky; the body scrolls. Unsaved edits are guarded in-app.
 */
export function SideDrawer({ open, onOpenChange, title, description, children, footer, onSave, saveLabel = 'Yadda saxla', saving, saveDisabled,
  cancelLabel = 'Ləğv et', dirty, size = 'md', testId }: SideDrawerProps) {
  const mobile = useIsMobileAdmin();
  const [guard, setGuard] = useState(false);
  const request = (next: boolean) => {
    if (!next && dirty && !saving) { setGuard(true); return; }
    setGuard(false); onOpenChange(next);
  };
  return (
    <DialogPrimitive.Root open={open} onOpenChange={request}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ak-overlay" />
        <DialogPrimitive.Content className={cn('ak-drawer', mobile ? 'is-sheet' : 'is-side', `is-${size}`)} data-testid={testId}
          onOpenAutoFocus={event => { if (mobile) event.preventDefault(); }}>
          <header className="ak-drawer-head">
            {mobile && <span className="ak-drawer-grip" aria-hidden />}
            <div className="min-w-0">
              <DialogPrimitive.Title className="ak-drawer-title">{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description className="ak-drawer-desc">{description}</DialogPrimitive.Description>
                : <DialogPrimitive.Description className="sr-only">Redaktə paneli</DialogPrimitive.Description>}
            </div>
            <button type="button" className="ak-icon-btn" aria-label="Bağla" onClick={() => request(false)}><X size={18} /></button>
          </header>
          <div className="ak-drawer-body">{children}</div>
          {guard && (
            <div className="ak-drawer-guard" role="alertdialog" aria-label="Yadda saxlanmamış dəyişikliklər">
              <AlertTriangle size={16} /><span>Yadda saxlanmamış dəyişikliklər itəcək.</span>
              <button type="button" className="ak-btn ak-btn-sm" onClick={() => setGuard(false)}>Qal</button>
              <button type="button" className="ak-btn ak-btn-sm ak-btn-danger" onClick={() => { setGuard(false); onOpenChange(false); }}>Çıx</button>
            </div>
          )}
          {footer !== null && (
            <footer className="ak-drawer-foot">
              {footer ?? (
                <>
                  <button type="button" className="ak-btn" onClick={() => request(false)} disabled={saving}>{cancelLabel}</button>
                  {onSave && <button type="button" className="ak-btn ak-btn-primary" onClick={onSave} disabled={saving || saveDisabled}>
                    {saving && <Loader2 size={14} className="animate-spin" />}{saveLabel}</button>}
                </>
              )}
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface ConfirmOptions { title: string; description?: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean }

/** Controlled in-app confirmation dialog (replaces window.confirm). */
export function ConfirmDialog({ open, options, onResolve }: { open: boolean; options: ConfirmOptions | null; onResolve: (ok: boolean) => void }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={next => { if (!next) onResolve(false); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ak-overlay" />
        <DialogPrimitive.Content className="ak-confirm" role="alertdialog" data-testid="ak-confirm">
          <DialogPrimitive.Title className="ak-confirm-title">{options?.title}</DialogPrimitive.Title>
          {options?.description ? <DialogPrimitive.Description className="ak-confirm-desc">{options.description}</DialogPrimitive.Description>
            : <DialogPrimitive.Description className="sr-only">Təsdiq</DialogPrimitive.Description>}
          <div className="ak-confirm-actions">
            <button type="button" className="ak-btn" onClick={() => onResolve(false)}>{options?.cancelLabel ?? 'Ləğv et'}</button>
            <button type="button" className={cn('ak-btn', options?.danger ? 'ak-btn-danger' : 'ak-btn-primary')} onClick={() => onResolve(true)} autoFocus>
              {options?.confirmLabel ?? 'Təsdiqlə'}</button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Mount once (the admin shell does). Sections call `useAdminConfirm()`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);
  const pending = useRef<((ok: boolean) => void) | null>(null);
  const confirm = useCallback<ConfirmFn>(options => new Promise<boolean>(resolve => {
    pending.current?.(false);
    pending.current = resolve;
    setState({ options, resolve });
  }), []);
  const resolve = (ok: boolean) => { state?.resolve(ok); pending.current = null; setState(null); };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog open={!!state} options={state?.options ?? null} onResolve={resolve} />
    </ConfirmContext.Provider>
  );
}

/** In-app confirm; falls back to the browser dialog when rendered outside the shell (isolated tests). */
export function useAdminConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  return context ?? (async options => window.confirm(options.title));
}

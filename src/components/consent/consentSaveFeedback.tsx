import { ToastAction } from '@/components/ui/toast';
import type { toast as toastFn } from '@/hooks/use-toast';
import { flushPendingConsents } from '@/lib/consentGate';
import { ct } from '@/lib/consent-copy';

type Toast = typeof toastFn;

/**
 * Feedback for a consent decision the server did not record. "Saved on this device, sent when online" only
 * for a real connectivity failure; any other failure gets an error with a retry of the stored decision.
 */
export function showConsentSaveFailure(toast: Toast, { offline, backend, userId }: { offline: boolean; backend: string; userId: string }) {
  if (offline) {
    toast({ title: ct('consent_saved_offline') });
    return;
  }
  const retry = async () => {
    const ok = await flushPendingConsents(backend, userId).catch(() => false);
    if (ok) toast({ title: ct('consent_updated') });
    else showConsentSaveFailure(toast, { offline: typeof navigator !== 'undefined' && navigator.onLine === false, backend, userId });
  };
  toast({
    title: ct('consent_save_failed'),
    variant: 'destructive',
    action: <ToastAction altText={ct('consent_retry')} onClick={() => { void retry(); }} data-testid="consent-retry">{ct('consent_retry')}</ToastAction>,
  });
}

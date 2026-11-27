import { CloudOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOptionalAuthContext } from '@/contexts/AuthContext';
import { useUserStore } from '@/store/userStore';
import { tr } from '@/lib/tr';

/**
 * Small, non-blocking "offline, will sync" pill for a signed-in account. The app keeps
 * working on cached data (children, timers, last logs) and the offline outbox; this only
 * says so. Touch passes through it.
 */
export default function OfflineSyncIndicator() {
  const online = useOnlineStatus();
  const auth = useOptionalAuthContext();
  useUserStore((state) => state.language); // re-render on language change
  if (online || !auth?.user) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 6px)' }}
    >
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-foreground/80 px-3 py-1 text-[11px] font-medium leading-tight text-background shadow-sm backdrop-blur">
        <CloudOff className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{tr('netsync_offline_indicator', 'Oflayn · internet gələndə sinxronlanacaq')}</span>
      </span>
    </div>
  );
}

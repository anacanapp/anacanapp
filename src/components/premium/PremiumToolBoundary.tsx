import { useEffect, useState, type ReactNode } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import PremiumModal from '@/components/PremiumModal';
export default function PremiumToolBoundary({ children, onClose, feature = 'tool' }: { children: ReactNode; onClose: () => void; feature?: string }) {
  const { isPremium, loading, entitlementReady } = useSubscription();
  // A purchase/restore made from this gate was confirmed by the server sync; stay in the
  // tool (close only the paywall) while the shared entitlement query catches up.
  const [unlocked, setUnlocked] = useState(false);
  // Once the shared entitlement reports Premium, it alone decides again (a later revocation locks).
  useEffect(() => { if (isPremium) setUnlocked(false); }, [isPremium]);
  // isPremium already includes a confirmed offline grant, so an entitlement request that
  // failed (offline/timeout) never shows the paywall to a paying user.
  if (isPremium || unlocked) return <>{children}</>;
  if (loading && !entitlementReady) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  return <PremiumModal isOpen onClose={onClose} onPurchased={() => setUnlocked(true)} feature={feature} />;
}

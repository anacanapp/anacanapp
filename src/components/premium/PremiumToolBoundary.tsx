import type { ReactNode } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import PremiumModal from '@/components/PremiumModal';
export default function PremiumToolBoundary({ children, onClose, feature = 'tool' }: { children: ReactNode; onClose: () => void; feature?: string }) {
  const { isPremium, loading, entitlementReady } = useSubscription();
  if (isPremium) return <>{children}</>;
  if (loading && !entitlementReady) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  return <PremiumModal isOpen onClose={onClose} feature={feature} />;
}

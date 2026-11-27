import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { loadPromoText } from '@/data/promo';
import { fill } from '@/lib/feature-text';
import { clearPendingPromo, FINAL_ERRORS, PROMO_PENDING_EVENT, promoDurationLabel, promoErrorText, readPendingPromo, redeemPromo } from '@/lib/promo';

/**
 * Grants a saved QR gift code once a session exists (after signup, login, Google/Apple sign-in or on the next start).
 * Final refusals drop the code; network or server failures keep it for the next start.
 */
export function PromoRedeemer() {
  const { user } = useAuth();
  const client = useQueryClient();
  const busy = useRef(false);
  const userId = user?.id ?? null;

  const run = useCallback(async () => {
    if (!userId || busy.current) return;
    const code = readPendingPromo();
    if (!code) return;
    busy.current = true;
    try {
      const result = await redeemPromo(code);
      const text = await loadPromoText(useUserStore.getState().language || 'az');
      if ('code' in result) {
        if (FINAL_ERRORS.has(result.code)) { clearPendingPromo(); toast.error(promoErrorText(text, result.code)); }
      } else {
        clearPendingPromo();
        toast.success(fill(text.success, { duration: promoDurationLabel(text, result.duration) }));
        void client.invalidateQueries({ predicate: (query) => ['premium-access-v1', 'subscription', 'household-premium'].includes(String(query.queryKey[0])) });
      }
    } finally {
      busy.current = false;
    }
  }, [userId, client]);

  useEffect(() => {
    void run();
    const onPending = () => { void run(); };
    window.addEventListener(PROMO_PENDING_EVENT, onPending);
    return () => window.removeEventListener(PROMO_PENDING_EVENT, onPending);
  }, [run]);
  return null;
}

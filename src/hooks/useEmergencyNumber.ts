import { useOptionalAuthContext } from '@/contexts/AuthContext';
import { useUserStore } from '@/store/userStore';
import { getEmergencyNumber } from '@/lib/emergency';

/**
 * The emergency number for the user's COUNTRY (not language): the profile
 * country_code first, then the country picked before sign-in (userStore),
 * otherwise 112. Safe outside AuthProvider (disclaimers render everywhere).
 */
export function useEmergencyNumber(): string {
  const auth = useOptionalAuthContext();
  const storedCountry = useUserStore((state) => state.countryCode);
  return getEmergencyNumber(auth?.profile?.country_code || storedCountry);
}

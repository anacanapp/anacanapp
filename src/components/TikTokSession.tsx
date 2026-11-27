import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePrivacyConsent } from '@/lib/privacyConsent';
import { setTikTokIdentity } from '@/lib/tiktok-events';

/** Keeps TikTok's external id in step with the signed-in account (native + attribution consent only). */
export default function TikTokSession() {
  const { user } = useAuth();
  const { attribution } = usePrivacyConsent();
  const externalId = user && attribution ? user.id : null;
  useEffect(() => { void setTikTokIdentity(externalId); }, [externalId]);
  return null;
}

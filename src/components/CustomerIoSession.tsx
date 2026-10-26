import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { customerIo, customerIoEnabled, CUSTOMER_IO_CONSENT_EVENT } from '@/lib/customerio';

/** Mounted after admission/session restoration, inside the existing AuthProvider. */
export default function CustomerIoSession() {
  const { user } = useAuth();
  const language = useUserStore(state => state.language);
  const backend = getBackendConfig().url;
  const client = useQueryClient();
  const key = ['customerio-consent', backend, user?.id];
  const { data: allowed } = useQuery({
    queryKey: key,
    enabled: customerIoEnabled && !!user,
    meta: { persist: false },
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.from('user_preferences').select('privacy_share_analytics').eq('user_id', user!.id).maybeSingle();
      if (error) throw new Error('CUSTOMERIO_CONSENT_UNAVAILABLE');
      return data?.privacy_share_analytics === true;
    },
  });

  useEffect(() => {
    void customerIo.setIdentity(user && allowed === true ? { userId: user.id, backend, language, consent: true } : null);
  }, [user?.id, backend, language, allowed]);
  useEffect(() => () => { void customerIo.setIdentity(null); }, []);
  useEffect(() => {
    const changed = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.userId !== user?.id || detail?.backend !== backend || typeof detail?.allowed !== 'boolean') return;
      if (!detail.allowed) void customerIo.setIdentity(null);
      const queryKey = ['customerio-consent', backend, user.id];
      // An older in-flight preference read must not undo an explicit opt-out.
      void client.cancelQueries({ queryKey, exact: true }).then(() => client.setQueryData(queryKey, detail.allowed));
    };
    window.addEventListener(CUSTOMER_IO_CONSENT_EVENT, changed);
    return () => window.removeEventListener(CUSTOMER_IO_CONSENT_EVENT, changed);
  }, [user?.id, backend, client]);
  return null;
}

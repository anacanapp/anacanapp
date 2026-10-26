import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFullScreenChat } from '@/hooks/useChatChrome';
import { useAdSafetyBlock } from '@/components/ads/AdExperienceProvider';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { tr } from '@/lib/chat-i18n';
import ConversationScreen from '@/components/chat/ConversationScreen';

export default function MotherChatScreen({ onBack }: { onBack: () => void }) {
  useFullScreenChat(); useAdSafetyBlock(true);
  const { user, profile } = useAuth();
  const linked = profile?.user_id === user?.id ? profile?.linked_partner_id : null;
  const partner = useQuery({ queryKey: ['chat-partner-v2', getBackendConfig().url, user?.id, linked], enabled: !!linked && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id,name,avatar_url').eq('id', linked!).maybeSingle();
      if (error) throw error;
      return data;
    } });
  if (partner.data) return <ConversationScreen kind="partner" target={partner.data.user_id}
    title={partner.data.name} avatar={partner.data.avatar_url} onBack={onBack} />;
  return <section className="a-scope min-h-screen" style={{ background: 'var(--a-bg)' }}>
    <header className="chat-topbar"><button type="button" className="chat-icon-button" onClick={onBack} aria-label={tr('common_geri', 'Geri')}><ArrowLeft className="rtl:rotate-180" size={21} /></button>
      <h1 className="chat-topbar-name">{tr('bottomnav_mesajlar', 'Mesajlar')}</h1></header>
    <div className="chat-empty">{linked && partner.isPending ? <Loader2 className="animate-spin" /> : <>
      <p>{partner.isError ? tr('chat_partner_load_failed', 'Partnyor məlumatları yüklənmədi.') : tr('usepartnermessages_evvelce_partnyorla_elaqelenin_2378fa', 'Əvvəlcə partnyorla əlaqələnin.')}</p>
      {partner.isError && <button type="button" onClick={() => partner.refetch()}>{tr('chat_retry', 'Yenidən cəhd et')}</button>}
    </>}</div>
  </section>;
}

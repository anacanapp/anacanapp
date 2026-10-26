import { useState, useEffect, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { tr } from '@/lib/tr';
import ConversationListScreen from '@/components/community/ConversationListScreen';

const DirectMessageScreen = lazy(() => import('@/components/community/DirectMessageScreen'));
const MotherChatScreen = lazy(() => import('@/components/MotherChatScreen'));
const GroupChatScreen = lazy(() => import('@/components/community/GroupChatScreen'));

interface MessagesScreenProps {
  onBack: () => void;
  partnerProfileId?: string | null;
}

const suspenseFallback = (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
);

const MessagesScreen = ({ onBack, partnerProfileId }: MessagesScreenProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: partnerUserId, isLoading: partnerLoading, refetch } = useQuery({
    queryKey: ['messages-partner-user-id', user?.id, partnerProfileId],
    enabled: !!user?.id && !!partnerProfileId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles')
        .select('user_id').eq('id', partnerProfileId).maybeSingle();
      if (error) throw error;
      return data?.user_id ?? null;
    },
  });
  const [activeChat, setActiveChat] = useState<{
    type: 'dm' | 'partner' | 'group';
    userId: string;
    name: string;
    avatar: string | null;
  } | null>(null);

  useEffect(() => { setActiveChat(null); }, [user?.id, partnerProfileId]);

  const handleOpenChat = (userId: string, name: string, avatar: string | null) => {
    // Never guess DM vs partner while the RLS-protected identity lookup is unavailable.
    if (partnerProfileId && !partnerUserId) {
      toast({
        title: tr('usepartnerdata_partner_melumatlari_yuklene_bi_430423', 'Could not load partner details'),
        variant: 'destructive',
      });
      void refetch();
      return;
    }
    if (partnerUserId && userId === partnerUserId) {
      setActiveChat({ type: 'partner', userId, name, avatar });
    } else {
      setActiveChat({ type: 'dm', userId, name, avatar });
    }
  };

  if (partnerLoading) return suspenseFallback;

  // Individual chat view
  if (activeChat) {
    if (activeChat.type === 'group') return <Suspense fallback={suspenseFallback}><GroupChatScreen groupId={activeChat.userId} onBack={() => setActiveChat(null)} /></Suspense>;
    if (activeChat.type === 'partner') {
      return (
        <Suspense fallback={suspenseFallback}>
          <MotherChatScreen onBack={() => setActiveChat(null)} />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={suspenseFallback}>
        <DirectMessageScreen
          userId={activeChat.userId}
          userName={activeChat.name}
          userAvatar={activeChat.avatar}
          onBack={() => setActiveChat(null)}
        />
      </Suspense>
    );
  }

  // Conversations list
  return (
    <ConversationListScreen
      onBack={onBack}
      onOpenChat={handleOpenChat}
      partnerId={partnerUserId}
      onOpenGroup={id => setActiveChat({ type: 'group', userId: id, name: '', avatar: null })}
    />
  );
};

export default MessagesScreen;

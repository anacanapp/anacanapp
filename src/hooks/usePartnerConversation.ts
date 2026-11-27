import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePartnerMessages } from './usePartnerMessages';
import { useAuth } from './useAuth';
import { Conversation } from './useDirectMessages';

/** Message types the partner chat itself shows (same list as chat_messages_v2). */
const CHAT_TYPES = new Set(['text', 'love', 'image', 'audio', 'video']);

/**
 * Hook that returns the partner chat as a Conversation object
 * for use in the unified conversations list
 */
export const usePartnerConversation = (partnerId?: string | null) => {
  const { messages, loading } = usePartnerMessages();
  const { user } = useAuth();
  // The linked person's real name and photo (the list used to show "Partner" with no picture).
  const person = useQuery({
    queryKey: ['partner-conversation-person', user?.id, partnerId],
    enabled: !!user?.id && !!partnerId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('name, avatar_url').eq('user_id', partnerId!).maybeSingle();
      if (error) throw error;
      return data as { name: string | null; avatar_url: string | null } | null;
    },
  });

  const result = useMemo(() => {
    const chat = (messages || []).filter(m => CHAT_TYPES.has(m.message_type) && !(m as { deleted_at?: string | null }).deleted_at);
    if (!partnerId || !user || chat.length === 0) {
      return { conversation: null, unreadCount: 0 };
    }

    const unread = chat.filter(m => m.receiver_id === user.id && !m.is_read).length;
    const lastMsg = chat[0]; // newest first (usePartnerMessages)

    const conversation: Conversation = {
      user_id: partnerId,
      name: person.data?.name?.trim() || 'Partner',
      avatar_url: person.data?.avatar_url || null,
      last_message: lastMsg?.content || null,
      last_message_type: lastMsg?.message_type || 'text',
      last_message_at: lastMsg?.created_at || new Date().toISOString(),
      unread_count: unread,
    };

    return { conversation, unreadCount: unread };
  }, [partnerId, user, messages, person.data]);

  return { messages: result, loading };
};

import { useMemo } from 'react';
import { usePartnerMessages } from './usePartnerMessages';
import { useAuth } from './useAuth';
import { Conversation } from './useDirectMessages';

/**
 * Hook that returns the partner chat as a Conversation object
 * for use in the unified conversations list
 */
export const usePartnerConversation = (partnerId?: string | null) => {
  const { messages, loading } = usePartnerMessages();
  const { user, profile } = useAuth();

  const result = useMemo(() => {
    if (!partnerId || !user || !messages || messages.length === 0) {
      return { conversation: null, unreadCount: 0 };
    }

    const unread = messages.filter(m => m.receiver_id === user.id && !m.is_read).length;
    const lastMsg = messages[messages.length - 1];

    const conversation: Conversation = {
      user_id: partnerId,
      name: (profile as any)?.partner_name || 'Partner',
      avatar_url: null,
      last_message: lastMsg?.content || null,
      last_message_type: lastMsg?.message_type || 'text',
      last_message_at: lastMsg?.created_at || new Date().toISOString(),
      unread_count: unread,
    };

    return { conversation, unreadCount: unread };
  }, [partnerId, user, messages, profile]);

  return { messages: result, loading };
};

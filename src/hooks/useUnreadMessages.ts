import { useMemo } from 'react';
import { usePartnerMessages } from './usePartnerMessages';
import { useAuth } from './useAuth';
import { useChatGroups } from './useChatGroups';

/**
 * Hook to get unread message count for use in badges
 */
export const useUnreadMessages = () => {
  const { messages, loading } = usePartnerMessages();
  const { user } = useAuth();
  const groups = useChatGroups(undefined, 'mine');

  const unreadCount = useMemo(() => {
    if (!user || !messages) return 0;
    return messages.filter(m => m.receiver_id === user.id && !m.is_read).length
      + groups.groups.reduce((sum, group) => sum + (group.is_member ? Number(group.unread_count || 0) : group.access_state === 'invited' ? 1 : 0), 0);
  }, [messages, user, groups.groups]);

  return {
    unreadCount,
    loading,
    hasUnread: unreadCount > 0,
  };
};

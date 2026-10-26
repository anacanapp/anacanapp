import { tr } from "@/lib/tr";import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getPublicProfileCard } from '@/lib/public-profile-cards';

interface PresenceState {
  onlineCount: number;
  onlineUsers: Array<{
    id: string;
    name: string;
    avatar_url?: string;
  }>;
  typingUsers: Array<{
    id: string;
    name: string;
  }>;
}

export const useGroupPresence = (groupId: string | null) => {
  const [presenceState, setPresenceState] = useState<PresenceState>({
    onlineCount: 0,
    onlineUsers: [],
    typingUsers: []
  });
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  // Own presence identity, cached once per subscription so typing toggles do
  // not re-fetch auth user + profile card each time.
  const selfRef = useRef<{ id: string; name: string; avatar_url?: string } | null>(null);

  useEffect(() => {
    if (!groupId) {
      setPresenceState({ onlineCount: 0, onlineUsers: [], typingUsers: [] });
      return;
    }

    let cancelled = false;
    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      // Get user profile from public_profile_cards (bypasses RLS)
      const profile = await getPublicProfileCard(user.id);
      if (cancelled) return;
      selfRef.current = {
        id: user.id,
        name: profile?.name || tr("usegrouppresence_i_stifadeci_b6bdd6", "İstifadəçi"),
        avatar_url: profile?.avatar_url
      };

      // Presence topic must stay shared by every member of the group, so this
      // channel name is intentionally NOT suffixed with a random id.
      const channelName = `group_presence:${groupId}`;
      const channel = supabase.channel(channelName, {
        config: {
          presence: { key: user.id }
        }
      });

      channel.
      on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: PresenceState['onlineUsers'] = [];
        const typing: PresenceState['typingUsers'] = [];

        Object.entries(state).forEach(([userId, presences]) => {
          const presence = (presences as any[])[0];
          if (presence) {
            users.push({
              id: userId,
              name: presence.name || tr("usegrouppresence_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"),
              avatar_url: presence.avatar_url
            });
            if (presence.isTyping && userId !== user.id) {
              typing.push({
                id: userId,
                name: presence.name || tr("usegrouppresence_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")
              });
            }
          }
        });

        setPresenceState({
          onlineCount: users.length,
          onlineUsers: users,
          typingUsers: typing
        });
      }).
      on('presence', { event: 'join' }, ({ key, newPresences }) => {

        // Handle user join
      }).on('presence', { event: 'leave' }, ({ key, leftPresences }) => {

        // Handle user leave
      });
      channelRef.current = channel;
      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && !cancelled) {
          await channel.track({
            name: profile?.name || tr("usegrouppresence_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"),
            avatar_url: profile?.avatar_url,
            isTyping: false,
            online_at: new Date().toISOString()
          });
        }
      });
    };

    void setupPresence();

    return () => {
      cancelled = true;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      isTypingRef.current = false;
      selfRef.current = null;
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [groupId]);

  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!channelRef.current || isTypingRef.current === isTyping) return;

    isTypingRef.current = isTyping;

    const channel = channelRef.current;
    if (!channel) return;
    let self = selfRef.current;
    if (!self) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const profile = await getPublicProfileCard(user.id);
      self = {
        id: user.id,
        name: profile?.name || tr("usegrouppresence_i_stifadeci_b6bdd6", "İstifadəçi"),
        avatar_url: profile?.avatar_url
      };
      selfRef.current = self;
    }
    if (channelRef.current !== channel) return;

    await channel.track({
      name: self.name,
      avatar_url: self.avatar_url,
      isTyping,
      online_at: new Date().toISOString()
    });

    // Auto-stop typing after 3 seconds
    if (isTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(false);
      }, 3000);
    }
  }, []);

  const startTyping = useCallback(() => setTyping(true), [setTyping]);
  const stopTyping = useCallback(() => setTyping(false), [setTyping]);

  return {
    ...presenceState,
    startTyping,
    stopTyping
  };
};
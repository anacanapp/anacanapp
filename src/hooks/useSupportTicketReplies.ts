import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TicketReply {
  id: string;
  ticket_id: string;
  user_id: string;
  is_admin: boolean;
  message: string;
  created_at: string;
}

export const useSupportTicketReplies = (ticketId: string | null) => {
  const { user } = useAuth();
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReplies = useCallback(async () => {
    if (!ticketId || !user) {
      setReplies([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_ticket_replies')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setReplies((data || []) as TicketReply[]);
    } catch (error) {
      console.error('Error fetching replies:', error);
    } finally {
      setLoading(false);
    }
  }, [ticketId, user]);

  const addReply = async (message: string, isAdmin: boolean = false) => {
    if (!ticketId || !user || !message.trim()) {
      return { error: 'Invalid request' };
    }

    try {
      const { data, error } = await supabase
        .from('support_ticket_replies')
        .insert({
          ticket_id: ticketId,
          user_id: user.id,
          is_admin: isAdmin,
          message: message.trim()
        })
        .select()
        .single();

      if (error) throw error;
      await fetchReplies();
      return { data: data as TicketReply, error: null };
    } catch (error) {
      console.error('Error adding reply:', error);
      return { data: null, error };
    }
  };

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  // Real-time subscription
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`ticket-replies-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_ticket_replies',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          setReplies(prev => [...prev, payload.new as TicketReply]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  return {
    replies,
    loading,
    addReply,
    refetch: fetchReplies
  };
};

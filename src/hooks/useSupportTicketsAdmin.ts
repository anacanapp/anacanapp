import { tr } from "@/lib/tr";import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';

export interface AdminSupportTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  user_name?: string;
  user_email?: string;
}

export const useSupportTicketsAdmin = () => {
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    try {
      // DÜZƏLİŞ: limitsiz idi — support_tickets 1000-i keçəndə "Dəstək"
      // admin səhifəsi yalnız ilk 1000 tiketi (və onlara aid stat kartlarını) göstərirdi.
      const data = await fetchAllRows((from, to) =>
        supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).range(from, to)
      );

      // Fetch user info
      const userIds = [...new Set((data || []).map((t) => t.user_id))];

      const profiles = await fetchAllRows((from, to) =>
        supabase.from('profiles').select('user_id, name, email').in('user_id', userIds).range(from, to)
      );

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );

      const enrichedTickets = (data || []).map((t) => {
        const profile = profileMap.get(t.user_id);
        return {
          ...t,
          user_name: profile?.name || tr("usesupportticketsadmin_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"),
          user_email: profile?.email || ''
        };
      });

      setTickets(enrichedTickets as AdminSupportTicket[]);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const respondToTicket = async (ticketId: string, response: string, newStatus: AdminSupportTicket['status'] = 'resolved') => {
    try {
      const { error } = await supabase.
      from('support_tickets').
      update({
        admin_response: response,
        status: newStatus,
        responded_at: new Date().toISOString()
      }).
      eq('id', ticketId);

      if (error) throw error;
      await fetchTickets();
      return { error: null };
    } catch (error) {
      console.error('Error responding to ticket:', error);
      return { error };
    }
  };

  const updateStatus = async (ticketId: string, status: AdminSupportTicket['status']) => {
    try {
      const { error } = await supabase.
      from('support_tickets').
      update({ status }).
      eq('id', ticketId);

      if (error) throw error;
      await fetchTickets();
      return { error: null };
    } catch (error) {
      console.error('Error updating status:', error);
      return { error };
    }
  };

  const updatePriority = async (ticketId: string, priority: AdminSupportTicket['priority']) => {
    try {
      const { error } = await supabase.
      from('support_tickets').
      update({ priority }).
      eq('id', ticketId);

      if (error) throw error;
      await fetchTickets();
      return { error: null };
    } catch (error) {
      console.error('Error updating priority:', error);
      return { error };
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return {
    tickets,
    loading,
    respondToTicket,
    updateStatus,
    updatePriority,
    refetch: fetchTickets
  };
};
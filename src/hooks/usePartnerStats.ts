import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { usePartnerData } from './usePartnerData';

export interface PartnerStats {
  totalPoints: number;
  completedMissions: number;
  level: number;
  lovesSent: number;
  messagesSent: number;
}

export const usePartnerStats = () => {
  const { user } = useAuth();
  const { partnerProfile } = usePartnerData();
  const [stats, setStats] = useState<PartnerStats>({
    totalPoints: 0,
    completedMissions: 0,
    level: 1,
    lovesSent: 0,
    messagesSent: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch completed missions and points
      const { data: missionsData, error: missionsError } = await supabase
        .from('partner_missions')
        .select('points_earned, is_completed')
        .eq('user_id', user.id)
        .eq('is_completed', true);

      if (missionsError) throw missionsError;

      const totalPoints = missionsData?.reduce((sum, m) => sum + (m.points_earned || 0), 0) || 0;
      const completedMissions = missionsData?.length || 0;
      const level = Math.floor(totalPoints / 50) + 1;

      // Fetch love messages sent
      const { count: lovesCount, error: lovesError } = await supabase
        .from('partner_messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', user.id)
        .eq('message_type', 'love');

      if (lovesError) throw lovesError;

      // Fetch text messages sent
      const { count: messagesCount, error: messagesError } = await supabase
        .from('partner_messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', user.id)
        .in('message_type', ['text', 'image', 'audio']);

      if (messagesError) throw messagesError;

      setStats({
        totalPoints,
        completedMissions,
        level,
        lovesSent: lovesCount || 0,
        messagesSent: messagesCount || 0,
      });
    } catch (err) {
      console.error('Error fetching partner stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`partner-stats-${user.id}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partner_missions', filter: `user_id=eq.${user.id}` },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'partner_messages', filter: `sender_id=eq.${user.id}` },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    stats,
    loading,
    refetch: fetchStats,
  };
};

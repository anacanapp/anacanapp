import { useState, useEffect, useCallback, useMemo } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useBabyMilestonesDB } from './useDynamicConfig';
import { useChildren } from './useChildren';
import { useUserStore } from '@/store/userStore';

export interface BabyMilestone {
  id: string;
  user_id: string;
  child_id: string | null;
  milestone_id: string;
  achieved_at: string;
  notes: string | null;
  created_at: string;
}

export const useBabyMilestones = () => {
  const { user } = useAuth();
  const { selectedChild } = useChildren();
  const { toast } = useToast();
  const [milestones, setMilestones] = useState<BabyMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: dbMilestones, isLoading: dbLoading } = useBabyMilestonesDB();
  const language = useUserStore((state) => state.language);

  // Map DB milestones to the format expected by components (no fallback needed - DB is the source)
  const MILESTONES = useMemo(() => {
    if (!dbMilestones || dbMilestones.length === 0) {
      return [];
    }
    return dbMilestones.map((m) => {
      return {
        id: m.milestone_key,
        week: m.week_number,
        label: m.label,
        emoji: m.emoji,
        description: m.description
      };
    });
  }, [dbMilestones]);

  const fetchMilestones = useCallback(async () => {
    if (!user) return;

    try {
      let query = supabase.
      from('baby_milestones').
      select('*').
      eq('user_id', user.id).
      order('achieved_at', { ascending: false });

      // Filter by selected child if available
      if (selectedChild) {
        query = query.eq('child_id', selectedChild.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMilestones(data || []);
    } catch (error) {
      console.error('Error fetching milestones:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedChild]);

  useEffect(() => {
    fetchMilestones();

    // Subscribe to realtime updates
    if (user) {
      const channel = supabase.
      channel(`milestones-channel:${crypto.randomUUID()}`).
      on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'baby_milestones',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchMilestones();
        }
      ).
      subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, fetchMilestones]);

  const toggleMilestone = useCallback(async (milestoneId: string, notes?: string) => {
    if (!user) return;

    const existing = milestones.find((m) => m.milestone_id === milestoneId);

    try {
      if (existing) {
        // Remove milestone
        const { error } = await supabase.
        from('baby_milestones').
        delete().
        eq('id', existing.id);

        if (error) throw error;

        setMilestones((prev) => prev.filter((m) => m.id !== existing.id));
        toast({
          title: tr("usebabymilestones_merhele_silindi_fb7d94", "Mərhələ silindi"),
          description: tr("usebabymilestones_inkisaf_merhelesi_silindi_6e6a48", "İnkişaf mərhələsi silindi")
        });
      } else {
        // Add milestone
        const { data, error } = await supabase.
        from('baby_milestones').
        insert({
          user_id: user.id,
          child_id: selectedChild?.id || null,
          milestone_id: milestoneId,
          notes: notes || null
        }).
        select().
        single();

        if (error) throw error;

        if (data) {
          setMilestones((prev) => [data, ...prev]);
          const milestoneDetails = MILESTONES.find((m) => m.id === milestoneId);
          toast({
            title: `🎉 ${milestoneDetails?.label || tr("usebabymilestones_merhele_0e09aa", "M\u0259rh\u0259l\u0259")} ${tr("usebabymilestones_qeyd_edildi_xyz123", "qeyd edildi!")}`,
            description: milestoneDetails?.description
          });
        }
      }
    } catch (error) {
      console.error('Error toggling milestone:', error);
      toast({
        title: tr("usebabymilestones_xeta_3cdbb6", "Xəta"),
        description: tr("usebabymilestones_merhele_qeyd_edile_bilmedi_b2cb1f", "Mərhələ qeyd edilə bilmədi"),
        variant: 'destructive'
      });
    }
  }, [user, milestones, toast, MILESTONES, selectedChild]);

  const isMilestoneAchieved = useCallback((milestoneId: string) => {
    return milestones.some((m) => m.milestone_id === milestoneId);
  }, [milestones]);

  const getMilestoneDate = useCallback((milestoneId: string) => {
    const milestone = milestones.find((m) => m.milestone_id === milestoneId);
    return milestone?.achieved_at ? new Date(milestone.achieved_at) : null;
  }, [milestones]);

  return {
    milestones,
    loading: loading || dbLoading,
    toggleMilestone,
    isMilestoneAchieved,
    getMilestoneDate,
    refetch: fetchMilestones,
    MILESTONES
  };
};
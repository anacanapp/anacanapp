import { useState, useEffect, useCallback, useRef } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface DailySummary {
  id: string;
  user_id: string;
  partner_user_id: string;
  summary_date: string;
  mood: number | null;
  symptoms: string[] | null;
  water_intake: number;
  kick_count: number;
  contraction_count: number;
  notes: string | null;
  is_sent: boolean;
  sent_at: string | null;
  created_at: string;
}

export const useDailySummary = () => {
  const { user, profile } = useAuth();
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [todaySummary, setTodaySummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getPartnerUserId = useCallback(async (): Promise<string | null> => {
    if (!profile?.linked_partner_id) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', profile.linked_partner_id)
        .single();

      if (error || !data) return null;
      return data.user_id;
    } catch {
      return null;
    }
  }, [profile?.linked_partner_id]);

  const fetchSummaries = async () => {
    if (!user) return;

    try {
      const isPartner = profile?.life_stage === 'partner';

      let query = supabase
        .from('daily_summaries')
        .select('*')
        .order('summary_date', { ascending: false })
        .limit(30);

      if (isPartner) {
        query = query.eq('partner_user_id', user.id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSummaries((data || []) as DailySummary[]);

      const today = new Date().toISOString().split('T')[0];
      const todayData = data?.find(s => s.summary_date === today) || null;
      setTodaySummary(todayData as DailySummary | null);
    } catch (error) {
      console.error('Error fetching daily summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Silently update today's summary without sending notification
  const updateSummarySilently = useCallback(async () => {
    if (!user || profile?.life_stage === 'partner') return;

    try {
      const partnerUserId = await getPartnerUserId();
      if (!partnerUserId) return;

      const today = new Date().toISOString().split('T')[0];

      const [dailyLogRes, kicksRes, contractionsRes] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('log_date', today)
          .single(),
        supabase
          .from('kick_sessions')
          .select('kick_count')
          .eq('user_id', user.id)
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`),
        supabase
          .from('contractions')
          .select('id')
          .eq('user_id', user.id)
          .gte('start_time', `${today}T00:00:00`)
          .lte('start_time', `${today}T23:59:59`),
      ]);

      const dailyLog = dailyLogRes.data;
      const totalKicks = kicksRes.data?.reduce((sum, k) => sum + (k.kick_count || 0), 0) || 0;
      const contractionCount = contractionsRes.data?.length || 0;

      await supabase
        .from('daily_summaries')
        .upsert({
          user_id: user.id,
          partner_user_id: partnerUserId,
          summary_date: today,
          mood: dailyLog?.mood || null,
          symptoms: dailyLog?.symptoms || null,
          water_intake: dailyLog?.water_intake || 0,
          kick_count: totalKicks,
          contraction_count: contractionCount,
          is_sent: false,
        }, {
          onConflict: 'user_id,summary_date'
        });

      await fetchSummaries();
    } catch (error) {
      console.error('Error auto-updating summary:', error);
    }
  }, [user, profile?.life_stage, getPartnerUserId]);

  // Debounced version to avoid rapid-fire updates
  const debouncedUpdateSummary = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateSummarySilently();
    }, 1500);
  }, [updateSummarySilently]);

  const generateAndSendSummary = async () => {
    if (!user || profile?.life_stage === 'partner') return { error: 'Only woman can send summary' };

    try {
      const partnerUserId = await getPartnerUserId();
      if (!partnerUserId) return { error: 'No partner linked' };

      const today = new Date().toISOString().split('T')[0];

      const [dailyLogRes, kicksRes, contractionsRes] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('log_date', today)
          .single(),
        supabase
          .from('kick_sessions')
          .select('kick_count')
          .eq('user_id', user.id)
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`),
        supabase
          .from('contractions')
          .select('id')
          .eq('user_id', user.id)
          .gte('start_time', `${today}T00:00:00`)
          .lte('start_time', `${today}T23:59:59`),
      ]);

      const dailyLog = dailyLogRes.data;
      const totalKicks = kicksRes.data?.reduce((sum, k) => sum + (k.kick_count || 0), 0) || 0;
      const contractionCount = contractionsRes.data?.length || 0;

      const { data, error } = await supabase
        .from('daily_summaries')
        .upsert({
          user_id: user.id,
          partner_user_id: partnerUserId,
          summary_date: today,
          mood: dailyLog?.mood || null,
          symptoms: dailyLog?.symptoms || null,
          water_intake: dailyLog?.water_intake || 0,
          kick_count: totalKicks,
          contraction_count: contractionCount,
          is_sent: true,
          sent_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,summary_date'
        })
        .select()
        .single();

      if (error) throw error;

      const moodEmojis = ['😢', '😔', '😐', '🙂', '😊'];
      const moodText = dailyLog?.mood ? moodEmojis[dailyLog.mood - 1] : '❓';

      await supabase.from('partner_messages').insert({
        sender_id: user.id,
        receiver_id: partnerUserId,
        message_type: 'daily_summary',
        content: JSON.stringify({
          type: 'daily_summary',
          title: tr("usedailysummary_gundelik_xulase_42932d", "📊 Gündəlik Xülasə"),
          body: `${tr("usedailysummary_ehval", "Əhval:")} ${moodText} | ${tr("usedailysummary_su", "Su:")} ${dailyLog?.water_intake || 0}ml | ${tr("usedailysummary_tepikler", "Təpiklər:")} ${totalKicks}`,
          summary: data,
          timestamp: new Date().toISOString()
        }),
      });

      await fetchSummaries();
      return { data, error: null };
    } catch (error) {
      console.error('Error generating summary:', error);
      return { data: null, error };
    }
  };

  // Realtime subscriptions on summary + source tables
  useEffect(() => {
    if (!user) return;
    fetchSummaries();

    // daily_summaries sətri ya mənim (user_id) ya da partnyorumun mənə göndərdiyi
    // (partner_user_id) sətridir — rol əsasında düzgün sütunu filtrləyirik ki,
    // dəyişiklik yalnız bu iki nəfərə yayımlansın, bütün istifadəçilərə yox.
    const filterColumn = profile?.life_stage === 'partner' ? 'partner_user_id' : 'user_id';

    const channel = supabase
      .channel(`summary_and_sources:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_summaries', filter: `${filterColumn}=eq.${user.id}` }, () => {
        fetchSummaries();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_logs', filter: `user_id=eq.${user.id}` }, () => {
        debouncedUpdateSummary();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kick_sessions', filter: `user_id=eq.${user.id}` }, () => {
        debouncedUpdateSummary();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contractions', filter: `user_id=eq.${user.id}` }, () => {
        debouncedUpdateSummary();
      })
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, profile?.life_stage, debouncedUpdateSummary]);

  return {
    summaries,
    todaySummary,
    loading,
    generateAndSendSummary,
    updateSummarySilently,
    refetch: fetchSummaries,
  };
};

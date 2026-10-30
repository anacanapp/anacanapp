import { tr } from "@/lib/tr";import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { getPregnancyWeek, getDaysUntilDue as calcDaysUntilDue, getDaysElapsed, getRealCalendarAge } from '@/lib/pregnancy-utils';
import { getPhaseInfoForDate, type CyclePhaseInfo } from '@/lib/cycle-utils';
import { usePartnerSharedSettings } from './usePartnerSharing';
import { readCache, writeCache } from '@/lib/offlineCache';

const PARTNER_PROFILE_CACHE = 'partner_profile';
const PARTNER_DAILYLOG_CACHE = 'partner_dailylog';

export interface PartnerWomanData {
  id: string;
  user_id: string;
  name: string;
  life_stage: 'flow' | 'bump' | 'mommy' | null;
  last_period_date: string | null;
  due_date: string | null;
  baby_birth_date: string | null;
  baby_name: string | null;
  baby_gender: 'boy' | 'girl' | null;
  cycle_length: number;
  period_length: number;
  // Əkiz/üçüz və s. — partnyor ekranlarında "körpəniz"/"körpələriniz" mətnini
  // düzgün seçmək üçün (bax PartnerHomeScreen.tsx, PartnerWeekInfoCard.tsx)
  multiples_type: string | null;
}

export interface PartnerDailyLog {
  mood: number | null;
  symptoms: string[] | null;
  water_intake: number | null;
  log_date: string;
}

export const usePartnerData = () => {
  const { profile } = useAuth();
  const { sharing } = usePartnerSharedSettings();
  const [partnerProfile, setPartnerProfile] = useState<PartnerWomanData | null>(null);
  const [partnerDailyLog, setPartnerDailyLog] = useState<PartnerDailyLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Offline fallback: son uğurlu fetch-in nəticəsini göstər. */
  const restoreFromCache = (): boolean => {
    if (!profile?.user_id) return false;
    const cachedProfile = readCache<PartnerWomanData>(PARTNER_PROFILE_CACHE, profile.user_id);
    if (!cachedProfile) return false;
    setPartnerProfile(cachedProfile);
    // Gündəlik log yalnız bu günə aiddirsə göstərilsin (dünənki əhval "bu gün" kimi görünməsin)
    const cachedLog = readCache<PartnerDailyLog>(PARTNER_DAILYLOG_CACHE, profile.user_id);
    const today = new Date().toISOString().split('T')[0];
    if (cachedLog?.log_date === today) setPartnerDailyLog(cachedLog);
    return true;
  };

  const fetchPartnerData = async () => {
    if (!profile?.linked_partner_id) {
      setLoading(false);
      return;
    }

    try {
      // Fetch partner's profile using the linked_partner_id
      const { data: partnerData, error: profileError } = await supabase.
      from('profiles').
      select('id, user_id, name, life_stage, last_period_date, due_date, baby_birth_date, baby_name, baby_gender, cycle_length, period_length, multiples_type').
      eq('id', profile.linked_partner_id).
      maybeSingle();

      if (profileError) {
        console.error('Error fetching partner profile:', profileError);
        // Offline/server xətası → son vəziyyət cache-dən
        if (!restoreFromCache()) {
          setError(tr("usepartnerdata_partner_melumatlari_yuklene_bi_430423", "Partner m\u0259lumatlar\u0131 y\xFCkl\u0259n\u0259 bilm\u0259di"));
        }
        setLoading(false);
        return;
      }

      if (partnerData) {
        setPartnerProfile(partnerData as PartnerWomanData);
        if (profile?.user_id) writeCache(PARTNER_PROFILE_CACHE, profile.user_id, partnerData);

        // Fetch today's daily log for the partner
        const today = new Date().toISOString().split('T')[0];
        // Masked by her sharing settings on the server (Duzelis68); no direct daily_logs access.
        const { data: logRows, error: logError } = await (supabase as any).rpc('partner_daily_logs_v1', { p_from: today, p_to: today });
        const logData = (logRows as PartnerDailyLog[] | null)?.[0] ?? null;

        if (!logError && logData) {
          setPartnerDailyLog(logData);
          if (profile?.user_id) writeCache(PARTNER_DAILYLOG_CACHE, profile.user_id, logData);
        }
      }
    } catch (err) {
      console.error('Error in fetchPartnerData:', err);
      if (!restoreFromCache()) {
        setError(tr("usepartnerdata_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartnerData();

    // daily_logs is no longer readable row-by-row for the partner (Duzelis68), so realtime
    // cannot deliver it; refresh while the app is open and when it returns to the foreground.
    if (profile?.linked_partner_id && partnerProfile?.user_id) {
      const timer = window.setInterval(fetchPartnerData, 60_000);
      const onVisible = () => { if (document.visibilityState === 'visible') fetchPartnerData(); };
      document.addEventListener('visibilitychange', onVisible);
      return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
    }
  }, [profile?.linked_partner_id, partnerProfile?.user_id]);

  // Calculate pregnancy week if partner is in 'bump' stage - using centralized utility
  const getPartnerPregnancyWeek = (): number => {
    if (!partnerProfile?.last_period_date || partnerProfile.life_stage !== 'bump') {
      return 0;
    }
    return getPregnancyWeek(partnerProfile.last_period_date);
  };

  // Calculate days until due date - using centralized utility
  const getPartnerDaysUntilDue = (): number => {
    if (!partnerProfile?.last_period_date && !partnerProfile?.due_date) {
      return 0;
    }
    return calcDaysUntilDue(partnerProfile.last_period_date, partnerProfile.due_date);
  };

  // Get baby age in days for 'mommy' stage
  const getBabyAgeDays = (): number => {
    if (!partnerProfile?.baby_birth_date || partnerProfile.life_stage !== 'mommy') {
      return 0;
    }
    return getRealCalendarAge(partnerProfile.baby_birth_date).totalDays;
  };

  // Get cycle phase info for 'flow' stage
  const getCyclePhaseInfo = (): CyclePhaseInfo | null => {
    if (!sharing.share_cycle) return null;
    if (!partnerProfile?.last_period_date || partnerProfile.life_stage !== 'flow') {
      return null;
    }
    return getPhaseInfoForDate(
      new Date(),
      new Date(partnerProfile.last_period_date),
      partnerProfile.cycle_length || 28,
      partnerProfile.period_length || 5
    );
  };

  // Days until next period for 'flow' stage
  const getDaysUntilNextPeriod = (): number => {
    if (!sharing.share_cycle) return 0;
    if (!partnerProfile?.last_period_date || partnerProfile.life_stage !== 'flow') {
      return 0;
    }
    const cycleLength = partnerProfile.cycle_length || 28;
    const lmp = new Date(partnerProfile.last_period_date);
    const today = new Date();
    const daysSince = Math.floor((today.getTime() - lmp.getTime()) / (1000 * 60 * 60 * 24));
    const daysIntoCycle = (daysSince % cycleLength + cycleLength) % cycleLength;
    return Math.max(0, cycleLength - daysIntoCycle);
  };

  // Paylaşım maskası: ana bağladığı sahələr partnyora null görünür
  const maskedDailyLog: PartnerDailyLog | null = partnerDailyLog ? {
    ...partnerDailyLog,
    mood: sharing.share_mood ? partnerDailyLog.mood : null,
    symptoms: sharing.share_symptoms ? partnerDailyLog.symptoms : null,
    water_intake: sharing.share_water ? partnerDailyLog.water_intake : null
  } : null;

  return {
    partnerProfile,
    partnerDailyLog: maskedDailyLog,
    sharing,
    loading,
    error,
    refetch: fetchPartnerData,
    getPregnancyWeek: getPartnerPregnancyWeek,
    getDaysUntilDue: getPartnerDaysUntilDue,
    getBabyAgeDays,
    getCyclePhaseInfo,
    getDaysUntilNextPeriod
  };
};
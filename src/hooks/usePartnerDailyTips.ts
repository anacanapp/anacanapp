import { tr, mapRowsTranslation } from "@/lib/tr";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { useMemo } from 'react';

interface PartnerDailyTip {
  id: string;
  tip_text: string;
  tip_text_az: string | null;
  tip_emoji: string;
  life_stage: string;
  week_number: number | null;
  sort_order: number;
}

// Fetch partner daily tips from database
export const usePartnerDailyTips = (lifeStage?: string) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['partner-daily-tips', lifeStage, language],
    queryFn: async () => {
      let query = supabase.
      from('partner_daily_tips').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (lifeStage) {
        query = query.eq('life_stage', lifeStage);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching partner daily tips:', error);
        return [];
      }

      return mapRowsTranslation(data, language, ['tip_text']) as unknown as PartnerDailyTip[];
    },
    staleTime: 1000 * 60 * 30 // 30 minutes
  });
};

// Get a random daily tip based on date (changes daily)
export const useDailyTip = (lifeStage?: string, weekNumber?: number) => {
  const { data: tips = [], isLoading } = usePartnerDailyTips(lifeStage);

  const dailyTip = useMemo(() => {
    if (!tips.length) return null;

    // Filter by week if provided
    let filteredTips = tips;
    if (weekNumber) {
      const weekSpecific = tips.filter((t) => t.week_number === weekNumber);
      if (weekSpecific.length > 0) {
        filteredTips = weekSpecific;
      } else {
        // Fallback to general tips (no week specified)
        filteredTips = tips.filter((t) => !t.week_number);
      }
    }

    if (!filteredTips.length) {
      filteredTips = tips;
    }

    // Use date to get consistent daily tip
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (
      1000 * 60 * 60 * 24)
    );
    const index = dayOfYear % filteredTips.length;

    return filteredTips[index];
  }, [tips, weekNumber]);

  return {
    tip: dailyTip,
    isLoading,
    tipText: dailyTip?.tip_text || tr("usepartnerdailytips_heyat_yoldasiniza_bu_gun_gozel_b30548", "H\u0259yat yolda\u015F\u0131n\u0131za bu g\xFCn g\xF6z\u0259l bir jest edin!"),
    tipEmoji: dailyTip?.tip_emoji || '💕'
  };
};

// Static fallback tips
export const FALLBACK_PARTNER_TIPS = [
{ tip_text_az: tr("usepartnerdailytips_heyat_yoldasiniza_bu_gun_gozel_b30548", "H\u0259yat yolda\u015F\u0131n\u0131za bu g\xFCn g\xF6z\u0259l bir jest edin!"), tip_emoji: '💕' },
{ tip_text_az: tr("usepartnerdailytips_ona_sevdiyi_qelyanalti_alin_c76822", "Ona sevdiyi q\u0259lyanalt\u0131 al\u0131n"), tip_emoji: '🍫' },
{ tip_text_az: tr("usepartnerdailytips_ayaq_masaji_etmeyi_teklif_edin_02109b", "Ayaq masaj\u0131 etm\u0259yi t\u0259klif edin"), tip_emoji: '💆' },
{ tip_text_az: tr("usepartnerdailytips_ona_bu_gun_ne_qeder_gozel_goru_f8391d", "Ona bu g\xFCn n\u0259 q\u0259d\u0259r g\xF6z\u0259l g\xF6r\xFCnd\xFCy\xFCn\xFC s\xF6yl\u0259yin"), tip_emoji: '💕' },
{ tip_text_az: tr("usepartnerdailytips_ev_islerine_komek_edin_4f7415", "Ev i\u015Fl\u0259rin\u0259 k\xF6m\u0259k edin"), tip_emoji: '🧹' }];
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tr, mapRowsTranslation } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { useUserStore } from '@/store/userStore';
import { subDays, format } from 'date-fns';

export interface MoodCheckin {
  id: string;
  user_id: string;
  mood_level: number;
  mood_type: string | null;
  notes: string | null;
  checked_at: string;
  created_at: string;
}

export interface EPDSAssessment {
  id: string;
  user_id: string;
  total_score: number;
  answers: Record<string, number>;
  risk_level: 'low' | 'moderate' | 'high';
  recommendation: string | null;
  completed_at: string;
}

export interface MentalHealthResource {
  id: string;
  name: string;
  name_az: string;
  description: string | null;
  description_az: string | null;
  resource_type: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  address_az: string | null;
  is_emergency: boolean;
}

// EPDS Questions in Azerbaijani
export const EPDS_QUESTIONS = [
{
  id: 1,
  question: tr("usementalhealth_son_7_gun_erzinde_gulmek_ve_gulmeli_tere_69e031", "Son 7 gün ərzində gülmək və gülməli tərəfləri görmək mümkün oldu:"),
  options: [
  { value: 0, label: tr("usementalhealth_hemiseki_kimi_e708ee", "Həmişəki kimi") },
  { value: 1, label: tr("usementalhealth_indi_o_qeder_de_yox_91ad4a", "İndi o qədər də yox") },
  { value: 2, label: tr("usementalhealth_evvelki_kimi_deyil_e73285", "Əvvəlki kimi deyil") },
  { value: 3, label: tr("usementalhealth_umumiyyetle_yox_6e0c1c", "Ümumiyyətlə yox") }]

},
{
  id: 2,
  question: tr("usementalhealth_son_7_gun_erzinde_geleceye_hevesle_baxdi_191d48", "Son 7 gün ərzində gələcəyə həvəslə baxdım:"),
  options: [
  { value: 0, label: tr("usementalhealth_hemiseki_qeder_be9ff8", "Həmişəki qədər") },
  { value: 1, label: tr("usementalhealth_evvelkinden_bir_az_az_aa492a", "Əvvəlkindən bir az az") },
  { value: 2, label: tr("usementalhealth_evvelkinden_xeyli_az_b06dd4", "Əvvəlkindən xeyli az") },
  { value: 3, label: tr("usementalhealth_demek_olar_ki_hec_7d8e43", "Demək olar ki, heç") }]

},
{
  id: 3,
  question: tr("usementalhealth_son_7_gun_erzinde_nese_sehv_getdikde_ozu_7020d6", "Son 7 gün ərzində nəsə səhv getdikdə özümü əsassız yerə günahlandırdım:"),
  options: [
  { value: 3, label: tr("usementalhealth_beli_cox_vaxt_b3c387", "Bəli, çox vaxt") },
  { value: 2, label: tr("usementalhealth_beli_bezen_3972c9", "Bəli, bəzən") },
  { value: 1, label: tr("mentalhealth_tez_tez_deyil", 'Tez-tez deyil') },
  { value: 0, label: tr("usementalhealth_xeyr_hec_vaxt_b57661", "Xeyr, heç vaxt") }]

},
{
  id: 4,
  question: tr("usementalhealth_son_7_gun_erzinde_hec_bir_sebeb_olmadan__d8ad78", "Son 7 gün ərzində heç bir səbəb olmadan narahat və həyəcanlı oldum:"),
  options: [
  { value: 0, label: tr("usementalhealth_xeyr_umumiyyetle_yox_e2352c", "Xeyr, ümumiyyətlə yox") },
  { value: 1, label: tr("usementalhealth_demek_olar_ki_hec_7d8e43", "Demək olar ki, heç") },
  { value: 2, label: tr("usementalhealth_beli_bezen_3972c9", "Bəli, bəzən") },
  { value: 3, label: tr("usementalhealth_beli_cox_tez_tez_39ed8b", "Bəli, çox tez-tez") }]

},
{
  id: 5,
  question: tr("usementalhealth_son_7_gun_erzinde_hec_bir_sebeb_olmadan__ae94a6", "Son 7 gün ərzində heç bir səbəb olmadan qorxdum və ya panikaya düşdüm:"),
  options: [
  { value: 3, label: tr("usementalhealth_beli_kifayet_qeder_cox_b2f3c8", "Bəli, kifayət qədər çox") },
  { value: 2, label: tr("usementalhealth_beli_bezen_3972c9", "Bəli, bəzən") },
  { value: 1, label: tr("usementalhealth_xeyr_cox_deyil_eb8671", "Xeyr, çox deyil") },
  { value: 0, label: tr("usementalhealth_xeyr_umumiyyetle_yox_e2352c", "Xeyr, ümumiyyətlə yox") }]

},
{
  id: 6,
  question: tr("usementalhealth_son_7_gun_erzinde_isler_meni_cox_yukledi_ee4b49", "Son 7 gün ərzində işlər məni çox yüklədi:"),
  options: [
  { value: 3, label: tr("usementalhealth_beli_cox_vaxt_bacarmirdim_fe6629", "Bəli, çox vaxt bacarmırdım") },
  { value: 2, label: tr("usementalhealth_beli_bezen_evvelki_kimi_bacarmirdim_b5945c", "Bəli, bəzən əvvəlki kimi bacarmırdım") },
  { value: 1, label: tr("usementalhealth_xeyr_ekser_vaxt_yaxsi_idare_edirdim_e2b859", "Xeyr, əksər vaxt yaxşı idarə edirdim") },
  { value: 0, label: tr("usementalhealth_xeyr_hemiseki_kimi_idare_edirdim_02a4c9", "Xeyr, həmişəki kimi idarə edirdim") }]

},
{
  id: 7,
  question: tr("usementalhealth_son_7_gun_erzinde_o_qeder_bedbext_idim_k_1f093c", "Son 7 gün ərzində o qədər bədbəxt idim ki, yuxuya getməkdə çətinlik çəkirdim:"),
  options: [
  { value: 3, label: tr("usementalhealth_beli_cox_vaxt_b3c387", "Bəli, çox vaxt") },
  { value: 2, label: tr("usementalhealth_beli_bezen_3972c9", "Bəli, bəzən") },
  { value: 1, label: tr("mentalhealth_tez_tez_deyil", 'Tez-tez deyil') },
  { value: 0, label: tr("usementalhealth_xeyr_umumiyyetle_yox_e2352c", "Xeyr, ümumiyyətlə yox") }]

},
{
  id: 8,
  question: tr("usementalhealth_son_7_gun_erzinde_ozumu_kederli_ve_ya_be_e00f93", "Son 7 gün ərzində özümü kədərli və ya bədbəxt hiss etdim:"),
  options: [
  { value: 3, label: tr("usementalhealth_beli_cox_vaxt_b3c387", "Bəli, çox vaxt") },
  { value: 2, label: tr("usementalhealth_beli_kifayet_qeder_tez_tez_784be6", "Bəli, kifayət qədər tez-tez") },
  { value: 1, label: tr("mentalhealth_tez_tez_deyil", 'Tez-tez deyil') },
  { value: 0, label: tr("usementalhealth_xeyr_umumiyyetle_yox_e2352c", "Xeyr, ümumiyyətlə yox") }]

},
{
  id: 9,
  question: tr("usementalhealth_son_7_gun_erzinde_o_qeder_bedbext_idim_k_4a4ad7", "Son 7 gün ərzində o qədər bədbəxt idim ki, ağlayırdım:"),
  options: [
  { value: 3, label: tr("usementalhealth_beli_cox_vaxt_b3c387", "Bəli, çox vaxt") },
  { value: 2, label: tr("usementalhealth_beli_kifayet_qeder_tez_tez_784be6", "Bəli, kifayət qədər tez-tez") },
  { value: 1, label: tr("usementalhealth_yalniz_bezen_5e5a2a", "Yalnız bəzən") },
  { value: 0, label: tr("usementalhealth_xeyr_hec_vaxt_b57661", "Xeyr, heç vaxt") }]

},
{
  id: 10,
  question: tr("usementalhealth_son_7_gun_erzinde_ozume_zerer_vermek_fik_fabedb", "Son 7 gün ərzində özümə zərər vermək fikri ağlıma gəldi:"),
  options: [
  { value: 3, label: tr("usementalhealth_beli_kifayet_qeder_tez_tez_784be6", "Bəli, kifayət qədər tez-tez") },
  { value: 2, label: tr("usementalhealth_bezen_6f3d8f", "Bəzən") },
  { value: 1, label: tr("usementalhealth_demek_olar_ki_hec_7d8e43", "Demək olar ki, heç") },
  { value: 0, label: tr("usementalhealth_hec_vaxt_7a641b", "Heç vaxt") }]

}];


export const useMoodCheckins = (days: number = 14) => {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['mood-checkins', user?.id, days],
    queryFn: async () => {
      if (!user?.id) return [];

      const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

      const { data, error } = await supabase.
      from('mood_checkins').
      select('*').
      eq('user_id', user.id).
      gte('checked_at', startDate).
      order('checked_at', { ascending: false });

      if (error) throw error;
      return data as MoodCheckin[];
    },
    enabled: !!user?.id
  });
};

export const useTodayMoodCheckin = () => {
  const { user } = useAuthContext();
  const today = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['mood-checkin-today', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase.
      from('mood_checkins').
      select('*').
      eq('user_id', user.id).
      eq('checked_at', today).
      maybeSingle();

      if (error) throw error;
      return data as MoodCheckin | null;
    },
    enabled: !!user?.id
  });
};

export const useAddMoodCheckin = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async (checkin: {
      mood_level: number;
      mood_type?: string;
      notes?: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase.
      from('mood_checkins').
      upsert({
        user_id: user.id,
        checked_at: today,
        ...checkin
      }, {
        onConflict: 'user_id,checked_at'
      }).
      select().
      single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mood-checkins'] });
      queryClient.invalidateQueries({ queryKey: ['mood-checkin-today'] });
    }
  });
};

export const useEPDSAssessments = () => {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['epds-assessments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase.
      from('epds_assessments').
      select('*').
      eq('user_id', user.id).
      order('completed_at', { ascending: false });

      if (error) throw error;
      return data as EPDSAssessment[];
    },
    enabled: !!user?.id
  });
};

export const useSubmitEPDS = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async (answers: Record<string, number>) => {
      if (!user?.id) throw new Error('User not authenticated');

      const totalScore = Object.values(answers).reduce((sum, val) => sum + val, 0);

      let riskLevel: 'low' | 'moderate' | 'high' = 'low';
      let recommendation = '';

      if (totalScore >= 13) {
        riskLevel = 'high';
        recommendation = tr("usementalhealth_neticeleriniz_yuksek_risk_gost_55d3a7", "N\u0259tic\u0259l\u0259riniz y\xFCks\u0259k risk g\xF6st\u0259rir. Z\u0259hm\u0259t olmasa m\xFCt\u0259x\u0259ssisl\u0259 \u0259laq\u0259 saxlay\u0131n.");
      } else if (totalScore >= 10) {
        riskLevel = 'moderate';
        recommendation = tr("usementalhealth_neticeleriniz_orta_seviyyede_r_c3cd4c", "N\u0259tic\u0259l\u0259riniz orta s\u0259viyy\u0259d\u0259 risk g\xF6st\u0259rir. H\u0259kiminizl\u0259 dan\u0131\u015Fma\u011F\u0131 t\xF6vsiy\u0259 edirik.");
      } else {
        recommendation = tr("usementalhealth_neticeleriniz_normal_seviyyede_cc8dde", "N\u0259tic\u0259l\u0259riniz normal s\u0259viyy\u0259d\u0259dir. \xD6z\xFCn\xFCz\u0259 qay\u011F\u0131 g\xF6st\u0259rm\u0259y\u0259 davam edin.");
      }

      const { data, error } = await supabase.
      from('epds_assessments').
      insert({
        user_id: user.id,
        total_score: totalScore,
        answers,
        risk_level: riskLevel,
        recommendation
      }).
      select().
      single();

      if (error) throw error;
      return data as EPDSAssessment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epds-assessments'] });
    }
  });
};

export const useMentalHealthResources = () => {
  const language = useUserStore((state) => state.language);
  const storeCountry = useUserStore((state) => state.countryCode);
  const { user } = useAuthContext();
  return useQuery({
    queryKey: ['mental-health-resources', language, storeCountry, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('mental_health_resources').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (error) throw error;

      // Yardım nömrələri ÖLKƏYƏ görə seçilir (dil yox): AZ nömrələri (103, 860, ASAN...)
      // yalnız Azərbaycan istifadəçilərinə, UZ nömrələri (103, 112, 1146...) Özbəkistan
      // istifadəçilərinə göstərilir. Profildəki ölkə yoxdursa dilə görə təxmin edilir.
      let activeCountry = storeCountry as string | null;
      if (!activeCountry && user?.id) {
        const { data: prof } = await supabase.
        from('profiles').
        select('country_code').
        eq('user_id', user.id).
        maybeSingle();
        activeCountry = (prof as any)?.country_code || null;
      }
      if (!activeCountry) {
        activeCountry =
        language === 'uz' ? 'UZ' :
        language === 'ka' ? 'GE' :
        language === 'kk' ? 'KZ' :
        language === 'tr' ? 'TR' :
        language === 'ru' ? 'RU' :
        language === 'de' ? 'DE' :
        language === 'ar' ? 'SA' : 'AZ';
      }

      const rows = (data || []) as any[];
      // country_code sütunu köhnə sxemdə olmaya bilər — müdafiəli filtr.
      // Sütun varsa: yalnız istifadəçinin ölkəsinin nömrələri göstərilir (yanlış ölkənin
      // təcili nömrələri təhlükəlidir — boş siyahı yanlış nömrədən yaxşıdır).
      const hasCountryInfo = rows.some((r) => r.country_code);
      const finalRows = hasCountryInfo ?
      rows.filter((r) => (r.country_code || 'AZ') === activeCountry) :
      rows;

      return mapRowsTranslation(finalRows, language, ['name', 'description', 'address']) as unknown as MentalHealthResource[];
    },
    staleTime: 1000 * 60 * 30
  });
};

interface MoodSignal {
  checked_at: string;
  mood_level: number;
}

/**
 * mood_checkins (bu alətin öz qeydləri) ilə daily_logs.mood (Dashboard-dakı Əhval
 * vərəqəsi/MoodDiary) eyni 1-5 miqyasını (1=pis, 5=əla) paylaşır — istifadəçi hansı
 * ekrandan qeyd etsə də, EPDS təklifi hər iki mənbəni nəzərə alsın deyə birləşdirilir.
 * Eyni gün üçün hər iki mənbə varsa, mood_checkins üstünlük təşkil edir (daha spesifik alət).
 */
function mergeMoodSignals(
checkins: MoodCheckin[] = [],
dailyLogs: {log_date: string;mood: number | null;}[] = [])
: MoodSignal[] {
  const byDate = new Map<string, number>();
  const cutoff = format(subDays(new Date(), 14), 'yyyy-MM-dd');

  for (const log of dailyLogs) {
    if (log.mood != null && log.log_date >= cutoff) {
      byDate.set(log.log_date, log.mood);
    }
  }

  for (const c of checkins) {
    byDate.set(c.checked_at, c.mood_level);
  }

  return Array.from(byDate.entries()).map(([checked_at, mood_level]) => ({ checked_at, mood_level }));
}

// Check if user should be prompted for EPDS
export const useShouldShowEPDSPrompt = (dailyLogs?: {log_date: string;mood: number | null;}[]) => {
  const { data: checkins } = useMoodCheckins(14);

  const merged = mergeMoodSignals(checkins, dailyLogs);
  if (!merged.length) return false;

  const lowMoodCount = merged.filter((c) => c.mood_level <= 2).length;
  const consecutiveLowDays = getConsecutiveLowMoodDays(merged);

  return lowMoodCount >= 7 || consecutiveLowDays >= 5;
};

function getConsecutiveLowMoodDays(checkins: MoodSignal[]): number {
  let maxConsecutive = 0;
  let current = 0;

  const sorted = [...checkins].sort((a, b) =>
  new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
  );

  for (const checkin of sorted) {
    if (checkin.mood_level <= 2) {
      current++;
      maxConsecutive = Math.max(maxConsecutive, current);
    } else {
      current = 0;
    }
  }

  return maxConsecutive;
}
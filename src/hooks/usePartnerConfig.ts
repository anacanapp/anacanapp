import { tr } from "@/lib/tr";import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PartnerAchievement {
  id: string;
  achievement_key: string;
  name: string;
  name_az: string | null;
  emoji: string;
  description: string | null;
  description_az: string | null;
  unlock_condition: string | null;
  unlock_threshold: number;
  sort_order: number;
  is_active: boolean;
}

export interface PartnerMenuItem {
  id: string;
  menu_key: string;
  label: string;
  label_az: string | null;
  icon_name: string;
  route: string;
  sort_order: number;
  is_active: boolean;
}

export interface SurpriseCategory {
  id: string;
  category_key: string;
  label: string;
  label_az: string | null;
  emoji: string;
  color_gradient: string;
  sort_order: number;
  is_active: boolean;
}

export const usePartnerAchievements = () => {
  return useQuery({
    queryKey: ['partner-achievements'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('partner_achievements').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (error) throw error;
      return (data || []) as PartnerAchievement[];
    },
    staleTime: 1000 * 60 * 30
  });
};

export const usePartnerMenuItems = () => {
  return useQuery({
    queryKey: ['partner-menu-items'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('partner_menu_items').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (error) throw error;
      return (data || []) as PartnerMenuItem[];
    },
    staleTime: 1000 * 60 * 30
  });
};

export const useSurpriseCategories = () => {
  return useQuery({
    queryKey: ['surprise-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('surprise_categories').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (error) throw error;
      return (data || []) as SurpriseCategory[];
    },
    staleTime: 1000 * 60 * 30
  });
};

// Fallbacks
// NOT: `messages_sent`/`missions_completed` unlock_condition dəyərləri
// gamifikasiyanın iki ayrı sistemini (Sürprizlər -> Nailiyyətlər,
// Missiyalar/Mesajlar -> heç nə) birləşdirmək üçün əlavə olundu - əvvəllər
// yalnız Sürpriz aktivliyi nailiyyət aça bilirdi, gündəlik missiya
// tamamlamaq və ya sevgi/mesaj göndərmək HEÇ BİR nailiyyətə təsir etmirdi.
export const FALLBACK_ACHIEVEMENTS = [
{ achievement_key: 'first_love', name_az: tr("usepartnerconfig_ilk_sevgi", "İlk Sevgi"), emoji: '💕', unlock_condition: 'always_unlocked', unlock_threshold: 0 },
{ achievement_key: 'supporter', name_az: tr("usepartnerconfig_destekci_829677", "D\u0259st\u0259k\xE7i"), emoji: '🤝', unlock_condition: 'always_unlocked', unlock_threshold: 0 },
{ achievement_key: 'caring', name_az: tr("usepartnerconfig_qaygikes_c791ee", "Qay\u011F\u0131ke\u015F"), emoji: '🌟', unlock_condition: 'completed_surprises', unlock_threshold: 3 },
{ achievement_key: 'super_partner', name_az: tr("partnerprofilescreen_super_partner", "Super Partnyor"), emoji: '🏆', unlock_condition: 'completed_surprises', unlock_threshold: 10 },
{ achievement_key: 'family_hero', name_az: tr("usepartnerconfig_aile_qehremani_62b00e", "Ail\u0259 Q\u0259hr\u0259man\u0131"), emoji: '👑', unlock_condition: 'surprise_points', unlock_threshold: 500 },
{ achievement_key: 'messenger', name_az: tr("usepartnerconfig_sevgi_elcisi", "Sevgi Elçisi"), emoji: '💌', unlock_condition: 'messages_sent', unlock_threshold: 10 },
{ achievement_key: 'weekly_hero', name_az: tr("usepartnerconfig_heftelik_qehreman", "Həftəlik Qəhrəman"), emoji: '📅', unlock_condition: 'missions_completed', unlock_threshold: 7 }];


export const FALLBACK_MENU_ITEMS = [
{ menu_key: 'notifications', label_az: tr("usepartnerconfig_bildirisler_54eb88", "Bildiri\u015Fl\u0259r"), icon_name: 'Bell', route: 'notifications' },
{ menu_key: 'partner-privacy', label_az: tr("usepartnerconfig_gizlilik", "Gizlilik"), icon_name: 'Shield', route: 'partner-privacy' },
{ menu_key: 'help', label_az: tr("usepartnerconfig_yardim_da857a", "Yard\u0131m"), icon_name: 'HelpCircle', route: 'help' }];


export const FALLBACK_SURPRISE_CATEGORIES = [
{ category_key: 'romantic', label_az: tr("usepartnerconfig_romantik", "Romantik"), emoji: '❤️', color_gradient: 'from-pink-500 to-rose-600' },
{ category_key: 'care', label_az: tr("usepartnerconfig_qaygi_868e7d", "Qay\u011F\u0131"), emoji: '🤗', color_gradient: 'from-violet-500 to-purple-600' },
{ category_key: 'adventure', label_az: tr("usepartnerconfig_macera_bc3bdc", "Mac\u0259ra"), emoji: '🌟', color_gradient: 'from-amber-500 to-orange-600' },
{ category_key: 'gift', label_az: tr("usepartnerconfig_hediyye_8578f3", "H\u0259diyy\u0259"), emoji: '🎁', color_gradient: 'from-emerald-500 to-teal-600' }];
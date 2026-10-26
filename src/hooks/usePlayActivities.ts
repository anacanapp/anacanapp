import { tr, mapRowsTranslation } from "@/lib/tr";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { useUserStore } from '@/store/userStore';
import { toast } from 'sonner';

export interface PlayActivity {
  id: string;
  title: string;
  title_az: string;
  description: string | null;
  description_az: string | null;
  instructions: string | null;
  instructions_az: string | null;
  min_age_days: number;
  max_age_days: number;
  duration_minutes: number;
  required_items: string[];
  skill_tags: string[];
  image_url: string | null;
  video_url: string | null;
  difficulty_level: string;
}

export interface PlayInventoryItem {
  id: string;
  name: string;
  name_az: string;
  emoji: string | null;
  category: string;
}

export const usePlayActivities = (babyAgeDays?: number, availableItems?: string[]) => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['play-activities', babyAgeDays, availableItems, language],
    queryFn: async () => {
      let query = supabase.
      from('play_activities').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (babyAgeDays !== undefined) {
        query = query.
        lte('min_age_days', babyAgeDays).
        gte('max_age_days', babyAgeDays);
      }

      const { data, error } = await query;
      if (error) throw error;

      let activities = mapRowsTranslation(data, language, ['title', 'description', 'instructions']) as unknown as PlayActivity[];

      // Filter by available items if provided
      if (availableItems?.length) {
        activities = activities.filter((activity) => {
          if (!activity.required_items?.length) return true;
          return activity.required_items.some((item) =>
          availableItems.includes(item.toLowerCase().replace(/\s+/g, '_'))
          );
        });
      }

      return activities;
    },
    staleTime: 1000 * 60 * 5
  });
};

export const usePlayInventoryItems = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['play-inventory-items', language],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('play_inventory_items').
      select('*').
      eq('is_active', true).
      order('sort_order');

      if (error) throw error;
      return mapRowsTranslation(data, language, ['name']) as unknown as PlayInventoryItem[];
    },
    staleTime: 1000 * 60 * 10
  });
};

export const useUserPlayInventory = () => {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['user-play-inventory', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase.
      from('user_play_inventory').
      select('*').
      eq('user_id', user.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });
};

export const useToggleInventoryItem = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async ({ itemName, itemNameAz }: {itemName: string;itemNameAz?: string;}) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Check if item exists
      const { data: existing } = await supabase.
      from('user_play_inventory').
      select('id').
      eq('user_id', user.id).
      eq('item_name', itemName).
      single();

      if (existing) {
        // Remove item
        const { error } = await supabase.
        from('user_play_inventory').
        delete().
        eq('id', existing.id);
        if (error) throw error;
        return { action: 'removed' };
      } else {
        // Add item
        const { error } = await supabase.
        from('user_play_inventory').
        insert({
          user_id: user.id,
          item_name: itemName,
          item_name_az: itemNameAz
        });
        if (error) throw error;
        return { action: 'added' };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-play-inventory'] });
    }
  });
};

export const useLogPlayActivity = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async ({ activityId, rating, notes



    }: {activityId: string;rating?: number;notes?: string;}) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase.
      from('play_activity_logs').
      insert({
        user_id: user.id,
        activity_id: activityId,
        rating,
        notes
      }).
      select().
      single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['play-activity-logs'] });
      toast.success(tr("useplayactivities_oyun_tamamlandi_abeae1", "Oyun tamamland\u0131! \uD83C\uDF89"));
    }
  });
};
import { tr } from "@/lib/tr";import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Review {
  id: string;
  provider_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  user_name?: string;
  user_avatar?: string;
}

export const useProviderReviews = (providerId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['provider-reviews', providerId],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('healthcare_provider_reviews').
      select('*').
      eq('provider_id', providerId).
      eq('is_active', true).
      order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles for reviews
      const userIds = [...new Set((data || []).map((r) => r.user_id))];
      const { data: profiles } = await supabase.
      from('profiles').
      select('user_id, name, avatar_url').
      in('user_id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      return (data || []).map((review) => ({
        ...review,
        user_name: profileMap.get(review.user_id)?.name || tr("useproviderreviews_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"),
        user_avatar: profileMap.get(review.user_id)?.avatar_url
      })) as Review[];
    },
    enabled: !!providerId
  });

  const { data: userReview } = useQuery({
    queryKey: ['user-review', providerId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase.
      from('healthcare_provider_reviews').
      select('*').
      eq('provider_id', providerId).
      eq('user_id', user.id).
      maybeSingle();

      if (error) throw error;
      return data as Review | null;
    },
    enabled: !!providerId && !!user?.id
  });

  const submitReview = useMutation({
    mutationFn: async ({ rating, comment }: {rating: number;comment: string;}) => {
      if (!user?.id) throw new Error(tr("useproviderreviews_i_stifadeci_daxil_olmayib_96484b", "\u0130stifad\u0259\xE7i daxil olmay\u0131b"));

      const { error } = await supabase.
      from('healthcare_provider_reviews').
      upsert({
        provider_id: providerId,
        user_id: user.id,
        rating,
        comment: comment || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'provider_id,user_id'
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-reviews', providerId] });
      queryClient.invalidateQueries({ queryKey: ['user-review', providerId] });
      queryClient.invalidateQueries({ queryKey: ['healthcare-providers'] });
      toast.success(tr("useproviderreviews_reyiniz_ugurla_gonderildi_066d09", "R\u0259yiniz u\u011Furla g\xF6nd\u0259rildi!"));
    },
    onError: () => {
      toast.error(tr("useproviderreviews_rey_gonderilmedi_yeniden_cehd__2c6482", "R\u0259y g\xF6nd\u0259rilm\u0259di. Yenid\u0259n c\u0259hd edin."));
    }
  });

  const deleteReview = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error(tr("useproviderreviews_i_stifadeci_daxil_olmayib_96484b", "\u0130stifad\u0259\xE7i daxil olmay\u0131b"));

      const { error } = await supabase.
      from('healthcare_provider_reviews').
      delete().
      eq('provider_id', providerId).
      eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-reviews', providerId] });
      queryClient.invalidateQueries({ queryKey: ['user-review', providerId] });
      queryClient.invalidateQueries({ queryKey: ['healthcare-providers'] });
      toast.success(tr("useproviderreviews_reyiniz_silindi_5c36ac", "R\u0259yiniz silindi"));
    }
  });

  return {
    reviews,
    userReview,
    isLoading,
    submitReview,
    deleteReview,
    isAuthenticated: !!user
  };
};
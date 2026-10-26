import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ActiveBlock {
  id: string;
  block_type: 'community' | 'full' | string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
}

/**
 * İstifadəçinin ÖZ aktiv blokunu oxuyur (RLS: "Users can see if they are
 * blocked" — yalnız öz sətirləri). Vaxtı keçmiş bloklar nəzərə alınmır.
 *
 * İstifadə yerləri:
 *   - Index.tsx: block_type='full' → tam blok ekranı (BlockedScreen)
 *   - CommunityScreen: istənilən aktiv blok → community bağlıdır paneli
 *
 * Server tərəfdə icra: Duzelis61.sql trigger-ləri (client gate yalnız UX-dır).
 */
export const useActiveBlock = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-active-block', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ActiveBlock | null> => {
      const { data, error } = await supabase.
      from('user_blocks').
      select('id, block_type, reason, expires_at, created_at').
      eq('user_id', user!.id).
      eq('is_active', true).
      order('created_at', { ascending: false });

      if (error) {
        // Cədvəl əlçatmazdırsa istifadəçini bloklu SAYMA (fail-open)
        console.warn('useActiveBlock:', error.message);
        return null;
      }

      const now = Date.now();
      const active = (data || []).find(
        (b: any) => !b.expires_at || new Date(b.expires_at).getTime() > now
      );
      // "full" blok "community" blokdan üstündür — hər ikisi varsa full qaytar
      const full = (data || []).find(
        (b: any) => b.block_type === 'full' && (!b.expires_at || new Date(b.expires_at).getTime() > now)
      );
      return (full || active || null) as ActiveBlock | null;
    }
  });
};

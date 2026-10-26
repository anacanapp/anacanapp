import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { fetchAllRows } from '@/lib/supabaseFetchAll';

export interface AdminRecipe {
  id: string;
  title: string;
  description: string | null;
  category: string;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  calories: number | null;
  ingredients: string[];
  instructions: string[];
  image_url: string | null;
  is_active: boolean;
  tags: string[];
}

export const useAdminRecipesQuery = () => {
  return useQuery({
    queryKey: ['admin-recipes'],
    queryFn: async () => {
      const data = await fetchAllRows((from, to) =>
        supabase.from('admin_recipes').select('*').order('created_at', { ascending: false }).range(from, to)
      );
      return (data || []).map(item => ({
        ...item,
        ingredients: Array.isArray(item.ingredients) ? item.ingredients as string[] : [],
        instructions: Array.isArray(item.instructions) ? item.instructions as string[] : [],
        tags: Array.isArray((item as any).tags) ? (item as any).tags as string[] : [],
      })) as AdminRecipe[];
    },
  });
};

export const useAdminRecipesAdmin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useAdminRecipesQuery();

  // NOT: bu 3 mutasiyanın heç birində onError yox idi, VƏ çağıran
  // komponent (AdminRecipes.tsx) `mutateAsync`-ı try/catch olmadan
  // çağırırdı - bu, əsas Resept Yarat/Yenilə/Sil axınında (ikinci dərəcəli
  // deyil) tam sessiz uğursuzluğa səbəb olurdu.
  const create = useMutation({
    mutationFn: async (item: Partial<AdminRecipe>) => {
      const { error } = await supabase.from('admin_recipes').insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast({ title: tr("useadminrecipes_resept_elave_edildi_fe3c1a", "Resept əlavə edildi") });
    },
    onError: (error: any) => {
      toast({ title: tr("useadminrecipes_xeta_bas_verdi_f22fba", "Xəta baş verdi"), description: error?.message, variant: 'destructive' });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: Partial<AdminRecipe> & { id: string }) => {
      const { error } = await supabase.from('admin_recipes').update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast({ title: tr("useadminrecipes_resept_yenilendi_dd7821", "Resept yeniləndi") });
    },
    onError: (error: any) => {
      toast({ title: tr("useadminrecipes_xeta_bas_verdi_f22fba", "Xəta baş verdi"), description: error?.message, variant: 'destructive' });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('admin_recipes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast({ title: tr("hooks_adminrecipes_resept_silindi", "Resept silindi") });
    },
    onError: (error: any) => {
      toast({ title: tr("useadminrecipes_xeta_bas_verdi_f22fba", "Xəta baş verdi"), description: error?.message, variant: 'destructive' });
    },
  });

  return { ...query, create, update, remove, refetch: query.refetch };
};

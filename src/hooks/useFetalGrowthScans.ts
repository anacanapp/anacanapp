import { useState, useEffect, useCallback } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface FetalGrowthScan {
  id: string;
  user_id: string;
  baby_label: string;
  scan_date: string;
  efw_grams: number;
  notes: string | null;
  created_at: string;
}

/**
 * USM-əsaslı təxmini körpə çəkisi (EFW) qeydləri — Fetal Growth Tracker.
 * Doğuşdan ƏVVƏL istifadə olunur (user_children hələ mövcud deyil), ona görə
 * hər körpə üçün sadə hərf etiketi (baby_label: 'A'/'B'/'C'/'D') istifadə olunur,
 * child_id yox. `fetal_growth_scans` cədvəli hələ generasiya olunmuş
 * supabase/types.ts-də yoxdur — ona görə (supabase as any) ilə sorğulanır
 * (bu, kodda artıq dəfələrlə istifadə olunan qəbul edilmiş nümunədir).
 */
export const useFetalGrowthScans = () => {
  const [scans, setScans] = useState<FetalGrowthScan[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchScans = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await (supabase as any).
      from('fetal_growth_scans').
      select('*').
      eq('user_id', user.id).
      order('scan_date', { ascending: true });

      if (error) throw error;
      setScans((data || []) as FetalGrowthScan[]);
    } catch (error: any) {
      console.error('Error fetching fetal growth scans:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addScan = async (babyLabel: string, scanDate: string, efwGrams: number, notes?: string) => {
    if (!user) return null;
    try {
      const { data, error } = await (supabase as any).
      from('fetal_growth_scans').
      insert({
        user_id: user.id,
        baby_label: babyLabel,
        scan_date: scanDate,
        efw_grams: efwGrams,
        notes: notes || null
      }).
      select().
      single();

      if (error) throw error;

      setScans((prev) => [...prev, data as FetalGrowthScan].sort(
        (a, b) => new Date(a.scan_date).getTime() - new Date(b.scan_date).getTime()
      ));

      toast({ title: tr('fetalgrowth_scan_saved', 'USM qeydi yadda saxlandı! 🤰'), description: `${efwGrams} q` });
      return data;
    } catch (error: any) {
      console.error('Error adding fetal growth scan:', error);
      toast({ title: tr('fetalgrowth_error', 'Xəta baş verdi'), description: error.message, variant: 'destructive' });
      return null;
    }
  };

  const deleteScan = async (scanId: string) => {
    if (!user) return;
    try {
      const { error } = await (supabase as any).
      from('fetal_growth_scans').
      delete().
      eq('id', scanId).
      eq('user_id', user.id);

      if (error) throw error;
      setScans((prev) => prev.filter((s) => s.id !== scanId));
      toast({ title: tr('common_silindi', 'Silindi') });
    } catch (error: any) {
      console.error('Error deleting fetal growth scan:', error);
      toast({ title: tr('fetalgrowth_error', 'Xəta baş verdi'), description: error.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  return { scans, loading, addScan, deleteScan, refetch: fetchScans };
};

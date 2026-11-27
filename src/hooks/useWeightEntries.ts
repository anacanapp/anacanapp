import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { todayKey } from '@/lib/local-date';
import { retainOutboxUser, saveWithOutbox, subscribeOutbox } from '@/lib/offline-outbox';

export interface WeightEntry {
  id: string;
  user_id: string;
  weight: number;
  entry_date: string;
  notes: string | null;
  created_at: string;
}

export const useWeightEntries = () => {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const fetchEntries = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false })
        .limit(100);

      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      console.error('Error fetching weight entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const addEntry = async (weight: number, notes?: string) => {
    if (!user) return null;

    // Queued in the offline outbox first (client UUID id, idempotent replay): a dropped
    // connection or a timeout keeps it and syncs later instead of losing the entry.
    const outcome = await saveWithOutbox(user.id, 'weight_entries', {
      user_id: user.id,
      weight,
      notes: notes || null,
      entry_date: todayKey(),
    });

    if (outcome.status === 'error') {
      console.error('Error adding weight entry:', outcome.error);
      toast({
        title: tr("useweightentries_xeta_bas_verdi_f22fba", "Xəta baş verdi"),
        description: (outcome.error as { message?: string })?.message,
        variant: 'destructive',
      });
      return null;
    }

    const saved = outcome.data as unknown as WeightEntry;
    // Immediately update local state (optimistic while queued, confirmed when saved).
    setEntries(prev => [saved, ...prev.filter(e => e.id !== saved.id)]);
    toast({
      title: tr("useweightentries_ceki_yadda_saxlandi_f56b5a", "Çəki yadda saxlandı! ⚖️"),
      description: `${weight} kg`,
    });
    if (outcome.status === 'saved') void fetchEntries();
    return saved;
  };

  const getStats = () => {
    if (entries.length === 0) return null;

    // Start weight is from profile, or the FIRST (oldest) entry if no profile start weight
    // Entries are ordered by entry_date DESC, so oldest is at the end
    const firstEntryWeight = entries.length > 0 ? entries[entries.length - 1].weight : 0;
    const startWeight = profile?.start_weight || firstEntryWeight;
    
    // Current weight is the LATEST entry (first in the array since ordered DESC)
    const currentWeight = entries[0]?.weight || startWeight;
    const totalGain = currentWeight - startWeight;
    
    return {
      startWeight,
      currentWeight,
      totalGain,
      entryCount: entries.length,
    };
  };

  const updateStartWeight = async (weight: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ start_weight: weight })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: tr("useweightentries_baslangic_ceki_yadda_saxlandi_e650ab", "Başlanğıc çəki yadda saxlandı!"),
        description: `${weight} kg`,
      });
    } catch (error: any) {
      console.error('Error updating start weight:', error);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [user]);

  // Offline outbox: flush queued weight entries (mount, online, app resume) and
  // refetch once a background flush delivered them.
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const unsubscribe = subscribeOutbox((event) => {
      if (event.userId === uid && event.sentTables.includes('weight_entries')) void fetchEntries();
    });
    const release = retainOutboxUser(uid);
    return () => { unsubscribe(); release(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const deleteEntry = async (entryId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('weight_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', user.id);

      if (error) throw error;

      setEntries(prev => prev.filter(e => e.id !== entryId));
      toast({
        title: 'Silindi',
        description: tr("useweightentries_ceki_qeydi_silindi_d9e1c4", "Çəki qeydi silindi"),
      });
    } catch (error: any) {
      console.error('Error deleting weight entry:', error);
      toast({
        title: tr("useweightentries_xeta_bas_verdi_f22fba", "Xəta baş verdi"),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteAllEntries = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('weight_entries')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setEntries([]);
      toast({
        title: tr("useweightentries_sifirlandi_edc3d3", "Sıfırlandı"),
        description: tr("useweightentries_butun_ceki_qeydleri_silindi_9918ff", "Bütün çəki qeydləri silindi"),
      });
    } catch (error: any) {
      console.error('Error deleting all weight entries:', error);
      toast({
        title: tr("useweightentries_xeta_bas_verdi_f22fba", "Xəta baş verdi"),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return {
    entries,
    loading,
    addEntry,
    getStats,
    updateStartWeight,
    deleteEntry,
    deleteAllEntries,
    refetch: fetchEntries,
  };
};

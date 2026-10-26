import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PartnerHospitalBagItem {
  id: string;
  user_id: string;
  item_id: string;
  item_name: string;
  category: 'mom' | 'baby' | 'documents';
  is_checked: boolean;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

export const usePartnerHospitalBag = () => {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<PartnerHospitalBagItem[]>([]);
  const [loading, setLoading] = useState(true);

  const getPartnerUserId = useCallback(async (): Promise<string | null> => {
    if (!profile?.linked_partner_id) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', profile.linked_partner_id)
        .single();

      if (error || !data) return null;
      return data.user_id;
    } catch {
      return null;
    }
  }, [profile?.linked_partner_id]);

  const fetchItems = async () => {
    if (!user) return;

    try {
      const partnerUserId = await getPartnerUserId();
      if (!partnerUserId) {
        setLoading(false);
        return;
      }

      // Fetch partner's hospital bag items
      const { data, error } = await supabase
        .from('hospital_bag_items')
        .select('*')
        .eq('user_id', partnerUserId)
        .order('item_id');

      if (error) throw error;
      setItems((data || []) as PartnerHospitalBagItem[]);
    } catch (error) {
      console.error('Error fetching partner hospital bag items:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = async (itemId: string) => {
    const item = items.find(i => i.item_id === itemId);
    if (!item) return;

    try {
      const partnerUserId = await getPartnerUserId();
      if (!partnerUserId) return;

      const { error } = await supabase
        .from('hospital_bag_items')
        .update({ is_checked: !item.is_checked })
        .eq('user_id', partnerUserId)
        .eq('item_id', itemId);

      if (error) throw error;

      setItems(prev => prev.map(i => 
        i.item_id === itemId ? { ...i, is_checked: !i.is_checked } : i
      ));
    } catch (error) {
      console.error('Error toggling hospital bag item:', error);
    }
  };

  const addItem = async (itemName: string, category: 'mom' | 'baby' | 'documents') => {
    if (!user) return { error: 'No user logged in' };

    try {
      const partnerUserId = await getPartnerUserId();
      if (!partnerUserId) return { error: 'No partner linked' };

      const newItemId = `partner-${Date.now()}`;

      const { data, error } = await supabase
        .from('hospital_bag_items')
        .insert({
          user_id: partnerUserId,
          item_id: newItemId,
          item_name: itemName,
          category,
          is_checked: false,
          added_by: 'partner',
        })
        .select()
        .single();

      if (error) throw error;

      await fetchItems();
      return { data, error: null };
    } catch (error) {
      console.error('Error adding hospital bag item:', error);
      return { data: null, error };
    }
  };

  const getProgress = () => {
    if (items.length === 0) return 0;
    const checked = items.filter(i => i.is_checked).length;
    return (checked / items.length) * 100;
  };

  // Set up realtime subscription — yalnız partnyorun user_id-sinə filtrlənir
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await fetchItems();
      const partnerUserId = await getPartnerUserId();
      if (cancelled || !partnerUserId) return;

      channel = supabase
        .channel(`partner_hospital_bag_changes:${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'hospital_bag_items', filter: `user_id=eq.${partnerUserId}` },
          () => {
            fetchItems();
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [user, profile?.linked_partner_id, getPartnerUserId]);

  return {
    items,
    loading,
    toggleItem,
    addItem,
    getProgress,
    checkedCount: items.filter(i => i.is_checked).length,
    totalCount: items.length,
    refetch: fetchItems,
  };
};

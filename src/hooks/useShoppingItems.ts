import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import type { PushEventData } from '@/lib/push';
import { useAuth } from './useAuth';

export interface ShoppingItem {
  id: string;
  user_id: string;
  partner_id: string | null;
  name: string;
  quantity: number;
  is_checked: boolean;
  priority: 'low' | 'medium' | 'high';
  added_by: string | null;
  created_at: string;
}

export const useShoppingItems = () => {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    if (!user) return;

    try {
      // Təbii olaraq kiçik (istifadəçi + partnyorun siyahısı) cədvəldir, amma
      // illər boyu yığılan işarələnməmiş elementlərə qarşı təhlükəsizlik həddi.
      const { data, error } = await supabase
        .from('shopping_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) throw error;
      
      setItems((data || []) as ShoppingItem[]);
    } catch (error) {
      console.error('Error fetching shopping items:', error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (item: {
    name: string;
    quantity?: number;
    priority?: 'low' | 'medium' | 'high';
  }) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const isPartner = profile?.life_stage === 'partner';
      
      // Get partner's user_id
      let partnerUserId: string | null = null;
      if (profile?.linked_partner_id) {
        const { data: partnerProfile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', profile.linked_partner_id)
          .single();
        partnerUserId = partnerProfile?.user_id || null;
      }

      const { data, error } = await supabase
        .from('shopping_items')
        .insert({
          name: item.name,
          quantity: item.quantity || 1,
          priority: item.priority || 'medium',
          user_id: user.id,
          partner_id: partnerUserId,
          added_by: isPartner ? 'partner' : 'woman'
        })
        .select()
        .single();

      if (error) throw error;
      
      // Send push notification to partner (max 1/day)
      if (partnerUserId) {
        await notifyPartnerAboutShopping(partnerUserId, data.name, data.id);
      }

      await fetchItems();
      return { data, error: null };
    } catch (error) {
      console.error('Error adding shopping item:', error);
      return { data: null, error };
    }
  };

  const notifyPartnerAboutShopping = async (partnerUserId: string, itemName: string, interactionId: string) => {
    try {
      // Check if we already sent a shopping notification today
      const today = new Date().toISOString().split('T')[0];
      const storageKey = `shopping_notif_${today}`;
      
      if (localStorage.getItem(storageKey)) {
        return; // Already notified today
      }

      const adderName = profile?.name || 'Partnyorun';

      const { invokeSendPush } = await import('@/lib/push');
      await invokeSendPush({
        userId: partnerUserId,
        title: tr("useshoppingitems_alisveris_siyahisina_elave_5d9c87", "🛒 Alışveriş siyahısına əlavə"),
        body: `${adderName} "${itemName}" ${tr("useshoppingitems_elave_etdi_siyahini_yoxla", "əlavə etdi. Siyahını yoxla!")}`,
        data: {
          type: 'shopping_list',
          context: 'partner',
          interactionId
        } satisfies PushEventData,
        kind: 'shopping_list'
      });

      localStorage.setItem(storageKey, '1');
    } catch (err) {
      console.error('Error sending shopping notification:', err);
    }
  };

  const toggleItem = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    try {
      const { error } = await supabase
        .from('shopping_items')
        .update({ is_checked: !item.is_checked })
        .eq('id', id);

      if (error) throw error;
      
      await fetchItems();
    } catch (error) {
      console.error('Error toggling shopping item:', error);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchItems();
    } catch (error) {
      console.error('Error deleting shopping item:', error);
    }
  };

  // Set up realtime subscription — siyahı user_id VƏ YA partner_id ilə paylaşılır
  // (RLS eyni OR məntiqini işlədir), ona görə hər iki sütuna görə filtrlənmiş
  // iki handler açırıq ki, dəyişiklik yalnız bu cütlüyə yayımlansın.
  useEffect(() => {
    if (!user) return;
    fetchItems();

    const channel = supabase
      .channel(`shopping_items_changes:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_items', filter: `user_id=eq.${user.id}` },
        () => {
          fetchItems();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_items', filter: `partner_id=eq.${user.id}` },
        () => {
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const uncheckedCount = items.filter(i => !i.is_checked).length;
  const checkedCount = items.filter(i => i.is_checked).length;

  return {
    items,
    loading,
    addItem,
    toggleItem,
    deleteItem,
    uncheckedCount,
    checkedCount,
    refetch: fetchItems
  };
};

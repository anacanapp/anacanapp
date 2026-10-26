import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useHospitalBagTemplates } from './useDynamicTools';

export interface HospitalBagItem {
  id: string;
  user_id: string;
  item_id: string;
  item_name: string;
  category: 'mom' | 'baby' | 'documents';
  is_checked: boolean;
  priority: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useHospitalBag = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<HospitalBagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: templates = [], isLoading: templatesLoading } = useHospitalBagTemplates();

  const fetchItems = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('hospital_bag_items')
        .select('*')
        .eq('user_id', user.id)
        .order('item_id');

      if (error) throw error;

      // If no items exist, initialize with templates from DB
      if (!data || data.length === 0) {
        await initializeFromTemplates();
      } else {
        setItems(data as HospitalBagItem[]);
      }
    } catch (error) {
      console.error('Error fetching hospital bag items:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeFromTemplates = async () => {
    if (!user || templates.length === 0) return;

    try {
      const itemsToInsert = templates.map((template) => ({
        user_id: user.id,
        item_id: template.id,
        item_name: template.item_name,
        category: template.category as 'mom' | 'baby' | 'documents',
        is_checked: false,
        priority: template.priority || 2,
        notes: template.notes || null,
      }));


      const { data, error } = await supabase
        .from('hospital_bag_items')
        .insert(itemsToInsert)
        .select();

      if (error) throw error;
      if (data) setItems(data as HospitalBagItem[]);
    } catch (error) {
      console.error('Error initializing hospital bag items:', error);
    }
  };

  const toggleItem = async (itemId: string) => {
    if (!user) return;

    const item = items.find(i => i.item_id === itemId);
    if (!item) return;

    try {
      const { error } = await supabase
        .from('hospital_bag_items')
        .update({ is_checked: !item.is_checked })
        .eq('user_id', user.id)
        .eq('item_id', itemId);

      if (error) throw error;

      setItems(prev => prev.map(i => 
        i.item_id === itemId ? { ...i, is_checked: !i.is_checked } : i
      ));
    } catch (error) {
      console.error('Error toggling hospital bag item:', error);
    }
  };

  const getProgress = () => {
    if (items.length === 0) return 0;
    const checked = items.filter(i => i.is_checked).length;
    return (checked / items.length) * 100;
  };

  useEffect(() => {
    if (user && !templatesLoading) {
      fetchItems();
    }
  }, [user, templatesLoading, templates]);

  const enrichedItems = items.map(item => {
    const template = templates.find(t => t.id === item.item_id);
    if (template) {
      return {
        ...item,
        item_name: template.item_name,
        notes: template.notes
      };
    }
    return item;
  });

  return {
    items: enrichedItems,
    loading: loading || templatesLoading,
    toggleItem,
    getProgress,
    checkedCount: items.filter(i => i.is_checked).length,
    totalCount: items.length,
    refetch: fetchItems,
  };
};

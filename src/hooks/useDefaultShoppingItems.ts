import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserStore } from '@/store/userStore';
import { mapRowsTranslation } from '@/lib/tr';

export interface DefaultShoppingItem {
  id: string;
  name: string;
  name_az: string | null;
  category: string;
  priority: 'low' | 'medium' | 'high';
  life_stage: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const useDefaultShoppingItems = () => {
  const { profile } = useAuth();
  const language = useUserStore((state) => state.language);
  const [items, setItems] = useState<DefaultShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('default_shopping_items')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      let filteredData = data || [];
      
      // Map translations
      filteredData = mapRowsTranslation(filteredData, language, ['name']);

      // Filter by life_stage if user has a profile
      if (profile?.life_stage) {
        filteredData = filteredData.filter(
          item => item.life_stage === 'all' || item.life_stage === profile.life_stage
        );
      }
      
      setItems(filteredData as DefaultShoppingItem[]);
    } catch (error) {
      console.error('Error fetching default shopping items:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [profile?.life_stage, language]);

  return {
    items,
    loading,
    refetch: fetchItems
  };
};

// Admin hook for managing default shopping items
export const useAdminDefaultShoppingItems = () => {
  const [items, setItems] = useState<DefaultShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('default_shopping_items')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setItems((data || []) as DefaultShoppingItem[]);
    } catch (error) {
      console.error('Error fetching default shopping items:', error);
    } finally {
      setLoading(false);
    }
  };

  const createItem = async (item: Omit<DefaultShoppingItem, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('default_shopping_items')
        .insert(item);

      if (error) throw error;
      await fetchItems();
      return { error: null };
    } catch (error) {
      console.error('Error creating item:', error);
      return { error };
    }
  };

  const updateItem = async (id: string, updates: Partial<DefaultShoppingItem>) => {
    try {
      const { error } = await supabase
        .from('default_shopping_items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await fetchItems();
      return { error: null };
    } catch (error) {
      console.error('Error updating item:', error);
      return { error };
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('default_shopping_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchItems();
      return { error: null };
    } catch (error) {
      console.error('Error deleting item:', error);
      return { error };
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  return {
    items,
    loading,
    createItem,
    updateItem,
    deleteItem,
    refetch: fetchItems
  };
};

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface FavoriteName {
  id: string;
  user_id: string;
  name: string;
  gender: 'boy' | 'girl' | 'unisex';
  meaning: string | null;
  origin: string | null;
  created_at: string;
}

export const useFavoriteNames = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteName[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('favorite_names')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites((data || []) as FavoriteName[]);
    } catch (error) {
      console.error('Error fetching favorite names:', error);
    } finally {
      setLoading(false);
    }
  };

  const addFavorite = async (name: string, gender: 'boy' | 'girl' | 'unisex', meaning?: string, origin?: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('favorite_names')
        .insert({
          user_id: user.id,
          name,
          gender,
          meaning: meaning || null,
          origin: origin || null,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setFavorites(prev => [data as FavoriteName, ...prev]);
      }
    } catch (error) {
      console.error('Error adding favorite name:', error);
    }
  };

  const removeFavorite = async (name: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('favorite_names')
        .delete()
        .eq('user_id', user.id)
        .eq('name', name);

      if (error) throw error;
      setFavorites(prev => prev.filter(f => f.name !== name));
    } catch (error) {
      console.error('Error removing favorite name:', error);
    }
  };

  const toggleFavorite = async (name: string, gender: 'boy' | 'girl' | 'unisex', meaning?: string, origin?: string) => {
    const isFavorite = favorites.some(f => f.name === name);
    if (isFavorite) {
      await removeFavorite(name);
    } else {
      await addFavorite(name, gender, meaning, origin);
    }
  };

  const isFavorite = (name: string) => {
    return favorites.some(f => f.name === name);
  };

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  return {
    favorites,
    loading,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    refetch: fetchFavorites,
  };
};

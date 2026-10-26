import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mapRowsTranslation, getPersistedLanguage } from '@/lib/tr';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  rating: number | null;
  stock: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setProducts(mapRowsTranslation(data || [], getPersistedLanguage(), ['name', 'description', 'category']) as Product[]);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const getProductsByCategory = (category: string) => {
    if (category === 'all') return products;
    return products.filter(p => p.category === category);
  };

  const searchProducts = (query: string) => {
    if (!query.trim()) return products;
    return products.filter(p => 
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.description?.toLowerCase().includes(query.toLowerCase())
    );
  };

  const categories = [...new Set(products.map(p => p.category))];

  return {
    products,
    loading,
    categories,
    getProductsByCategory,
    searchProducts,
    refetch: fetchProducts
  };
};

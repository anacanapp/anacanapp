import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { fetchAllRows } from '@/lib/supabaseFetchAll';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: number;
  shipping_address: {
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
    postal_code?: string;
  } | null;
  billing_address: any | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
  };
}

export const useOrders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data || []) as Order[]);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  return { orders, loading, refetch: fetchOrders };
};

export const useAllOrders = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<(Order & { user_email?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllOrders = async () => {
    try {
      // DÜZƏLİŞ: limitsiz idi — orders 1000-i keçəndə "Sifarişlər" admin
      // səhifəsi (stats.total/pending/processing/completed/revenue daxil)
      // yalnız ilk 1000 sifarişi görürdü.
      const ordersData = await fetchAllRows((from, to) =>
        supabase.from('orders').select('*').order('created_at', { ascending: false }).range(from, to)
      );

      // Get order items for each order
      const ordersWithItems = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: items } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);
          
          return {
            ...order,
            items: items || []
          };
        })
      );

      setOrders(ordersWithItems as (Order & { user_email?: string })[]);
    } catch (error) {
      console.error('Error fetching all orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;
      
      toast({ title: tr("useorders_status_yenilendi_890662", "Status yeniləndi") });
      fetchAllOrders();
    } catch (error: any) {
      toast({ title: tr("useorders_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchAllOrders();
  }, []);

  return { orders, loading, refetch: fetchAllOrders, updateOrderStatus };
};

export const useCart = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCart = async () => {
    if (!user) return;

    try {
      const { data: cartData, error: cartError } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', user.id);

      if (cartError) throw cartError;

      // Fetch product details for each cart item
      const itemsWithProducts = await Promise.all(
        (cartData || []).map(async (item) => {
          const { data: product } = await supabase
            .from('products')
            .select('id, name, price, image_url')
            .eq('id', item.product_id)
            .single();
          
          return {
            ...item,
            product: product || undefined
          };
        })
      );

      setItems(itemsWithProducts as CartItem[]);
    } catch (error) {
      console.error('Error fetching cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (productId: string, quantity: number = 1) => {
    if (!user) {
      toast({ title: tr("useorders_giris_edin_3be3d2", "Giriş edin"), description: tr("useorders_sebete_elave_etmek_ucun_daxil_olun_db21c6", "Səbətə əlavə etmək üçün daxil olun") });
      return;
    }

    try {
      // Check if item already exists
      const existingItem = items.find(i => i.product_id === productId);
      
      if (existingItem) {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + quantity })
          .eq('id', existingItem.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            product_id: productId,
            quantity
          });
        
        if (error) throw error;
      }

      toast({ title: tr("useorders_sebete_elave_edildi_633b0b", "Səbətə əlavə edildi!") });
      fetchCart();
    } catch (error: any) {
      toast({ title: tr("useorders_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) {
      removeFromCart(itemId);
      return;
    }

    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId);

      if (error) throw error;
      fetchCart();
    } catch (error: any) {
      toast({ title: tr("useorders_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      toast({ title: 'Silindi' });
      fetchCart();
    } catch (error: any) {
      toast({ title: tr("useorders_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    }
  };

  const clearCart = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      setItems([]);
    } catch (error: any) {
      console.error('Error clearing cart:', error);
    }
  };

  const createOrder = async (shippingAddress: Order['shipping_address'], notes?: string) => {
    if (!user || items.length === 0) return null;

    try {
      const totalAmount = items.reduce((sum, item) => 
        sum + (item.product?.price || 0) * item.quantity, 0
      );

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          user_id: user.id,
          order_number: `ANA-${Date.now()}`,
          total_amount: totalAmount,
          shipping_address: shippingAddress as any,
          notes,
          status: 'pending'
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product?.name || 'Unknown',
        quantity: item.quantity,
        unit_price: item.product?.price || 0,
        total_price: (item.product?.price || 0) * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Clear cart
      await clearCart();

      toast({ title: tr("useorders_sifaris_yaradildi_6c3ee9", "Sifariş yaradıldı!"), description: tr("useorders_order_number_desc", "Sifariş nömrəsi: {number}").replace("{number}", order.order_number) });
      return order;
    } catch (error: any) {
      toast({ title: tr("useorders_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
      return null;
    }
  };

  useEffect(() => {
    fetchCart();
  }, [user]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);

  return {
    items,
    loading,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    createOrder,
    totalItems,
    totalPrice,
    refetch: fetchCart
  };
};

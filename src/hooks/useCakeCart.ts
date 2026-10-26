import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type Cake } from '@/hooks/useCakes';

export interface CakeCartItem {
  cake: Cake;
  quantity: number;
  customFields: Record<string, string>;
}

interface CakeCartState {
  items: CakeCartItem[];
  addToCart: (cake: Cake, quantity: number, customFields: Record<string, string>) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

export const useCakeCart = create<CakeCartState>()(
  persist(
    (set, get) => ({
      items: [],
      totalItems: 0,
      totalPrice: 0,

      addToCart: (cake, quantity, customFields) => {
        const items = [...get().items, { cake, quantity, customFields }];
        set({
          items,
          totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
          totalPrice: items.reduce((sum, i) => sum + i.cake.price * i.quantity, 0),
        });
      },

      removeItem: (index) => {
        const items = get().items.filter((_, i) => i !== index);
        set({
          items,
          totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
          totalPrice: items.reduce((sum, i) => sum + i.cake.price * i.quantity, 0),
        });
      },

      updateQuantity: (index, quantity) => {
        if (quantity < 1) return;
        const items = [...get().items];
        items[index] = { ...items[index], quantity };
        set({
          items,
          totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
          totalPrice: items.reduce((sum, i) => sum + i.cake.price * i.quantity, 0),
        });
      },

      clearCart: () => set({ items: [], totalItems: 0, totalPrice: 0 }),
    }),
    { name: 'cake-cart' }
  )
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type Cake } from '@/hooks/useCakes';

export interface CakeCartItem {
  cake: Cake;
  quantity: number;
  customFields: Record<string, string>;
  /** Add-ons chosen on the cake page (e.g. the photo box), per cake. Older saved carts have none. */
  extraPrice?: number;
}

/** Price of one cake in the cart, add-ons included. */
export const cakeUnitPrice = (item: CakeCartItem) => Number(item.cake.price) + (Number(item.extraPrice) || 0);
const sumPrice = (items: CakeCartItem[]) => items.reduce((sum, i) => sum + cakeUnitPrice(i) * i.quantity, 0);

interface CakeCartState {
  items: CakeCartItem[];
  addToCart: (cake: Cake, quantity: number, customFields: Record<string, string>, extraPrice?: number) => void;
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

      addToCart: (cake, quantity, customFields, extraPrice = 0) => {
        const items = [...get().items, { cake, quantity, customFields, extraPrice }];
        set({
          items,
          totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
          totalPrice: sumPrice(items),
        });
      },

      removeItem: (index) => {
        const items = get().items.filter((_, i) => i !== index);
        set({
          items,
          totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
          totalPrice: sumPrice(items),
        });
      },

      updateQuantity: (index, quantity) => {
        if (quantity < 1) return;
        const items = [...get().items];
        items[index] = { ...items[index], quantity };
        set({
          items,
          totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
          totalPrice: sumPrice(items),
        });
      },

      clearCart: () => set({ items: [], totalItems: 0, totalPrice: 0 }),
    }),
    { name: 'cake-cart' }
  )
);

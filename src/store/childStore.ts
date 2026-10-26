import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChildData {
  id: string;
  user_id: string;
  name: string;
  birth_date: string;
  gender: 'boy' | 'girl' | 'unknown';
  avatar_emoji: string;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
}

interface ChildState {
  selectedChildId: string | null;
  setSelectedChildId: (childId: string | null) => void;
}

export const useChildStore = create<ChildState>()(
  persist(
    (set) => ({
      selectedChildId: null,
      setSelectedChildId: (childId) => set({ selectedChildId: childId }),
    }),
    {
      name: 'selected-child-storage',
    }
  )
);

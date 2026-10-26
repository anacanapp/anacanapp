// Persistent Timer Store - keeps timers running across page navigation
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearAllTimerNotifications } from '@/utils/timerNotifications';
import { startNativeTimer, stopNativeTimer } from '@/lib/live-timer';

export type TimerType = 'sleep' | 'feeding' | 'diaper' | 'white-noise';

export interface ActiveTimer {
  id: string;
  type: TimerType;
  feedType?: 'left' | 'right';
  label?: string;
  /** Hansı uşağa aiddir (əkiz/üçüzlərdə hər körpənin öz MÜSTƏQİL taymeri olsun deyə).
   *  undefined = tək uşaqlı ailələr / uşaq seçilməyib (əvvəlki davranışla tam uyğundur). */
  childId?: string;
  /** Yalnız GÖRÜNTÜ üçün (FloatingTimerWidget + kilid ekranı) — "Əli — 😴 Yuxu" kimi
   *  fərqləndirmək üçün. Bir uşaqlı ailələrdə ötürülmür (UI-də əlavə qarışıqlıq olmasın). */
  childName?: string;
  startTime: number; // timestamp
}

interface TimerState {
  activeTimers: ActiveTimer[];
  startTimer: (type: TimerType, feedType?: 'left' | 'right', label?: string, childId?: string, childName?: string) => string;
  stopTimer: (id: string) => { durationSeconds: number } | null;
  getActiveTimer: (type: TimerType, feedType?: 'left' | 'right', childId?: string) => ActiveTimer | undefined;
  getElapsedSeconds: (id: string) => number;
  hasAnyActiveTimer: () => boolean;
  clearAllTimers: () => void;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      activeTimers: [],
      
      startTimer: (type, feedType, label, childId, childName) => {
        const id = `${type}-${feedType || 'main'}-${childId || 'nochild'}-${Date.now()}`;
        const timer: ActiveTimer = {
          id,
          type,
          feedType,
          label,
          childId,
          childName,
          startTime: Date.now(),
        };
        
        set((state) => ({
          activeTimers: [...state.activeTimers, timer]
        }));
        
        // Kilid ekranı: iOS Live Activity / Android FGS bildirişi (fallback: lokal bildiriş)
        startNativeTimer(timer);
        
        return id;
      },
      
      stopTimer: (id) => {
        const timer = get().activeTimers.find(t => t.id === id);
        if (!timer) return null;
        
        const durationSeconds = Math.floor((Date.now() - timer.startTime) / 1000);
        
        set((state) => ({
          activeTimers: state.activeTimers.filter(t => t.id !== id)
        }));
        
        // Kilid ekranı aktivliyini/bildirişini dayandır
        stopNativeTimer(id);
        
        return { durationSeconds };
      },
      
      // childId veriləndə YALNIZ o uşağın taymeri qaytarılır — əkiz A üçün başladılan
      // yuxu taymeri əkiz B seçiləndə "davam edir" kimi görünməsin deyə (əvvəlki bug).
      // childId verilməyəndə (tək uşaqlı ailələr) əvvəlki davranış dəyişməz qalır.
      getActiveTimer: (type, feedType, childId) => {
        return get().activeTimers.find(t => 
          t.type === type && 
          (feedType === undefined || t.feedType === feedType) &&
          (t.childId ?? undefined) === (childId ?? undefined)
        );
      },
      
      getElapsedSeconds: (id) => {
        const timer = get().activeTimers.find(t => t.id === id);
        if (!timer) return 0;
        return Math.floor((Date.now() - timer.startTime) / 1000);
      },
      
      hasAnyActiveTimer: () => {
        return get().activeTimers.length > 0;
      },
      
      clearAllTimers: () => {
        get().activeTimers.forEach((t) => stopNativeTimer(t.id));
        clearAllTimerNotifications();
        set({ activeTimers: [] });
      },
    }),
    {
      name: 'anacan-timers',
    }
  )
);

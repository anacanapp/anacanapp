import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ensureCopyLanguage } from '@/lib/ui-copy';
import { quotaManagedStorage } from '@/lib/local-storage';
import { normalizeAppLanguage, setCachedAppLanguage } from '@/lib/app-languages';
import type { LifeStage, UserRole, DailyLog, CycleData, PregnancyData, BabyData, DeliveryType, PostpartumData } from '@/types/anacan';
import { FRUIT_SIZES } from '@/types/anacan';
import { getPregnancyWeek, getDayInWeek, getTrimester, calculateDueDate, getRealCalendarAge } from '@/lib/pregnancy-utils';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const isNative = () => Capacitor.isNativePlatform();

interface UserState {
  isAuthenticated: boolean;
  isOnboarded: boolean;
  hasSeenIntro: boolean;
  hasSelectedLanguage: boolean;
  hasCompletedFunnel: boolean;
  userId: string | null;
  email: string | null;
  name: string | null;
  role: UserRole;
  lifeStage: LifeStage | null;
  partnerCode: string | null;
  linkedPartnerId: string | null;
  
  // Life stage specific data
  lastPeriodDate: Date | null;
  cycleLength: number;
  periodLength: number;
  dueDate: Date | null;
  babyBirthDate: Date | null;
  babyName: string | null;
  babyGender: 'boy' | 'girl' | null;
  babyCount: number;
  multiplesType: 'single' | 'twins' | 'triplets' | 'quadruplets' | null;
  /** Doğuş növü (profiles.delivery_type ilə sinxron) — Doğuşdan Sonra Sağalma məzmununu filtrləmək üçün */
  deliveryType: DeliveryType | null;
  language: string;
  countryCode: string | null;
  
  // Partner's woman data (for partner mode)
  partnerWomanData: {
    name: string;
    lifeStage: LifeStage;
    mood?: number;
    symptoms?: string[];
  } | null;
  
  // Actions
  setAuth: (isAuth: boolean, userId?: string, email?: string, name?: string) => void;
  setOnboarded: (isOnboarded: boolean) => void;
  setHasSeenIntro: (hasSeen: boolean) => void;
  setHasSelectedLanguage: (val: boolean) => void;
  setFunnelCompleted: (v: boolean) => void;
  setLifeStage: (stage: LifeStage) => void;
  setRole: (role: UserRole) => void;
  setLastPeriodDate: (date: Date | null) => void;
  setCycleLength: (length: number) => void;
  setPeriodLength: (length: number) => void;
  setDueDate: (date: Date | null) => void;
  setBabyData: (birthDate: Date, name: string, gender: 'boy' | 'girl', babyCount?: number, multiplesType?: 'single' | 'twins' | 'triplets' | 'quadruplets') => void;
  setDeliveryType: (type: DeliveryType | null) => void;
  setPartnerCode: (code: string) => void;
  setLinkedPartnerId: (id: string | null) => void;
  setPartnerWomanData: (data: UserState['partnerWomanData']) => void;
  setMultiplesData: (babyCount: number, multiplesType: 'single' | 'twins' | 'triplets' | 'quadruplets') => void;
  setLanguage: (lang: string) => void;
  setCountryCode: (code: string | null) => void;
  logout: () => void;
  
  // Computed
  getCycleData: () => CycleData | null;
  getPregnancyData: () => PregnancyData | null;
  getBabyData: () => BabyData | null;
  getPostpartumWeek: () => PostpartumData | null;
}

const generatePartnerCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'ANACAN-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      isOnboarded: false,
      hasSeenIntro: false,
      hasSelectedLanguage: false,
      hasCompletedFunnel: true, // Default true so existing users skip; set to false during onboarding
      userId: null,
      email: null,
      name: null,
      role: 'woman',
      lifeStage: null,
      partnerCode: null,
      linkedPartnerId: null,
      lastPeriodDate: null,
      cycleLength: 28,
      periodLength: 5,
      dueDate: null,
      babyBirthDate: null,
      babyName: null,
      babyGender: null,
      babyCount: 1,
      multiplesType: null,
      deliveryType: null,
      language: 'az',
      countryCode: null,
      partnerWomanData: null,

      setAuth: (isAuth, userId, email, name) => {
        const current = get();
        set({
          isAuthenticated: isAuth,
          userId: userId || null,
          email: email || null,
          name: name || null,
          // Only generate partner code if we don't already have one
          partnerCode: isAuth ? (current.partnerCode || generatePartnerCode()) : null,
        });
      },

      setOnboarded: (isOnboarded) => set({ isOnboarded }),
      setHasSeenIntro: (hasSeenIntro) => {
        set({ hasSeenIntro });
        if (isNative()) {
          void Preferences.set({ key: 'anacan_has_seen_intro', value: String(hasSeenIntro) });
        }
      },
      setHasSelectedLanguage: (hasSelectedLanguage) => {
        set({ hasSelectedLanguage });
        if (isNative()) {
          void Preferences.set({ key: 'anacan_has_selected_language', value: String(hasSelectedLanguage) });
        }
      },
      setFunnelCompleted: (hasCompletedFunnel) => set({ hasCompletedFunnel }),
      setCountryCode: (countryCode) => set({ countryCode }),

      setLifeStage: (stage) => set({ lifeStage: stage }),

      setRole: (role) => set({ role }),

      setLastPeriodDate: (date) => set({ lastPeriodDate: date }),

      setCycleLength: (length) => set({ cycleLength: length }),

      setPeriodLength: (length) => set({ periodLength: length }),

      setDueDate: (date) => set({ dueDate: date }),

      setBabyData: (birthDate, name, gender, babyCount = 1, multiplesType = 'single') => set({
        babyBirthDate: birthDate,
        babyName: name,
        babyGender: gender,
        babyCount,
        multiplesType,
      }),

      setMultiplesData: (babyCount, multiplesType) => set({ babyCount, multiplesType }),

      setDeliveryType: (deliveryType) => set({ deliveryType }),

  setLanguage: (lang) => {
    lang = normalizeAppLanguage(lang);
    set({ language: lang });
    // KRİTİK: getLocaleTag() bunu oxuyur — tarix/ay/həftə adlarının
    // düzgün lokalda formatlanması üçün (əvvəllər yazılmırdı → həmişə az-AZ idi)
    try { localStorage.setItem('language', lang); } catch { /* boş */ }
    // RTL (ar) ↔ LTR keçidi dərhal — reload-a qədər də düzgün istiqamət
    import('@/lib/rtl').then((m) => m.applyDocumentDirection(lang)).catch(() => {});
    if (isNative()) {
      void Preferences.set({ key: 'anacan_app_language', value: lang });
    }
  },

      setPartnerCode: (code) => set({ partnerCode: code }),

      setLinkedPartnerId: (id) => set({ linkedPartnerId: id }),

      setPartnerWomanData: (data) => set({ partnerWomanData: data }),

      logout: () => set({
        isAuthenticated: false,
        isOnboarded: false,
        hasCompletedFunnel: false,
        userId: null,
        email: null,
        name: null,
        role: 'woman',
        lifeStage: null,
        partnerCode: null,
        linkedPartnerId: null,
        lastPeriodDate: null,
        dueDate: null,
        babyBirthDate: null,
        babyName: null,
        babyGender: null,
        babyCount: 1,
        multiplesType: null,
        deliveryType: null,
        partnerWomanData: null,
      }),

      getCycleData: () => {
        const { lastPeriodDate, cycleLength, periodLength } = get();
        if (!lastPeriodDate) return null;

        const today = new Date();
        const lastPeriod = new Date(lastPeriodDate);
        const daysSincePeriod = Math.floor((today.getTime() - lastPeriod.getTime()) / (1000 * 60 * 60 * 24));
        const currentDay = (daysSincePeriod % cycleLength) + 1;
        
        let phase: CycleData['phase'];
        if (currentDay <= periodLength) {
          phase = 'menstrual';
        } else if (currentDay <= 13) {
          phase = 'follicular';
        } else if (currentDay <= 16) {
          phase = 'ovulation';
        } else {
          phase = 'luteal';
        }

        const ovulationDay = cycleLength - 14;
        const fertileStart = new Date(lastPeriod);
        fertileStart.setDate(fertileStart.getDate() + ovulationDay - 5);
        const fertileEnd = new Date(lastPeriod);
        fertileEnd.setDate(fertileEnd.getDate() + ovulationDay + 1);

        const nextPeriodDate = new Date(lastPeriod);
        nextPeriodDate.setDate(nextPeriodDate.getDate() + cycleLength);

        return {
          lastPeriodDate: lastPeriod,
          cycleLength,
          periodLength,
          currentDay,
          phase,
          fertileWindow: { start: fertileStart, end: fertileEnd },
          nextPeriodDate,
        };
      },

      getPregnancyData: () => {
        const { lastPeriodDate } = get();
        if (!lastPeriodDate) return null;

        const lastPeriod = new Date(lastPeriodDate);
        
        // Use centralized pregnancy calculation utilities
        const currentWeek = getPregnancyWeek(lastPeriodDate);
        const currentDay = getDayInWeek(lastPeriodDate);
        const trimester = getTrimester(currentWeek);

        const fruitWeek = Object.keys(FRUIT_SIZES)
          .map(Number)
          .filter(w => w <= currentWeek)
          .pop() || 4;
        
        const babySize = FRUIT_SIZES[fruitWeek] || FRUIT_SIZES[4];

        // LMP is the single source of truth across the platform
        const calculatedDueDate = calculateDueDate(lastPeriodDate);

        return {
          dueDate: calculatedDueDate,
          lastPeriodDate: lastPeriod,
          currentWeek,
          currentDay,
          trimester,
          babySize: {
            fruit: babySize.fruit,
            lengthCm: babySize.lengthCm,
            weightG: babySize.weightG,
          },
        };
      },

      getBabyData: () => {
        const { babyBirthDate, babyName, babyGender } = get();
        if (!babyBirthDate || !babyName || !babyGender) return null;

        const age = getRealCalendarAge(babyBirthDate);

        return {
          id: 'baby-1',
          name: babyName,
          birthDate: new Date(babyBirthDate),
          gender: babyGender,
          ageInDays: age.totalDays,
          ageInMonths: age.months,
          ageRemainingDays: age.days,
        };
      },

      /** Doğuşdan Sonra Sağalma məzmununu (məşqlər, bərpa cədvəli, 40 gün checklist) həftəyə görə filtrləmək üçün */
      getPostpartumWeek: () => {
        const { babyBirthDate, deliveryType } = get();
        if (!babyBirthDate) return null;

        const age = getRealCalendarAge(babyBirthDate);

        return {
          birthDate: new Date(babyBirthDate),
          daysSinceBirth: age.totalDays,
          week: Math.floor(age.totalDays / 7),
          deliveryType,
        };
      },
    }),
    {
      name: 'anacan-user-store',
      storage: createJSONStorage(() => quotaManagedStorage(localStorage, { bestEffort: true })),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        isOnboarded: state.isOnboarded,
        hasSeenIntro: state.hasSeenIntro,
        hasCompletedFunnel: state.hasCompletedFunnel,
        userId: state.userId,
        email: state.email,
        name: state.name,
        role: state.role,
        lifeStage: state.lifeStage,
        partnerCode: state.partnerCode,
        linkedPartnerId: state.linkedPartnerId,
        lastPeriodDate: state.lastPeriodDate,
        cycleLength: state.cycleLength,
        periodLength: state.periodLength,
        dueDate: state.dueDate,
        babyBirthDate: state.babyBirthDate,
        babyName: state.babyName,
        babyGender: state.babyGender,
        babyCount: state.babyCount,
        multiplesType: state.multiplesType,
        deliveryType: state.deliveryType,
        language: state.language,
        hasSelectedLanguage: state.hasSelectedLanguage,
        // KRİTİK: countryCode persist olunmurdu — InitialLanguageScreen-də seçilən
        // ölkə qeyri-az dillərdə dərhal gələn window.location.reload() ilə silinir,
        // qeydiyyata NULL gedirdi ("Naməlum ölkə" statistikasının səbəblərindən biri).
        countryCode: state.countryCode,
      }),
    }
  )
);

// Keep tr()'s in-memory language in step with every store write (setLanguage,
// hydration, logout) so it never has to re-read the persisted store.
if (useUserStore.persist.hasHydrated()) setCachedAppLanguage(useUserStore.getState().language);
useUserStore.subscribe((state, previous) => {
  if (state.language !== previous.language) {
    setCachedAppLanguage(state.language);
    // Language set without ensureLanguageReady (e.g. server preference after login): fetch its copy chunk.
    void ensureCopyLanguage(state.language);
  }
});

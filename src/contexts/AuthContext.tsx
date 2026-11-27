import { tr } from "@/lib/tr";import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { runLogoutCleanup } from '@/lib/logout-cleanup';
import { supabase, authStorage } from '@/integrations/supabase/client';
import { setRequestTimeoutMessage } from '@/lib/network-timeout';
import { OFFLINE_RESTORE_GRACE_MS, isSessionExpired, readStoredSession, type StoredSession } from '@/lib/offline-session';
import { isAzureBackend } from '@/integrations/supabase/backend-config';
import { readCache, writeCache, clearAllCaches } from '@/lib/offlineCache';
import { syncUserTimeZone } from '@/lib/user-timezone';
import { safeAppleWebError, signInWithAppleWeb, usesAzureAppleWebFlow } from '@/lib/apple-web-auth';
const isCapacitorNative = typeof (window as any)?.Capacitor?.isNativePlatform === 'function' &&
  (window as any).Capacitor.isNativePlatform();
import { useUserStore } from '@/store/userStore';
import { storedCalendarDate } from '@/lib/stored-date-key';
import { useShallow } from 'zustand/react/shallow';
import type { User, Session } from '@supabase/supabase-js';
import type { Json } from '@/integrations/supabase/types';

// Clear, localized retry text for SDK request timeouts (the client cannot import i18n itself).
setRequestTimeoutMessage(() => tr('netsync_timeout_retry', 'Bağlantı zəifdir, cavab gecikdi. Yenidən cəhd edin.'));

/** The persisted SDK session (null when Auth removed it, i.e. after a real sign-out/invalid token). */
const readPersistedSession = (): Promise<StoredSession | null> => {
  try { return readStoredSession(authStorage?.storage, authStorage?.storageKey); } catch { return Promise.resolve(null); }
};

const PROFILE_CACHE_KEY = 'profile';
const ROLE_CACHE_KEY = 'role';
/** auth-js emits SIGNED_IN on every visibility return; the same account is re-read at most this often. */
export const SAME_USER_REHYDRATE_MS = 10 * 60 * 1000;

const json = (value: unknown) => { try { return JSON.stringify(value ?? null); } catch { return ''; } };
/** Same account and no field the app reads changed: keep the previous object reference. */
function sameAuthUser(a: User | null, b: User | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.email === b.email && a.phone === b.phone && a.role === b.role && a.aud === b.aud
    && a.created_at === b.created_at && a.updated_at === b.updated_at && a.last_sign_in_at === b.last_sign_in_at
    && a.email_confirmed_at === b.email_confirmed_at && a.phone_confirmed_at === b.phone_confirmed_at
    && json(a.user_metadata) === json(b.user_metadata) && json(a.app_metadata) === json(b.app_metadata)
    && json(a.identities?.map((i) => [i.id, i.provider])) === json(b.identities?.map((i) => [i.id, i.provider]));
}
const sameSession = (a: Session | null, b: Session | null) => a === b || !!a && !!b
  && a.access_token === b.access_token && a.refresh_token === b.refresh_token && a.expires_at === b.expires_at;
const dateMs = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  // A YYYY-MM-DD profile column is a local calendar day (see storedCalendarDate), not UTC midnight.
  const ms = value instanceof Date ? value.getTime()
    : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? storedCalendarDate(value)?.getTime() ?? NaN
    : new Date(value as string).getTime();
  return Number.isFinite(ms) ? ms : null;
};
const sameDate = (a: unknown, b: unknown) => dateMs(a) === dateMs(b);

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  life_stage: 'flow' | 'bump' | 'mommy' | 'partner' | null;
  partner_code: string | null;
  linked_partner_id: string | null;
  avatar_url: string | null;
  cycle_length: number;
  period_length: number;
  last_period_date: string | null;
  due_date: string | null;
  baby_birth_date: string | null;
  baby_name: string | null;
  baby_gender: 'boy' | 'girl' | null;
  baby_count: number | null;
  multiples_type: 'single' | 'twins' | 'triplets' | 'quadruplets' | null;
  /** Doğuş növü — BirthOnboardingModal.tsx ilə yazılır, Doğuşdan Sonra Sağalma məzmunu üçün oxunur */
  delivery_type: 'natural' | 'cesarean' | 'assisted' | null;
  start_weight: number | null;
  is_premium: boolean | null;
  premium_until: string | null;
  badge_type: string | null;
  bio: string | null;
  // Əvvəllər burada elan edilməmişdi (sütun DB-də var idi, HƏR YERDƏ `as any`
  // ilə oxunurdu — məs. useCommunity.ts, useBanners.ts, useBlog.ts).
  country_code: string | null;
  /** Pregnancy loss support (Duzelis72): the date it ended, the 8-week recovery mode, and partner sharing. */
  pregnancy_loss_date?: string | null;
  loss_recovery_active?: boolean | null;
  loss_share_partner?: boolean | null;
  onboarding_answers?: Json;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  role: 'admin' | 'user' | 'moderator';
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: UserRole | null;
  loading: boolean;
  /** hydrateUser bitib (profil DB/cache-dən oxunub). Onboarding qərarı bundan ƏVVƏL verilməməlidir. */
  profileLoaded: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  signUp: (email: string, password: string, name: string, countryCode?: string | null) => Promise<{data: any;error: any;}>;
  signIn: (email: string, password: string) => Promise<{data: any;error: any;}>;
  signInWithGoogle: () => Promise<{data: any;error: any;}>;
  signInWithApple: () => Promise<{data: any;error: any;}>;
  signOut: () => Promise<{error: any;}>;
  updateProfile: (updates: Partial<Profile>) => Promise<{data: any;error: any;}>;
  linkPartner: (partnerCode: string) => Promise<{error: any;}>;
  fetchProfile: (userId: string) => Promise<Profile | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─────────────────────────────────────────
// Provider
// ─────────────────────────────────────────
export const AuthProvider: React.FC<{children: React.ReactNode;}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  // Optional so AuthProvider also works outside a QueryClientProvider (tests, widgets).
  const queryClient = useContext(QueryClientContext);
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;
  /** Account whose profile/roles/prefs were last hydrated, and when. */
  const hydratedRef = useRef<{ userId: string; at: number } | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;
  const profileRef = useRef<Profile | null>(null);
  profileRef.current = profile;
  /** Opened on the stored account while the token could not be refreshed (offline). */
  const offlineSessionRef = useRef(false);

  // Stable references: ~40 hooks depend on [user]/[profile]; a resume must not replace
  // equal objects and re-run every effect/query in the tree.
  const applyUser = useCallback((next: User | null) => {
    setUser((prev) => sameAuthUser(prev, next) ? prev : next);
  }, []);
  const applySession = useCallback((next: Session | null) => {
    setSession((prev) => sameSession(prev, next) ? prev : next);
  }, []);
  const applyProfile = useCallback((next: Profile | null) => {
    setProfile((prev) => prev === next || (prev && next && json(prev) === json(next)) ? prev : next);
  }, []);
  const applyRole = useCallback((next: UserRole | null) => {
    setUserRole((prev) => (prev?.role ?? null) === (next?.role ?? null) ? prev : next);
  }, []);

  // useShallow: bu 12 sahə userStore-un action funksiyalarıdır (referansları
  // stabildir), amma seçicisiz useUserStore() BÜTÜN store obyektinə abunə
  // yazır — dilin/cycle-in/hər hansı sahənin dəyişməsi AuthProvider-i (bütün
  // ağacın kökü) lazımsız yerə yenidən render edirdi.
  const {
    setAuth,
    setRole,
    setLifeStage,
    setOnboarded,
    setLastPeriodDate,
    setCycleLength,
    setPeriodLength,
    setDueDate,
    setBabyData,
    setMultiplesData,
    setDeliveryType,
    setPartnerCode,
    setLinkedPartnerId,
    logout: storeLogout
  } = useUserStore(
    useShallow((s) => ({
      setAuth: s.setAuth,
      setRole: s.setRole,
      setLifeStage: s.setLifeStage,
      setOnboarded: s.setOnboarded,
      setLastPeriodDate: s.setLastPeriodDate,
      setCycleLength: s.setCycleLength,
      setPeriodLength: s.setPeriodLength,
      setDueDate: s.setDueDate,
      setBabyData: s.setBabyData,
      setMultiplesData: s.setMultiplesData,
      setDeliveryType: s.setDeliveryType,
      setPartnerCode: s.setPartnerCode,
      setLinkedPartnerId: s.setLinkedPartnerId,
      logout: s.logout
    }))
  );

  // ─────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────
  /**
   * Sərt variant: şəbəkə/server xətasında THROW edir.
   * Beləliklə "profil həqiqətən yoxdur" (null) ilə "fetch alınmadı" (throw)
   * fərqlənir — offline-da istifadəçini onboarding-ə atmamaq üçün kritikdir.
   */
  const fetchProfileStrict = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase.
    from('profiles').
    select('*').
    eq('user_id', userId).
    maybeSingle();

    if (error) throw error;
    const p = data as Profile | null;
    if (p) writeCache(PROFILE_CACHE_KEY, userId, p); // son uğurlu profil → cache
    return p;
  }, []);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      return await fetchProfileStrict(userId);
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Offline/server xətası → son vəziyyət cache-dən
      return readCache<Profile>(PROFILE_CACHE_KEY, userId);
    }
  }, [fetchProfileStrict]);

  const fetchUserRole = useCallback(async (userId: string): Promise<UserRole | null> => {
    try {
      const { data, error } = await supabase.
      from('user_roles').
      select('role').
      eq('user_id', userId);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const rolesPriority = ['admin', 'moderator', 'user'];
      const highestRole = rolesPriority.find((r) => data.some((d) => d.role === r));
      const role = highestRole ? { role: highestRole as UserRole['role'] } : null;
      if (role) writeCache(ROLE_CACHE_KEY, userId, role);
      return role;
    } catch (error) {
      console.error('Error fetching user role:', error);
      // Offline → cache (UI rahatlığıdır; real icazələr RLS-dədir)
      return readCache<UserRole>(ROLE_CACHE_KEY, userId);
    }
  }, []);

  const syncProfileToStore = useCallback(
    (profileData: Profile | null, userId?: string) => {
      if (!profileData) {
        setOnboarded(false);
        return;
      }

      if (profileData.partner_code) setPartnerCode(profileData.partner_code);
      // LMP/doğuş tarixi HƏMİŞƏ sinxronlaşdırılır (null daxil) — əvvəllər
      // yalnız truthy dəyər yazılırdı: DB-də təmizlənmiş LMP store-da köhnə
      // dəyəri saxlayır, ProfileEdit formu ona əsaslanıb köhnə tarixi
      // YENİDƏN DB-yə yazırdı ("silinmiş LMP öz-özünə qayıdır" bug-ı)
      // New Date objects only when the value changed: an equal re-sync (resume/refresh)
      // must not notify every store subscriber that compares dates by reference.
      const current = useUserStore.getState() as Partial<{ lastPeriodDate: unknown; dueDate: unknown; babyBirthDate: unknown;
        babyName: unknown; babyGender: unknown; babyCount: unknown; multiplesType: unknown }>;
      if (!sameDate(current.lastPeriodDate, profileData.last_period_date)) {
        setLastPeriodDate(profileData.last_period_date ? storedCalendarDate(profileData.last_period_date) : null);
      }
      if (!sameDate(current.dueDate, profileData.due_date)) setDueDate(profileData.due_date ? storedCalendarDate(profileData.due_date) : null);
      if (profileData.cycle_length) setCycleLength(profileData.cycle_length);
      if (profileData.period_length) setPeriodLength(profileData.period_length);

      // Sync linked partner ID
      setLinkedPartnerId(profileData.linked_partner_id);

      // Pregnancy also needs these values after logout/re-login, when the local
      // store has reset to one child. Keep the count/type pair coherent.
      const babyCount = [1, 2, 3, 4].includes(profileData.baby_count ?? 0) ? profileData.baby_count! : 1;
      const multipleType = (['single', 'twins', 'triplets', 'quadruplets'] as const)[babyCount - 1];
      if (current.babyCount !== babyCount || current.multiplesType !== multipleType) setMultiplesData(babyCount, multipleType);

      if (profileData.baby_birth_date && profileData.baby_name && profileData.baby_gender && (
        !sameDate(current.babyBirthDate, profileData.baby_birth_date) || current.babyName !== profileData.baby_name
        || current.babyGender !== profileData.baby_gender || current.babyCount !== babyCount || current.multiplesType !== multipleType)) {
        setBabyData(storedCalendarDate(profileData.baby_birth_date) ?? new Date(profileData.baby_birth_date), profileData.baby_name, profileData.baby_gender,
          babyCount, multipleType);
      }

      // Doğuş növü — Doğuşdan Sonra Sağalma məzmununu (məşqlər, bərpa cədvəli) filtrləmək üçün
      setDeliveryType(profileData.delivery_type ?? null);

      if (profileData.life_stage === 'partner') {
        setRole('partner');
      } else {
        setRole('woman');
      }

      if (profileData.life_stage) {
        setLifeStage(profileData.life_stage as any);
        setOnboarded(true);
      } else {
        setOnboarded(false);
      }

      // Set analytics user properties for GA + internal tracking + Mixpanel
      if (userId) {
        import('@/lib/analytics').then((m) => {
          m.analytics.setUserId(userId);
          m.analytics.setUserProperties({
            life_stage: profileData.life_stage || 'unknown',
            is_premium: String(profileData.is_premium || false),
            role: profileData.life_stage === 'partner' ? 'partner' : 'woman'
          });
        }).catch(() => {});

        // Mixpanel identification
        import('@/lib/mixpanel').then(({ identifyUser, setSuperProperties }) => {
          identifyUser(userId, {
            $name: profileData.name || undefined,
            $email: profileData.email || undefined,
            life_stage: profileData.life_stage || 'unknown',
            is_premium: profileData.is_premium || false,
            role: profileData.life_stage === 'partner' ? 'partner' : 'woman',
            baby_name: profileData.baby_name || undefined,
            baby_gender: profileData.baby_gender || undefined,
            badge_type: profileData.badge_type || undefined
          });
          setSuperProperties({
            life_stage: profileData.life_stage || 'unknown',
            is_premium: profileData.is_premium || false,
            user_role: profileData.life_stage === 'partner' ? 'partner' : 'woman'
          });
        }).catch(() => {});
      }
    },
    [setOnboarded, setPartnerCode, setLastPeriodDate, setCycleLength, setPeriodLength, setDueDate, setBabyData, setMultiplesData, setDeliveryType, setRole, setLifeStage, setLinkedPartnerId]
  );

  // ─────────────────────────────────────────
  // Auth actions
  // ─────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string, name: string, countryCode?: string | null) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { name, country_code: countryCode, language: useUserStore.getState().language }
        }
      });
      if (error) throw error;
      import('@/lib/analytics').then((m) => m.analytics.logSignUp('email')).catch(() => {});
      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Analytics tracking
      import('@/lib/analytics').then((m) => m.analytics.logLogin('email')).catch(() => {});
      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      if (isCapacitorNative) {
        const nativeAuth = await import('@/lib/native-auth');
        try {
          const data = await nativeAuth.signInWithGoogleNative();
          import('@/lib/analytics').then((m) => m.analytics.logLogin('google')).catch(() => {});
          return { data, error: null };
        } catch (error) {
          if (!(error instanceof nativeAuth.GoogleNativePickerError)) throw error;
          const { resolveGoogleNativeFailure } = await import('@/lib/social-auth-errors');
          const outcome = resolveGoogleNativeFailure(error, (window as any)?.Capacitor?.getPlatform?.());
          if (outcome.report) import('@/lib/crashReporter').then((m) => m.reportAuthError('google', error)).catch(() => {});
          if (outcome.action === 'silent') return { data: null, error: null };
          if (outcome.action === 'browser') {
            // Old Android (no Credential Manager / Play Services, DEVELOPER_ERROR 10, 12500): browser OAuth.
            await nativeAuth.signInWithGoogleBrowserFallback();
            return { data: null, error: null };
          }
          return { data: null, error: outcome.action === 'error' ? outcome.error : error };
        }
      }
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Google sign in error:', error);
      // Cihazlardakı real xəta admin panelində görünsün (Crash Reports)
      import('@/lib/crashReporter').then((m) => m.reportAuthError('google', error)).catch(() => {});
      return { data: null, error };
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    if (usesAzureAppleWebFlow()) {
      try {
        const data = await signInWithAppleWeb();
        import('@/lib/analytics').then((m) => m.analytics.logLogin('apple')).catch(() => {});
        return { data, error: null };
      } catch (error) {
        // No raw Apple result/token reaches console or crash reporting.
        return { data: null, error: safeAppleWebError(error) };
      }
    }
    try {
      const platform = (window as any)?.Capacitor?.getPlatform?.();
      if (isCapacitorNative && platform === 'ios') {
        const { signInWithAppleNative } = await import('@/lib/native-auth');
        let data;
        try {
          data = await signInWithAppleNative();
        } catch (error) {
          // ASAuthorizationError 1001 (sheet closed) = silent; 1000 = clear message, never the raw code.
          const { resolveAppleNativeFailure } = await import('@/lib/social-auth-errors');
          const outcome = resolveAppleNativeFailure(error);
          if (outcome.action === 'rethrow') throw error;
          if (outcome.report) import('@/lib/crashReporter').then((m) => m.reportAuthError('apple', error)).catch(() => {});
          return { data: null, error: outcome.action === 'error' ? outcome.error : null };
        }
        import('@/lib/analytics').then((m) => m.analytics.logLogin('apple')).catch(() => {});
        return { data, error: null };
      }
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Apple sign in error:', error);
      // Cihazlardakı real xəta admin panelində görünsün (Crash Reports)
      import('@/lib/crashReporter').then((m) => m.reportAuthError('apple', error)).catch(() => {});
      return { data: null, error };
    }
  }, []);

  const signOut = useCallback(async () => {
    // Privacy cleanup while the session still exists (device_tokens delete is RLS-scoped):
    // push row + FCM token, pending/delivered local reminders. Bounded; never blocks logout.
    try { await runLogoutCleanup(userRef.current?.id ?? useUserStore.getState().userId ?? null); } catch { /* best effort */ }
    try {
      const { error } = await supabase.auth.signOut();
      // Ignore AuthSessionMissingError - session already gone
      if (error && error.name !== 'AuthSessionMissingError') {
        console.error('Sign out error:', error);
      }
    } catch (error: any) {
      // Still clear state even if signOut throws
      if (error?.name !== 'AuthSessionMissingError') {
        console.error('Sign out error:', error);
      }
    } finally {
      // Always clear local state regardless of server response
      hydratedRef.current = null;
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserRole(null);
      storeLogout();
      try { queryClientRef.current?.clear(); } catch { /* in-memory only */ }
      clearAllCaches(); // offline "son vəziyyət" cache-ləri də getsin
      if (isAzureBackend()) {
        import('@/lib/revenuecat').then(({ logOutRevenueCat }) => logOutRevenueCat()).catch(() => {});
      }
      // Reset Mixpanel on logout
      import('@/lib/mixpanel').then(({ resetMixpanel }) => resetMixpanel()).catch(() => {});
    }
    return { error: null };
  }, [storeLogout]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return { data: null, error: 'No user logged in' };
    try {
      // .single() istifadə etmirik: 0 sətir (profil sətri yaranmayıb) və ya
      // dublikat sətir hallarında PGRST116 ilə çökməsin.
      const { data: rows, error } = await supabase.
      from('profiles').
      update(updates).
      eq('user_id', user.id).
      select();

      if (error) throw error;

      let row = rows?.[0] ?? null;
      if (!row) {
        // Profil sətri yoxdur (signup trigger-i işləməyib) — özümüz yaradaq
        const { data: inserted, error: insErr } = await supabase.
        from('profiles').
        insert({ user_id: user.id, email: user.email, ...updates } as any).
        select();
        if (insErr) throw insErr;
        row = inserted?.[0] ?? null;
      }
      if (!row) throw new Error('Profile row could not be created');
      const newProfile = row as Profile;
      setProfile(newProfile);
      writeCache(PROFILE_CACHE_KEY, user.id, newProfile);
      syncProfileToStore(newProfile, user?.id);
      return { data: newProfile, error: null };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { data: null, error };
    }
  }, [user, syncProfileToStore]);

  const linkPartner = useCallback(async (partnerCode: string) => {
    if (!user) return { error: 'No user logged in' };
    try {
      const { clearStaleOneSidedLink, linkPartnerByCode, PartnerLinkError } = await import('@/lib/partner-link');
      try {
        await linkPartnerByCode(partnerCode);
      } catch (error) {
        if (!(error instanceof PartnerLinkError && error.code === 'PAIRING_CONFLICT' && profile?.linked_partner_id
          && await clearStaleOneSidedLink(user.id))) throw error;
        await linkPartnerByCode(partnerCode);
      }
      const newProfile = await fetchProfileStrict(user.id);
      if (!newProfile) throw new Error('Profile could not be refreshed after pairing');
      setProfile(newProfile);
      syncProfileToStore(newProfile, user.id);
      return { error: null };
    } catch (error) {
      console.error('Link partner error:', error);
      return { error };
    }
  }, [user, profile?.linked_partner_id, fetchProfileStrict, syncProfileToStore]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const [profileData, roleData] = await Promise.all([fetchProfile(user.id), fetchUserRole(user.id)]);
    // Offline-da fetchProfile cache qaytarır; null yalnız cache də yoxdursa gəlir —
    // o halda mövcud vəziyyəti pozmuruq (onboarding-ə atmamaq üçün).
    if (profileData) {
      applyProfile(profileData);
      syncProfileToStore(profileData, user.id);
    }
    if (roleData) applyRole(roleData);
  }, [user, fetchProfile, fetchUserRole, syncProfileToStore, applyProfile, applyRole]);

  // ─────────────────────────────────────────
  // Init & listener
  // ─────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let bootstrapTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const clearBootstrapTimeout = () => {
      if (bootstrapTimeoutId) {
        clearTimeout(bootstrapTimeoutId);
        bootstrapTimeoutId = null;
      }
    };

    const finishLoading = () => {
      if (!mounted) return;
      clearBootstrapTimeout();
      setLoading(false);
    };

    // Failsafe: never let the app stay stuck behind a global loading spinner.
    bootstrapTimeoutId = setTimeout(() => {
      if (!mounted) return;
      console.warn('Auth bootstrap timeout - forcing loading=false');
      finishLoading();
    }, 5000);

    const hydrateUser = async (u: User) => {
      try {
        const [profileRes, roleRes, prefsRes] = await Promise.allSettled([
          fetchProfileStrict(u.id),
          fetchUserRole(u.id),
          supabase.from('user_preferences').select('language').eq('user_id', u.id).maybeSingle()
        ]);

        if (!mounted) return;

        // Profil: server cavabı ilə şəbəkə xətasını fərqləndir.
        //  - fulfilled + null  → profil həqiqətən yoxdur (yeni istifadəçi)
        //  - rejected          → offline/server xətası → son vəziyyət cache-dən
        const profileFetchFailed = profileRes.status === 'rejected';
        const profileData = profileRes.status === 'fulfilled' ?
        profileRes.value :
        readCache<Profile>(PROFILE_CACHE_KEY, u.id);
        if (profileFetchFailed) {
          console.warn('Profile fetch failed — using cached profile:', !!profileData);
        }
        const roleData = roleRes.status === 'fulfilled' ? roleRes.value : readCache<UserRole>(ROLE_CACHE_KEY, u.id);
        const prefsData = prefsRes.status === 'fulfilled' ? prefsRes.value?.data : null;
        const createdTime = new Date(u.created_at).getTime();
        const lastSignInTime = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : createdTime;
        const isFirstLogin = Math.abs(lastSignInTime - createdTime) < 60000;
        const localLang = useUserStore.getState().language;

        const localHasSelected = useUserStore.getState().hasSelectedLanguage;

        if (isFirstLogin) {
          // For newly registered users, their local language choice should be pushed to the DB
          // overriding the default 'az' that the database trigger might have inserted.
          Promise.resolve(supabase.from('user_preferences').upsert({ user_id: u.id, language: localLang }, { onConflict: 'user_id' })).catch(console.error);
        } else if (localHasSelected && localLang) {
          // Bu cihazda istifadəçi dil seçimini AÇIQ şəkildə edib (məs. ilk açılış ekranında tr).
          // Lokal seçim qalib gəlir — serverdəki köhnə dəyər (məs. az) onu ƏZMƏMƏLİDİR.
          // Server yalnız sinxronlanır ki, push bildirişləri düzgün dildə gəlsin.
          if (prefsData?.language !== localLang) {
            Promise.resolve(supabase.from('user_preferences').upsert({ user_id: u.id, language: localLang }, { onConflict: 'user_id' })).catch(console.error);
          }
        } else if (prefsData?.language) {
          // Lokal açıq seçim yoxdur → serverdəki üstünlük tətbiq olunur.
          useUserStore.getState().setLanguage(prefsData.language);
          useUserStore.getState().setHasSelectedLanguage(true);
        } else {
          Promise.resolve(supabase.from('user_preferences').upsert({ user_id: u.id, language: localLang }, { onConflict: 'user_id' })).catch(console.error);
        }
        // Device time zone for server reminders (once per session, only when changed, quiet if the column is missing).
        void syncUserTimeZone(u.id);
        applyProfile(profileData);
        applyRole(roleData);

        setAuth(
          true,
          u.id,
          u.email || '',
          profileData?.name || u.user_metadata?.name || tr("authcontext_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")
        );

        if (profileData) {
          syncProfileToStore(profileData, u.id);
        } else if (!profileFetchFailed) {
          // Server qəti dedi: profil yoxdur → onboarding düzgündür
          syncProfileToStore(null, u.id);
        }
        // profileFetchFailed && !profileData → persist olunmuş zustand vəziyyətinə
        // TOXUNMA: istifadəçi son bildiyi dashboard-da qalır (offline-first).
      } catch (error) {
        console.error('Error hydrating user:', error);
        // Don't clear user/session on hydration error - keep the session alive
      } finally {
        // Onboarding gate-i yalnız bundan sonra qərar verə bilər
        if (mounted) setProfileLoaded(true);
      }
    };

    /** Same account came back (resume): re-read profile/role only, no prefs upsert. */
    const refreshSameUser = async (u: User) => {
      try {
        const [profileRes, roleRes] = await Promise.allSettled([fetchProfileStrict(u.id), fetchUserRole(u.id)]);
        if (!mounted || userRef.current?.id !== u.id) return;
        // A failed read keeps the current state (offline-first); only a server answer updates.
        if (profileRes.status === 'fulfilled' && profileRes.value) {
          const next = profileRes.value;
          if (json(profileRef.current) !== json(next)) {
            applyProfile(next);
            syncProfileToStore(next, u.id);
          }
        }
        if (roleRes.status === 'fulfilled' && roleRes.value) applyRole(roleRes.value);
      } catch { /* keep current state */ }
    };

    const beginHydration = (u: User) => {
      hydratedRef.current = { userId: u.id, at: Date.now() };
      void hydrateUser(u);
    };

    let initialHandled = false;
    /** Read-only open on the stored account: cached profile/role, no network, no logout. */
    const restoreOfflineSession = (stored: StoredSession) => {
      if (!mounted) return;
      const u = stored.user;
      const alreadyRestored = offlineSessionRef.current && userRef.current?.id === u.id;
      offlineSessionRef.current = true;
      if (alreadyRestored) { finishLoading(); return; }
      // at: 0 → the first real session triggers a fresh server read.
      hydratedRef.current = { userId: u.id, at: 0 };
      applySession(stored);
      applyUser(u);
      setAuth(true, u.id, u.email || '', u.user_metadata?.name || tr("authcontext_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"));
      const cachedProfile = readCache<Profile>(PROFILE_CACHE_KEY, u.id);
      const cachedRole = readCache<UserRole>(ROLE_CACHE_KEY, u.id);
      if (cachedProfile) {
        applyProfile(cachedProfile);
        syncProfileToStore(cachedProfile, u.id);
      }
      // No cached profile: the persisted store state stays as it was (offline-first).
      if (cachedRole) applyRole(cachedRole);
      setProfileLoaded(true);
      finishLoading();
    };

    /** The token was refreshed after an offline open: full server read, then send queued writes. */
    const leaveOfflineSession = (u: User) => {
      if (!offlineSessionRef.current) return false;
      offlineSessionRef.current = false;
      beginHydration(u);
      import('@/lib/offline-outbox').then((m) => m.flushOutbox(u.id)).catch(() => {});
      return true;
    };

    // Expired stored token: do not wait for the SDK's refresh retries (~25 s offline).
    let restoreTimer: ReturnType<typeof setTimeout> | null = null;
    void readPersistedSession().then((stored) => {
      if (!mounted || initialHandled || !stored || !isSessionExpired(stored)) return;
      const restore = () => { if (mounted && !initialHandled) restoreOfflineSession(stored); };
      if (typeof navigator !== 'undefined' && navigator.onLine === false) restore();
      else restoreTimer = setTimeout(restore, OFFLINE_RESTORE_GRACE_MS);
    });

    // Network back while opened offline: refresh now (getSession refreshes an expired token;
    // success arrives as TOKEN_REFRESHED, a real invalid token as SIGNED_OUT).
    const onOnline = () => {
      if (offlineSessionRef.current) void supabase.auth.getSession().catch(() => {});
    };
    if (typeof window !== 'undefined') window.addEventListener('online', onOnline);

    // Single source of truth: only onAuthStateChange handles auth state.
    // No separate initializeAuth / getSession call to avoid race conditions.
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('Auth state changed:', event, currentSession?.user?.email);
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        offlineSessionRef.current = false;
        hydratedRef.current = null;
        setSession(null);
        setUser(null);
        setProfile(null);
        setUserRole(null);
        setProfileLoaded(false);
        storeLogout();
        try { queryClientRef.current?.clear(); } catch { /* in-memory only */ }
        clearAllCaches();
        finishLoading();
        import('@/lib/revenuecat').then((m) => m.logOutRevenueCat()).catch(() => {});
        return;
      }

      if (event === 'INITIAL_SESSION') {
        initialHandled = true;
        if (restoreTimer) { clearTimeout(restoreTimer); restoreTimer = null; }
        if (!currentSession?.user) {
          // Auth keeps the stored session only when the refresh failed for a network reason
          // (offline, timeout, captive portal). That is not a logout: open read-only.
          const stored = await readPersistedSession();
          if (!mounted) return;
          if (stored) {
            restoreOfflineSession(stored);
            return;
          }
        }
        if (currentSession?.user) {
          offlineSessionRef.current = false;
          applySession(currentSession);
          applyUser(currentSession.user);
          setAuth(
            true,
            currentSession.user.id,
            currentSession.user.email || '',
            currentSession.user.user_metadata?.name || tr("authcontext_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")
          );
          finishLoading();
          // Set analytics user ID
          import('@/lib/analytics').then((m) => {
            m.analytics.setUserId(currentSession.user.id);
            m.analytics.setUserProperties({ life_stage: '' });
          }).catch(() => {});
          import('@/lib/revenuecat').then((m) => m.identifyUser(currentSession.user.id)).catch(() => {});
          beginHydration(currentSession.user);
        } else {
          // No session on initial load - user is truly not logged in
          storeLogout();
          finishLoading();
        }
        return;
      }

      if (event === 'SIGNED_IN') {
        if (currentSession?.user) {
          const u = currentSession.user;
          const hydrated = hydratedRef.current;
          if (offlineSessionRef.current && hydrated?.userId === u.id) {
            applySession(currentSession);
            applyUser(u);
            finishLoading();
            leaveOfflineSession(u);
            return;
          }
          if (hydrated?.userId === u.id) {
            // Same account (visibility return / duplicate after INITIAL_SESSION): keep the
            // user/session references when nothing changed and skip the full hydration.
            applySession(currentSession);
            applyUser(u);
            finishLoading();
            if (Date.now() - hydrated.at >= SAME_USER_REHYDRATE_MS) {
              hydratedRef.current = { userId: u.id, at: Date.now() };
              void refreshSameUser(u);
            }
            return;
          }
          applySession(currentSession);
          applyUser(u);
          setAuth(
            true,
            currentSession.user.id,
            currentSession.user.email || '',
            currentSession.user.user_metadata?.name || tr("authcontext_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")
          );
          finishLoading();
          beginHydration(currentSession.user);
        }
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        if (currentSession?.user) {
          // Silently update session - don't re-hydrate to avoid flickering. The user
          // object keeps its reference unless a field actually changed.
          applySession(currentSession);
          applyUser(currentSession.user);
          leaveOfflineSession(currentSession.user);
        }
        // Do NOT call storeLogout if token refresh comes back without a session
        // The session might still be recoverable
        return;
      }

      // USER_UPDATED and other events
      if (currentSession?.user) {
        applySession(currentSession);
        applyUser(currentSession.user);
        finishLoading();
        beginHydration(currentSession.user);
      }
    });

    return () => {
      mounted = false;
      clearBootstrapTimeout();
      if (restoreTimer) clearTimeout(restoreTimer);
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = userRole?.role === 'admin';
  const isModerator = userRole?.role === 'moderator' || isAdmin;

  // Dəyər obyekti useMemo-suz hər render-də YENİ referans yaradırdı — bu context-i
  // istehlak edən 130+ fayl (useAuth/useAuthContext) hər auth state dəyişikliyində
  // (hətta uzaq bir componentin dövlət dəyişikliyi ilə) lazımsız yerə re-render olurdu.
  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    profile,
    userRole,
    loading,
    profileLoaded,
    isAdmin,
    isModerator,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signOut,
    updateProfile,
    linkPartner,
    fetchProfile,
    refreshProfile
  }), [
    user, session, profile, userRole, loading, profileLoaded, isAdmin, isModerator,
    signUp, signIn, signInWithGoogle, signInWithApple, signOut, updateProfile, linkPartner,
    fetchProfile, refreshProfile
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>);

};

// ─────────────────────────────────────────
// Hook
// ─────────────────────────────────────────
export const useAuthContext = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
};

/** Same context, but null outside AuthProvider (for widgets rendered anywhere). */
export const useOptionalAuthContext = (): AuthContextValue | null => useContext(AuthContext);

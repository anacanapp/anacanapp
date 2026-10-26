import { tr } from "@/lib/tr";import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isAzureBackend } from '@/integrations/supabase/backend-config';
import { readCache, writeCache, clearAllCaches } from '@/lib/offlineCache';
import { safeAppleWebError, signInWithAppleWeb, usesAzureAppleWebFlow } from '@/lib/apple-web-auth';
const isCapacitorNative = typeof (window as any)?.Capacitor?.isNativePlatform === 'function' &&
  (window as any).Capacitor.isNativePlatform();
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import type { User, Session } from '@supabase/supabase-js';
import type { Json } from '@/integrations/supabase/types';

const PROFILE_CACHE_KEY = 'profile';
const ROLE_CACHE_KEY = 'role';

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
      setLastPeriodDate(profileData.last_period_date ? new Date(profileData.last_period_date) : null);
      setDueDate(profileData.due_date ? new Date(profileData.due_date) : null);
      if (profileData.cycle_length) setCycleLength(profileData.cycle_length);
      if (profileData.period_length) setPeriodLength(profileData.period_length);

      // Sync linked partner ID
      setLinkedPartnerId(profileData.linked_partner_id);

      // Pregnancy also needs these values after logout/re-login, when the local
      // store has reset to one child. Keep the count/type pair coherent.
      const babyCount = [1, 2, 3, 4].includes(profileData.baby_count ?? 0) ? profileData.baby_count! : 1;
      const multipleType = (['single', 'twins', 'triplets', 'quadruplets'] as const)[babyCount - 1];
      setMultiplesData(babyCount, multipleType);

      if (profileData.baby_birth_date && profileData.baby_name && profileData.baby_gender) {
        setBabyData(new Date(profileData.baby_birth_date), profileData.baby_name, profileData.baby_gender,
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
        const { signInWithGoogleNative } = await import('@/lib/native-auth');
        const data = await signInWithGoogleNative();
        import('@/lib/analytics').then((m) => m.analytics.logLogin('google')).catch(() => {});
        return { data, error: null };
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
        const data = await signInWithAppleNative();
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
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserRole(null);
      storeLogout();
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
      const { isAzurePartnerPairingEnabled, linkPartnerByCode } = await import('@/lib/partner-link');
      if (isAzurePartnerPairingEnabled()) {
        await linkPartnerByCode(partnerCode);
        const newProfile = await fetchProfileStrict(user.id);
        if (!newProfile) throw new Error('Profile could not be refreshed after pairing');
        setProfile(newProfile);
        syncProfileToStore(newProfile, user.id);
        return { error: null };
      }

      const { data: partnerProfile, error: findError } = await supabase.
      from('profiles').
      select('id, user_id').
      eq('partner_code', partnerCode).
      maybeSingle();

      if (findError || !partnerProfile) return { error: 'Partner code not found' };

      const { error: updateError } = await supabase.
      from('profiles').
      update({ linked_partner_id: partnerProfile.id, life_stage: 'partner' as const }).
      eq('user_id', user.id);

      if (updateError) throw updateError;

      const { data: myProfile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();
      if (myProfile) {
        await supabase.from('profiles').update({ linked_partner_id: myProfile.id }).eq('user_id', partnerProfile.user_id);
      }

      const newProfile = await fetchProfile(user.id);
      setProfile(newProfile);
      syncProfileToStore(newProfile, user.id);
      return { error: null };
    } catch (error) {
      console.error('Link partner error:', error);
      return { error };
    }
  }, [user, fetchProfile, fetchProfileStrict, syncProfileToStore]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const [profileData, roleData] = await Promise.all([fetchProfile(user.id), fetchUserRole(user.id)]);
    // Offline-da fetchProfile cache qaytarır; null yalnız cache də yoxdursa gəlir —
    // o halda mövcud vəziyyəti pozmuruq (onboarding-ə atmamaq üçün).
    if (profileData) {
      setProfile(profileData);
      syncProfileToStore(profileData, user.id);
    }
    if (roleData) setUserRole(roleData);
  }, [user, fetchProfile, fetchUserRole, syncProfileToStore]);

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
        setProfile(profileData);
        setUserRole(roleData);

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

    // Single source of truth: only onAuthStateChange handles auth state.
    // No separate initializeAuth / getSession call to avoid race conditions.
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('Auth state changed:', event, currentSession?.user?.email);
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setUserRole(null);
        setProfileLoaded(false);
        storeLogout();
        clearAllCaches();
        finishLoading();
        import('@/lib/revenuecat').then((m) => m.logOutRevenueCat()).catch(() => {});
        return;
      }

      if (event === 'INITIAL_SESSION') {
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
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
          void hydrateUser(currentSession.user);
        } else {
          // No session on initial load - user is truly not logged in
          storeLogout();
          finishLoading();
        }
        return;
      }

      if (event === 'SIGNED_IN') {
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          setAuth(
            true,
            currentSession.user.id,
            currentSession.user.email || '',
            currentSession.user.user_metadata?.name || tr("authcontext_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")
          );
          finishLoading();
          void hydrateUser(currentSession.user);
        }
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        if (currentSession?.user) {
          // Silently update session - don't re-hydrate to avoid flickering
          setSession(currentSession);
          setUser(currentSession.user);
        }
        // Do NOT call storeLogout if token refresh comes back without a session
        // The session might still be recoverable
        return;
      }

      // USER_UPDATED and other events
      if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
        finishLoading();
        void hydrateUser(currentSession.user);
      }
    });

    return () => {
      mounted = false;
      clearBootstrapTimeout();
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

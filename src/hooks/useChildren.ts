import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useChildStore } from '@/store/childStore';
import { readCache, writeCache } from '@/lib/offlineCache';
import { getRealCalendarAge, getPrematurityInfo, type PrematurityInfo } from '@/lib/pregnancy-utils';

export interface Child {
  id: string;
  user_id: string;
  name: string;
  birth_date: string;
  /** Orijinal gözlənilən doğum tarixi (EDD). NULL = məlum deyil. Premature aşkarlanması + korreksiya yaşı bundan hesablanır. */
  due_date?: string | null;
  gender: 'boy' | 'girl' | 'unknown';
  country_code?: string | null;
  vaccine_country_code?: string | null;
  avatar_emoji: string;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
}

// MODUL-səviyyəli guard: useChildren bir neçə komponentdə paralel işləyir —
// per-instans ref yarışa səbəb olub eyni uşağı təkrar yaradırdı
const seedAttemptedUsers = new Set<string>();

// Eyni anda mount olunmuş ~7 instansiya (Dashboard, taymer widget, tarixçələr...)
// eyni sorğunu ayrıca göndərirdi; davam edən sorğu paylaşılır.
const inflightChildren = new Map<string, Promise<{ data: Child[] | null; error: unknown }>>();
function loadActiveChildren(userId: string) {
  const pending = inflightChildren.get(userId);
  if (pending) return pending;
  const request = Promise.resolve(supabase
    .from('user_children')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('sort_order'))
    .then(({ data, error }) => ({ data: data as Child[] | null, error }))
    .finally(() => inflightChildren.delete(userId));
  inflightChildren.set(userId, request);
  return request;
}

// Last successful children list per user (offline cache, cleared on logout).
// Offline or on a failed fetch the app keeps showing these instead of an empty
// "add child" state.
const CHILDREN_CACHE_KEY = 'children_v1';
export function readCachedChildren(userId: string): Child[] {
  const cached = readCache<Child[]>(CHILDREN_CACHE_KEY, userId);
  return Array.isArray(cached) ? cached : [];
}
function writeCachedChildren(userId: string, rows: Child[]) {
  writeCache(CHILDREN_CACHE_KEY, userId, rows);
}

export const useChildren = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  // Use Zustand store for global selectedChildId
  const { selectedChildId, setSelectedChildId } = useChildStore();

  // user_children was re-SELECTed on every screen mount (manual useState+fetch). It is
  // now cached by react-query so the ~7 parallel mounts (Dashboard, timer widget,
  // histories…) share one request and a 5 min staleTime keeps later mounts free. The
  // existing offline cache (offlineCache) still provides the instant cold/offline render
  // and the on-error fallback; refetchOnReconnect (react-query default) replaces the old
  // manual 'online' retry.
  const query = useQuery<Child[]>({
    queryKey: ['user-children', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    // Offline/server errors fall back to the cached list immediately; a retry storm on a
    // captive network is not wanted (the 'online' reconnect refetch covers recovery).
    retry: false,
    // Seed from the durable offline cache so a cold/offline launch renders instantly,
    // then refetch in the background (initialDataUpdatedAt: 0 marks it stale).
    initialData: () => {
      if (!userId) return undefined;
      const cached = readCachedChildren(userId);
      return cached.length > 0 ? cached : undefined;
    },
    initialDataUpdatedAt: 0,
    queryFn: async () => {
      const uid = userId!;
      const { data, error } = await loadActiveChildren(uid);
      if (error) throw error;
      let rows = (data || []) as Child[];

      // Backfill: this user has baby fields on profile (from onboarding) but no
      // user_children rows yet — create the first child so Profile/Tools can show it.
      // Guard is module-level and the INSERT runs only when the list is empty, so
      // parallel instances (react-query dedupes to one anyway) cannot duplicate.
      if (rows.length === 0 && !seedAttemptedUsers.has(uid)) {
        const { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .select('baby_name, baby_birth_date, baby_gender, due_date')
          .eq('user_id', uid)
          .maybeSingle();

        if (!profileError && profileRow?.baby_name && profileRow?.baby_birth_date) {
          // Guard YALNIZ həqiqətən seed cəhdi ediləndə "yandırılır" — profil
          // məlumatı hələ boşdursa guard qoyulmur ki, növbəti sorğuda yenidən sınansın.
          seedAttemptedUsers.add(uid);
          const normalizedGender: 'boy' | 'girl' =
            profileRow.baby_gender === 'girl' || profileRow.baby_gender === 'boy'
              ? profileRow.baby_gender
              : 'boy';

          const avatarEmoji = normalizedGender === 'girl' ? '👧' : '👦';

          // user_children-in yeganə unikal indeksi QİSMƏN-dir (WHERE is_active = true),
          // supabase-js .upsert() bu arbiteri tanıya bilmir; bu kod yalnız sətir sayı 0
          // olanda işə düşür, ona görə sadə INSERT təhlükəsizdir.
          const { error: insertError } = await supabase
            .from('user_children')
            .insert({
              user_id: uid,
              name: profileRow.baby_name,
              birth_date: profileRow.baby_birth_date,
              // Premature dəstəyi: profildə EDD hələ silinməyibsə, körpəyə köçür
              due_date: profileRow.due_date ?? null,
              gender: normalizedGender,
              avatar_emoji: avatarEmoji,
              is_active: true,
              sort_order: 0,
            });

          if (insertError) {
            console.error('Error seeding first child from profile:', insertError);
          } else {
            // Yenidən oxu — istər biz yaratmışıq, istər paralel instansiya
            const { data: reread } = await supabase
              .from('user_children')
              .select('*')
              .eq('user_id', uid)
              .eq('is_active', true)
              .order('sort_order');
            const seededRows = (reread || []) as Child[];
            if (seededRows.length > 0) rows = seededRows;
          }
        } else if (profileError) {
          console.error('Error fetching profile for child seeding:', profileError);
        }
      }

      writeCachedChildren(uid, rows);
      return rows;
    },
  });

  // On an offline/server error react-query keeps the last data (seeded from the offline
  // cache), so cached children stay on screen instead of an empty "add child" state.
  const children: Child[] = query.data ?? [];
  /** First load with nothing cached yet. */
  const loading = query.isLoading;
  /** Last fetch failed (offline/server error). Cached children, if any, are still shown. */
  const loadError = query.isError;

  const fetchChildren = useCallback(async () => { await query.refetch(); }, [query]);

  // Derive selectedChild from children array and store's selectedChildId
  const selectedChild = children.find(c => c.id === selectedChildId) || children[0] || null;

  // Wrapper to set selected child - updates the store
  const setSelectedChild = useCallback((child: Child | null) => {
    setSelectedChildId(child?.id || null);
  }, [setSelectedChildId]);

  // Auto-select first child if none selected or the selected one is not in the list.
  useEffect(() => {
    if (children.length === 0) return;
    const current = useChildStore.getState().selectedChildId;
    if (!children.some(c => c.id === current)) setSelectedChildId(children[0].id);
  }, [children, setSelectedChildId]);

  // Profil redaktəsi kimi yerlərdən uşaq məlumatı dəyişəndə dərhal təzələ
  useEffect(() => {
    const handler = () => { void queryClient.invalidateQueries({ queryKey: ['user-children', userId] }); };
    window.addEventListener('anacan:children-updated', handler);
    return () => window.removeEventListener('anacan:children-updated', handler);
  }, [queryClient, userId]);

  const addChild = useCallback(async (childData: {
    name: string;
    birth_date: string;
    gender?: 'boy' | 'girl' | 'unknown';
    avatar_emoji?: string;
    /** Orijinal EDD — premature aşkarlanması üçün (opsional) */
    due_date?: string | null;
  }) => {
    if (!user) return null;

    try {
      const normalizedGender: 'boy' | 'girl' =
        childData.gender === 'girl' || childData.gender === 'boy' ? childData.gender : 'boy';

      const avatarEmoji = childData.avatar_emoji ?? (normalizedGender === 'girl' ? '👧' : '👦');

      const { data, error } = await supabase
        .from('user_children')
        .insert({
          user_id: user.id,
          name: childData.name,
          birth_date: childData.birth_date,
          due_date: childData.due_date ?? null,
          gender: normalizedGender,
          avatar_emoji: avatarEmoji,
          is_active: true,
          sort_order: children.length,
        })
        .select()
        .maybeSingle();

      if (!error && data) {
        await fetchChildren();
        return data as Child;
      }
    } catch (error) {
      console.error('Error adding child:', error);
    }
    return null;
  }, [user, children.length, fetchChildren]);

  const updateChild = useCallback(async (childId: string, updates: Partial<Child>) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('user_children')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', childId)
        .eq('user_id', user.id);

      if (!error) {
        await fetchChildren();
        return true;
      }
    } catch (error) {
      console.error('Error updating child:', error);
    }
    return false;
  }, [user, fetchChildren]);

  const deleteChild = useCallback(async (childId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('user_children')
        .update({ is_active: false })
        .eq('id', childId)
        .eq('user_id', user.id);

      if (!error) {
        if (selectedChild?.id === childId) {
          setSelectedChild(null);
        }
        await fetchChildren();
        return true;
      }
    } catch (error) {
      console.error('Error deleting child:', error);
    }
    return false;
  }, [user, selectedChild, fetchChildren]);

  const getChildAge = useCallback((child: Child) => {
    const age = getRealCalendarAge(child.birth_date);
    const weeks = Math.floor(age.totalDays / 7);

    // Premature dəstəyi: due_date varsa korreksiya olunmuş yaş da hesablanır.
    // corrected* sahələri YALNIZ korreksiya real tətbiq olunanda (premature +
    // korreksiya yaşı < 24 ay) xronoloji dəyərlərdən fərqlənir — əks halda
    // eyni dəyərləri daşıyır, ona görə istehlakçılar birbaşa corrected*
    // istifadə edə bilər.
    const prematurity: PrematurityInfo = getPrematurityInfo(child.birth_date, child.due_date ?? null);
    const useCorrected = prematurity.correctionApplies && prematurity.corrected !== null;
    const corrected = useCorrected ? prematurity.corrected! : age;

    return {
      days: age.totalDays,
      dayNumber: age.dayNumber,
      weeks,
      months: age.months,
      years: age.years,
      remainingMonths: age.remainingMonths,
      remainingDays: age.days,
      displayText: age.displayText,
      // Korreksiya olunmuş (premature deyilsə xronoloji ilə eynidir):
      correctedDays: corrected.totalDays,
      correctedDayNumber: corrected.dayNumber,
      correctedWeeks: Math.floor(corrected.totalDays / 7),
      correctedMonths: corrected.months,
      correctedDisplayText: corrected.displayText,
      correctionApplied: useCorrected,
      isPremature: prematurity.isPremature,
      gestationalWeeksAtBirth: prematurity.gestationalWeeksAtBirth,
      gestationalExtraDays: prematurity.gestationalExtraDays,
    };
  }, []);

  return {
    children,
    selectedChild,
    setSelectedChild,
    loading,
    loadError,
    addChild,
    updateChild,
    deleteChild,
    getChildAge,
    refetch: fetchChildren,
    hasChildren: children.length > 0,
    hasMultipleChildren: children.length > 1,
  };
};

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useChildStore } from '@/store/childStore';
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

export const useChildren = () => {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Use Zustand store for global selectedChildId
  const { selectedChildId, setSelectedChildId } = useChildStore();
  
  // Derive selectedChild from children array and store's selectedChildId
  const selectedChild = children.find(c => c.id === selectedChildId) || children[0] || null;
  
  // Wrapper to set selected child - updates the store
  const setSelectedChild = useCallback((child: Child | null) => {
    setSelectedChildId(child?.id || null);
  }, [setSelectedChildId]);

  const fetchChildren = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await loadActiveChildren(user.id);

      if (error) throw error;
      // Seçim store-dan oxunur: asılılıqda olsaydı, uşaq dəyişəndə bütün instansiyalar yenidən sorğu göndərirdi
      const selectedChildId = useChildStore.getState().selectedChildId;

      const rows = (data || []) as Child[];

      // Backfill: if this user has baby fields on profile (from onboarding) but no user_children rows yet,
      // create the first child automatically so Profile/Tools can show it.
      // Guard modul-səviyyəlidir + upsert ignoreDuplicates → paralel instansiyalar dublikat yarada bilməz.
      if (rows.length === 0 && !seedAttemptedUsers.has(user.id)) {
        const { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .select('baby_name, baby_birth_date, baby_gender, due_date')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!profileError && profileRow?.baby_name && profileRow?.baby_birth_date) {
          // Guard YALNIZ həqiqətən seed cəhdi ediləndə "yandırılır" — profil
          // məlumatı hələ boşdursa (istifadəçi baby_name/baby_birth_date-i
          // sonra dolduracaqsa), guard qoyulmur ki, növbəti fetchChildren()
          // çağırışında YENIDƏN sınansın (əvvəllər guard buradan ƏVVƏL
          // qoyulurdu — sessiya boyu əbədi bloklanırdı).
          seedAttemptedUsers.add(user.id);
          const normalizedGender: 'boy' | 'girl' =
            profileRow.baby_gender === 'girl' || profileRow.baby_gender === 'boy'
              ? profileRow.baby_gender
              : 'boy';

          const avatarEmoji = normalizedGender === 'girl' ? '👧' : '👦';

          // DÜZƏLİŞ: əvvəllər .upsert(..., {onConflict:'user_id,name,birth_date'})
          // idi — user_children-in YEGANƏ unikal indeksi QİSMƏN-dir
          // (WHERE is_active = true, bax Duzelis-dən əvvəlki
          // 20260813150027_user_children_unique_guard.sql). Supabase-js-in
          // .upsert() metodu ON CONFLICT-ə WHERE predikatı əlavə edə bilmir,
          // buna görə Postgres bu qismən indeksi arbiter kimi tanıya bilmir
          // və HƏR sətir 42P10 xətası ilə rədd olunurdu (səssizcə, heç yerdə
          // göstərilmədən) — bu sətrin özü elə YALNIZ mövcud sətir sayı 0
          // olanda işə düşür, ona görə sadə INSERT tam təhlükəsizdir.
          const { error: insertError } = await supabase
            .from('user_children')
            .insert({
              user_id: user.id,
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
              .eq('user_id', user.id)
              .eq('is_active', true)
              .order('sort_order');
            const seededRows = (reread || []) as Child[];
            if (seededRows.length > 0) {
              setChildren(seededRows);
              if (!seededRows.some(c => c.id === selectedChildId)) {
                setSelectedChildId(seededRows[0].id);
              }
              setLoading(false);
              return;
            }
          }
        } else if (profileError) {
          console.error('Error fetching profile for child seeding:', profileError);
        }
      }

      setChildren(rows);

      // Auto-select first child if none selected or selected child is not in the list
      if (rows.length > 0) {
        const currentlySelectedExists = rows.some(c => c.id === selectedChildId);
        if (!currentlySelectedExists) {
          setSelectedChildId(rows[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching children:', error);
    } finally {
      setLoading(false);
    }
  }, [user, setSelectedChildId]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  // Profil redaktəsi kimi yerlərdən uşaq məlumatı dəyişəndə dərhal təzələ
  useEffect(() => {
    const handler = () => fetchChildren();
    window.addEventListener('anacan:children-updated', handler);
    return () => window.removeEventListener('anacan:children-updated', handler);
  }, [fetchChildren]);

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
    addChild,
    updateChild,
    deleteChild,
    getChildAge,
    refetch: fetchChildren,
    hasChildren: children.length > 0,
    hasMultipleChildren: children.length > 1,
  };
};

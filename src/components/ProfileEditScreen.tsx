import { useState, useRef, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { getLocaleTag } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Save, User, Calendar, Loader2, CalendarDays, Baby, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import countriesData from '../../countries.json';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { calculateDueDate, calculateLMPFromDueDate, getPregnancyWeek, getDayInWeek } from '@/lib/pregnancy-utils';
import type { LifeStage } from '@/types/anacan';
import { tr } from "@/lib/tr";

interface ProfileEditScreenProps {
  onBack: () => void;
}

type DateInputMode = 'lmp' | 'dueDate';

// Form input stili — ağ səth + zərif haşiyə
const inputCls = "h-11 rounded-xl";
const inputStyle: React.CSSProperties = { background: 'var(--a-surface)', borderColor: 'var(--a-line-strong)', color: 'var(--a-ink)' };
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: 'var(--a-ink-soft)' };

const ProfileEditScreen = ({ onBack }: ProfileEditScreenProps) => {
  useScrollToTop();

  const { user, profile, updateProfile } = useAuth();
  const { countryCode, setCountryCode, lifeStage, babyName, dueDate, lastPeriodDate, cycleLength, setLifeStage, setDueDate, setLastPeriodDate, setCycleLength, setBabyData, babyGender, babyBirthDate, language } = useUserStore(
    useShallow((s) => ({
      countryCode: s.countryCode,
      setCountryCode: s.setCountryCode,
      lifeStage: s.lifeStage,
      babyName: s.babyName,
      dueDate: s.dueDate,
      lastPeriodDate: s.lastPeriodDate,
      cycleLength: s.cycleLength,
      setLifeStage: s.setLifeStage,
      setDueDate: s.setDueDate,
      setLastPeriodDate: s.setLastPeriodDate,
      setCycleLength: s.setCycleLength,
      setBabyData: s.setBabyData,
      babyGender: s.babyGender,
      babyBirthDate: s.babyBirthDate,
      language: s.language,
    }))
  );
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // KRİTİK BUG DÜZƏLİŞİ: bu ekran əvvəllər uşaq məlumatını (ad/doğuş
  // tarixi/cins) YALNIZ köhnə profiles.baby_* sütunlarına yazırdı və
  // user_children-ə (Dashboard/alətlərin HƏQİQƏTƏN oxuduğu mənbə) ya heç
  // toxunmurdu, ya da "sort_order-a görə birinci uşaq" kimi səhv/kövrək
  // bir "güzgü" yazısı edirdi (çox-uşaqlı valideyndə səhv uşağı yeniləyirdi,
  // uşaq hələ yaranmayıbsa sükutla heç nə etmirdi). İndi birbaşa
  // useChildren().updateChild/addChild ilə DOĞRU sətrə yazılır.
  const { selectedChild, hasChildren, updateChild, addChild } = useChildren();

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Date input mode for pregnancy - default to LMP if available, else dueDate
  const [dateInputMode, setDateInputMode] = useState<DateInputMode>(
    lastPeriodDate ? 'lmp' : 'dueDate'
  );

  const [formData, setFormData] = useState({
    name: profile?.name || '',
    bio: '',
    avatar_url: profile?.avatar_url || '',
    life_stage: (lifeStage || 'bump') as LifeStage,
    // Körpə sahələri əvvəlcə HƏQİQİ mənbədən (user_children.selectedChild) —
    // köhnə Zustand/profiles dəyərləri (babyName/babyBirthDate/babyGender)
    // köhnəlmiş ola bilər, yalnız hələ heç bir user_children sətri yoxdursa
    // fallback kimi istifadə olunur.
    baby_name: selectedChild?.name || babyName || '',
    due_date: dueDate ? new Date(dueDate).toISOString().split('T')[0] : '',
    last_period_date: lastPeriodDate ? new Date(lastPeriodDate).toISOString().split('T')[0] : '',
    cycle_length: cycleLength || 28,
    baby_birth_date: selectedChild?.birth_date || (babyBirthDate ? new Date(babyBirthDate).toISOString().split('T')[0] : ''),
    baby_gender: (selectedChild?.gender === 'girl' ? 'girl' : selectedChild?.gender === 'boy' ? 'boy' : babyGender) || '' as 'boy' | 'girl' | '',
    country_code: (profile as any)?.country_code || countryCode || '',
    // Çoxdöllü hamiləlik (əkiz/üçüz/dördüz) — onboarding-də yazılır, amma
    // sonradan (USM-dən sonra, ya da dəqiqləşdiriləndə) burada dəyişdirilə bilər
    multiples_type: (profile?.multiples_type || 'single') as 'single' | 'twins' | 'triplets' | 'quadruplets',
    // Xorionluq (plasenta növü) — yalnız çoxdöllü hamiləlikdə mənalıdır, adətən
    // 10-14-cü həftə USM-dən sonra məlum olur
    chorionicity: (profile as any)?.chorionicity || ''
  });

  // useChildren() asinxron yüklənir — mount anında selectedChild hələ hazır
  // olmaya bilər (yuxarıdakı useState ilkin dəyəri o zaman köhnə Zustand
  // fallback-ına düşür). Data gələn kimi BİR DƏFƏ sahələri sinxronlaşdırırıq
  // (ref-guard sayəsində istifadəçinin sonrakı əl ilə redaktəsini əzmir).
  const babyFieldsSyncedRef = useRef(false);
  useEffect(() => {
    if (babyFieldsSyncedRef.current || !selectedChild) return;
    babyFieldsSyncedRef.current = true;
    setFormData((prev) => ({
      ...prev,
      baby_name: selectedChild.name,
      baby_birth_date: selectedChild.birth_date,
      baby_gender: selectedChild.gender === 'girl' ? 'girl' : 'boy'
    }));
  }, [selectedChild]);

  // Compute the calculated date based on mode
  const calculatedDates = useMemo(() => {
    if (dateInputMode === 'lmp' && formData.last_period_date) {
      const lmp = new Date(formData.last_period_date);
      const dueDate = calculateDueDate(lmp);
      const week = getPregnancyWeek(lmp);
      const day = getDayInWeek(lmp);
      return {
        calculatedDueDate: dueDate,
        calculatedLMP: null,
        week,
        day
      };
    } else if (dateInputMode === 'dueDate' && formData.due_date) {
      const dd = new Date(formData.due_date);
      const lmp = calculateLMPFromDueDate(dd);
      const week = lmp ? getPregnancyWeek(lmp) : 0;
      const day = lmp ? getDayInWeek(lmp) : 0;
      return {
        calculatedDueDate: null,
        calculatedLMP: lmp,
        week,
        day
      };
    }
    return { calculatedDueDate: null, calculatedLMP: null, week: 0, day: 0 };
  }, [dateInputMode, formData.last_period_date, formData.due_date]);

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const locale = getLocaleTag();
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  };

  useEffect(() => {
    // Load bio from profile if available
    const loadBio = async () => {
      if (!user) return;
      const { data } = await supabase.
      from('profiles').
      select('bio').
      eq('user_id', user.id).
      single();
      if (data && 'bio' in data && data.bio) {
        setFormData((prev) => ({ ...prev, bio: data.bio as string }));
      }
    };
    loadBio();
  }, [user]);

  // Avatarı kvadrat şəklə salır (mərkəzdən kəsir) və kiçildir —
  // uzunsov şəkillər dairəvi avatarda əzilmiş/əyilmiş görünməsin deyə.
  const squareCropAvatar = (file: File, size = 512): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const side = Math.min(img.naturalWidth, img.naturalHeight);
          const sx = (img.naturalWidth - side) / 2;
          const sy = (img.naturalHeight - side) / 2;
          const target = Math.min(size, side);
          const canvas = document.createElement('canvas');
          canvas.width = target;
          canvas.height = target;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas context unavailable');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);
          canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
            'image/jpeg',
            0.88
          );
        } catch (err) {
          reject(err);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load failed'));
      };
      img.src = url;
    });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      // Kvadrat kəsim mümkün olmasa (məs. dəstəklənməyən format), orijinal faylı yüklə
      let uploadBody: Blob = file;
      let fileExt = file.name.split('.').pop() || 'jpg';
      try {
        uploadBody = await squareCropAvatar(file);
        fileExt = 'jpg';
      } catch {
        // fallback: orijinal fayl
      }

      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage.
      from('community-media').
      upload(filePath, uploadBody, { contentType: uploadBody === file ? file.type : 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.
      from('community-media').
      getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, avatar_url: urlData.publicUrl }));
      toast({ title: tr("profileeditscreen_sekil_yuklendi_0c2f85", 'Şəkil yükləndi!') });
    } catch (error: any) {
      toast({ title: tr("profileeditscreen_xeta_3cdbb6", 'Xəta'), description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Calculate effective dates for pregnancy
      let effectiveLMP: string | null = null;
      let effectiveDueDate: string | null = null;

      // TZ-itkisiz serializasiya: toISOString() lokal→UTC çevirməsi UTC+4-də
      // hər LMP↔doğuş tarixi çevrilməsində tarixi 1 gün sürüşdürürdü
      const toLocalDateStr = (d: Date | null) => d ? format(d, 'yyyy-MM-dd') : null;

      if (formData.life_stage === 'bump') {
        if (dateInputMode === 'lmp' && formData.last_period_date) {
          effectiveLMP = formData.last_period_date;
          effectiveDueDate = toLocalDateStr(calculateDueDate(new Date(formData.last_period_date)));
        } else if (dateInputMode === 'dueDate' && formData.due_date) {
          effectiveDueDate = formData.due_date;
          effectiveLMP = toLocalDateStr(calculateLMPFromDueDate(new Date(formData.due_date)));
        }
      }

      // Update profile in database
      const updateData: any = {
        name: formData.name,
        avatar_url: formData.avatar_url,
        bio: formData.bio,
        life_stage: formData.life_stage,
        baby_name: formData.baby_name || null,
        cycle_length: formData.cycle_length,
        country_code: formData.country_code || null
      };

      // KRİTİK BUG DÜZƏLİŞİ ("hamiləlik həftəsi öz-özünə dəyişir"):
      // Əvvəllər HƏR save-də (ad/şəkil dəyişəndə belə) LMP/doğuş tarixi
      // yenidən hesablanıb yazılırdı — dueDate rejimində LMP = doğuş−280
      // düsturu istifadəçinin ƏSL daxil etdiyi LMP-ni əzirdi (üstəlik TZ
      // itkisi ilə hər dövrədə ~1 gün sürüşürdü). İndi tarix sahələri YALNIZ
      // istifadəçi onları həqiqətən DƏYİŞİBSƏ (və ya mərhələ dəyişibsə)
      // payload-a daxil edilir.
      const dbLMP = (profile as any)?.last_period_date || null;
      const dbDue = (profile as any)?.due_date || null;
      const stageChanged = (profile as any)?.life_stage !== formData.life_stage;

      // Set dates based on life stage
      if (formData.life_stage === 'bump') {
        const datesChanged = effectiveLMP !== dbLMP || effectiveDueDate !== dbDue;
        if (stageChanged || datesChanged) {
          // Yalnız aktiv rejimin sahəsi istifadəçi girişidir; digəri hesablanır.
          // Dəyişiklik yoxdursa DB-dəki dəyərlərə TOXUNULMUR.
          const userTouchedDates =
          dateInputMode === 'lmp' ?
          formData.last_period_date !== (dbLMP || '') :
          formData.due_date !== (dbDue || '');
          if (stageChanged || userTouchedDates) {
            updateData.due_date = effectiveDueDate;
            updateData.last_period_date = effectiveLMP;
          }
        }
        updateData.multiples_type = formData.multiples_type;
        updateData.baby_count = formData.multiples_type === 'twins' ? 2 : formData.multiples_type === 'triplets' ? 3 : formData.multiples_type === 'quadruplets' ? 4 : 1;
        updateData.chorionicity = formData.multiples_type === 'single' ? null : formData.chorionicity || null;
      } else if (formData.life_stage === 'flow') {
        const flowLMP = formData.last_period_date || null;
        if (stageChanged || flowLMP !== dbLMP) {
          updateData.last_period_date = flowLMP;
          updateData.due_date = null;
        }
      } else if (stageChanged) {
        // mommy/partner-ə KEÇİD anında tarixlər təmizlənir; sadə profil
        // redaktəsində (mərhələ dəyişməyibsə) onlara toxunulmur
        updateData.last_period_date = null;
        updateData.due_date = null;
      }

      // Add mommy specific fields
      if (formData.life_stage === 'mommy') {
        updateData.baby_birth_date = formData.baby_birth_date || null;
        updateData.baby_gender = formData.baby_gender || null;
      }

      const { error } = await supabase.
      from('profiles').
      update(updateData).
      eq('user_id', user.id);

      if (error) throw error;

      // Update local store using existing actions
      setLifeStage(formData.life_stage);

      // Sync pregnancy dates to local store
      if (formData.life_stage === 'bump') {
        if (effectiveLMP) setLastPeriodDate(new Date(effectiveLMP));
        if (effectiveDueDate) setDueDate(new Date(effectiveDueDate));
      } else if (formData.life_stage === 'flow') {
        if (formData.last_period_date) setLastPeriodDate(new Date(formData.last_period_date));
      }

      if (formData.cycle_length) setCycleLength(formData.cycle_length);

      // Update baby data for mommy stage
      if (formData.life_stage === 'mommy' && formData.baby_birth_date && formData.baby_gender) {
        setBabyData(
          new Date(formData.baby_birth_date),
          formData.baby_name || tr("profileeditscreen_korpe_fa2b51", "K\xF6rp\u0259"),
          formData.baby_gender as 'boy' | 'girl'
        );

        // KRİTİK BUG DÜZƏLİŞİ: Dashboard/alətlər yaş/ad məlumatını
        // user_children-dən oxuyur (profiles.baby_* YOX) — bax useChildren.ts.
        // Əvvəllər burada "sort_order-a görə BİRİNCİ uşağı" seçib sükutla
        // yeniləyirdik (çox-uşaqlı valideyndə səhv uşağı dəyişirdi, xəta
        // olsa belə heç bir bildiriş yox idi). İndi HƏQİQİ seçilmiş uşağı
        // (selectedChild) doğru useChildren() funksiyaları ilə yeniləyirik,
        // uşaq hələ yoxdursa yenisini yaradırıq, xəta olsa toast göstəririk.
        const babyDisplayName = formData.baby_name || tr("profileeditscreen_korpe_fa2b51", "K\xF6rp\u0259");
        const childUpdates = {
          name: babyDisplayName,
          birth_date: formData.baby_birth_date,
          gender: formData.baby_gender as 'boy' | 'girl',
          avatar_emoji: formData.baby_gender === 'girl' ? '👧' : '👦'
        };

        const childSynced = selectedChild ?
        await updateChild(selectedChild.id, childUpdates) :
        !!(await addChild(childUpdates));

        if (!childSynced) {
          toast({
            title: tr("profileeditscreen_xeta_3cdbb6", 'Xəta'),
            description: tr("profileeditscreen_korpe_melumati_yenilenmedi", "Körpə məlumatı yenilənmədi — yenidən cəhd edin"),
            variant: 'destructive'
          });
        }

        // Digər useChildren instansiyalarına da xəbər ver (updateChild/addChild
        // öz instansiyasını artıq refetch edir, bu köhnə hook-un özündən asılı
        // qalan digər ekranlar üçün əlavə təhlükəsizlik toru).
        window.dispatchEvent(new CustomEvent('anacan:children-updated'));
      } else if (formData.baby_name && babyBirthDate && babyGender) {
        setBabyData(new Date(babyBirthDate), formData.baby_name, babyGender);
      }

      // Refresh auth profile
      await updateProfile({ name: formData.name });
      setCountryCode(formData.country_code || null);

      toast({ title: tr("profileeditscreen_profil_yenilendi_ad61ca", 'Profil yeniləndi!') });
      onBack();
    } catch (error: any) {
      toast({ title: tr("profileeditscreen_xeta_3cdbb6", 'Xəta'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleLifeStageChange = (value: string) => {
    setFormData((prev) => ({ ...prev, life_stage: value as LifeStage }));
  };

  return (
    <div className="a-scope fixed inset-0 flex flex-col overflow-hidden" style={{ background: 'var(--a-bg)' }}>
      {/* Safe area spacer */}
      <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-top, 0px)', background: 'var(--a-nav-bg)' }} />

      {/* Header */}
      <div className="flex-shrink-0" style={{ background: 'var(--a-nav-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid var(--a-line)' }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <motion.button
            onClick={onBack}
            className="a-icon-btn"
            whileTap={{ scale: 0.95 }}
            aria-label={tr("common_geri", "Geri")}>

            <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
          </motion.button>
          <h1 className="flex-1 truncate" style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--a-ink)' }}>{tr("profileeditscreen_profili_redakte_et_b5368c", "Profili Redaktə Et")}</h1>
          <motion.button onClick={handleSave} disabled={loading} className="a-btn-solid disabled:opacity-50" whileTap={{ scale: 0.95 }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={14} />}
            {tr("profileeditscreen_saxla", "Saxla")}
          </motion.button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>

        <div className="px-4 py-6 space-y-4 max-w-md mx-auto">
        {/* Avatar Section */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar className="w-28 h-28" style={{ border: '4px solid var(--a-peach-1)' }}>
              <AvatarImage src={formData.avatar_url || undefined} />
              <AvatarFallback style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)', fontSize: 30, fontWeight: 800 }}>
                {formData.name?.charAt(0) || tr("common_initial_i", "İ")}
              </AvatarFallback>
            </Avatar>
            <motion.button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 end-0 w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'var(--a-peach-2)', boxShadow: '0 10px 20px -8px rgba(217, 108, 74, 0.55)', border: '3px solid var(--a-surface)' }}
                whileTap={{ scale: 0.95 }}
                disabled={uploading}>

              {uploading ?
                <Loader2 className="w-4 h-4 text-white animate-spin" /> :

                <Camera className="w-4 h-4 text-white" />
                }
            </motion.button>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden" />

          </div>
          <p className="mt-2" style={{ fontSize: 12.5, color: 'var(--a-ink-soft)' }}>{tr("profileeditscreen_profil_seklini_deyis_7dbfc6", "Profil şəklini dəyiş")}</p>
        </div>

        {/* Basic Info */}
        <div className="a-card space-y-4">
          <h3 className="a-card-title flex items-center gap-2">
            <User size={15} style={{ color: 'var(--a-accent-ink)' }} />
            {tr("profileeditscreen_esas_melumatlar_56bfed", "\u018Fsas M\u0259lumatlar")}
          </h3>

          <div className="space-y-2">
            <label style={labelStyle}>{tr("untranslated_ad_i34vkg", "Ad")}</label>
            <Input
                className={inputCls}
                style={inputStyle}
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={tr("profileeditscreen_adiniz_b3e84a", "Adınız")} />

          </div>

          <div className="space-y-2">
            <label style={labelStyle}>{tr("authscreen_olke", "Ölkə")}</label>
            <Select value={formData.country_code} onValueChange={(val) => setFormData(prev => ({ ...prev, country_code: val }))}>
              <SelectTrigger className={`w-full ${inputCls}`} style={inputStyle}>
                <SelectValue placeholder={tr("authscreen_olke_secin", "Ölkə seçin")} />
              </SelectTrigger>
              <SelectContent className="a-scope max-h-[300px]">
                {countriesData.map((country) => (
                  <SelectItem key={country.isoAlpha2} value={country.isoAlpha2}>
                    <span className="flex items-center gap-2">
                      <img src={country.flag.startsWith('data:') ? country.flag : `data:image/png;base64,${country.flag}`} alt="" className="w-6 h-4 object-cover rounded-sm" style={{ border: '1px solid var(--a-line)' }} />
                      {country.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label style={labelStyle}>Bio</label>
            <Textarea
                className="rounded-xl"
                style={inputStyle}
                value={formData.bio}
                onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                placeholder={tr("profileeditscreen_ozunuz_haqqinda_qisa_melumat_1a283c", "Özünüz haqqında qısa məlumat...")}
                rows={3} />

          </div>

          <div className="space-y-2">
            <label style={labelStyle}>Email</label>
            <Input value={user?.email || ''} disabled className={inputCls} style={{ ...inputStyle, background: 'var(--a-surface-soft)' }} />
          </div>
        </div>

        {/* Life Stage Settings */}
        <div className="a-card space-y-4">
          <h3 className="a-card-title flex items-center gap-2">
            <Calendar size={15} style={{ color: 'var(--a-accent-ink)' }} />
            {tr("profileeditscreen_merhele_0e09aa", "M\u0259rh\u0259l\u0259")}
          </h3>

          <div className="space-y-2">
            <label style={labelStyle}>{tr("profileeditscreen_merhele_0e09aa", "Mərhələ")}</label>
            <Select
                value={formData.life_stage}
                onValueChange={handleLifeStageChange}>

              <SelectTrigger className={`w-full ${inputCls}`} style={inputStyle}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="a-scope">
                <SelectItem value="flow">{tr("profileeditscreen_menstruasiya_izleyicisi_b0d2dd", "🌸 Menstruasiya izləyicisi")}</SelectItem>
                <SelectItem value="bump">{tr("profileeditscreen_hamileyem_01937d", "🤰 Hamiləyəm")}</SelectItem>
                <SelectItem value="mommy">{tr("profileeditscreen_anayam_mommy", "👶 Anayam")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pregnancy specific fields */}
          {formData.life_stage === 'bump' &&
            <>
              {/* Date Input Mode Toggle */}
              <div className="space-y-3">
                <label style={labelStyle}>{tr("profileeditscreen_tarix_novunu_secin_ad6b20", "Tarix növünü seçin")}</label>
                <ToggleGroup
                  type="single"
                  value={dateInputMode}
                  onValueChange={(value) => value && setDateInputMode(value as DateInputMode)}
                  className="grid grid-cols-2 gap-2">

                  <ToggleGroupItem
                    value="lmp"
                    className="flex items-center gap-2 h-auto py-3 px-4 rounded-xl border data-[state=on]:bg-[var(--a-peach-1)] data-[state=on]:text-[var(--a-accent-ink)] data-[state=on]:border-[var(--a-peach-2)]"
                    style={{ borderColor: 'var(--a-line-strong)' }}>

                    <CalendarDays className="w-4 h-4" />
                    <span className="text-sm">{tr("profileeditscreen_son_menstruasiya_tarixi_7c9f8a", "📅 Son menstruasiya tarixi:")}</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="dueDate"
                    className="flex items-center gap-2 h-auto py-3 px-4 rounded-xl border data-[state=on]:bg-[var(--a-peach-1)] data-[state=on]:text-[var(--a-accent-ink)] data-[state=on]:border-[var(--a-peach-2)]"
                    style={{ borderColor: 'var(--a-line-strong)' }}>

                    <Baby className="w-4 h-4" />
                    <span className="text-sm">{tr("profileeditscreen_dogus_tarixi_e2caea", "Doğuş tarixi")}</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Date Input based on mode */}
              {dateInputMode === 'lmp' ?
              <div className="space-y-2">
                  <label style={labelStyle}>{tr("profileeditscreen_son_menstruasiyan_ilk_gunu_c79f76", "Son menstruasiyanın ilk günü")}</label>
                  <DateField
                  className={inputCls}
                  style={inputStyle}
                  placeholderInset={12}
                  value={formData.last_period_date}
                  onChange={(v) => setFormData((prev) => ({ ...prev, last_period_date: v }))} />

                </div> :

              <div className="space-y-2">
                  <label style={labelStyle}>{tr("profileeditscreen_texmini_dogus_tarixi_a8b543", "Təxmini doğuş tarixi")}</label>
                  <DateField
                  className={inputCls}
                  style={inputStyle}
                  placeholderInset={12}
                  value={formData.due_date}
                  onChange={(v) => setFormData((prev) => ({ ...prev, due_date: v }))} />

                </div>
              }

              {/* Calculated Date Info Card */}
              {(calculatedDates.calculatedDueDate || calculatedDates.calculatedLMP) &&
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
                style={{ background: 'var(--a-peach-1)', borderRadius: 16, padding: 16 }}>

                  <div className="flex items-center gap-2" style={{ color: 'var(--a-accent-ink)' }}>
                    <Sparkles className="w-4 h-4" />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{tr("profileeditscreen_hesablanmis_melumatlar_b5a420", "Hesablanmış məlumatlar")}</span>
                  </div>

                  {calculatedDates.calculatedDueDate &&
                <p style={{ fontSize: 13, color: 'var(--a-accent-ink)' }}>
                      {tr("profileeditscreen_texmini_dogus_tarixi_011e51", "\uD83C\uDFAF T\u0259xmini do\u011Fu\u015F tarixi:")} <strong>{formatDate(calculatedDates.calculatedDueDate)}</strong>
                    </p>
                }

                  {calculatedDates.calculatedLMP &&
                <p style={{ fontSize: 13, color: 'var(--a-accent-ink)' }}>
                      {tr("profileeditscreen_son_menstruasiya_tarixi_7c9f8a", "📅 Son menstruasiya tarixi:")} <strong>{formatDate(calculatedDates.calculatedLMP)}</strong>
                    </p>
                }

                  {calculatedDates.week > 0 &&
                <p style={{ fontSize: 13, color: 'var(--a-accent-ink)', opacity: 0.85 }}>
                      {tr("profileeditscreen_hazirda_33b3c8", "Hazırda:")} <strong>{calculatedDates.week} {tr("profileeditscreen_hefte_d4c248", "həftə")} {calculatedDates.day} {tr("profileeditscreen_gun_54e78d", "gün")}</strong>
                    </p>
                }
                </motion.div>
              }

              <div className="space-y-2">
                <label style={labelStyle}>{tr("profileeditscreen_korpenin_adi_isteye_bagli_4e76c8", "Körpənin adı (istəyə bağlı)")}</label>
                <Input
                  className={inputCls}
                  style={inputStyle}
                  value={formData.baby_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, baby_name: e.target.value }))}
                  placeholder={tr("profileeditscreen_korpenin_adi_8a4e9e", "Körpənin adı")} />

              </div>

              {/* Çoxdöllü hamiləlik */}
              <div className="space-y-2">
                <label style={labelStyle}>{tr("profile_multiples_label", "Neçə körpə gözləyirsiniz?")}</label>
                <Select
                  value={formData.multiples_type}
                  onValueChange={(v) => setFormData((prev) => ({
                    ...prev,
                    multiples_type: v as 'single' | 'twins' | 'triplets' | 'quadruplets',
                    chorionicity: v === 'single' ? '' : prev.chorionicity
                  }))}>

                  <SelectTrigger className={`w-full ${inputCls}`} style={inputStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="a-scope">
                    <SelectItem value="single">👶 {tr("profile_multiples_single", "Tək körpə")}</SelectItem>
                    <SelectItem value="twins">👶👶 {tr("profile_multiples_twins", "Əkiz")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Xorionluq — yalnız çoxdöllü hamiləlikdə göstərilir. TTTS riski
                  (əkiz-əkizə transfuziya sindromu) plasentanın ortaq olub-olmamasından
                  asılıdır — DangerSignsScreen bu sahəyə görə xəbərdarlıq göstərir. */}
              {formData.multiples_type !== 'single' &&
              <div className="space-y-2">
                  <label style={labelStyle}>{tr("chorionicity_label", "Plasenta növü (Xorionluq)")}</label>
                  <Select
                  value={formData.chorionicity || 'unknown'}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, chorionicity: v }))}>

                    <SelectTrigger className={`w-full ${inputCls}`} style={inputStyle}>
                      <SelectValue placeholder={tr("chorionicity_placeholder", "Seçin (USM-də məlum olur)")} />
                    </SelectTrigger>
                    <SelectContent className="a-scope">
                      <SelectItem value="unknown">{tr("chorionicity_unknown", "Hələ bilmirəm / USM gözləyirəm")}</SelectItem>
                      <SelectItem value="dichorionic">{tr("chorionicity_dichorionic", "Ayrı-ayrı plasentalar (Dixorionik)")}</SelectItem>
                      <SelectItem value="monochorionic_diamniotic">{tr("chorionicity_mcda", "Ortaq plasenta, ayrı kisələr (Monoxorionik-Diamniotik)")}</SelectItem>
                      <SelectItem value="monochorionic_monoamniotic">{tr("chorionicity_mcma", "Ortaq plasenta və ortaq kisə (Monoxorionik-Monoamniotik)")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs" style={{ color: 'var(--a-ink-faint)', lineHeight: 1.5 }}>
                    {formData.chorionicity === 'dichorionic' && tr("chorionicity_help_dichorionic", "Hər körpənin öz plasentası var — ən aşağı riskli növdür, əkiz doğuşların əksəriyyəti bu qrupdadır.")}
                    {formData.chorionicity === 'monochorionic_diamniotic' && tr("chorionicity_help_mcda", "Körpələr eyni plasentanı paylaşır (adətən eyniz əkizlərdə) — TTTS (əkiz-əkizə transfuziya sindromu) riskinə görə USM-lər daha tez-tez təyin olunur.")}
                    {formData.chorionicity === 'monochorionic_monoamniotic' && tr("chorionicity_help_mcma", "Körpələr həm plasentanı, həm kisəni paylaşır — nadir haldır, ən yaxın izləmə tələb edir (göbək ciyəsi dolaşması riski də var).")}
                    {(!formData.chorionicity || formData.chorionicity === 'unknown') && tr("chorionicity_help_unknown", "Adətən 10-14-cü həftə USM-də (dating scan) müəyyən olunur — həkiminiz sizə deyəcək. Ortaq plasenta olduqda USM-lər daha tez-tez planlaşdırılır.")}
                  </p>
                </div>
              }
            </>
            }

          {/* Flow specific fields */}
          {formData.life_stage === 'flow' &&
            <>
              <div className="space-y-2">
                <label style={labelStyle}>{tr("untranslated_son_menstruasiya_tarixi_fgz9t7", "Son menstruasiya tarixi")}</label>
                <DateField
                  className={inputCls}
                  style={inputStyle}
                  placeholderInset={12}
                  value={formData.last_period_date}
                  onChange={(v) => setFormData((prev) => ({ ...prev, last_period_date: v }))} />

              </div>
              <div className="space-y-2">
                <label style={labelStyle}>{tr("profileeditscreen_dovrun_uzunlugu_gun_4d99da", "Dövrün uzunluğu (gün)")}</label>
                <Input
                  className={inputCls}
                  style={inputStyle}
                  type="number"
                  value={formData.cycle_length}
                  onChange={(e) => setFormData((prev) => ({ ...prev, cycle_length: parseInt(e.target.value) || 28 }))}
                  min={10}
                  max={50} />

              </div>
            </>
            }

          {/* Mommy specific fields */}
          {formData.life_stage === 'mommy' &&
            <>
              <div className="space-y-2">
                <label style={labelStyle}>{tr("profileeditscreen_korpenin_adi_8a4e9e", "Körpənin adı")}</label>
                <Input
                  className={inputCls}
                  style={inputStyle}
                  value={formData.baby_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, baby_name: e.target.value }))}
                  placeholder={tr("profileeditscreen_korpenin_adi_8a4e9e", "Körpənin adı")} />

              </div>
              <div className="space-y-2">
                <label style={labelStyle}>{tr("profileeditscreen_dogus_tarixi_e2caea", "Doğuş tarixi")}</label>
                <DateField
                  className={inputCls}
                  style={inputStyle}
                  placeholderInset={12}
                  value={formData.baby_birth_date}
                  onChange={(v) => setFormData((prev) => ({ ...prev, baby_birth_date: v }))} />

              </div>
              <div className="space-y-2">
                <label style={labelStyle}>{tr("untranslated_cinsi_az7fty", "Cinsi")}</label>
                <Select
                  value={formData.baby_gender}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, baby_gender: value as 'boy' | 'girl' }))}>

                  <SelectTrigger className={`w-full ${inputCls}`} style={inputStyle}>
                    <SelectValue placeholder={tr("profileeditscreen_secin_5c0c8d", "Seçin")} />
                  </SelectTrigger>
                  <SelectContent className="a-scope">
                    <SelectItem value="boy">{tr("profileeditscreen_oglan_c41cd8", "👦 Oğlan")}</SelectItem>
                    <SelectItem value="girl">{tr("profileeditscreen_qiz_cc9008", "👧 Qız")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
            }
        </div>
      </div>
      </div>
    </div>);

};

export default ProfileEditScreen;

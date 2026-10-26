import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Baby, X, ChevronRight, ChevronLeft, Calendar, Scale,
  Ruler, Sparkles, Heart, Check, Stethoscope } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { tr } from "@/lib/tr";
import { useIsRtl, rtlX } from '@/lib/rtl';

interface BirthOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type DeliveryType = 'natural' | 'cesarean' | 'assisted';
type Gender = 'boy' | 'girl';

interface BabyEntry {
  name: string;
  gender: Gender;
  weight: string;
  height: string;
}

const BirthOnboardingModal = ({ isOpen, onClose, onComplete }: BirthOnboardingModalProps) => {
  const isRtl = useIsRtl();
  const { user, profile } = useAuth();
  const setLifeStage = useUserStore((s) => s.setLifeStage);
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Əkiz/üçüz/dördüz hamiləlik onboarding-də seçilibsə (profiles.baby_count,
  // hamiləlik mərhələsində doldurulur) — doğuş anında HƏR körpə üçün ayrıca
  // ad/cins/çəki/boy toplanır. Tək körpəli ailələrdə (əksəriyyət) UI əvvəlki
  // kimi tam eyni qalır — heç bir vizual dəyişiklik yoxdur.
  const babyCount = Math.max(1, Math.min(4, profile?.baby_count || 1));
  const isMultiple = babyCount > 1;

  // Form data
  const [birthDate, setBirthDate] = useState<Date | undefined>(new Date());
  const [babies, setBabies] = useState<BabyEntry[]>(() =>
  Array.from({ length: babyCount }, (_, i) => ({
    name: i === 0 ? profile?.baby_name || '' : '',
    gender: 'boy' as Gender,
    weight: '',
    height: ''
  }))
  );
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('natural');

  const updateBaby = (index: number, updates: Partial<BabyEntry>) => {
    setBabies((prev) => prev.map((b, i) => i === index ? { ...b, ...updates } : b));
  };

  const totalSteps = 4;

  const deliveryOptions = [
  { value: 'natural', label: tr("birthonboardingmodal_tebii_dogus_d7dea2", 'Təbii doğuş'), emoji: '🌸', description: tr("birthonboardingmodal_vaginal_dogus_e137c8", 'Vaginal doğuş') },
  { value: 'cesarean', label: tr("birthonboardingmodal_qeyseriyye_d8c1b4", 'Qeysəriyyə'), emoji: '🏥', description: tr("birthonboardingmodal_sezaryen_emeliyyati_120bc4", 'Sezaryen əməliyyatı') },
  { value: 'assisted', label: tr("birthonboardingmodal_komekli_dogus_9ccc60", 'Köməkli doğuş'), emoji: '🩺', description: 'Vakuum/forseps' }];


  const handleComplete = async () => {
    if (!user || !birthDate || babies.some((b) => !b.name.trim())) {
      toast({ title: tr("birthonboardingmodal_xeta_3cdbb6", 'Xəta'), description: tr("birthonboardingmodal_zeruri_saheleri_doldurun_ab6828", 'Zəruri sahələri doldurun'), variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const birthDateStr = format(birthDate, 'yyyy-MM-dd');
      const firstBaby = babies[0];
      const deliveryLabel = deliveryOptions.find((d) => d.value === deliveryType)?.label || deliveryType;

      // Köhnə tək-körpəli profil sahələri (profiles.baby_name və s.) — geriyə
      // uyğunluq üçün İLK körpənin datası ilə doldurulur (partner ekranları və
      // bəzi köhnə kod yolları hələ birbaşa bu sahələri oxuyur).
      const { error: profileError } = await supabase.
      from('profiles').
      update({
        life_stage: 'mommy',
        baby_name: firstBaby.name.trim(),
        baby_birth_date: birthDateStr,
        baby_gender: firstBaby.gender,
        birth_weight_kg: firstBaby.weight ? parseFloat(firstBaby.weight) : null,
        birth_height_cm: firstBaby.height ? parseFloat(firstBaby.height) : null,
        delivery_type: deliveryType,
        updated_at: new Date().toISOString()
      }).
      eq('user_id', user.id);

      if (profileError) throw profileError;

      // Hər körpə üçün AYRICA user_children qeydi (idempotent — dublikat yaratmır).
      // Əkiz/üçüzlərdə bu, hər körpənin öz böyümə qrafiki/peyvənd təqvimi/taymeri
      // olmasını təmin edir (əvvəllər vergüllə yazılan tək ad tək sətrə düşürdü).
      //
      // DÜZƏLİŞ: əvvəllər burada .upsert({...}, {onConflict:'user_id,name,birth_date'})
      // çağırılırdı. user_children-in YEGANƏ unikal indeksi QISMƏNDİR
      // (WHERE is_active = true, bax 20260813150027_user_children_unique_guard.sql).
      // Supabase-js-in .upsert() metodu ON CONFLICT-ə WHERE predikatı əlavə edə
      // bilmir, buna görə Postgres bu qismən indeksi arbiter kimi tanıya bilmirdi
      // və HƏR sətir 42P10 xətası ilə səssizcə rədd olunurdu (xəta mesajında
      // "duplicate" sözü olmadığı üçün aşağıdakı yoxlama da onu udurdu) — nəticədə
      // user_children HƏMİŞƏ boş qalırdı və mommy_day push bildirişləri, böyümə
      // qrafiki, peyvənd təqvimi və s. heç vaxt işə düşmürdü. İndi əvvəlcə mövcud
      // sətirləri oxuyuruq, sonra YALNIZ olmayanlar üçün sadə INSERT edirik (eyni
      // işlək yol useChildren.ts/OnboardingScreen.tsx/PremiumOnboarding.tsx-də
      // artıq istifadə olunur).
      const { data: existingChildren } = await supabase.
      from('user_children').
      select('name, birth_date').
      eq('user_id', user.id).
      eq('is_active', true);

      const existingKeys = new Set(
        (existingChildren || []).map((c) => `${c.name}::${c.birth_date}`)
      );

      // PREMATURE DƏSTƏYİ: bu keçid anında profiles.due_date hələ silinməyib
      // (onu yalnız ProfileEditScreen-in mommy branch-i null-layır) — orijinal
      // EDD-ni hər körpəyə köçürürük. Bundan gestasiya yaşı, premature statusu
      // və korreksiya olunmuş yaş avtomatik hesablanır. EDD yoxdursa, LMP+280
      // gün istifadə olunur.
      let originalDueDate: string | null = (profile as any)?.due_date ?? null;
      if (!originalDueDate && (profile as any)?.last_period_date) {
        const lmp = new Date((profile as any).last_period_date);
        if (!Number.isNaN(lmp.getTime())) {
          lmp.setDate(lmp.getDate() + 280);
          originalDueDate = format(lmp, 'yyyy-MM-dd');
        }
      }

      for (let i = 0; i < babies.length; i++) {
        const baby = babies[i];
        const babyName = baby.name.trim();
        if (existingKeys.has(`${babyName}::${birthDateStr}`)) continue;

        const { error: childError } = await supabase.
        from('user_children').
        insert({
          user_id: user.id,
          name: babyName,
          birth_date: birthDateStr,
          due_date: originalDueDate,
          gender: baby.gender,
          avatar_emoji: baby.gender === 'girl' ? '👧' : '👦',
          is_active: true,
          sort_order: i,
          notes: tr("birthonboardingmodal_notes_template", "Doğum çəkisi: {weight} {weightUnit}, Boy: {height} {heightUnit}, Doğum tipi: {type}").replace("{weight}", baby.weight || '-').replace("{weightUnit}", tr('unit_kg', 'kq')).replace("{height}", baby.height || '-').replace("{heightUnit}", tr('unit_cm', 'sm')).replace("{type}", deliveryLabel)
        });

        if (childError) {
          console.error('Child creation error:', childError);
        }
      }

      // Update local store
      setLifeStage('mommy');

      const namesJoined = babies.map((b) => b.name.trim()).join(' & ');
      toast({
        title: tr("birthonboardingmodal_tebrik_edirik_4dc427", 'Təbrik edirik! 🎉'),
        description: `${namesJoined} ${tr("birth_welcome_world", "dünyaya xoş gəldi! Analıq səyahətinizə başlayırıq.")}`
      });

      onComplete();
    } catch (error: any) {
      console.error('Birth onboarding error:', error);
      toast({
        title: tr("birthonboardingmodal_xeta_bas_verdi_f22fba", 'Xəta baş verdi'),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:return !!birthDate;
      case 2:return babies.every((b) => b.name.trim().length >= 2);
      case 3:return true;
      case 4:return true; // Optional fields
      default:return false;
    }
  };

  const nextStep = () => {
    if (step < totalSteps && canProceed()) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}>
        
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}>
          
          {/* Header */}
          <div className="relative bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 p-6 text-white">
            <button
              onClick={onClose}
              className="absolute top-4 end-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                <Baby className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{tr("birthonboardingmodal_tebrik_edirik_4dc427", "Təbrik edirik! 🎉")}</h2>
                <p className="text-white/80 text-sm">
                  {isMultiple ?
                  tr("birthonboardingmodal_korpeleriniz_haqqinda_melumat", "Körpələriniz haqqında məlumat verin") :
                  tr("birthonboardingmodal_korpeniz_haqqinda_melumat_verin_7560c6", "Körpəniz haqqında məlumat verin")}
                </p>
              </div>
            </div>
            
            {/* Progress */}
            <div className="flex gap-1.5 mt-4">
              {Array.from({ length: totalSteps }).map((_, i) =>
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                i < step ? 'bg-white' : 'bg-white/30'}`
                } />

              )}
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {/* Step 1: Birth Date */}
              {step === 1 &&
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: rtlX(20, isRtl) }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
                className="space-y-4">
                
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-pink-100 dark:bg-pink-950/50 flex items-center justify-center mx-auto mb-3">
                      <Calendar className="w-8 h-8 text-pink-500" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{tr("birthonboardingmodal_dogum_tarixi_d96907", "Doğum tarixi")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isMultiple ?
                    tr("birthonboardingmodal_korpeleriniz_ne_vaxt_doguldu", "Körpələriniz nə vaxt doğuldu?") :
                    tr("birthonboardingmodal_korpeniz_ne_vaxt_doguldu_165d80", "Körpəniz nə vaxt doğuldu?")}
                    </p>
                  </div>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                      variant="outline"
                      className={cn(
                        "w-full h-14 justify-start text-start font-medium text-base",
                        !birthDate && "text-muted-foreground"
                      )}>
                      
                        <Calendar className="me-3 h-5 w-5 text-pink-500" />
                        {birthDate ? format(birthDate, "d MMMM yyyy", { locale: getCurrentDateLocale() }) : tr("birthonboardingmodal_tarix_secin_3377b4", "Tarix se\xE7in")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[60]" align="center">
                      <CalendarComponent
                      mode="single"
                      selected={birthDate}
                      onSelect={setBirthDate}
                      disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")} />
                    
                    </PopoverContent>
                  </Popover>
                </motion.div>
              }
              
              {/* Step 2: Baby Name(s) — birdən çox körpə varsa hər biri üçün ayrıca kart */}
              {step === 2 &&
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: rtlX(20, isRtl) }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
                className="space-y-4">
                
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-pink-100 dark:bg-pink-950/50 flex items-center justify-center mx-auto mb-3">
                      <Heart className="w-8 h-8 text-pink-500" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">
                      {isMultiple ? tr("birthonboardingmodal_korpelerin_adlari", "Körpələrin adları") : tr("birthonboardingmodal_korpenin_adi_8a4e9e", "Körpənin adı")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {isMultiple ?
                    tr("birthonboardingmodal_balaca_mocuzelerinizin_adlari_nedir", "Balaca möcüzələrinizin adları nədir?") :
                    tr("birthonboardingmodal_balaca_mocuzenizin_adi_nedir_d5c071", "Balaca möcüzənizin adı nədir?")}
                    </p>
                  </div>
                  
                  <div className={isMultiple ? "space-y-3 max-h-[320px] overflow-y-auto pe-1" : ""}>
                    {babies.map((baby, i) =>
                  <div key={i} className={isMultiple ? "rounded-2xl border border-border/60 p-3" : ""}>
                        {isMultiple &&
                    <p className="text-xs font-bold text-pink-500 mb-2">
                            {tr("birthonboardingmodal_n_ci_korpe", "{n}-ci körpə").replace('{n}', String(i + 1))}
                          </p>
                    }
                        <Input
                      value={baby.name}
                      onChange={(e) => updateBaby(i, { name: e.target.value })}
                      placeholder={tr("birthonboardingmodal_korpenin_adini_daxil_edin_7deaac", "Körpənin adını daxil edin")}
                      className={isMultiple ? "h-12 text-base text-center font-medium" : "h-14 text-lg text-center font-medium"}
                      autoFocus={i === 0} />
                    
                        
                        {/* Gender Selection */}
                        <div className={`grid grid-cols-2 gap-3 ${isMultiple ? 'mt-3' : 'mt-4'}`}>
                          {[
                      { value: 'boy', label: tr("birthonboardingmodal_oglan_e9715e", 'Oğlan'), emoji: '👦', color: 'bg-blue-100 dark:bg-blue-950/50 border-blue-300' },
                      { value: 'girl', label: tr("birthonboardingmodal_qiz_79bf6b", 'Qız'), emoji: '👧', color: 'bg-pink-100 dark:bg-pink-950/50 border-pink-300' }].
                      map((option) =>
                      <motion.button
                        key={option.value}
                        onClick={() => updateBaby(i, { gender: option.value as Gender })}
                        className={`p-4 rounded-xl border-2 transition-all ${
                        baby.gender === option.value ?
                        `${option.color} border-current` :
                        'bg-muted/50 border-transparent'}`
                        }
                        whileTap={{ scale: 0.95 }}>
                        
                              <span className={isMultiple ? "text-2xl mb-1 block" : "text-3xl mb-2 block"}>{option.emoji}</span>
                              <span className="font-medium text-sm">{option.label}</span>
                            </motion.button>
                      )}
                        </div>
                      </div>
                  )}
                  </div>
                </motion.div>
              }
              
              {/* Step 3: Delivery Type */}
              {step === 3 &&
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: rtlX(20, isRtl) }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
                className="space-y-4">
                
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-pink-100 dark:bg-pink-950/50 flex items-center justify-center mx-auto mb-3">
                      <Stethoscope className="w-8 h-8 text-pink-500" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{tr("birthonboardingmodal_dogum_tipi_c2efb4", "Doğum tipi")}</h3>
                    <p className="text-sm text-muted-foreground">{tr("birthonboardingmodal_dogum_nece_bas_tutdu_f27265", "Doğum necə baş tutdu?")}</p>
                  </div>
                  
                  <div className="space-y-2">
                    {deliveryOptions.map((option) =>
                  <motion.button
                    key={option.value}
                    onClick={() => setDeliveryType(option.value as DeliveryType)}
                    className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                    deliveryType === option.value ?
                    'bg-pink-50 dark:bg-pink-950/30 border-pink-300' :
                    'bg-muted/50 border-transparent'}`
                    }
                    whileTap={{ scale: 0.98 }}>
                    
                        <span className="text-2xl">{option.emoji}</span>
                        <div className="text-start">
                          <p className="font-semibold text-foreground">{option.label}</p>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </div>
                        {deliveryType === option.value &&
                    <Check className="w-5 h-5 text-pink-500 ms-auto" />
                    }
                      </motion.button>
                  )}
                  </div>
                </motion.div>
              }
              
              {/* Step 4: Birth Stats — hər körpə üçün ayrıca çəki/boy */}
              {step === 4 &&
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: rtlX(20, isRtl) }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
                className="space-y-4">
                
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-pink-100 dark:bg-pink-950/50 flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="w-8 h-8 text-pink-500" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{tr("birthonboardingmodal_dogum_olculeri_674a98", "Doğum ölçüləri")}</h3>
                    <p className="text-sm text-muted-foreground">{tr("birthonboardingmodal_isteye_bagli_sonra_da_elave_ede_bilersin_ade2f0", "İstəyə bağlı - sonra da əlavə edə bilərsiniz")}</p>
                  </div>
                  
                  <div className={isMultiple ? "space-y-3 max-h-[240px] overflow-y-auto pe-1" : ""}>
                    {babies.map((baby, i) =>
                  <div key={i} className={isMultiple ? "rounded-2xl border border-border/60 p-3" : ""}>
                        {isMultiple &&
                    <p className="text-xs font-bold text-pink-500 mb-2">
                            {baby.name.trim() || tr("birthonboardingmodal_n_ci_korpe", "{n}-ci körpə").replace('{n}', String(i + 1))}
                          </p>
                    }
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">{tr("birthonboardingmodal_ceki_kq_2f7555", "Çəki (kq)")}</Label>
                            <div className="relative">
                              <Scale className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                            type="number"
                            step="0.1"
                            min="1"
                            max="6"
                            value={baby.weight}
                            onChange={(e) => updateBaby(i, { weight: e.target.value })}
                            placeholder="3.5"
                            className="ps-10 h-12" />
                          
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">{tr("birthonboardingmodal_boy_sm_3bc841", "Boy (sm)")}</Label>
                            <div className="relative">
                              <Ruler className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                            type="number"
                            step="1"
                            min="30"
                            max="60"
                            value={baby.height}
                            onChange={(e) => updateBaby(i, { height: e.target.value })}
                            placeholder="50"
                            className="ps-10 h-12" />
                          
                            </div>
                          </div>
                        </div>
                      </div>
                  )}
                  </div>
                  
                  {/* Summary */}
                  <div className="bg-pink-50 dark:bg-pink-950/30 rounded-xl p-4 mt-4">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Baby className="w-4 h-4 text-pink-500" />
                      {tr("birthonboardingmodal_xulase_029c8a", "X\xFClas\u0259")}
                    </h4>
                    {babies.map((baby, i) =>
                  <div key={i} className={i > 0 ? "mt-2.5 pt-2.5 border-t border-pink-200/50 dark:border-pink-800/30" : ""}>
                        {isMultiple &&
                    <p className="text-xs font-bold text-pink-600 dark:text-pink-400 mb-1">
                            {baby.name.trim() || tr("birthonboardingmodal_n_ci_korpe", "{n}-ci körpə").replace('{n}', String(i + 1))}
                          </p>
                    }
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <p className="text-muted-foreground">{tr("untranslated_ad_w3td2c", "Ad:")}<span className="text-foreground font-medium">{baby.name}</span></p>
                          <p className="text-muted-foreground">Cins: <span className="text-foreground font-medium">{baby.gender === 'boy' ? tr("birthonboardingmodal_oglan_e9715e", "O\u011Flan") : tr("birthonboardingmodal_qiz_79bf6b", "Q\u0131z")}</span></p>
                          <p className="text-muted-foreground">{tr("birthonboardingmodal_ceki_kq_2f7555", "Çəki (kq)")}: <span className="text-foreground font-medium">{baby.weight || '-'}</span></p>
                          <p className="text-muted-foreground">{tr("birthonboardingmodal_boy_sm_3bc841", "Boy (sm)")}: <span className="text-foreground font-medium">{baby.height || '-'}</span></p>
                        </div>
                      </div>
                  )}
                    <div className="grid grid-cols-2 gap-2 text-sm mt-2.5 pt-2.5 border-t border-pink-200/50 dark:border-pink-800/30">
                      <p className="text-muted-foreground">{tr("untranslated_tarix_15qhck", "Tarix:")}<span className="text-foreground font-medium">{birthDate ? format(birthDate, 'd MMM yyyy', { locale: getCurrentDateLocale() }) : '-'}</span></p>
                      <p className="text-muted-foreground">{tr("untranslated_tip_5d1vhb", "Tip:")}<span className="text-foreground font-medium">{deliveryOptions.find((d) => d.value === deliveryType)?.label}</span></p>
                    </div>
                  </div>
                </motion.div>
              }
            </AnimatePresence>
          </div>
          
          {/* Footer */}
          <div className="p-6 pt-0 flex gap-3">
            {step > 1 &&
            <Button
              variant="outline"
              onClick={prevStep}
              className="flex-1 h-12">
              
                <ChevronLeft className="rtl:rotate-180 w-4 h-4 me-1" />
                {tr("common_geri", "Geri")}
              </Button>
            }
            
            {step < totalSteps ?
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="flex-1 h-12 bg-gradient-to-r from-pink-500 to-rose-500">{tr("untranslated_davam_et_rchhd5", "Davam et")}<ChevronRight className="rtl:rotate-180 w-4 h-4 ms-1" />
              </Button> :

            <Button
              onClick={handleComplete}
              disabled={loading}
              className="flex-1 h-12 bg-gradient-to-r from-pink-500 to-rose-500">
              
                {loading ?
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> :

              <>
                    <Sparkles className="w-4 h-4 me-2" />
                    {tr("common_tamamla", "Tamamla")}
                  </>
              }
              </Button>
            }
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>);

};

export default BirthOnboardingModal;

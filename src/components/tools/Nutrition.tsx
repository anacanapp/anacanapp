import { useState, forwardRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Utensils, Apple, Coffee, Droplets, Droplet,
  Plus, Star, X, Check, Trash2, Heart } from
'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useDailyLogs } from '@/hooks/useDailyLogs';
import { useMealLogs } from '@/hooks/useMealLogs';
import { useNutritionTips } from '@/hooks/useDynamicContent';
import { useCommonFoods } from '@/hooks/useDynamicConfig';
import { useMealTypes, useNutritionTargets } from '@/hooks/useDynamicTools';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import VitaminsTab from './VitaminsTab';
import { ToolPage, ToolHeader, ToolLoading } from './anacan/ToolKit';
import { tr } from "@/lib/tr";
import { NEW_LANGUAGE_CODES } from '@/lib/app-languages';
import { useIsRtl, rtlX } from '@/lib/rtl';

interface NutritionProps {
  onBack: () => void;
}

// Fallback meal types
const fallbackMealTypes = [
{ meal_id: 'breakfast', name: tr("nutrition_seher_yemeyi_b82929", "Səhər yeməyi"), emoji: '🍳', time_range: '07:00 - 09:00' },
{ meal_id: 'lunch', name: tr("nutrition_nahar_lunch", 'Nahar'), emoji: '🍲', time_range: '12:00 - 14:00' },
{ meal_id: 'dinner', name: tr("nutrition_sam_yemeyi_6002e9", "Şam yeməyi"), emoji: '🍽️', time_range: '18:00 - 20:00' },
{ meal_id: 'snack', name: tr("nutrition_qelyanalti_42fb71", "Qəlyanaltı"), emoji: '🍎', time_range: tr("nutrition_i_stenilen_vaxt_ec15be", "İstənilən vaxt") }];


// Fallback targets
const fallbackTargets = {
  bump: { calories: 2300, water_glasses: 10, description: tr("nutrition_hamilelik_dovru_57af7a", "Hamiləlik dövrü") },
  mommy: { calories: 2500, water_glasses: 12, description: tr("nutrition_emizdirme_dovru_6f45f4", "Əmizdirmə dövrü") },
  flow: { calories: 2000, water_glasses: 8, description: tr("nutrition_umumi_saglamliq_6c20a8", "Ümumi sağlamlıq") }
};

// Common foods will be fetched from DB, fallback for loading
const fallbackFoods = [
{ name: tr("nutrition_yumurta_egg", 'Yumurta'), calories: 78, emoji: '🥚' },
{ name: tr("nutrition_corek_1_dilim_6ad54a", "Çörək (1 dilim)"), calories: 80, emoji: '🍞' },
{ name: tr("nutrition_pendir_cheese", 'Pendir'), calories: 113, emoji: '🧀' },
{ name: tr("nutrition_sud_1_stekan_45357d", "Süd (1 stəkan)"), calories: 150, emoji: '🥛' }];


// Icon mapping for meal types
const mealIcons: Record<string, any> = {
  breakfast: Coffee,
  lunch: Utensils,
  dinner: Utensils,
  snack: Apple,
  nursing: Heart
};

const Nutrition = forwardRef<HTMLDivElement, NutritionProps>(({ onBack }, ref) => {
  useScrollToTop();
  useScreenAnalytics('Nutrition', 'Tools');
  const isRtl = useIsRtl();

  const [activeTab, setActiveTab] = useState<'log' | 'tips' | 'vitamins' | 'water'>('log');
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [customFood, setCustomFood] = useState({ name: '', calories: '' });
  const [aiCalLoading, setAiCalLoading] = useState(false);

  // Qida adına görə kalorini AI ilə avtomatik təyin et (istifadəçi yazmayıbsa)
  const autoFillCalories = async (foodName: string) => {
    const n = foodName.trim();
    if (n.length < 2 || customFood.calories || aiCalLoading) return;
    setAiCalLoading(true);
    try {
      const { data } = await supabase.functions.invoke('food-calories', { body: { name: n, language } });
      if (data?.found && data?.calories) {
        // İstifadəçi bu arada özü yazmayıbsa doldur
        setCustomFood((prev) => prev.calories ? prev : { ...prev, calories: String(data.calories) });
      }
    } catch (e) {
      console.warn('food-calories lookup failed:', e);
    } finally {
      setAiCalLoading(false);
    }
  };

  const { todayLog, loading: logsLoading, updateWaterIntake } = useDailyLogs();
  const { loading: mealLoading, addMealLog, deleteMealLog, getTodayStats, getMealsByType } = useMealLogs();
  const { data: nutritionTips = [], isLoading: tipsLoading } = useNutritionTips();
  const { data: dbFoods = [], isLoading: foodsLoading } = useCommonFoods();
  const { lifeStage, language } = useUserStore(
    useShallow((s) => ({ lifeStage: s.lifeStage, language: s.language }))
  );
  const { profile } = useAuth();
  const isMultiple = !!profile?.multiples_type && profile.multiples_type !== 'single';
  const babyCount = Math.max(1, Math.min(4, profile?.baby_count || 1));

  // Dynamic data from database
  const { data: dbMealTypes = [] } = useMealTypes(lifeStage || 'flow');
  const { data: dbTargets = [] } = useNutritionTargets();

  // Use DB foods or fallback
  const allCommonFoods = dbFoods.length > 0 ?
  dbFoods.map((f) => ({ name: f.name, calories: f.calories, emoji: f.emoji, meal_types: f.meal_types })) :
  fallbackFoods.map((f) => ({ ...f, meal_types: ['breakfast', 'lunch', 'dinner', 'snack'] }));

  // Filter foods by selected meal type using meal_types array directly
  const getFilteredFoods = (mealId: string) => {
    return allCommonFoods.filter((f) => {
      if (!f.meal_types || f.meal_types.length === 0) return true;
      return f.meal_types.includes(mealId);
    });
  };

  const commonFoods = selectedMeal ? getFilteredFoods(selectedMeal) : allCommonFoods;

  // Map meal types from DB or use fallback
  const mealTypes = useMemo(() => {
    if (dbMealTypes.length > 0) {
      return dbMealTypes.map((m) => {
        let mealName = m.name;
        let mealTime = m.time_range || '';

        // Fix for Nursing (it incorrectly comes as Nursing / Əlavə qida from db in some cases)
        if (m.meal_id === 'nursing') {
          mealName = language === 'en' ? 'Nursing' : language === 'ru' ? 'Грудное вскармливание' : language === 'tr' ? 'Emzirme' : language === 'kk' ? 'Емізу' : language === 'uz' ? 'Emizish' : language === 'ka' ? 'ძუძუთი კვება' : language === 'de' ? 'Stillen' : language === 'ar' ? 'رضاعة' : 'Əmizdirmə';
          mealTime = language === 'en' ? 'Anytime' : language === 'ru' ? 'В любое время' : language === 'tr' ? 'Her zaman' : language === 'kk' ? 'Кез келген уақытта' : language === 'uz' ? 'Istalgan vaqtda' : language === 'ka' ? 'ნებისმიერ დროს' : language === 'de' ? 'Jederzeit' : language === 'ar' ? 'في أي وقت' : 'İstənilən vaxt';
          if ((NEW_LANGUAGE_CODES as readonly string[]).includes(language)) {
            mealName = tr('nutrition_nursing_label', 'Əmizdirmə');
            mealTime = tr('nutrition_any_time', 'İstənilən vaxt');
          }
        } else {
          // QEYD: bu düzəliş əvvəllər YALNIZ language==='en' üçün işləyirdi — digər dillərdə
          // (ru/tr/kk/de/ar) DB-dən gələn xam Azərbaycan mətni (məs. "İstənilən vaxt") olduğu
          // kimi göstərilirdi. İndi bütün dillər üçün ümumiləşdirilib.
          const MEAL_NAME_TR: Record<string, Record<string, string>> = {
            'Əlavə qida': { en: 'Snack', ru: 'Перекус', tr: 'Ara öğün', kk: 'Жеңіл тамақ', uz: 'Yengil tamaddi', ka: 'წახემსება', de: 'Snack', ar: 'وجبة خفيفة' },
            'Qəlyanaltı': { en: 'Snack', ru: 'Перекус', tr: 'Ara öğün', kk: 'Жеңіл тамақ', uz: 'Yengil tamaddi', ka: 'წახემსება', de: 'Snack', ar: 'وجبة خفيفة' },
            'Səhər yeməyi': { en: 'Breakfast', ru: 'Завтрак', tr: 'Kahvaltı', kk: 'Таңғы ас', uz: 'Nonushta', ka: 'საუზმე', de: 'Frühstück', ar: 'الإفطار' },
            'Nahar': { en: 'Lunch', ru: 'Обед', tr: 'Öğle yemeği', kk: 'Түскі ас', uz: 'Tushlik', ka: 'სადილი', de: 'Mittagessen', ar: 'الغداء' },
            'Şam yeməyi': { en: 'Dinner', ru: 'Ужин', tr: 'Akşam yemeği', kk: 'Кешкі ас', uz: 'Kechki ovqat', ka: 'ვახშამი', de: 'Abendessen', ar: 'العشاء' },
          };
          const MEAL_TIME_TR: Record<string, string> = {
            en: 'Anytime', ru: 'В любое время', tr: 'Her zaman', kk: 'Кез келген уақытта', uz: 'Istalgan vaqtda', ka: 'ნებისმიერ დროს', de: 'Jederzeit', ar: 'في أي وقت',
          };
          if (MEAL_NAME_TR[mealName]?.[language]) mealName = MEAL_NAME_TR[mealName][language];
          if (mealTime === 'İstənilən vaxt' && MEAL_TIME_TR[language]) mealTime = MEAL_TIME_TR[language];
          if (mealTime === 'İstənilən vaxt' && (NEW_LANGUAGE_CODES as readonly string[]).includes(language)) mealTime = tr('nutrition_any_time', 'İstənilən vaxt');
        }

        return {
          id: m.meal_id,
          name: mealName,
          icon: mealIcons[m.meal_id] || Utensils,
          time: mealTime,
          emoji: m.emoji || '🍽️'
        };
      });
    }
    return fallbackMealTypes.map((m) => ({
      id: m.meal_id,
      name: m.name,
      icon: mealIcons[m.meal_id] || Utensils,
      time: m.time_range || '',
      emoji: m.emoji || '🍽️'
    }));
  }, [dbMealTypes]);

  // Get targets from DB or use fallback
  // Əkiz/çoxdöllü hamiləlikdə ACOG-a görə hər əlavə körpə üçün təxminən +300
  // kkal/gün əlavə tələb olunur (yəni əkiz +300, üçüz +600 və s. tək-hamiləlik
  // bazasının üzərinə). Yalnız hamiləlik (bump) mərhələsi üçün tətbiq olunur —
  // əmizdirmə/analıq üçün fərqli, ayrıca tədqiq olunmamış tövsiyələr var.
  const extraKcalForMultiples = lifeStage === 'bump' && isMultiple ? (babyCount - 1) * 300 : 0;

  const targets = useMemo(() => {
    const stage = lifeStage || 'flow';
    const dbTarget = dbTargets.find((t) => t.life_stage === stage);
    if (dbTarget) {
      return {
        calories: dbTarget.calories + extraKcalForMultiples,
        water: dbTarget.water_glasses,
        description: dbTarget.description || ''
      };
    }
    const fallback = fallbackTargets[stage as keyof typeof fallbackTargets] || fallbackTargets.flow;
    return { calories: fallback.calories + extraKcalForMultiples, water: fallback.water_glasses, description: fallback.description };
  }, [dbTargets, lifeStage, extraKcalForMultiples]);

  const waterGlasses = todayLog?.water_intake || 0;
  const stats = getTodayStats();
  const todayCalories = stats.totalCalories;

  const addWater = async () => {
    if (waterGlasses < 12) {
      await updateWaterIntake(1);
    }
  };

  const handleAddFood = async (food: {name: string;calories: number;}) => {
    if (!selectedMeal) return;

    await addMealLog({
      meal_type: selectedMeal as 'breakfast' | 'lunch' | 'dinner' | 'snack',
      food_name: food.name,
      calories: food.calories
    });
  };

  const handleAddCustomFood = async () => {
    if (!selectedMeal || !customFood.name || !customFood.calories) return;

    await addMealLog({
      meal_type: selectedMeal as 'breakfast' | 'lunch' | 'dinner' | 'snack',
      food_name: customFood.name,
      calories: parseInt(customFood.calories) || 0
    });

    setCustomFood({ name: '', calories: '' });
    setShowAddModal(false);
  };

  const handleDeleteMeal = async (id: string) => {
    await deleteMealLog(id);
  };

  const loading = logsLoading || tipsLoading || mealLoading;

  if (loading) {
    return <ToolLoading />;
  }

  // Meal detail view
  if (selectedMeal) {
    const mealInfo = mealTypes.find((m) => m.id === selectedMeal);
    const mealLogs = getMealsByType(selectedMeal);
    const mealCalories = stats.mealCalories[selectedMeal as keyof typeof stats.mealCalories] || 0;

    return (
      <div ref={ref}>
        <ToolPage>
          <ToolHeader
            onBack={() => setSelectedMeal(null)}
            eyebrow={mealInfo?.time}
            title={mealInfo?.name || ''}
            actions={<span style={{ fontSize: 26 }}>{mealInfo?.emoji}</span>} />

          <div className="space-y-3">
            {/* Meal summary */}
            <div className="a-cta" style={{ marginTop: 0 }}>
              <div className="flex justify-between items-center w-full">
                <div>
                  <p className="a-eyebrow" style={{ marginBottom: 2 }}>{tr("nutrition_bu_yemek_be47dc", "Bu yemək")}</p>
                  <p className="a-heading" style={{ margin: 0, fontSize: 24 }}>{mealCalories} <span style={{ fontSize: 13, fontWeight: 700 }}>kcal</span></p>
                </div>
                <span className="a-tag" style={{ cursor: 'default' }}>
                  {mealLogs.length} {language === 'en' ? (mealLogs.length === 1 ? 'item' : 'items') : language === 'ru' ? 'продукт' : language === 'tr' ? 'ürün' : language === 'kk' ? 'өнім' : language === 'uz' ? 'mahsulot' : language === 'ka' ? 'პროდუქტი' : language === 'de' ? (mealLogs.length === 1 ? 'Eintrag' : 'Einträge') : language === 'ar' ? 'عنصر' : 'qida'}
                </span>
              </div>
            </div>

            {/* Added foods */}
            {mealLogs.length > 0 && (
              <div className="a-card">
                <h3 className="a-card-title a-heading" style={{ marginBottom: 10 }}>{tr("nutrition_elave_edilen_qidalar_c604e8", "Əlavə edilən qidalar")}</h3>
                <div className="space-y-1.5">
                  {mealLogs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-2.5 rounded-xl"
                      style={{ background: 'var(--a-surface-soft)' }}>
                      
                      <div>
                        <p className="a-list-title" style={{ margin: 0 }}>{log.food_name}</p>
                        <p className="a-list-sub" style={{ margin: 0 }}>{log.calories} kcal</p>
                      </div>
                      <motion.button
                        onClick={() => handleDeleteMeal(log.id)}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--a-pink-1)' }}
                        whileTap={{ scale: 0.9 }}>
                        
                        <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--a-pink-ink)' }} />
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick add foods */}
            <div className="a-card">
              <h3 className="a-card-title a-heading" style={{ marginBottom: 10 }}>{tr("nutrition_tez_elave_et_5c2127", "Tez əlavə et")}</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {commonFoods.map((food, index) =>
                <motion.button
                  key={food.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(index * 0.02, 0.3) }}
                  onClick={() => handleAddFood(food)}
                  className="rounded-xl p-2 text-center transition-colors"
                  style={{ background: 'var(--a-surface-soft)', border: '1px solid var(--a-line)', cursor: 'pointer' }}
                  whileTap={{ scale: 0.95 }}>
                  
                    <div className="text-xl mb-0.5">{food.emoji}</div>
                    <p className="text-[9px] font-semibold truncate" style={{ margin: 0, color: 'var(--a-ink)' }}>{food.name}</p>
                    <p className="text-[8px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{food.calories}</p>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Custom add */}
            <motion.button
              onClick={() => setShowAddModal(true)}
              className="w-full rounded-2xl p-3 flex items-center justify-center gap-2 text-sm font-bold"
              style={{ background: 'var(--a-surface)', border: '1.5px dashed var(--a-peach-2)', color: 'var(--a-accent-ink)', cursor: 'pointer' }}
              whileTap={{ scale: 0.98 }}>
              
              <Plus className="w-4 h-4" />
              <span>{tr("nutrition_xususi_qida_elave_et_2a3838", "Xüsusi qida əlavə et")}</span>
            </motion.button>
          </div>

          {/* Custom food modal */}
          <AnimatePresence>
            {showAddModal &&
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-end"
              onClick={() => setShowAddModal(false)}>
              
                <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="w-full rounded-t-[26px] p-4"
                style={{ background: 'var(--a-surface)', paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 100px)' }}
                onClick={(e) => e.stopPropagation()}>
                
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="a-heading" style={{ margin: 0, fontSize: 16, color: 'var(--a-ink)' }}>{tr("nutrition_xususi_qida_elave_et_2a3838", "Xüsusi qida əlavə et")}</h2>
                    <button className="a-icon-btn" onClick={() => setShowAddModal(false)} aria-label="Close">
                      <X size={15} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="a-list-sub mb-1 block" style={{ margin: '0 0 4px' }}>{tr("nutrition_qida_adi_d6a129", "Qida adı")}</label>
                      <input
                      className="a-input w-full"
                      value={customFood.name}
                      onChange={(e) => setCustomFood({ ...customFood, name: e.target.value })}
                      onBlur={(e) => autoFillCalories(e.target.value)}
                      placeholder={tr('nutrition_food_ph', 'məs. Plov')} />
                    
                    </div>
                    <div>
                      <label className="a-list-sub mb-1 block" style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {tr("untranslated_kalori_y6oaf2", "Kalori")}
                        {aiCalLoading &&
                        <span style={{ fontSize: 10.5, color: 'var(--a-peach-2)', fontWeight: 700 }}>
                          ✨ {tr("nutrition_ai_kalori_axtarir", "AI təyin edir...")}
                        </span>
                        }
                      </label>
                      <input
                      className="a-input w-full"
                      type="number"
                      value={customFood.calories}
                      onChange={(e) => setCustomFood({ ...customFood, calories: e.target.value })}
                      placeholder={tr("nutrition_kcal_ph", "məs. 350")} />
                    
                    </div>
                    <button
                    onClick={handleAddCustomFood}
                    className="a-cta-btn w-full"
                    style={{ justifyContent: 'center', height: 46, opacity: !customFood.name || !customFood.calories ? 0.5 : 1 }}
                    disabled={!customFood.name || !customFood.calories}>
                    
                      <Check size={15} strokeWidth={2.2} />
                      {tr("nutrition_elave_et_6e1b9b", "\u018Flav\u0259 et")}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            }
          </AnimatePresence>
        </ToolPage>
      </div>);

  }

  return (
    <div ref={ref}>
      <ToolPage>
        <ToolHeader
          onBack={onBack}
          eyebrow={targets.description || tr("nutrition_saglam_qidalanma_ucun_tovsiyel_7cb135", "Sa\u011Flam qidalanma \xFC\xE7\xFCn t\xF6vsiy\u0259l\u0259r")}
          title={tr("nutrition_qidalanma_title", 'Qidalanma')} />

        {/* Stats Card */}
        <div className="a-cta" style={{ marginTop: 0 }}>
          <div className="w-full">
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className="a-eyebrow" style={{ marginBottom: 2 }}>{tr("nutrition_bugunku_kalori_33554f", "Bugünkü kalori")}</p>
                <p className="a-heading" style={{ margin: 0, fontSize: 24 }}>
                  {todayCalories} <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--a-ink-soft)' }}>/ {targets.calories}</span>
                </p>
                {extraKcalForMultiples > 0 &&
                <p className="text-[10px] font-semibold" style={{ margin: '2px 0 0', color: 'var(--a-ink-soft)' }}>
                    {tr("nutrition_ekiz_ucun_elave_kalori", "+{n} kkal əkiz/çoxdöllü üçün daxildir").replace('{n}', String(extraKcalForMultiples))}
                  </p>
                }
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--a-surface-soft)' }}>
                <span className="text-2xl">🍽️</span>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--a-line-strong)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--a-peach-2)' }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(todayCalories / targets.calories * 100, 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }} />
              
            </div>
            <p className="text-xs mt-2 text-center font-semibold" style={{ margin: '8px 0 0', color: 'var(--a-ink-soft)' }}>{stats.totalMeals} {tr("nutrition_yemek_qeyd_edildi_1d4996", "yem\u0259k qeyd edildi")}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="a-tabs w-full mt-3" style={{ display: 'flex' }}>
          {[
          { id: 'log', label: tr("nutrition_yemek_b1fd56", 'Yemək') },
          { id: 'vitamins', label: tr("nutrition_vitaminler_e49129", 'Vitaminlər') },
          { id: 'water', label: tr("common_su_water", 'Su') }].
          map((tab) =>
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`a-tab flex-1 ${activeTab === tab.id ? 'active' : ''}`}>
            
              {tab.label}
            </button>
          )}
        </div>

        <div className="mt-3">
          <AnimatePresence mode="wait">
            {activeTab === 'log' &&
            <motion.div
              key="log"
              initial={{ opacity: 0, x: rtlX(-20, isRtl) }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: rtlX(20, isRtl) }}>
              
                <div className="a-section-head">
                  <h2 className="a-section-title a-heading" style={{ fontSize: 15 }}>{tr("nutrition_bugunku_yemekler_25c273", "Bugünkü yeməklər")}</h2>
                </div>
                <div className="a-list-card pb-4">
                  {mealTypes.map((meal, index) => {
                  const mealLogs = getMealsByType(meal.id);
                  const mealCalories = stats.mealCalories[meal.id as keyof typeof stats.mealCalories] || 0;

                  return (
                    <motion.button
                      key={meal.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedMeal(meal.id)}
                      className="a-list-row w-full text-start"
                      style={{ width: '100%', background: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer' }}>
                      
                        <span className="a-list-icon" style={{ background: 'var(--a-grad-peach)', fontSize: 18 }}>
                          {meal.emoji}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="a-list-title">{meal.name}</p>
                          <p className="a-list-sub">
                            {mealLogs.length > 0 ?
                          `${mealLogs.length} ${language === 'en' ? (mealLogs.length === 1 ? 'item' : 'items') : language === 'ru' ? 'продукт' : language === 'tr' ? 'ürün' : language === 'kk' ? 'өнім' : language === 'uz' ? 'mahsulot' : language === 'ka' ? 'პროდუქტი' : language === 'de' ? (mealLogs.length === 1 ? 'Eintrag' : 'Einträge') : language === 'ar' ? 'عنصر' : 'qida'} • ${mealCalories} kcal` :
                          meal.time
                          }
                          </p>
                        </div>
                        <span className="a-list-trail">
                          {mealLogs.length > 0 ?
                        <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--a-green-1)', display: 'inline-flex' }}>
                              <Check className="w-3.5 h-3.5" style={{ color: 'var(--a-green-ink)' }} />
                            </span> :

                        <Plus className="w-4 h-4" style={{ color: 'var(--a-peach-2)' }} />
                        }
                        </span>
                      </motion.button>);

                })}
                </div>
              </motion.div>
            }

            {activeTab === 'tips' &&
            <motion.div
              key="tips"
              initial={{ opacity: 0, x: rtlX(-20, isRtl) }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: rtlX(20, isRtl) }}
              className="space-y-3">
              
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-4 h-4" style={{ color: 'var(--a-yellow-2)' }} />
                  <h2 className="font-bold text-sm a-heading" style={{ margin: 0, color: 'var(--a-on-bg)' }}>{tr("nutrition_tovsiye_olunan_qidalar_5d52f5", "Tövsiyə olunan qidalar")}</h2>
                </div>
                <p className="text-xs mb-2" style={{ margin: 0, color: 'var(--a-on-bg-soft)' }}>
                  {lifeStage === 'bump' ? tr("nutrition_hamilelik_dovrunde_faydali_qid_4fb245", "Hamil\u0259lik d\xF6vr\xFCnd\u0259 faydal\u0131 qidalar") :
                lifeStage === 'mommy' ? tr("nutrition_emizdirme_dovrunde_faydali_qid_38d382", "\u018Fmizdirm\u0259 d\xF6vr\xFCnd\u0259 faydal\u0131 qidalar") : tr("nutrition_saglam_qidalanma_ucun_tovsiyel_7cb135", "Sa\u011Flam qidalanma \xFC\xE7\xFCn t\xF6vsiy\u0259l\u0259r")
                }
                </p>
                
                {nutritionTips.length === 0 ?
              <div className="a-card text-center" style={{ padding: '30px 18px' }}>
                    <div className="text-4xl mb-3">🥗</div>
                    <p className="a-list-sub" style={{ margin: 0 }}>{tr("nutrition_tovsiye_tapilmadi_facebb", "Tövsiyə tapılmadı")}</p>
                  </div> :

              <div className="grid grid-cols-2 gap-2">
                    {nutritionTips.map((tip, index) =>
                <motion.div
                  key={tip.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  className="a-card"
                  style={{ padding: 14 }}>
                  
                        <div className="text-2xl mb-2">{tip.emoji || '🍎'}</div>
                        <h3 className="a-list-title mb-0.5" style={{ margin: 0 }}>{tip.title}</h3>
                        <p className="a-list-sub mb-1" style={{ margin: '0 0 6px' }}>{tip.calories || 0} kcal</p>
                        <div className="flex flex-wrap gap-0.5">
                          {(tip.benefits || []).slice(0, 2).map((benefit) =>
                    <span
                      key={benefit}
                      className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold"
                      style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                      
                              {benefit}
                            </span>
                    )}
                        </div>
                      </motion.div>
                )}
                  </div>
              }
              </motion.div>
            }

            {activeTab === 'vitamins' &&
            <VitaminsTab />
            }

            {activeTab === 'water' &&
            <motion.div
              key="water"
              initial={{ opacity: 0, x: rtlX(-20, isRtl) }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: rtlX(20, isRtl) }}
              className="space-y-3">
              
                <div className="a-card text-center">
                  <Droplets className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--a-blue-2)' }} />
                  <h2 className="a-heading" style={{ margin: '0 0 4px', fontSize: 28 }}>
                    {waterGlasses} / {targets.water}
                  </h2>
                  <p className="a-list-sub mb-4" style={{ margin: '0 0 16px' }}>{tr("nutrition_stekan_su_icdiniz_a26973", "stəkan su içdiniz")}</p>
                  
                  <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                    {Array.from({ length: Math.max(targets.water, waterGlasses) }).map((_, i) =>
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all"
                    style={i < waterGlasses ?
                    { background: 'var(--a-blue-2)', color: '#fff', boxShadow: '0 6px 14px -6px rgba(99, 172, 223, 0.7)' } :
                    { background: 'var(--a-blue-1)', color: 'var(--a-blue-2)', opacity: 0.7 }}>
                    
                        <Droplet className={`w-5 h-5 ${i < waterGlasses ? 'fill-current' : 'fill-none stroke-current stroke-2'}`} />
                      </motion.div>
                  )}
                  </div>

                  <motion.button
                  onClick={addWater}
                  className="a-cta-btn w-full"
                  style={{ justifyContent: 'center', height: 46, opacity: waterGlasses >= 12 ? 0.5 : 1 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={waterGlasses >= 12}>
                  
                    <Plus size={15} strokeWidth={2.2} />
                    {tr("nutrition_su_elave_et_6ae5c0", "Su \u0259lav\u0259 et")}
                  </motion.button>
                </div>

                <div className="rounded-2xl p-3" style={{ background: 'var(--a-blue-1)' }}>
                  <h3 className="font-bold mb-1 text-sm" style={{ margin: '0 0 4px', color: 'var(--a-blue-ink)' }}>{tr("nutrition_meslehet_f594cf", "💡 Məsləhət")}</h3>
                  <p className="text-xs" style={{ margin: 0, color: 'var(--a-blue-ink)' }}>
                    {lifeStage === 'bump' ? tr("nutrition_hamilelik_zamani_gunde_en_azi__d70ce9", "Hamil\u0259lik zaman\u0131 g\xFCnd\u0259 \u0259n az\u0131 10 st\u0259kan su i\xE7m\u0259k t\xF6vsiy\u0259 olunur. Yet\u0259rli su i\xE7m\u0259k k\xF6rp\u0259nin inki\u015Faf\u0131na k\xF6m\u0259k edir.") :

                  lifeStage === 'mommy' ? tr("nutrition_emizdirme_dovrunde_gunde_12_st_a765d7", "\u018Fmizdirm\u0259 d\xF6vr\xFCnd\u0259 g\xFCnd\u0259 12 st\u0259kan su i\xE7m\u0259k t\xF6vsiy\u0259 olunur. Bu s\xFCd istehsal\u0131na k\xF6m\u0259k edir.") : tr("nutrition_gunde_en_azi_8_stekan_su_icmek_c12741", "G\xFCnd\u0259 \u0259n az\u0131 8 st\u0259kan su i\xE7m\u0259k b\u0259d\u0259ni sa\u011Flam saxlay\u0131r.")

                  }
                  </p>
                </div>
              </motion.div>
            }
          </AnimatePresence>
        </div>
      </ToolPage>
    </div>);

});

Nutrition.displayName = 'Nutrition';

export default Nutrition;

import { useState, useMemo, forwardRef, useEffect, useRef } from 'react';
import { tr } from '@/lib/tr';
import { useIsRtl, rtlX } from '@/lib/rtl';
import { getCachedTranslation } from '@/lib/i18n';
import { NEW_LANGUAGE_CODES } from '@/lib/app-languages';
import { motion } from 'framer-motion';
import {
  Search, Clock, Heart,
  Users, Crown, Lock, Flame, Timer, Sparkles,
  UtensilsCrossed } from
'lucide-react';
import { useRecipes, Recipe } from '@/hooks/useDynamicContent';
import { useRecipeCategories } from '@/hooks/useDynamicTools';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { useSubscription } from '@/hooks/useSubscription';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { resetAppScrollPosition } from '@/lib/scroll';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { PremiumModal } from '@/components/PremiumModal';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { AdInlineAnchor, AdSurface, useAdExit } from '@/components/ads/AdExperienceProvider';

interface RecipesProps {
  onBack: () => void;
  /** Opened from another tool (e.g. the solid food guide): start on this category / recipe. */
  initialCategory?: string;
  initialRecipeId?: string;
}


const Recipes = forwardRef<HTMLDivElement, RecipesProps>(({ onBack, initialCategory, initialRecipeId }, ref) => {
  useScrollToTop();
  const isRtl = useIsRtl();
  useScreenAnalytics('Recipes', 'Tools');

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeCategory, setRecipeCategory] = useState(initialCategory ?? 'all');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const { data: recipes = [], isLoading: recipesLoading } = useRecipes();
  const { lifeStage, language } = useUserStore(
    useShallow((s) => ({ lifeStage: s.lifeStage, language: s.language }))
  );
  const { isPremium, loading: subscriptionLoading } = useSubscription();

  // Dynamic data from database
  const { data: dbRecipeCategories = [] } = useRecipeCategories();

  // Get recipe categories from DB or use fallback - filter out any existing "all"
  const recipeCategories = useMemo(() => {
    const base = [{ id: 'all', name: tr("recipes_hamisi_c73c4d", "Hamısı"), emoji: '🍽️' }];
    if (dbRecipeCategories.length > 0) {
      const filtered = dbRecipeCategories.
      filter((c) => c.category_id !== 'all' && c.name.toLowerCase() !== tr("recipes_hamisi_6dc013", "ham\u0131s\u0131")).
      map((c) => ({
        id: c.category_id,
        name: c.name,
        emoji: c.emoji || '🍽️'
      }));
      return [...base, ...filtered];
    }
    return base;
  }, [dbRecipeCategories]);

  // Normalizes any category string (slug, AZ name, EN name) to a standard lowercase slug ID
  const getNormalizedCategorySlug = useMemo(() => {
    return (cat: string | undefined | null): string => {
      if (!cat) return 'all';
      const normalized = cat.trim().toLowerCase();
      
      const match = dbRecipeCategories.find(c => 
        c.category_id?.toLowerCase() === normalized ||
        c.name_az?.toLowerCase() === normalized ||
        c.name_en?.toLowerCase() === normalized ||
        c.name?.toLowerCase() === normalized
      );
      if (match) return match.category_id;

      const slugMap: Record<string, string> = {
        'səhər yeməyi': 'seher_yemeyi',
        'seher yemeyi': 'seher_yemeyi',
        'seher_yemeyi': 'seher_yemeyi',
        'nahar': 'nahar',
        'şam yeməyi': 'sam_yemeyi',
        'sam yemeyi': 'sam_yemeyi',
        'sam_yemeyi': 'sam_yemeyi',
        'desertlər': 'desertler',
        'desertler': 'desertler',
        'desert': 'desertler',
        'qəlyanaltılar': 'qelyanaltilar',
        'qelyanaltilar': 'qelyanaltilar',
        'qelyanalti': 'qelyanaltilar',
        'qəlyanaltı': 'qelyanaltilar',
        'sulu yeməklər': 'sulu_yemekler',
        'sulu yemekler': 'sulu_yemekler',
        'sulu_yemekler': 'sulu_yemekler',
        'körpə qidası': 'korpe_qidasi',
        'korpe qidasi': 'korpe_qidasi',
        'korpe_qidasi': 'korpe_qidasi'
      };

      return slugMap[normalized] || normalized;
    };
  }, [dbRecipeCategories]);

  // Robust translated category name helper
  const getTranslatedCategoryName = useMemo(() => {
    return (cat: string | undefined | null, localizedLabel?: string): string => {
      if (!cat) return '';
      
      const normalized = cat.trim().toLowerCase();
      
      // 1. Try to find a match in dbRecipeCategories
      const match = dbRecipeCategories.find(c => 
        c.category_id?.toLowerCase() === normalized ||
        c.name_az?.toLowerCase() === normalized ||
        c.name_en?.toLowerCase() === normalized ||
        c.name?.toLowerCase() === normalized
      );
      
      if (match) {
        return match.name; // This is already translated by mapRowsTranslation
      }

      // 2. Fallback local dictionary — bütün 7 dil üçün (əvvəllər yalnız en/az var idi,
      // ru/tr/kk/de/ar istifadəçiləri bu fallback-a düşəndə xam Azərbaycan mətni görürdü,
      // məs. "hamısı" filtr çipi — bax Recipes.tsx-də category.id==='all' çağırışı).
      type LangMap = { az: string; en: string; ru: string; tr: string; kk: string; de: string; ar: string; uz?: string; ka?: string };
      const dictionary: Record<string, LangMap> = {
        'seher_yemeyi': { az: 'Səhər Yeməyi', en: 'Breakfast', ru: 'Завтрак', tr: 'Kahvaltı', kk: 'Таңғы ас', de: 'Frühstück', ar: 'الإفطار' },
        'səhər yeməyi': { az: 'Səhər Yeməyi', en: 'Breakfast', ru: 'Завтрак', tr: 'Kahvaltı', kk: 'Таңғы ас', de: 'Frühstück', ar: 'الإفطار' },
        'seher yemeyi': { az: 'Səhər Yeməyi', en: 'Breakfast', ru: 'Завтрак', tr: 'Kahvaltı', kk: 'Таңғы ас', de: 'Frühstück', ar: 'الإفطار' },

        'nahar': { az: 'Nahar', en: 'Lunch', ru: 'Обед', tr: 'Öğle yemeği', kk: 'Түскі ас', de: 'Mittagessen', ar: 'الغداء' },

        'sam_yemeyi': { az: 'Şam Yeməyi', en: 'Dinner', ru: 'Ужин', tr: 'Akşam yemeği', kk: 'Кешкі ас', de: 'Abendessen', ar: 'العشاء' },
        'şam yeməyi': { az: 'Şam Yeməyi', en: 'Dinner', ru: 'Ужин', tr: 'Akşam yemeği', kk: 'Кешкі ас', de: 'Abendessen', ar: 'العشاء' },
        'sam yemeyi': { az: 'Şam Yeməyi', en: 'Dinner', ru: 'Ужин', tr: 'Akşam yemeği', kk: 'Кешкі ас', de: 'Abendessen', ar: 'العشاء' },

        'şorbalar': { az: 'Şorbalar', en: 'Soups', ru: 'Супы', tr: 'Çorbalar', kk: 'Сорпалар', de: 'Suppen', ar: 'الشوربات' },
        'sorbalar': { az: 'Şorbalar', en: 'Soups', ru: 'Супы', tr: 'Çorbalar', kk: 'Сорпалар', de: 'Suppen', ar: 'الشوربات' },

        'pürelər': { az: 'Pürelər', en: 'Purees', ru: 'Пюре', tr: 'Püreler', kk: 'Пюрелер', de: 'Pürees', ar: 'البورية' },
        'pureler': { az: 'Pürelər', en: 'Purees', ru: 'Пюре', tr: 'Püreler', kk: 'Пюрелер', de: 'Pürees', ar: 'البورية' },

        'əsas yeməklər': { az: 'Əsas yeməklər', en: 'Main dishes', ru: 'Основные блюда', tr: 'Ana yemekler', kk: 'Негізгі тағамдар', de: 'Hauptgerichte', ar: 'الأطباق الرئيسية' },
        'esas yemekler': { az: 'Əsas yeməklər', en: 'Main dishes', ru: 'Основные блюда', tr: 'Ana yemekler', kk: 'Негізгі тағамдар', de: 'Hauptgerichte', ar: 'الأطباق الرئيسية' },

        'desertler': { az: 'Desertlər', en: 'Desserts', ru: 'Десерты', tr: 'Tatlılar', kk: 'Десерттер', de: 'Desserts', ar: 'الحلويات' },
        'desertlər': { az: 'Desertlər', en: 'Desserts', ru: 'Десерты', tr: 'Tatlılar', kk: 'Десерттер', de: 'Desserts', ar: 'الحلويات' },
        'desert': { az: 'Desert', en: 'Dessert', ru: 'Десерт', tr: 'Tatlı', kk: 'Десерт', de: 'Dessert', ar: 'حلوى' },

        'saglam ickiler': { az: 'Sağlam içkilər', en: 'Healthy Drinks', ru: 'Полезные напитки', tr: 'Sağlıklı içecekler', kk: 'Пайдалы сусындар', de: 'Gesunde Getränke', ar: 'مشروبات صحية' },
        'sağlam içkilər': { az: 'Sağlam içkilər', en: 'Healthy Drinks', ru: 'Полезные напитки', tr: 'Sağlıklı içecekler', kk: 'Пайдалы сусындар', de: 'Gesunde Getränke', ar: 'مشروبات صحية' },

        'elave qida': { az: 'Əlavə qida', en: 'Supplementary Food', ru: 'Прикорм', tr: 'Ek gıda', kk: 'Қосымша тағам', de: 'Beikost', ar: 'الغذاء التكميلي' },
        'əlavə qida': { az: 'Əlavə qida', en: 'Supplementary Food', ru: 'Прикорм', tr: 'Ek gıda', kk: 'Қосымша тағам', de: 'Beikost', ar: 'الغذاء التكميلي' },

        'qelyanaltilar': { az: 'Qəlyanaltılar', en: 'Snacks', ru: 'Перекусы', tr: 'Ara öğünler', kk: 'Жеңіл тағамдар', de: 'Snacks', ar: 'وجبات خفيفة' },
        'qəlyanaltılar': { az: 'Qəlyanaltılar', en: 'Snacks', ru: 'Перекусы', tr: 'Ara öğünler', kk: 'Жеңіл тағамдар', de: 'Snacks', ar: 'وجبات خفيفة' },
        'qelyanalti': { az: 'Qəlyanaltı', en: 'Snack', ru: 'Перекус', tr: 'Ara öğün', kk: 'Жеңіл тағам', de: 'Snack', ar: 'وجبة خفيفة' },
        'qəlyanaltı': { az: 'Qəlyanaltı', en: 'Snack', ru: 'Перекус', tr: 'Ara öğün', kk: 'Жеңіл тағам', de: 'Snack', ar: 'وجبة خفيفة' },

        'sulu_yemekler': { az: 'Sulu Yeməklər', en: 'Soups', ru: 'Супы', tr: 'Sulu yemekler', kk: 'Сорпалы тағамдар', de: 'Suppen', ar: 'الأطباق ذات المرق' },
        'sulu yeməklər': { az: 'Sulu Yeməklər', en: 'Soups', ru: 'Супы', tr: 'Sulu yemekler', kk: 'Сорпалы тағамдар', de: 'Suppen', ar: 'الأطباق ذات المرق' },
        'sulu yemekler': { az: 'Sulu Yeməklər', en: 'Soups', ru: 'Супы', tr: 'Sulu yemekler', kk: 'Сорпалы тағамдар', de: 'Suppen', ar: 'الأطباق ذات المرق' },

        'korpe_qidasi': { az: 'Körpə Qidası', en: 'Baby Food', ru: 'Детское питание', tr: 'Bebek maması', kk: 'Бөбек тағамы', de: 'Babynahrung', ar: 'طعام الرضيع' },
        'körpə qidası': { az: 'Körpə Qidası', en: 'Baby Food', ru: 'Детское питание', tr: 'Bebek maması', kk: 'Бөбек тағамы', de: 'Babynahrung', ar: 'طعام الرضيع' },
        'korpe qidasi': { az: 'Körpə Qidası', en: 'Baby Food', ru: 'Детское питание', tr: 'Bebek maması', kk: 'Бөбек тағамы', de: 'Babynahrung', ar: 'طعام الرضيع' },

        'populyar': { az: 'Populyar', en: 'Popular', ru: 'Популярное', tr: 'Popüler', kk: 'Танымал', de: 'Beliebt', ar: 'الأكثر شيوعًا' },

        'all': { az: 'Hamısı', en: 'All', ru: 'Все', tr: 'Hepsi', kk: 'Барлығы', de: 'Alle', ar: 'الكل' },
        'hamısı': { az: 'Hamısı', en: 'All', ru: 'Все', tr: 'Hepsi', kk: 'Барлығы', de: 'Alle', ar: 'الكل' },
        'hamisi': { az: 'Hamısı', en: 'All', ru: 'Все', tr: 'Hepsi', kk: 'Барлығы', de: 'Alle', ar: 'الكل' },
      };

      if (dictionary[normalized]) {
        if ((NEW_LANGUAGE_CODES as readonly string[]).includes(language)) return getCachedTranslation(`recipe_category.${normalized}`, language) || dictionary[normalized].en;
        const langKey = (['az', 'en', 'ru', 'tr', 'kk', 'de', 'ar', 'uz', 'ka'] as const).includes(language as any) ? (language as keyof LangMap) : 'az';
        // uz/ka lüğətdə yoxdur → ru körpüsü (kk ilə eyni məntiq)
        return dictionary[normalized][langKey] || dictionary[normalized].ru;
      }

      // 3. Fallback to capitalization if nothing matches
      const label = localizedLabel || cat;
      return label.charAt(0).toUpperCase() + label.slice(1).replace(/_/g, ' ');
    };
  }, [dbRecipeCategories, language]);

  // Robust category matching filter
  const isCategoryMatch = useMemo(() => {
    return (recipeCat: string | undefined | null, selectedCat: string): boolean => {
      if (selectedCat === 'all') return true;
      if (!recipeCat) return false;
      return getNormalizedCategorySlug(recipeCat) === getNormalizedCategorySlug(selectedCat);
    };
  }, [getNormalizedCategorySlug]);

  const toggleFavorite = (recipeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) =>
    prev.includes(recipeId) ? prev.filter((id) => id !== recipeId) : [...prev, recipeId]
    );
  };

  // Filter recipes
  const filteredRecipes = recipes.filter((recipe) => {
    const matchesCategory = isCategoryMatch(recipe.category, recipeCategory);
    const matchesSearch = recipe.title.toLowerCase().includes(recipeSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Determine which recipes are free (first 3 per category)
  const freeRecipeIds = useMemo(() => {
    const ids = new Set<string>();
    const countPerCategory: Record<string, number> = {};
    for (const recipe of recipes) {
      const normalizedCat = getNormalizedCategorySlug(recipe.category);
      countPerCategory[normalizedCat] = (countPerCategory[normalizedCat] || 0) + 1;
      if (countPerCategory[normalizedCat] <= 3) {
        ids.add(recipe.id);
      }
    }
    return ids;
  }, [recipes, getNormalizedCategorySlug]);

  const isRecipeFree = (recipe: Recipe) => freeRecipeIds.has(recipe.id);

  const [scrollPosition, setScrollPosition] = useState(0);

  const handleRecipeClick = (recipe: Recipe) => {
    if (!isPremium && !isRecipeFree(recipe)) {
      setShowPremiumModal(true);
      return;
    }
    // Save scroll position before navigating to detail
    const scrollContainer = document.querySelector('[data-scroll-container]');
    setScrollPosition(scrollContainer?.scrollTop || window.scrollY || 0);
    setSelectedRecipe(recipe);
    // Scroll to top for detail view
    requestAnimationFrame(() => {
      resetAppScrollPosition();
    });
  };

  // Open the requested recipe once the list is loaded (the premium gate still applies).
  const initialOpened = useRef(false);
  useEffect(() => {
    if (initialOpened.current || !initialRecipeId || subscriptionLoading) return;
    const recipe = recipes.find((item) => item.id === initialRecipeId);
    if (!recipe) return;
    initialOpened.current = true;
    handleRecipeClick(recipe);
  }, [recipes, initialRecipeId, subscriptionLoading]);

  const handleBackFromDetail = () => {
    setSelectedRecipe(null);
    // Restore scroll position after returning to list
    requestAnimationFrame(() => {
      const scrollContainer = document.querySelector('[data-scroll-container]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollPosition;
      } else {
        window.scrollTo({ top: scrollPosition, behavior: 'auto' });
      }
    });
  };

  const totalTime = (recipe: Recipe) => (recipe.prep_time || 0) + (recipe.cook_time || 0);
  const leaveRecipe = useAdExit('recipe_exit_interstitial', handleBackFromDetail, !!selectedRecipe);

  // Recipe Detail View - scroll to top on open
  if (selectedRecipe && (isPremium || isRecipeFree(selectedRecipe))) {
    return (
      <div ref={ref} key={`recipe-${selectedRecipe.id}`}>
        <AdSurface id="recipes_banner" />
        <ToolPage>
          <ToolHeader
            onBack={() => { void leaveRecipe(); }}
            eyebrow={getTranslatedCategoryName(selectedRecipe.category, selectedRecipe.categoryLabel)}
            title={selectedRecipe.title}
            actions={
            <button className="a-icon-btn" onClick={(e) => toggleFavorite(selectedRecipe.id, e as any)} aria-label="Favorite">
                <Heart
                size={16}
                strokeWidth={2}
                style={favorites.includes(selectedRecipe.id) ? { fill: 'var(--a-pink-2)', color: 'var(--a-pink-2)' } : undefined} />
              </button>
            } />

          <div className="space-y-3">
            {/* Hero Image/Emoji */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-[26px] overflow-hidden"
              style={{ boxShadow: 'var(--a-card-shadow)' }}>
              
              {selectedRecipe.image_url ?
              <img
                src={selectedRecipe.image_url}
                alt={selectedRecipe.title}
                loading="lazy"
                decoding="async"
                className="w-full h-48 object-cover" /> :


              <div className="h-40 flex items-center justify-center" style={{ background: 'var(--a-illus-grad)' }}>
                  <span className="text-7xl">{selectedRecipe.emoji || '🍽️'}</span>
                </div>
              }
            </motion.div>

            {/* Quick Stats Row */}
            <motion.div
              className="flex items-center gap-2 justify-center flex-wrap"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}>
              
              {selectedRecipe.prep_time && selectedRecipe.prep_time > 0 &&
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-full" style={{ background: 'var(--a-blue-1)' }}>
                  <Timer className="w-4 h-4" style={{ color: 'var(--a-blue-ink)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--a-blue-ink)' }}>{selectedRecipe.prep_time} {tr("recipes_deq_780a5c", "d\u0259q")}</span>
                </div>
              }
              {selectedRecipe.cook_time && selectedRecipe.cook_time > 0 &&
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-full" style={{ background: 'var(--a-peach-1)' }}>
                  <Flame className="w-4 h-4" style={{ color: 'var(--a-accent-ink)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--a-accent-ink)' }}>{selectedRecipe.cook_time} {tr("recipes_deq_780a5c", "d\u0259q")}</span>
                </div>
              }
              {selectedRecipe.servings &&
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-full" style={{ background: 'var(--a-green-1)' }}>
                  <Users className="w-4 h-4" style={{ color: 'var(--a-green-ink)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--a-green-ink)' }}>{selectedRecipe.servings} por.</span>
                </div>
              }
            </motion.div>

            {/* Description */}
            {selectedRecipe.description &&
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="a-card">
              
                <div className="flex items-start gap-3">
                  <span className="a-list-icon" style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--a-grad-yellow)', flexShrink: 0 }}>
                    <Sparkles size={15} strokeWidth={2.2} style={{ color: 'var(--a-warn-ink)' }} />
                  </span>
                  <p className="a-cta-text" style={{ margin: 0 }}>{selectedRecipe.description}</p>
                </div>
              </motion.div>
            }

            {/* Ingredients Section */}
            <AdInlineAnchor id="recipes_banner" />
            {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 &&
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="a-card overflow-hidden"
              style={{ padding: 0 }}>
              
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--a-grad-green)' }}>
                  <h3 className="font-bold a-heading flex items-center gap-2" style={{ margin: 0, color: 'var(--a-green-ink)' }}>
                    <span className="text-lg">🥗</span> {tr("recipes_i_nqrediyentler_4c0854", "\u0130nqrediyentl\u0259r")}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(255,255,255,0.45)', color: 'var(--a-green-ink)' }}>
                    {selectedRecipe.ingredients.length}
                  </span>
                </div>
                <div className="p-4 space-y-2">
                  {selectedRecipe.ingredients.map((ingredient, idx) =>
                <motion.div
                  key={idx}
                  className="flex items-center gap-3 py-2"
                  style={{ borderBottom: idx < selectedRecipe.ingredients!.length - 1 ? '1px solid var(--a-line)' : 'none' }}
                  initial={{ x: rtlX(-10, isRtl), opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.25 + idx * 0.02 }}>
                  
                      <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: 'var(--a-green-1)', color: 'var(--a-green-ink)' }}>
                        {idx + 1}
                      </div>
                      <span className="text-sm" style={{ color: 'var(--a-ink)' }}>{ingredient}</span>
                    </motion.div>
                )}
                </div>
              </motion.div>
            }

            {/* Instructions Section */}
            {selectedRecipe.instructions && selectedRecipe.instructions.length > 0 &&
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="a-card overflow-hidden"
              style={{ padding: 0 }}>
              
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--a-grad-peach)' }}>
                  <h3 className="font-bold a-heading flex items-center gap-2" style={{ margin: 0, color: 'var(--a-accent-ink)' }}>
                    <span className="text-lg">👩‍🍳</span> {tr("recipes_hazirlanma_13bf8d", "Haz\u0131rlanma")}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(255,255,255,0.45)', color: 'var(--a-accent-ink)' }}>
                    {selectedRecipe.instructions.length} {tr("recipes_addim_74e240", "add\u0131m")}
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  {selectedRecipe.instructions.map((instruction, idx) =>
                <motion.div
                  key={idx}
                  className="flex gap-3"
                  initial={{ x: rtlX(-10, isRtl), opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.35 + idx * 0.03 }}>
                  
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md"
                      style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
                          {idx + 1}
                        </div>
                        {idx < selectedRecipe.instructions!.length - 1 &&
                    <div className="w-0.5 flex-1 mt-2 min-h-[20px]" style={{ background: 'linear-gradient(180deg, var(--a-peach-2), transparent)', opacity: 0.4 }} />
                    }
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-sm leading-relaxed p-3 rounded-xl" style={{ margin: 0, color: 'var(--a-ink)', background: 'var(--a-surface-soft)' }}>{instruction}</p>
                      </div>
                    </motion.div>
                )}
                </div>
              </motion.div>
            }

            {/* Allergy Warning */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl p-4"
              style={{ background: 'var(--a-alert-bg)' }}>
              
              <p className="text-xs text-center" style={{ margin: 0, color: 'var(--a-alert-ink)' }}>
                {tr("recipes_allergiya_xeberdarligi_bal_ciy_7e75e8", "\u26A0\uFE0F Allergiya X\u0259b\u0259rdarl\u0131\u011F\u0131: Bal, \xE7iy\u0259l\u0259k v\u0259 ya f\u0131st\u0131q kimi qidalara allergiyan\u0131z varsa, h\u0259kiminizl\u0259 m\u0259sl\u0259h\u0259tl\u0259\u015Fin.")}
              </p>
            </motion.div>
          </div>
        </ToolPage>
      </div>);

  }

  return (
    <div ref={ref}>
      <AdSurface id="recipes_banner" />
      <ToolPage>
        <ToolHeader
          onBack={onBack}
          eyebrow={tr("recipes_saglam_ve_lezzetli_yemekler_ad49b7", "Sağlam və ləzzətli yeməklər")}
          title={tr("recipes_reseptler_98ed2c", "Reseptl\u0259r")} />

        {/* Premium banner for non-premium users */}
        {!isPremium &&
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="a-card mb-3">
          
            <div className="flex items-center gap-3">
              <span className="a-list-icon" style={{ background: 'var(--a-grad-yellow)', flexShrink: 0 }}>
                <Crown size={17} strokeWidth={2.2} style={{ color: 'var(--a-warn-ink)' }} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="a-list-title" style={{ margin: 0 }}>{tr("recipes_daha_cox_resept_975410", "Daha çox resept?")}</p>
                <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>{tr("recipes_her_kateqoriyadan_3_resept_pulsuzdur_ham_42a43d", "Hər kateqoriyadan 3 resept pulsuzdur. Hamısını görmək üçün Premium-a keçin")}</p>
              </div>
              <Sparkles className="w-5 h-5 animate-pulse flex-shrink-0" style={{ color: 'var(--a-yellow-2)' }} />
            </div>
          </motion.div>
        }

        {/* Search */}
        <AdInlineAnchor id="recipes_banner" />
        <motion.div
          className="a-search mb-3"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}>
          
          <Search size={16} style={{ color: 'var(--a-ink-faint)', flexShrink: 0 }} />
          <input
            value={recipeSearch}
            onChange={(e) => setRecipeSearch(e.target.value)}
            placeholder={tr("untranslated_resept_axtar_8odzsd", "Resept axtar...")} />
          
        </motion.div>

        {/* Categories - Pill style */}
        <motion.div
          className="flex gap-2 overflow-x-auto hide-scrollbar pb-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}>
          
          {recipeCategories.map((category, idx) =>
          <motion.button
            key={category.id}
            onClick={() => setRecipeCategory(category.id)}
            className="flex-shrink-0 px-4 py-2.5 rounded-full flex items-center gap-2 transition-all"
            style={recipeCategory === category.id ?
            { background: 'var(--a-grad-cta)', border: '1px solid var(--a-btn-border)', color: 'var(--a-accent-ink)', boxShadow: 'var(--a-card-shadow)' } :
            { background: 'var(--a-surface)', border: '1px solid var(--a-line)', color: 'var(--a-ink-soft)' }}
            whileTap={{ scale: 0.95 }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 + idx * 0.03 }}>
            
              <span className="text-lg">{category.emoji}</span>
              <span className="text-sm font-bold">{getTranslatedCategoryName(category.id) || category.name}</span>
            </motion.button>
          )}
        </motion.div>

        {/* Recipes Grid */}
        <div>
          {recipesLoading ?
          <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) =>
            <div key={i} className="a-card overflow-hidden animate-pulse" style={{ padding: 0 }}>
                  <div className="h-28" style={{ background: 'var(--a-surface-soft)' }} />
                  <div className="p-3 space-y-2">
                    <div className="h-4 rounded-full w-3/4" style={{ background: 'var(--a-surface-soft)' }} />
                    <div className="h-3 rounded-full w-1/2" style={{ background: 'var(--a-surface-soft)' }} />
                  </div>
                </div>
            )}
            </div> :
          filteredRecipes.length === 0 ?
          <motion.div
            className="a-card text-center"
            style={{ padding: '34px 18px' }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}>
            
              <div className="w-20 h-20 mx-auto mb-4 rounded-3xl flex items-center justify-center" style={{ background: 'var(--a-illus-grad)' }}>
                <UtensilsCrossed className="w-10 h-10" style={{ color: 'var(--a-peach-2)' }} />
              </div>
              <p className="a-list-title" style={{ margin: 0 }}>{tr("recipes_resept_tapilmadi_dde89b", "Resept tapılmadı")}</p>
              <p className="a-list-sub mt-1" style={{ margin: '4px 0 0', whiteSpace: 'normal' }}>{tr("recipes_basqa_kateqoriya_yoxlayin_31917a", "Başqa kateqoriya yoxlayın")}</p>
            </motion.div> :

          <div className="grid grid-cols-2 gap-3">
              {filteredRecipes.map((recipe, index) =>
            <div
              key={recipe.id}
              onClick={() => handleRecipeClick(recipe)}
              className="relative overflow-hidden text-start group cursor-pointer active:scale-[0.98] transition-all rounded-[20px]"
              style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)', boxShadow: 'var(--a-card-shadow)' }}>
              
                  {/* Lock overlay for non-premium non-free recipes */}
                  {!isPremium && !isRecipeFree(recipe) &&
              <div className="absolute inset-0 flex items-center justify-center z-10">
                      {/* Bərk yarımşəffaf örtük (backdrop-blur hər kartda zəif cihazları dondururdu) */}
                      <div className="absolute inset-0" style={{ background: 'var(--a-surface)', opacity: 0.86 }} />
                      <div className="relative flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'var(--a-grad-yellow)' }}>
                          <Lock className="w-5 h-5" style={{ color: 'var(--a-warn-ink)' }} />
                        </div>
                        <span className="text-xs font-bold" style={{ color: 'var(--a-yellow-ink)' }}>Premium</span>
                      </div>
                    </div>
              }
                  
                  {/* Recipe Image/Emoji */}
                  <div className="relative h-28 overflow-hidden">
                    {recipe.image_url ?
                <img
                  src={recipe.image_url}
                  alt={recipe.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> :


                <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--a-illus-grad)' }}>
                        <span className="text-5xl group-hover:scale-110 transition-transform duration-300">{recipe.emoji || '🍽️'}</span>
                      </div>
                }
                    
                    {/* Time badge */}
                    {totalTime(recipe) > 0 &&
                <div className="absolute top-2 start-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {totalTime(recipe)} {tr("recipes_deq_780a5c", "d\u0259q")}
                      </div>
                }

                    {/* Favorite button */}
                    <motion.button
                  onClick={(e) => toggleFavorite(recipe.id, e)}
                  className="absolute top-2 end-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md z-20"
                  style={{ background: 'rgba(255,255,255,0.9)' }}
                  whileTap={{ scale: 0.8 }}>
                  
                      <Heart
                    className="w-3.5 h-3.5"
                    style={favorites.includes(recipe.id) ? { fill: 'var(--a-pink-2)', color: 'var(--a-pink-2)' } : { color: 'var(--a-ink-faint)' }} />
                    </motion.button>
                  </div>

                  <div className="p-3">
                    <h3 className="font-bold text-sm line-clamp-2 mb-1" style={{ color: 'var(--a-ink)' }}>{recipe.title}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' }}>
                        {getTranslatedCategoryName(recipe.category, recipe.categoryLabel)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {!isRecipeFree(recipe) &&
                        <span className="flex items-center gap-0.5 text-[9px] font-bold" style={{ color: 'var(--a-yellow-2)' }}>
                          <Crown className="w-3 h-3" />
                        </span>
                        }
                        {recipe.servings &&
                        <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--a-ink-soft)' }}>
                          <Users className="w-3 h-3" />
                          {recipe.servings}
                        </span>
                        }
                      </div>
                    </div>
                  </div>
                </div>
            )}
            </div>
          }
        </div>

        {/* Recipe count */}
        {!recipesLoading && filteredRecipes.length > 0 &&
        <motion.p
          className="text-center text-xs mt-6"
          style={{ color: 'var(--a-on-bg-soft)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}>
          
            {filteredRecipes.length} {tr("recipes_resept_tapildi_1d8733", "resept tap\u0131ld\u0131")}
          </motion.p>
        }

        {/* Premium Modal */}
        <PremiumModal
          isOpen={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
          feature={tr("recipes_reseptler_98ed2c", "Reseptl\u0259r")} />
        
      </ToolPage>
    </div>);

});

Recipes.displayName = 'Recipes';

export default Recipes;

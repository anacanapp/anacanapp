import { useState, forwardRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Check, AlertTriangle, X, Loader2, Sparkles, Shield, ShieldCheck, ShieldAlert, ShieldX, Zap } from 'lucide-react';
import { useSafetyItems } from '@/hooks/useDynamicContent';
import { useSafetyCategories } from '@/hooks/useDynamicTools';
import { supabase } from '@/integrations/supabase/client';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { ToolPage, ToolHeader, ToolLoading } from './anacan/ToolKit';
import { tr, getPersistedLanguage } from "@/lib/tr";
import MedicalDisclaimer from '@/components/MedicalDisclaimer';

interface SafetyLookupProps {
  onBack: () => void;
}

const SafetyLookup = forwardRef<HTMLDivElement, SafetyLookupProps>(({ onBack }, ref) => {
  useScrollToTop();
  useScreenAnalytics('SafetyLookup', 'Tools');
  const { profile } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { data: safetyItems = [], isLoading } = useSafetyItems();
  const { data: dbCategories = [], isLoading: categoriesLoading } = useSafetyCategories();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const categories = useMemo(() => {
    const allOption = { id: 'all', name: tr("safetylookup_hamisi_c73c4d", "Hamısı"), emoji: '✨' };
    const mapped = dbCategories.
    filter((cat) => cat.category_id !== 'all' && cat.name.toLowerCase() !== tr("safetylookup_hamisi_6dc013", "ham\u0131s\u0131")).
    map((cat) => ({ id: cat.category_id, name: cat.name, emoji: cat.emoji || '📦' }));
    return [allOption, ...mapped];
  }, [dbCategories]);

  const filteredItems = safetyItems.filter((item) => {
    const name = item.name;
    return name.toLowerCase().includes(searchQuery.toLowerCase()) && (
    activeCategory === 'all' || item.category === activeCategory);
  });

  const stats = useMemo(() => ({
    safe: filteredItems.filter((i) => i.safety_level === 'safe').length,
    warning: filteredItems.filter((i) => i.safety_level === 'warning').length,
    danger: filteredItems.filter((i) => i.safety_level === 'danger').length
  }), [filteredItems]);

  // Safety level → anacan palette
  const getStatusConfig = (status: string) => {
    switch (status) {
      // Dark mode düzəlişi: hardcode #14532d/#5a3d00 dark modda uyğun
      // --a-grad-*-in tünd tint-inə qarşı demək olar oxunmurdu.
      case 'safe':return { grad: 'var(--a-grad-green)', soft: 'var(--a-green-1)', ink: 'var(--a-green-ink)', deepInk: 'var(--a-green-ink)', icon: ShieldCheck, label: tr("safetylookup_tehlukesiz_1f31cb", 'Təhlükəsiz'), emoji: '✅' };
      case 'warning':return { grad: 'var(--a-grad-yellow)', soft: 'var(--a-yellow-1)', ink: 'var(--a-warn-ink)', deepInk: 'var(--a-warn-ink)', icon: ShieldAlert, label: tr("safetylookup_ehtiyatli_ba7ebe", 'Ehtiyatlı'), emoji: '⚠️' };
      case 'danger':return { grad: 'var(--a-grad-pink)', soft: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)', deepInk: 'var(--a-alert-ink)', icon: ShieldX, label: tr("safetylookup_tehlukeli_056934", 'Təhlükəli'), emoji: '🚫' };
      default:return { grad: 'linear-gradient(135deg, var(--a-surface-soft), var(--a-line-strong))', soft: 'var(--a-surface-soft)', ink: 'var(--a-ink-soft)', deepInk: 'var(--a-ink)', icon: Shield, label: tr("safetylookup_namelum_134662", 'Naməlum'), emoji: '❓' };
    }
  };

  const handleAISearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      toast({ title: tr("safetylookup_en_azi_2_simvol_yazin_f08b6d", 'Ən azı 2 simvol yazın'), variant: 'destructive' });
      return;
    }
    let userContext: any = { lifeStage: profile?.life_stage };
    if (profile?.life_stage === 'bump' && profile?.last_period_date) {
      const diffDays = Math.floor((Date.now() - new Date(profile.last_period_date).getTime()) / 86400000);
      userContext.pregnancyWeek = Math.floor(diffDays / 7);
    } else if (profile?.life_stage === 'mommy' && profile?.baby_birth_date) {
      const { getRealCalendarAge } = await import('@/lib/pregnancy-utils');
      const age = getRealCalendarAge(profile.baby_birth_date);
      userContext.babyAgeMonths = age.months;
      userContext.babyName = profile.baby_name;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('safety-ai-lookup', {
        body: { query: searchQuery.trim(), category: activeCategory !== 'all' ? activeCategory : undefined, userContext, language: getPersistedLanguage() }
      });
      if (error) throw error;
      if (data?.success && data?.item) {
        await queryClient.invalidateQueries({ queryKey: ['safety_items'] });
        setSelectedItem(data.item);
        toast({ title: tr("safetylookup_ai_ile_tapildi_5c2d49", 'AI ilə tapıldı! ✨'), description: `${data.item.name} ${tr("safety_added_to_database", "bazaya əlavə edildi")}` });
      } else {
        toast({ title: tr("safetylookup_hec_ne_tapilmadi_6a4eca", 'Heç nə tapılmadı'), variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: tr("safetylookup_xeta_bas_verdi_f22fba", 'Xəta baş verdi'), description: error.message, variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  if (isLoading || categoriesLoading) {
    return <ToolLoading />;
  }

  return (
    <div ref={ref}>
      <ToolPage className="overflow-x-hidden">
        <ToolHeader
          onBack={onBack}
          eyebrow={tr("safetylookup_ne_yoxlamaq_isteyirsiniz_33ce31", "Nə yoxlamaq istəyirsiniz?")}
          title={tr("safetylookup_tehlukesizlik_sorgusu_bd80c3", "Təhlükəsizlik Sorğusu")} />

        {/* Search */}
        <div className="a-search mb-3">
          <Search size={16} style={{ color: 'var(--a-ink-faint)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder={tr("safetylookup_ne_yoxlamaq_isteyirsiniz_33ce31", "Nə yoxlamaq istəyirsiniz?")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
          
        </div>

        {/* Medical disclaimer */}
        <MedicalDisclaimer variant="anacan" className="mb-3" />

        {/* Stats inline */}
        <div className="flex gap-1.5 mb-2">
          {[
          { emoji: '✅', count: stats.safe, bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' },
          { emoji: '⚠️', count: stats.warning, bg: 'var(--a-yellow-1)', ink: 'var(--a-warn-ink)' },
          { emoji: '🚫', count: stats.danger, bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' }].
          map((s) =>
          <div key={s.emoji} className="flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: s.bg }}>
              <span className="text-xs">{s.emoji}</span>
              <span className="text-xs font-bold" style={{ color: s.ink }}>{s.count}</span>
            </div>
          )}
        </div>

        {/* Categories */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-3">
          {categories.map((cat) =>
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
            style={activeCategory === cat.id ?
            { background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)', border: '1px solid transparent', cursor: 'pointer' } :
            { background: 'var(--a-surface)', color: 'var(--a-ink-soft)', border: '1px solid var(--a-line)', cursor: 'pointer' }}>
            
              <span className="text-xs">{cat.emoji}</span>
              {cat.name}
            </button>
          )}
        </div>

        {/* Items */}
        <div className="space-y-1.5">
          {filteredItems.map((item) => {
            const cfg = getStatusConfig(item.safety_level);
            const Icon = cfg.icon;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-start"
                style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)', boxShadow: 'var(--a-card-shadow)', cursor: 'pointer' }}>
                
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.grad }}>
                  <Icon className="w-4 h-4" style={{ color: cfg.deepInk }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="a-list-title truncate" style={{ margin: 0 }}>{item.name}</p>
                  <p className="a-list-sub truncate" style={{ margin: 0 }}>{item.description}</p>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: cfg.soft, color: cfg.ink }}>
                  {cfg.label}
                </span>
              </button>);

          })}

          {/* No results + AI */}
          {filteredItems.length === 0 && searchQuery.trim().length >= 2 &&
          <div className="a-card flex flex-col items-center" style={{ padding: '30px 18px' }}>
              <Search className="w-8 h-8 mb-3" style={{ color: 'var(--a-ink-faint)' }} />
              <p className="a-list-title mb-1" style={{ margin: '0 0 4px' }}>{tr("safetylookup_bazada_tapilmadi_1e2889", "Bazada tapılmadı")}</p>
              <p className="a-list-sub mb-4 text-center" style={{ margin: '0 0 16px', whiteSpace: 'normal' }}>"{searchQuery}{tr("safetylookup_ai_ile_axtaris_edin_780816", "\" \u2014 AI il\u0259 axtar\u0131\u015F edin")}</p>
              <button
              onClick={handleAISearch}
              disabled={aiLoading}
              className="a-cta-btn"
              style={{ height: 44, padding: '0 20px', opacity: aiLoading ? 0.6 : 1 }}>
              
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap size={15} strokeWidth={2.2} />}
                {aiLoading ? tr("safetylookup_axtarilir_f0f94f", "Axtar\u0131l\u0131r...") : tr("safetylookup_ai_ile_axtar_01b8df", "AI il\u0259 axtar")}
              </button>
            </div>
          }

          {filteredItems.length === 0 && searchQuery.trim().length < 2 &&
          <div className="a-card flex flex-col items-center" style={{ padding: '30px 18px' }}>
              <Shield className="w-8 h-8 mb-2" style={{ color: 'var(--a-ink-faint)' }} />
              <p className="a-list-sub" style={{ margin: 0 }}>{tr("safetylookup_axtaris_etmeye_baslayin_5447ec", "Axtarış etməyə başlayın")}</p>
            </div>
          }
        </div>

        {/* Detail Modal */}
        <AnimatePresence>
          {selectedItem && (() => {
            const cfg = getStatusConfig(selectedItem.safety_level);
            const Icon = cfg.icon;
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={() => setSelectedItem(null)}>
                
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-sm rounded-[26px] max-h-[80vh] overflow-hidden"
                  style={{ background: 'var(--a-surface)', boxShadow: 'var(--a-card-shadow)' }}>
                  
                  <div className="px-4 py-4 overflow-y-auto max-h-[80vh]">
                    {/* Compact hero */}
                    <div className="flex items-center gap-3 rounded-2xl p-3 mb-3" style={{ background: cfg.grad }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.35)' }}>
                        <Icon className="w-5 h-5" style={{ color: cfg.deepInk }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold truncate a-heading" style={{ margin: 0, color: cfg.deepInk }}>{selectedItem.name}</h2>
                        <span className="text-xs font-semibold" style={{ color: cfg.deepInk, opacity: 0.8 }}>{cfg.emoji} {cfg.label}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="p-3 rounded-2xl mb-2.5" style={{ background: cfg.soft }}>
                      <p className="text-sm leading-relaxed" style={{ margin: 0, color: cfg.ink }}>
                        {selectedItem.description}
                      </p>
                    </div>

                    {/* Tips */}
                    <div className="p-3 rounded-2xl mb-4" style={{ background: 'var(--a-surface-soft)' }}>
                      <h3 className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ margin: '0 0 8px', color: 'var(--a-ink)' }}>
                        <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--a-peach-2)' }} />
                        {tr("safetylookup_tovsiyeler_17a8f7", "T\xF6vsiy\u0259l\u0259r")}
                      </h3>
                      <ul className="space-y-1.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {selectedItem.safety_level === 'safe' &&
                        <>
                            <li className="text-xs flex items-start gap-1.5" style={{ color: 'var(--a-ink-soft)' }}>
                              <Check className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--a-green-2)' }} />
                              {tr("safetylookup_hamilelik_dovrunde_istifade_ed_b320b9", "Hamil\u0259lik d\xF6vr\xFCnd\u0259 istifad\u0259 ed\u0259 bil\u0259rsiniz")}
                            </li>
                            <li className="text-xs flex items-start gap-1.5" style={{ color: 'var(--a-ink-soft)' }}>
                              <Check className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--a-green-2)' }} />
                              {tr("safetylookup_miqdari_normal_saxlayin_f90941", "Miqdar\u0131 normal saxlay\u0131n")}
                            </li>
                          </>
                        }
                        {selectedItem.safety_level === 'warning' &&
                        <>
                            <li className="text-xs flex items-start gap-1.5" style={{ color: 'var(--a-ink-soft)' }}>
                              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--a-yellow-2)' }} />
                              {tr("safetylookup_hekiminizle_meslehetlesin_1366f8", "H\u0259kiminizl\u0259 m\u0259sl\u0259h\u0259tl\u0259\u015Fin")}
                            </li>
                            <li className="text-xs flex items-start gap-1.5" style={{ color: 'var(--a-ink-soft)' }}>
                              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--a-yellow-2)' }} />
                              {tr("safetylookup_miqdari_mehdudlasdirin_9faa97", "Miqdar\u0131 m\u0259hdudla\u015Fd\u0131r\u0131n")}
                            </li>
                          </>
                        }
                        {selectedItem.safety_level === 'danger' &&
                        <>
                            <li className="text-xs flex items-start gap-1.5" style={{ color: 'var(--a-ink-soft)' }}>
                              <X className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--a-pink-2)' }} />
                              {tr("safetylookup_hamilelik_dovrunde_istifade_et_7bc436", "Hamil\u0259lik d\xF6vr\xFCnd\u0259 istifad\u0259 etm\u0259yin")}
                            </li>
                            <li className="text-xs flex items-start gap-1.5" style={{ color: 'var(--a-ink-soft)' }}>
                              <X className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--a-pink-2)' }} />
                              {tr("safetylookup_alternativ_axtarin_7735a0", "Alternativ axtar\u0131n")}
                            </li>
                          </>
                        }
                      </ul>
                    </div>

                    <div className="mb-3">
                      <MedicalDisclaimer variant="anacan" />
                    </div>



                    <button
                      onClick={() => setSelectedItem(null)}
                      className="a-cta-btn w-full"
                      style={{ justifyContent: 'center', height: 44 }}>
                      {tr("safetylookup_bagla_84bdc9", "Ba\u011Fla")}
                    
                    </button>
                  </div>
                </motion.div>
              </motion.div>);

          })()}
        </AnimatePresence>
      </ToolPage>
    </div>);

});

SafetyLookup.displayName = 'SafetyLookup';

export default SafetyLookup;

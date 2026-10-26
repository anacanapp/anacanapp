import { useState, forwardRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Info, ChevronDown, Package, Baby, FileText } from 'lucide-react';
import { useHospitalBag } from '@/hooks/useHospitalBag';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { ToolPage, ToolHeader, ToolLoading } from './anacan/ToolKit';
import { tr } from "@/lib/tr";
import { useUserStore } from '@/store/userStore';
import ModuleArticles from '@/components/blog/ModuleArticles';

interface HospitalBagProps {
  onBack: () => void;
}

const categoryConfig = {
  documents: { label: tr("hospitalbag_senedler_d60b5e", 'Sənədlər'), emoji: '📄', icon: FileText },
  mom: { label: tr("hospitalbag_ana_ucun_8f885e", 'Ana üçün'), emoji: '👩', icon: Package },
  baby: { label: tr("hospitalbag_korpe_ucun_27c058", 'Körpə üçün'), emoji: '👶', icon: Baby },
};

// Priority → anacan palette
const priorityConfig = {
  1: { label: tr("hospitalbag_cox_vacib_c4e66f", 'Çox Vacib'), bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)', dot: '🔴' },
  2: { label: tr("hospitalbag_priority_orta", 'Orta'), bg: 'var(--a-yellow-1)', ink: 'var(--a-warn-ink)', dot: '🟡' },
  3: { label: tr("hospitalbag_i_steye_bagli_43582b", 'İstəyə bağlı'), bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)', dot: '🟢' },
};

const HospitalBag = forwardRef<HTMLDivElement, HospitalBagProps>(({ onBack }, ref) => {
  useScrollToTop();
  useScreenAnalytics('HospitalBag', 'Tools');
  
  const { items, loading, toggleItem, getProgress, checkedCount, totalCount } = useHospitalBag();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const { profile } = useAuth();
  // Siyahının özü (hospital_bag_items) hər istifadəçi üçün TƏK dəst şablon
  // sətirləridir — say sütunu yoxdur. Şablonu əkiz/çoxdöllüyə görə ikiqat/üçqat
  // çoxaltmaq əvəzinə (bu, DB miqrasiyası + mövcud "checked" vəziyyətini poza
  // bilər), sadəcə körpə əşyalarının neçə dəst lazım olduğunu bildirən bir
  // şəffaflıq banneri göstəririk.
  const isMultiple = !!profile?.multiples_type && profile.multiples_type !== 'single';
  const babyCount = Math.max(1, Math.min(4, profile?.baby_count || 1));

  const categories = [
    { id: 'all', label: tr("hospitalbag_hamisi_c73c4d", 'Hamısı'), emoji: '👜' },
    { id: 'documents', label: tr("hospitalbag_senedler_d60b5e", 'Sənədlər'), emoji: '📄' },
    { id: 'mom', label: tr("common_ana", 'Ana'), emoji: '👩' },
    { id: 'baby', label: tr("hospitalbag_korpe_fa2b51", 'Körpə'), emoji: '👶' },
  ];

  const language = useUserStore(state => state.language);

  const filteredItems = activeCategory === 'all' 
    ? items 
    : items.filter(item => item.category === activeCategory);

  const translatedFilteredItems = filteredItems;

  const sortedItems = [...translatedFilteredItems].sort((a, b) => (a.priority || 2) - (b.priority || 2));

  const progress = getProgress();

  // Group items by category for "all" view
  const groupedItems = useMemo(() => {
    if (activeCategory !== 'all') return null;
    const groups: Record<string, typeof items> = {};
    for (const item of sortedItems) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [activeCategory, sortedItems]);

  if (loading) {
    return <ToolLoading />;
  }

  const renderItem = (item: typeof items[0], index: number) => {
    const priority = item.priority || 2;
    const pConfig = priorityConfig[priority as keyof typeof priorityConfig];
    const isExpanded = expandedItem === item.item_id;
    const hasNotes = item.notes && item.notes.trim().length > 0;

    return (
      <motion.div
        key={item.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.25 }}
        className="rounded-2xl overflow-hidden transition-all"
        style={item.is_checked ?
        { background: 'var(--a-green-1)', border: '1px solid transparent' } :
        { background: 'var(--a-surface)', border: '1px solid var(--a-line)', boxShadow: 'var(--a-card-shadow)' }}
      >
        <div 
          className="p-3 flex items-center gap-3 cursor-pointer transition-colors"
          onClick={() => {
            if (hasNotes) {
              setExpandedItem(isExpanded ? null : item.item_id);
            } else {
              toggleItem(item.item_id);
            }
          }}
        >
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              toggleItem(item.item_id);
            }}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
            style={item.is_checked ?
            { background: 'var(--a-green-2)', border: 'none', cursor: 'pointer' } :
            { background: 'none', border: '2px solid var(--a-line-strong)', cursor: 'pointer' }}
            whileTap={{ scale: 0.85 }}
            animate={item.is_checked ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.2 }}
          >
            {item.is_checked && <Check className="w-3.5 h-3.5 text-white" />}
          </motion.button>
          
          <div className="flex-1 min-w-0">
            <span
              className={`font-semibold text-sm transition-all block ${item.is_checked ? 'line-through' : ''}`}
              style={{ color: item.is_checked ? 'var(--a-green-ink)' : 'var(--a-ink)' }}>
              {item.item_name}
            </span>
            {hasNotes && !isExpanded && (
              <p className="text-xs truncate mt-0.5" style={{ margin: '2px 0 0', color: 'var(--a-ink-soft)', opacity: 0.8 }}>
                {item.notes}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: item.is_checked ? 'var(--a-chip-overlay)' : pConfig?.bg, color: pConfig?.ink }}>
              {pConfig?.dot}
            </span>
            {hasNotes && (
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--a-ink-faint)' }} />
              </motion.div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && hasNotes && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 pt-0">
                <div className="flex items-start gap-2 rounded-xl p-2.5" style={{ background: item.is_checked ? 'rgba(255,255,255,0.5)' : 'var(--a-surface-soft)' }}>
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--a-peach-2)' }} />
                  <p className="text-xs leading-relaxed" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>
                    {item.notes}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const renderCategorySection = (catKey: string, catItems: typeof items) => {
    const config = categoryConfig[catKey as keyof typeof categoryConfig];
    if (!config || catItems.length === 0) return null;
    const checkedInCat = catItems.filter(i => i.is_checked).length;

    return (
      <div key={catKey} className="mb-4">
        <div className="a-section-head">
          <span className="a-section-title a-heading" style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="text-base">{config.emoji}</span>
            {config.label}
          </span>
          <span className="a-section-link">
            {checkedInCat}/{catItems.length}
          </span>
        </div>
        <div className="space-y-1.5">
          {catItems.map((item, i) => renderItem(item, i))}
        </div>
      </div>
    );
  };

  return (
    <div ref={ref}>
      <ToolPage>
        <ToolHeader
          onBack={onBack}
          eyebrow={tr("hospitalbag_36_ci_hefteden_hazir_olmalidir_7990d9", "36-cı həftədən hazır olmalıdır")}
          title={tr("hospitalbag_xestexana_cantasi_045078", "Xəstəxana Çantası")}
          actions={
          <span className="a-rank-tag" style={{ margin: 0, background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
              {checkedCount}/{totalCount}
            </span>
          } />

        {/* Progress */}
        <div className="a-card mb-3" style={{ padding: '14px 16px' }}>
          <div className="a-pbar" style={{ marginTop: 0 }}>
            <div className="a-pbar-track">
              <div className="a-pbar-fill" style={{ width: `${Math.max(2, Math.min(100, progress))}%` }} />
            </div>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] font-semibold" style={{ color: 'var(--a-ink-soft)' }}>{tr("hospitalbag_36_ci_hefteden_hazir_olmalidir_7990d9", "36-cı həftədən hazır olmalıdır")}</span>
            <span className="text-[10px] font-bold" style={{ color: 'var(--a-accent-ink)' }}>{progress.toFixed(0)}%</span>
          </div>
        </div>

        {/* Əkiz/çoxdöllü şəffaflıq banneri */}
        {isMultiple && (
          <div className="a-card mb-3 flex items-start gap-2.5" style={{ padding: '12px 14px', background: 'var(--a-blue-1)' }}>
            <span className="text-lg flex-shrink-0">👶👶</span>
            <p className="text-xs leading-relaxed font-semibold" style={{ margin: 0, color: 'var(--a-blue-ink)' }}>
              {tr("hospitalbag_ekiz_banner", "Əkiz/çoxdöllü gözləyirsiniz — 'Körpə üçün' bölməsindəki geyim, bez və s. əşyalarını {n} dəst götürməyi unutmayın.").replace('{n}', String(babyCount))}
            </p>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex gap-1.5 pb-3 overflow-x-auto hide-scrollbar">
          {categories.map((cat) => {
            const catCount = cat.id === 'all' 
              ? items.length 
              : items.filter(i => i.category === cat.id).length;
            const catChecked = cat.id === 'all'
              ? checkedCount
              : items.filter(i => i.category === cat.id && i.is_checked).length;
            
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all"
                style={activeCategory === cat.id ?
                { background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)', border: '1px solid transparent', cursor: 'pointer' } :
                { background: 'var(--a-surface)', color: 'var(--a-ink-soft)', border: '1px solid var(--a-line)', cursor: 'pointer' }}
              >
                <span>{cat.emoji}</span>
                {cat.label}
                <span className="opacity-70">({catChecked}/{catCount})</span>
              </button>
            );
          })}
        </div>

        {/* Priority Legend */}
        <div className="flex gap-3 mb-3 px-1">
          {Object.entries(priorityConfig).map(([key, config]) => (
            <span key={key} className="text-[10px] flex items-center gap-1 font-semibold" style={{ color: 'var(--a-on-bg-soft)' }}>
              {config.dot} {config.label}
            </span>
          ))}
        </div>

        {/* Items */}
        {activeCategory === 'all' && groupedItems ? (
          ['documents', 'mom', 'baby'].map(catKey => 
            groupedItems[catKey] ? renderCategorySection(catKey, groupedItems[catKey]) : null
          )
        ) : (
          <div className="space-y-1.5">
            {sortedItems.map((item, i) => renderItem(item, i))}
          </div>
        )}

        {/* Completion Message */}
        {progress === 100 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[26px] p-4 text-center mt-4"
            style={{ background: 'var(--a-grad-green)', boxShadow: 'var(--a-card-shadow)' }}
          >
            <div className="text-4xl mb-2">🎉</div>
            <h3 className="text-lg font-bold a-heading" style={{ margin: 0, color: 'var(--a-green-ink)' }}>{tr("hospitalbag_tebrik_edirik_ba71c0", "Təbrik edirik!")}</h3>
            <p className="mt-1 text-sm" style={{ margin: '4px 0 0', color: 'var(--a-green-ink)', opacity: 0.85 }}>{tr("hospitalbag_cantaniz_hazirdir_xosbext_dogus_279a30", "Çantanız hazırdır. Xoşbəxt doğuş!")}</p>
          </motion.div>
        )}
        <div className="a-card mt-4"><ModuleArticles module="hospitalBag" /></div>
      </ToolPage>
    </div>
  );
});

HospitalBag.displayName = 'HospitalBag';

export default HospitalBag;

import { useState, forwardRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Info, ChevronDown, Package, Baby, FileText, Plus, Trash2, EyeOff, Eye, User } from 'lucide-react';
import { toast } from 'sonner';
import { useHospitalBag } from '@/hooks/useHospitalBag';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { ToolPage, ToolHeader, ToolLoading } from './anacan/ToolKit';
import { tr, formatTr } from "@/lib/tr";
import { CUSTOM_NAME_MAX, cleanItemName, type BagCategory } from '@/lib/hospital-bag';
import { useUserStore } from '@/store/userStore';
import ModuleArticles from '@/components/blog/ModuleArticles';

interface HospitalBagProps {
  onBack: () => void;
}

const categoryConfig = {
  documents: { label: tr("hospitalbag_senedler_d60b5e", 'Sənədlər'), emoji: '📄', icon: FileText },
  mom: { label: tr("hospitalbag_ana_ucun_8f885e", 'Ana üçün'), emoji: '👩', icon: Package },
  baby: { label: tr("hospitalbag_korpe_ucun_27c058", 'Körpə üçün'), emoji: '👶', icon: Baby },
  partner: { label: tr("p3b_bag_cat_partner", 'Partnyor üçün'), emoji: '🧔', icon: User },
};

const CATEGORY_ORDER: BagCategory[] = ['documents', 'mom', 'baby', 'partner'];

// Priority → anacan palette
const priorityConfig = {
  1: { label: tr("hospitalbag_cox_vacib_c4e66f", 'Çox Vacib'), bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)', dot: '🔴' },
  2: { label: tr("hospitalbag_priority_orta", 'Orta'), bg: 'var(--a-yellow-1)', ink: 'var(--a-warn-ink)', dot: '🟡' },
  3: { label: tr("hospitalbag_i_steye_bagli_43582b", 'İstəyə bağlı'), bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)', dot: '🟢' },
};

import { AptekHomeCard } from '@/components/aptek/AptekEntry';
const HospitalBag = forwardRef<HTMLDivElement, HospitalBagProps>(({ onBack }, ref) => {
  useScrollToTop();
  useScreenAnalytics('HospitalBag', 'Tools');
  
  const { items, hiddenItems, loading, toggleItem, addItem, deleteItem, setHidden, getProgress, checkedCount, totalCount } = useHospitalBag();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<BagCategory>('mom');
  const [saving, setSaving] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const openAdd = () => {
    setNewCategory(activeCategory !== 'all' && activeCategory in categoryConfig ? activeCategory as BagCategory : 'mom');
    setAdding(true);
  };
  const submitAdd = async () => {
    const name = cleanItemName(newName);
    if (!name || saving) return;
    setSaving(true);
    const { error } = await addItem(name, newCategory);
    setSaving(false);
    if (error) {
      toast.error(tr('p3b_bag_add_error', 'Əşya əlavə olunmadı. Yenidən cəhd edin.'));
      return;
    }
    setNewName('');
    setAdding(false);
  };
  const removeItem = async (item: { item_id: string; item_name: string }) => {
    if (!window.confirm(tr('p3b_bag_delete_confirm', 'Bu əşya siyahıdan silinsin?'))) return;
    const { error } = await deleteItem(item.item_id);
    if (error) toast.error(tr('p3b_bag_delete_error', 'Əşya silinmədi. Yenidən cəhd edin.'));
  };
  const hideItem = async (itemId: string, hidden: boolean) => {
    const { error } = await setHidden(itemId, hidden);
    if (error) toast.error(tr('p3b_bag_hide_error', 'Dəyişiklik saxlanmadı. Yenidən cəhd edin.'));
  };
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
    { id: 'partner', label: tr("p3b_bag_tab_partner", 'Partnyor'), emoji: '🧔' },
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
            aria-label={item.item_name}
            aria-pressed={item.is_checked}
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
            {item.custom && item.added_by === 'partner' && (
              <span className="text-[10px] font-semibold block mt-0.5" style={{ color: 'var(--a-ink-faint)' }}>
                {tr('p3b_bag_added_by_partner', 'Partnyor əlavə edib')}
              </span>
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (item.custom) void removeItem(item);
                else void hideItem(item.item_id, true);
              }}
              aria-label={item.custom ? tr('p3b_bag_delete', 'Sil') : tr('p3b_bag_hide', 'Gizlət')}
              title={item.custom ? tr('p3b_bag_delete', 'Sil') : tr('p3b_bag_hide', 'Gizlət')}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-ink-faint)' }}
            >
              {item.custom ? <Trash2 className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
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
          CATEGORY_ORDER.map(catKey => 
            groupedItems[catKey] ? renderCategorySection(catKey, groupedItems[catKey]) : null
          )
        ) : (
          <div className="space-y-1.5">
            {sortedItems.map((item, i) => renderItem(item, i))}
          </div>
        )}

        {/* Own item */}
        {adding ? (
          <div className="a-card mt-3" style={{ padding: '14px 16px' }}>
            <form onSubmit={(e) => { e.preventDefault(); void submitAdd(); }}>
              <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--a-ink-soft)' }} htmlFor="bag-new-item">
                {tr('p3b_bag_new_item', 'Öz əşyanız')}
              </label>
              <input
                id="bag-new-item"
                className="a-input w-full"
                value={newName}
                maxLength={CUSTOM_NAME_MAX}
                placeholder={tr('p3b_bag_new_item_ph', 'Məsələn: telefon şarj cihazı')}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-1.5 mt-2.5 flex-wrap" role="group" aria-label={tr('p3b_bag_category', 'Kateqoriya')}>
                {CATEGORY_ORDER.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={newCategory === cat}
                    onClick={() => setNewCategory(cat)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={newCategory === cat ?
                    { background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)', border: '1px solid transparent', cursor: 'pointer' } :
                    { background: 'var(--a-surface)', color: 'var(--a-ink-soft)', border: '1px solid var(--a-line)', cursor: 'pointer' }}
                  >
                    <span>{categoryConfig[cat].emoji}</span>{categoryConfig[cat].label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button type="submit" className="a-btn-solid" disabled={!cleanItemName(newName) || saving} style={{ opacity: !cleanItemName(newName) || saving ? 0.6 : 1 }}>
                  <Plus className="w-3.5 h-3.5" />{tr('p3b_bag_add', 'Əlavə et')}
                </button>
                <button type="button" className="a-btn-soft" onClick={() => { setAdding(false); setNewName(''); }}>
                  {tr('p3b_bag_cancel', 'Ləğv et')}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button type="button" className="a-btn-soft w-full mt-3" style={{ justifyContent: 'center' }} onClick={openAdd}>
            <Plus className="w-3.5 h-3.5" />{tr('p3b_bag_add_own', 'Öz əşyanızı əlavə edin')}
          </button>
        )}

        {/* Hidden default items */}
        {hiddenItems.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              aria-expanded={showHidden}
              className="text-xs font-bold flex items-center gap-1.5 px-1"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-on-bg-soft)' }}
            >
              <EyeOff className="w-3.5 h-3.5" />
              {formatTr('p3b_bag_hidden_n', 'Gizlədilənlər ({n})', { n: hiddenItems.length })}
              <ChevronDown className="w-3.5 h-3.5" style={{ transform: showHidden ? 'rotate(180deg)' : undefined }} />
            </button>
            {showHidden && (
              <div className="space-y-1.5 mt-2">
                {hiddenItems.map((item) => (
                  <div key={item.id} className="rounded-2xl p-3 flex items-center gap-3" style={{ background: 'var(--a-surface-soft)', border: '1px solid var(--a-line)' }}>
                    <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: 'var(--a-ink-soft)' }}>{item.item_name}</span>
                    <button type="button" className="a-btn-soft" style={{ padding: '6px 12px' }} onClick={() => void hideItem(item.item_id, false)}>
                      <Eye className="w-3.5 h-3.5" />{tr('p3b_bag_show', 'Göstər')}
                    </button>
                  </div>
                ))}
              </div>
            )}
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
        <div className="a-scope" style={{ marginTop: 4 }}><AptekHomeCard stage="bump" context="bag" /></div>
        <div className="a-card mt-4"><ModuleArticles module="hospitalBag" /></div>
      </ToolPage>
    </div>
  );
});

HospitalBag.displayName = 'HospitalBag';

export default HospitalBag;

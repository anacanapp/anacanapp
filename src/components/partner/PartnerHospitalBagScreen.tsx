import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Package,
  Baby,
  FileText,
  Check,
  Plus,
  RefreshCw,
  User,
  Trash2,
  EyeOff,
  Eye,
  ChevronDown } from
'lucide-react';
import { toast } from 'sonner';
import { usePartnerHospitalBag, type PartnerHospitalBagItem } from '@/hooks/usePartnerHospitalBag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { tr, formatTr, mapRowsTranslation } from "@/lib/tr";
import { CUSTOM_NAME_MAX, cleanItemName, type BagCategory } from '@/lib/hospital-bag';
import { useUserStore } from '@/store/userStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger } from
'@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
'@/components/ui/select';

interface PartnerHospitalBagScreenProps {
  onBack: () => void;
}

const CATEGORY_ORDER: BagCategory[] = ['mom', 'baby', 'documents', 'partner'];

const categoryIcons: Record<BagCategory, typeof Package> = {
  mom: Package,
  baby: Baby,
  documents: FileText,
  partner: User
};

/** The real group of an item ('partner' included); `category` folds 'partner' into 'mom' for older callers. */
const groupOf = (item: PartnerHospitalBagItem): BagCategory => item.bag_category ?? item.category;

const PartnerHospitalBagScreen: React.FC<PartnerHospitalBagScreenProps> = ({ onBack }) => {
  const bag = usePartnerHospitalBag();
  const {
    items,
    loading,
    toggleItem,
    addItem,
    deleteItem,
    setHidden,
    getProgress,
    checkedCount,
    totalCount
  } = bag;

  // Hidden default items: from `hiddenItems` when the hook exposes it, and any `hidden` rows in `items`.
  const exposedHidden = ('hiddenItems' in bag && Array.isArray(bag.hiddenItems) ? bag.hiddenItems : []) as PartnerHospitalBagItem[];
  const visibleRaw = items.filter((i) => !i.hidden);
  const hiddenRaw = [...exposedHidden, ...items.filter((i) => i.hidden && !exposedHidden.some((h) => h.id === i.id))];

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<BagCategory>('mom');
  const [activeCategory, setActiveCategory] = useState<BagCategory>('mom');
  const [saving, setSaving] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const language = useUserStore((state) => state.language);

  // Add translated fields map for the items array
  const translatedItems = mapRowsTranslation(visibleRaw, language, ['item_name', 'notes']);
  const translatedHidden = mapRowsTranslation(hiddenRaw, language, ['item_name', 'notes']);

  const openAddDialog = (open: boolean) => {
    if (open) setNewItemCategory(activeCategory);
    else setNewItemName('');
    setShowAddDialog(open);
  };

  const handleAddItem = async () => {
    const name = cleanItemName(newItemName);
    if (!name || saving) return;
    setSaving(true);
    const { error } = await addItem(name, newItemCategory);
    setSaving(false);
    if (error) {
      toast.error(tr('p3b_bag_add_error', 'Əşya əlavə olunmadı. Yenidən cəhd edin.'));
      return;
    }
    setActiveCategory(newItemCategory);
    setNewItemName('');
    setShowAddDialog(false);
  };

  const removeItem = async (item: PartnerHospitalBagItem) => {
    if (!window.confirm(tr('p3b_bag_delete_confirm', 'Bu əşya siyahıdan silinsin?'))) return;
    const { error } = await deleteItem(item.item_id);
    if (error) toast.error(tr('p3b_bag_delete_error', 'Əşya silinmədi. Yenidən cəhd edin.'));
  };

  const hideItem = async (itemId: string, hidden: boolean) => {
    const { error } = await setHidden(itemId, hidden);
    if (error) toast.error(tr('p3b_bag_hide_error', 'Dəyişiklik saxlanmadı. Yenidən cəhd edin.'));
  };

  const categoryLabels: Record<BagCategory, string> = {
    mom: tr("partnerhospitalbagscreen_ana_ucun_8f885e", "Ana \xFC\xE7\xFCn"),
    baby: tr("partnerhospitalbagscreen_korpe_ucun_27c058", "K\xF6rpə \xFC\xE7\xFCn"),
    documents: tr("partnerhospitalbagscreen_senedler_d60b5e", "Sənədlər"),
    partner: tr("p3b_bag_tab_partner", "Partnyor")
  };

  if (loading) {
    return (
      <div className="a-scope min-h-screen flex items-center justify-center overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--a-blue-2)' }} />
      </div>);

  }

  if (visibleRaw.length === 0 && hiddenRaw.length === 0) {
    return (
      <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
        <div className="a-shell">
          <header className="a-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr("common_geri", "Geri")}>
                <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
              </motion.button>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("partnerhospitalbagscreen_xestexana_cantasi_045078", "Xəstəxana Çantası")}</p>
            </div>
          </header>

          <div className="a-card" style={{ textAlign: 'center', padding: '38px 18px' }}>
            <div className="mx-auto mb-4 flex items-center justify-center"
            style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--a-surface-soft)' }}>
              <Package size={26} style={{ color: 'var(--a-ink-faint)' }} />
            </div>
            <h3 className="a-list-title" style={{ marginBottom: 4 }}>
              {tr("partnerhospitalbagscreen_partnyorunuz_hele_canta_hazirl_1f9cce", "Partnyorunuz hələ \xE7anta hazırlamayıb")}
            </h3>
            <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>
              {tr("partnerhospitalbagscreen_partnyorunuz_xestexana_cantasi_f29448", "Partnyorunuz xəstəxana \xE7antası siyahısı yaratdıqda burada g\xF6rəcəksiniz")}
            </p>
          </div>
        </div>
      </div>);

  }

  const activeItems = translatedItems.filter((i) => groupOf(i) === activeCategory);
  const progress = getProgress();
  const canSubmit = !!cleanItemName(newItemName) && !saving;

  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr("common_geri", "Geri")}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("partnerhospitalbagscreen_xestexana_cantasi_045078", "Xəstəxana Çantası")}</p>
          </div>
          <div className="a-topbar-actions">
            <Dialog open={showAddDialog} onOpenChange={openAddDialog}>
              <DialogTrigger asChild>
                <motion.button className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr("partnerhospitalbagscreen_esya_elave_et_79e28e", "Əşya əlavə et")}>
                  <Plus size={16} strokeWidth={2} />
                </motion.button>
              </DialogTrigger>
              <DialogContent className="a-scope rounded-[22px]">
                <DialogHeader>
                  <DialogTitle style={{ color: 'var(--a-ink)' }}>{tr("partnerhospitalbagscreen_esya_elave_et_79e28e", "Əşya əlavə et")}</DialogTitle>
                </DialogHeader>
                <form className="space-y-4 pt-4" onSubmit={(e) => { e.preventDefault(); void handleAddItem(); }}>
                  <Input
                    className="h-11 rounded-xl"
                    style={{ background: 'var(--a-surface)', borderColor: 'var(--a-line-strong)', color: 'var(--a-ink)' }}
                    aria-label={tr('p3b_bag_new_item', 'Öz əşyanız')}
                    placeholder={tr('p3b_bag_new_item_ph', 'Məsələn: telefon şarj cihazı')}
                    maxLength={CUSTOM_NAME_MAX}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)} />

                  <Select
                    value={newItemCategory}
                    onValueChange={(v) => setNewItemCategory(v as BagCategory)}>

                    <SelectTrigger
                      className="h-11 rounded-xl"
                      aria-label={tr('p3b_bag_category', 'Kateqoriya')}
                      style={{ background: 'var(--a-surface)', borderColor: 'var(--a-line-strong)', color: 'var(--a-ink)' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="a-scope">
                      <SelectItem value="mom">{tr("partnerhospitalbagscreen_ana_ucun_8f885e", "Ana üçün")}</SelectItem>
                      <SelectItem value="baby">{tr("partnerhospitalbagscreen_korpe_ucun_27c058", "Körpə üçün")}</SelectItem>
                      <SelectItem value="documents">{tr("partnerhospitalbagscreen_senedler_d60b5e", "Sənədlər")}</SelectItem>
                      <SelectItem value="partner">{tr("p3b_bag_cat_partner", "Partnyor üçün")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="submit"
                    className="w-full rounded-full text-white border-0 hover:opacity-95"
                    style={{ background: 'var(--a-peach-2)' }}
                    disabled={!canSubmit}>

                    <Plus className="w-4 h-4 me-2" />
                    {tr("partnerhospitalbagscreen_elave_et_6e1b9b", "Əlavə et")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* Progress (visible items only) */}
        <div className="a-card" style={{ marginBottom: 14 }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--a-ink)' }}>{tr("partnerhospitalbagscreen_hazirliq_23905c", "Hazırlıq")}</span>
            <span style={{ fontSize: 12.5, color: 'var(--a-ink-soft)' }}>
              {checkedCount} / {totalCount}
            </span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--a-surface-soft)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--a-grad-peach)' }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }} />
          </div>
          <p className="mt-2 text-center" style={{ fontSize: 11.5, color: 'var(--a-ink-soft)' }}>
            {progress.toFixed(0)}{tr("partnerhospitalbagscreen_tamamlandi_357fc9", "% tamamlandı")}
          </p>
        </div>

        {/* Category tabs */}
        <div className="a-tabs" role="tablist" style={{ marginBottom: 14 }}>
          {CATEGORY_ORDER.map((category) => {
            const Icon = categoryIcons[category];
            const inCat = translatedItems.filter((i) => groupOf(i) === category);
            const checkedInCat = inCat.filter((i) => i.is_checked).length;
            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={activeCategory === category}
                onClick={() => setActiveCategory(category)}
                className={`a-tab ${activeCategory === category ? 'active' : ''}`}>
                <span className="inline-flex items-center gap-1.5">
                  <Icon size={13} />
                  {categoryLabels[category]}
                  <span className="opacity-70">({checkedInCat}/{inCat.length})</span>
                </span>
              </button>);

          })}
        </div>

        {/* Items */}
        <div className="space-y-2">
          <AnimatePresence>
            {activeItems.map((item, index) =>
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: Math.min(index * 0.05, 0.3) }}
              className="flex items-center gap-2 transition-all"
              style={{
                padding: '6px 8px 6px 6px',
                borderRadius: 16,
                background: item.is_checked ? 'var(--a-green-1)' : 'var(--a-surface)',
                boxShadow: item.is_checked ? 'none' : 'var(--a-card-shadow)'
              }}>

                <button
                type="button"
                onClick={() => void toggleItem(item.item_id)}
                aria-pressed={item.is_checked}
                className="flex flex-1 min-w-0 items-center gap-3 text-start"
                style={{ padding: 9, background: 'none', border: 'none', cursor: 'pointer' }}>

                  <span
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0"
                  style={{
                    background: item.is_checked ? 'var(--a-green-2)' : 'transparent',
                    border: item.is_checked ? 'none' : '2px solid var(--a-ink-faint)'
                  }}>

                    {item.is_checked && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                  </span>
                  <span
                  className={`flex-1 min-w-0 ${item.is_checked ? 'line-through' : ''}`}
                  style={{ fontSize: 13.5, fontWeight: 600, color: item.is_checked ? 'var(--a-ink-soft)' : 'var(--a-ink)', overflowWrap: 'anywhere' }}>

                    {item.item_name}
                  </span>
                  {item.added_by === 'partner' &&
                <span className="inline-flex items-center shrink-0"
                style={{ background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)', borderRadius: 999, padding: '3px 9px', fontSize: 10.5, fontWeight: 700 }}>
                      <User className="w-3 h-3 me-1" />
                      {tr("partnerhospitalbagscreen_sen_0580e7", "Sən")}
                    </span>
                }
                </button>
                <button
                type="button"
                onClick={() => {
                  if (item.custom) void removeItem(item);
                  else void hideItem(item.item_id, true);
                }}
                aria-label={`${item.custom ? tr('p3b_bag_delete', 'Sil') : tr('p3b_bag_hide', 'Gizlət')}: ${item.item_name}`}
                title={item.custom ? tr('p3b_bag_delete', 'Sil') : tr('p3b_bag_hide', 'Gizlət')}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-ink-faint)' }}>

                  {item.custom ? <Trash2 className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {activeItems.length === 0 &&
          <div className="a-card text-center" style={{ padding: '28px 18px' }}>
              <p style={{ fontSize: 13, color: 'var(--a-ink-soft)' }}>
                {tr("partnerhospitalbagscreen_bu_kateqoriyada_esya_yoxdur_f91aa7", "Bu kateqoriyada əşya yoxdur")}
              </p>
            </div>
          }
        </div>

        {/* Own item */}
        <button type="button" className="a-btn-soft w-full mt-3" style={{ justifyContent: 'center' }} onClick={() => openAddDialog(true)}>
          <Plus className="w-3.5 h-3.5" />{tr('p3b_bag_add_own', 'Öz əşyanızı əlavə edin')}
        </button>

        {/* Hidden default items */}
        {translatedHidden.length > 0 &&
        <div className="mt-3">
            <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            aria-expanded={showHidden}
            className="text-xs font-bold flex items-center gap-1.5 px-1"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-on-bg-soft)' }}>

              <EyeOff className="w-3.5 h-3.5" />
              {formatTr('p3b_bag_hidden_n', 'Gizlədilənlər ({n})', { n: translatedHidden.length })}
              <ChevronDown className="w-3.5 h-3.5" style={{ transform: showHidden ? 'rotate(180deg)' : undefined }} />
            </button>
            {showHidden &&
          <div className="space-y-1.5 mt-2">
                {translatedHidden.map((item) =>
            <div key={item.id} className="rounded-2xl p-3 flex items-center gap-3" style={{ background: 'var(--a-surface-soft)', border: '1px solid var(--a-line)' }}>
                    <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: 'var(--a-ink-soft)' }}>{item.item_name}</span>
                    <button
                type="button"
                className="a-btn-soft"
                style={{ padding: '6px 12px' }}
                aria-label={`${tr('p3b_bag_show', 'Göstər')}: ${item.item_name}`}
                onClick={() => void hideItem(item.item_id, false)}>
                      <Eye className="w-3.5 h-3.5" />{tr('p3b_bag_show', 'Göstər')}
                    </button>
                  </div>
            )}
              </div>
          }
          </div>
        }
      </div>
    </div>);

};

export default PartnerHospitalBagScreen;

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
  User } from
'lucide-react';
import { usePartnerHospitalBag } from '@/hooks/usePartnerHospitalBag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { tr, mapRowsTranslation } from "@/lib/tr";
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

const PartnerHospitalBagScreen: React.FC<PartnerHospitalBagScreenProps> = ({ onBack }) => {
  const {
    items,
    loading,
    toggleItem,
    addItem,
    getProgress,
    checkedCount,
    totalCount,
    refetch
  } = usePartnerHospitalBag();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<'mom' | 'baby' | 'documents'>('mom');
  const [activeCategory, setActiveCategory] = useState<'mom' | 'baby' | 'documents'>('mom');

  const language = useUserStore(state => state.language);

  // Add translated fields map for the items array
  const translatedItems = mapRowsTranslation(items, language, ['item_name', 'notes']);

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;

    await addItem(newItemName.trim(), newItemCategory);
    setNewItemName('');
    setShowAddDialog(false);
  };

  const categoryIcons = {
    mom: Package,
    baby: Baby,
    documents: FileText
  };

  const categoryLabels = {
    mom: tr("partnerhospitalbagscreen_ana_ucun_8f885e", "Ana \xFC\xE7\xFCn"),
    baby: tr("partnerhospitalbagscreen_korpe_ucun_27c058", "K\xF6rp\u0259 \xFC\xE7\xFCn"),
    documents: tr("partnerhospitalbagscreen_senedler_d60b5e", "S\u0259n\u0259dl\u0259r")
  };

  if (loading) {
    return (
      <div className="a-scope min-h-screen flex items-center justify-center overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--a-blue-2)' }} />
      </div>);

  }

  if (items.length === 0) {
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
              {tr("partnerhospitalbagscreen_partnyorunuz_hele_canta_hazirl_1f9cce", "Partnyorunuz h\u0259l\u0259 \xE7anta haz\u0131rlamay\u0131b")}
            </h3>
            <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>
              {tr("partnerhospitalbagscreen_partnyorunuz_xestexana_cantasi_f29448", "Partnyorunuz x\u0259st\u0259xana \xE7antas\u0131 siyah\u0131s\u0131 yaratd\u0131qda burada g\xF6r\u0259c\u0259ksiniz")}
            </p>
          </div>
        </div>
      </div>);

  }

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
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <motion.button className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr("partnerhospitalbagscreen_esya_elave_et_79e28e", "Əşya əlavə et")}>
                  <Plus size={16} strokeWidth={2} />
                </motion.button>
              </DialogTrigger>
              <DialogContent className="a-scope rounded-[22px]">
                <DialogHeader>
                  <DialogTitle style={{ color: 'var(--a-ink)' }}>{tr("partnerhospitalbagscreen_esya_elave_et_79e28e", "Əşya əlavə et")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    className="h-11 rounded-xl"
                    style={{ background: 'var(--a-surface)', borderColor: 'var(--a-line-strong)', color: 'var(--a-ink)' }}
                    placeholder={tr("partnerhospitalbagscreen_esya_adi_176586", "Əşya adı")}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)} />

                  <Select
                    value={newItemCategory}
                    onValueChange={(v) => setNewItemCategory(v as 'mom' | 'baby' | 'documents')}>

                    <SelectTrigger className="h-11 rounded-xl" style={{ background: 'var(--a-surface)', borderColor: 'var(--a-line-strong)', color: 'var(--a-ink)' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="a-scope">
                      <SelectItem value="mom">{tr("partnerhospitalbagscreen_ana_ucun_8f885e", "Ana üçün")}</SelectItem>
                      <SelectItem value="baby">{tr("partnerhospitalbagscreen_korpe_ucun_27c058", "Körpə üçün")}</SelectItem>
                      <SelectItem value="documents">{tr("partnerhospitalbagscreen_senedler_d60b5e", "Sənədlər")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full rounded-full text-white border-0 hover:opacity-95"
                    style={{ background: 'var(--a-peach-2)' }}
                    onClick={handleAddItem}
                    disabled={!newItemName.trim()}>

                    <Plus className="w-4 h-4 me-2" />
                    {tr("partnerhospitalbagscreen_elave_et_6e1b9b", "\u018Flav\u0259 et")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* Progress */}
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
              animate={{ width: `${getProgress()}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }} />
          </div>
          <p className="mt-2 text-center" style={{ fontSize: 11.5, color: 'var(--a-ink-soft)' }}>
            {getProgress().toFixed(0)}{tr("partnerhospitalbagscreen_tamamlandi_357fc9", "% tamamland\u0131")}
          </p>
        </div>

        {/* Category tabs */}
        <div className="a-tabs" style={{ marginBottom: 14 }}>
          {(['mom', 'baby', 'documents'] as const).map((category) => {
            const Icon = categoryIcons[category];
            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`a-tab ${activeCategory === category ? 'active' : ''}`}>
                <span className="inline-flex items-center gap-1.5">
                  <Icon size={13} />
                  {categoryLabels[category]}
                </span>
              </button>);

          })}
        </div>

        {/* Items */}
        <div className="space-y-2">
          <AnimatePresence>
            {translatedItems.filter((i) => i.category === activeCategory).map((item, index) =>
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => toggleItem(item.item_id)}
              className="flex items-center gap-3 cursor-pointer transition-all"
              style={{
                padding: 15,
                borderRadius: 16,
                background: item.is_checked ? 'var(--a-green-1)' : 'var(--a-surface)',
                boxShadow: item.is_checked ? 'none' : 'var(--a-card-shadow)'
              }}>

                <div
                className="w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0"
                style={{
                  background: item.is_checked ? 'var(--a-green-2)' : 'transparent',
                  border: item.is_checked ? 'none' : '2px solid var(--a-ink-faint)'
                }}>

                  {item.is_checked && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </div>
                <span
                className={`flex-1 ${item.is_checked ? 'line-through' : ''}`}
                style={{ fontSize: 13.5, fontWeight: 600, color: item.is_checked ? 'var(--a-ink-soft)' : 'var(--a-ink)' }}>

                  {item.item_name}
                </span>
                {item.added_by === 'partner' &&
              <span className="inline-flex items-center shrink-0"
              style={{ background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)', borderRadius: 999, padding: '3px 9px', fontSize: 10.5, fontWeight: 700 }}>
                    <User className="w-3 h-3 me-1" />
                    {tr("partnerhospitalbagscreen_sen_0580e7", "S\u0259n")}
                  </span>
              }
              </motion.div>
            )}
          </AnimatePresence>

          {translatedItems.filter((i) => i.category === activeCategory).length === 0 &&
          <div className="a-card text-center" style={{ padding: '28px 18px' }}>
              <p style={{ fontSize: 13, color: 'var(--a-ink-soft)' }}>
                {tr("partnerhospitalbagscreen_bu_kateqoriyada_esya_yoxdur_f91aa7", "Bu kateqoriyada \u0259\u015Fya yoxdur")}
              </p>
            </div>
          }
        </div>
      </div>
    </div>);

};

export default PartnerHospitalBagScreen;
